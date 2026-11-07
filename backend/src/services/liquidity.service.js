import { listMovements } from '../repositories/analytics.repository.js';
import * as repo from '../repositories/money-profile.repository.js';
import { daysInMonth } from './analytics.service.js';
import { list as listCards } from './cards.service.js';
import { list as listDebts } from './debts.service.js';
import { todayIso } from './insights.service.js';
import { addDays, monthlyOutflows, projectLiquidity } from './liquidity.logic.js';
import { getPlan, isPaymentOf } from './money-plan.service.js';
import { list as listVacas } from './vacas.service.js';

/** Días que se proyectan si no se piden otros. */
export const DEFAULT_DAYS = 45;
export const MAX_DAYS = 90;

const money = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});

/**
 * @param {string} from AAAA-MM-DD
 * @param {string} to AAAA-MM-DD
 * @returns {number} Días entre las dos fechas.
 */
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * @param {object} [deps] Dependencias reemplazables en las pruebas.
 * @param {() => Date} [deps.now]
 * @returns {{ getLiquidity: (userId: string, days?: number) => Promise<object> }}
 */
export function createLiquidityService(deps = {}) {
  const now = deps.now ?? (() => new Date());

  /**
   * Proyección de la plata del usuario (FT-0059). Toma la plata de hoy y el gasto normal de Mi
   * plata y resta compromisos, tarjetas, vacas y cuentas por pagar con fecha. Es conservadora: no
   * cuenta ingresos futuros ni lo que le deben. Con fecha fija de pago proyecta hasta la víspera
   * del próximo pago (después entra plata que no sabemos cuánto es).
   * @param {string} userId
   * @param {number} [requestedDays]
   * @returns {Promise<object>} `{ ready: false }` si Mi plata no está configurada.
   */
  async function getLiquidity(userId, requestedDays = DEFAULT_DAYS) {
    const today = todayIso(now());
    const month = today.slice(0, 7);
    const [plan, profile, commitments, monthMovements, vacas, cardList, debts] = await Promise.all([
      getPlan(userId),
      repo.findProfile(userId),
      repo.listCommitments(userId),
      listMovements(userId, {
        from: `${month}-01`,
        to: `${month}-${String(daysInMonth(month)).padStart(2, '0')}`,
      }),
      listVacas(userId),
      listCards(userId),
      listDebts(userId),
    ]);
    if (!plan.ready) return { ready: false, today };

    const assumptions = [];
    let horizonDays = Math.min(requestedDays, MAX_DAYS);
    if (profile?.incomeType === 'fecha_fija' && plan.nextPay) {
      horizonDays = Math.min(horizonDays, Math.max(1, daysBetween(today, plan.nextPay) - 1));
      assumptions.push(
        `Proyectamos hasta la víspera de tu próximo pago (${plan.nextPay}): no sumamos lo que te van a pagar.`,
      );
    } else {
      assumptions.push('No contamos ingresos futuros: solo la plata que ya tienes.');
    }
    if (plan.pace === null) {
      assumptions.push(
        'Aún no hay 14 días de movimientos: solo restamos tus pagos, no tu gasto de cada día.',
      );
    }

    const until = addDays(today, horizonDays + 1);
    const expenses = monthMovements.filter((m) => m.type === 'gasto');
    const outflows = [
      ...monthlyOutflows({
        commitments,
        paidThisMonth: (c) => expenses.some((e) => isPaymentOf(c, e)),
        today,
        until,
      }),
      ...cardList
        .filter((c) => (c.statementTotal ?? c.used) > 0 && c.nextPaymentDate < until)
        .map((c) => ({
          date: c.nextPaymentDate,
          amount: c.statementTotal ?? c.used,
          kind: 'card',
          name: c.name,
          id: c.id,
        })),
      ...vacas
        .filter((v) => v.deadline && v.myRemaining > 0 && v.deadline < until)
        .map((v) => ({
          date: v.deadline,
          amount: v.myRemaining,
          kind: 'vaca',
          name: v.name,
          id: v.id,
        })),
      ...debts.items
        .filter((d) => d.kind === 'payable' && !d.settledAt && d.dueDate && d.dueDate < until)
        .map((d) => ({
          date: d.dueDate,
          amount: d.amount,
          kind: 'deuda',
          name: d.person,
          id: d.id,
        })),
    ];

    const receivable = debts.totals.receivable;
    if (receivable > 0) {
      assumptions.push(
        `No contamos lo que te deben (${money.format(receivable)}): si te pagan, te alcanza más.`,
      );
    }

    const projection = projectLiquidity({
      today,
      money: plan.money,
      pace: plan.pace,
      outflows,
      horizonDays,
    });
    return {
      ready: true,
      today,
      money: plan.money,
      pace: plan.pace,
      until: addDays(today, horizonDays),
      ...projection,
      receivable,
      assumptions,
    };
  }

  return { getLiquidity };
}

export const { getLiquidity } = createLiquidityService();
