import { listMovements } from '../repositories/analytics.repository.js';
import * as sourcesRepo from '../repositories/income-sources.repository.js';
import * as profileRepo from '../repositories/money-profile.repository.js';
import { daysInMonth, shiftMonth } from './analytics.service.js';
import {
  SOCIAL_SECURITY,
  cushionGoal,
  expectedIncomeFor,
  hasVariableIncome,
  isIndependent,
  isLargeIncome,
  legacyIncomeType,
  monthlyIncome,
  ownSalary,
  socialSecurity,
  splitIncome,
  workDayGoal,
} from './income.logic.js';
import { todayIso } from './insights.service.js';
import { getPlan, pendingCommitments } from './money-plan.service.js';
import { list as listVacas } from './vacas.service.js';

/** El colchón es una meta personal con este nombre: así reutiliza la barra, los aportes y el saldo. */
export const CUSHION_NAME = 'Colchón para meses flacos';
const isCushion = (meta) => /^colch[oó]n/i.test(meta.name);

const sum = (values) => values.reduce((acc, v) => acc + v, 0);

/**
 * @param {object} [deps] Dependencias reemplazables en las pruebas.
 * @param {() => Date} [deps.now]
 * @returns {{ getIncome: (userId: string) => Promise<object>, split: (userId: string, amount: number) => Promise<object>, expectedIncome: (userId: string, from: string, to: string) => Promise<object[]>, saveSources: (userId: string, sources: object[]) => Promise<object> }}
 */
export function createIncomeService(deps = {}) {
  const now = deps.now ?? (() => new Date());

  /**
   * Todo lo que necesitan el resumen y el reparto, en una sola ida a la base.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async function load(userId) {
    const today = todayIso(now());
    const month = today.slice(0, 7);
    const [sources, history, plan, commitments, monthMovements, metas] = await Promise.all([
      sourcesRepo.listSources(userId),
      sourcesRepo.monthlyIncomeHistory(userId, month),
      getPlan(userId),
      profileRepo.listCommitments(userId),
      listMovements(userId, { from: `${month}-01`, to: today }),
      listVacas(userId, true),
    ]);
    const income = monthlyIncome({ sources, history });
    const variable = hasVariableIncome(sources);
    const commitmentsTotal = sum(commitments.map((c) => c.amount));
    const pace = plan.ready ? plan.pace : null;
    const meta = metas.find(isCushion);
    const goal = cushionGoal({ commitments: commitmentsTotal, pace, variable });
    const incomes = monthMovements.filter((m) => m.type === 'ingreso');
    return {
      today,
      month,
      sources,
      income,
      variable,
      independent: isIndependent(sources),
      salary: ownSalary({ sources, lean: income.lean }),
      commitments,
      commitmentsTotal,
      pace,
      expenses: monthMovements.filter((m) => m.type === 'gasto'),
      monthIncome: sum(incomes.map((m) => m.amount)),
      todayIncome: sum(incomes.filter((m) => m.date === today).map((m) => m.amount)),
      cushion: { goal: meta?.goal ?? goal, suggestedGoal: goal, saved: meta?.total ?? 0, metaId: meta?.id ?? null },
    };
  }

  /**
   * `GET /money-profile/income`: cómo le entra la plata al usuario (FT-0060).
   * @param {string} userId
   * @returns {Promise<object>} Ver `docs/api/openapi.yaml`.
   */
  async function getIncome(userId) {
    const data = await load(userId);
    const { income, sources, today } = data;
    const daily = sources.find((s) => s.kind === 'diario' && s.workDays > 0);
    let workDay = null;
    if (daily) {
      // Lo que necesita el mes: pagos + gasto normal. Sin ritmo todavía, lo que suele hacer.
      const target = data.pace !== null ? data.commitmentsTotal + data.pace * daysInMonth(data.month) : income.normal;
      workDay = workDayGoal({ target, earned: data.monthIncome, todayIncome: data.todayIncome, today, workDays: daily.workDays });
    }
    return {
      sources,
      normal: income.normal,
      lean: income.lean,
      fixed: income.fixed,
      basis: income.basis,
      estimated: income.estimated,
      variable: data.variable,
      independent: data.independent,
      ownSalary: data.salary,
      cushion: data.cushion,
      socialSecurity: data.independent && income.normal > 0 ? { ...socialSecurity(income.normal), smmlv: SOCIAL_SECURITY.smmlv } : null,
      workDay,
    };
  }

  /**
   * `GET /money-profile/income/split?amount=`: cómo repartir un ingreso que ya se registró.
   * @param {string} userId
   * @param {number} amount
   * @returns {Promise<object>}
   */
  async function split(userId, amount) {
    const data = await load(userId);
    const nextMonth = `${shiftMonth(data.month, 1)}-01`;
    const pending = sum(
      pendingCommitments({ commitments: data.commitments, expenses: data.expenses, today: data.today, until: nextMonth }).map((p) => p.amount),
    );
    // Lo que ya había entrado este mes (sin este ingreso) cubre primero los pagos y luego el sueldo.
    const before = Math.max(0, data.monthIncome - amount);
    const remainingNeed = Math.max(0, data.commitmentsTotal + (data.salary ?? 0) - before);
    const salaryLeft = data.salary === null ? 0 : Math.max(0, remainingNeed - pending);
    return {
      amount,
      large: isLargeIncome({ amount, pace: data.pace }) && data.variable,
      ownSalary: data.salary,
      ...splitIncome({
        amount,
        pendingCommitments: pending,
        salaryLeft,
        cushionGap: Math.max(0, data.cushion.goal - data.cushion.saved),
        independent: data.independent,
      }),
      // `cushion` (arriba) es cuánto va al colchón; esto es cómo va el colchón.
      cushionStatus: data.cushion,
    };
  }

  /**
   * Contrato con el motor de liquidez (FT-0059): plata que se espera entre dos fechas (incluidas).
   * Lo fijo va con `sure: true`; lo variable con el valor del mes flaco y `sure: false` (o sin fecha).
   * La proyección debe mostrarlo como "esperado", nunca como plata que ya está.
   * @param {string} userId
   * @param {string} from AAAA-MM-DD
   * @param {string} to AAAA-MM-DD
   * @returns {Promise<Array<{ date: string|null, amount: number, sourceId: string, sure: boolean }>>}
   */
  async function expectedIncome(userId, from, to) {
    return expectedIncomeFor({ sources: await sourcesRepo.listSources(userId), from, to });
  }

  /**
   * `PUT /money-profile/sources`: reemplaza las fuentes y mantiene `tipo_ingreso` al día.
   * @param {string} userId
   * @param {import('./income.logic.js').IncomeSource[]} sources
   * @returns {Promise<object>} El resumen nuevo.
   */
  async function saveSources(userId, sources) {
    await sourcesRepo.replaceSources(userId, sources, legacyIncomeType(sources));
    return getIncome(userId);
  }

  return { getIncome, split, expectedIncome, saveSources };
}

export const { getIncome, split, expectedIncome, saveSources } = createIncomeService();
