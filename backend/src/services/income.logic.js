import { addDays } from './liquidity.logic.js';
import { dateInMonth } from './money-plan.service.js';
import { shiftMonth } from './analytics.service.js';

/**
 * Ingresos irregulares (FT-0060): cálculo puro, sin base de datos. Cuánto le entra al usuario en un
 * mes normal y en uno flaco, qué sueldo propio le conviene, cómo repartir un ingreso grande, cuánto
 * colchón necesita, cuánto apartar para la seguridad social y qué plata se espera (para el motor de
 * liquidez, FT-0059). La plata futura nunca se cuenta como si ya estuviera.
 */

/** Tipos de fuente que se preguntan en la bienvenida. */
export const SOURCE_KINDS = ['sueldo', 'comisiones', 'proyectos', 'diario', 'mesada'];
export const FREQUENCIES = ['mensual', 'quincenal', 'semanal', 'diario', 'irregular'];

/** Sin historial, lo que el usuario dijo se planea con este descuento ("más o menos" suele ser optimista). */
export const DECLARED_LEAN_FACTOR = 0.8;

/** Con menos meses de ingresos registrados se usa lo que dijo el usuario. */
export const MIN_HISTORY_MONTHS = 2;

/** Parte del mes flaco que se aparta como ahorro antes de proponer el sueldo propio. */
export const SAVE_SHARE = 0.1;

/** Semanas promedio por mes (52 ÷ 12). */
const WEEKS_PER_MONTH = 52 / 12;

/** Pagos por mes de una mesada según la frecuencia. */
const PER_MONTH = { mensual: 1, quincenal: 2, semanal: WEEKS_PER_MONTH, diario: 30, irregular: 1 };

/**
 * Seguridad social de un independiente en Colombia (verificado el 2026-11-07):
 * IBC = 40 % del ingreso, mínimo 1 SMMLV y máximo 25 SMMLV (UGPP); salud 12,5 % y pensión 16 %.
 * SMMLV 2026: $1.750.905 (Decreto 1469 de 2025). Se muestra siempre como valor aproximado.
 * shortcut: el salario mínimo va fijo en el código, hay que cambiarlo cada enero.
 */
export const SOCIAL_SECURITY = { smmlv: 1_750_905, ibcShare: 0.4, health: 0.125, pension: 0.16, maxSmmlv: 25 };

const roundTo = (value, step) => Math.round(value / step) * step;
const sum = (values) => values.reduce((acc, v) => acc + v, 0);

/**
 * @param {number[]} values
 * @returns {number} La mediana.
 */
export function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * @typedef {object} IncomeSource
 * @property {string} [id] UUID (las que ya están guardadas).
 * @property {string} name Cómo la llama el usuario.
 * @property {'sueldo'|'comisiones'|'proyectos'|'diario'|'mesada'} kind Tipo de fuente.
 * @property {'mensual'|'quincenal'|'semanal'|'diario'|'irregular'} frequency Cada cuánto llega.
 * @property {number[]} payDays Días del mes en que llega (sueldo, base de comisiones, mesada mensual).
 * @property {number|null} amount Sueldo o mesada: cuánto llega cada vez (sueldo: al mes). Comisiones: la
 *   base fija. Diario: cuánto hace en un día normal.
 * @property {number|null} low Comisiones de un mes malo.
 * @property {number|null} high Comisiones de un mes bueno.
 * @property {number[]} lastMonths Proyectos: cuánto le entró en los últimos meses (aproximado).
 * @property {number|null} workDays Diario: días que trabaja a la semana.
 */

/**
 * Cuánto deja una fuente al mes según lo que dijo el usuario.
 * `fixed`: lo seguro (sueldo, base de comisiones, mesada); cuenta completo.
 * `normal` y `lean`: mes normal y mes flaco (lo variable se planea con el flaco).
 * @param {IncomeSource} source
 * @returns {{ fixed: number, normal: number, lean: number, estimated: boolean }}
 *   `estimated`: se descontó el 20 % porque no hay cómo saber el mes flaco.
 */
export function declaredMonth(source) {
  const amount = source.amount ?? 0;
  switch (source.kind) {
    case 'sueldo':
      return { fixed: amount, normal: amount, lean: amount, estimated: false };
    case 'mesada': {
      const monthly = amount * (PER_MONTH[source.frequency] ?? 1);
      return { fixed: monthly, normal: monthly, lean: monthly, estimated: false };
    }
    case 'comisiones': {
      const low = source.low ?? 0;
      const high = source.high ?? low;
      return { fixed: amount, normal: amount + (low + high) / 2, lean: amount + low, estimated: false };
    }
    case 'proyectos': {
      const months = source.lastMonths.filter((m) => m > 0);
      if (months.length === 0) return { fixed: 0, normal: 0, lean: 0, estimated: false };
      if (months.length === 1) {
        return { fixed: 0, normal: months[0], lean: months[0] * DECLARED_LEAN_FACTOR, estimated: true };
      }
      return { fixed: 0, normal: median(months), lean: Math.min(...months), estimated: false };
    }
    case 'diario': {
      const normal = amount * (source.workDays ?? 0) * WEEKS_PER_MONTH;
      return { fixed: 0, normal, lean: normal * DECLARED_LEAN_FACTOR, estimated: true };
    }
    default:
      return { fixed: 0, normal: 0, lean: 0, estimated: false };
  }
}

/**
 * Mes normal y mes flaco del usuario. Con al menos dos meses de ingresos registrados manda la
 * historia (normal: mediana de los últimos seis; flaco: el menor de los últimos tres); si no, lo
 * que contó en la bienvenida.
 * @param {{ sources: IncomeSource[], history: number[] }} data `history`: ingresos de cada mes
 *   completo, del más reciente al más viejo (solo meses con algún ingreso).
 * @returns {{ normal: number, lean: number, fixed: number, basis: 'history'|'declared'|'none', estimated: boolean }}
 */
export function monthlyIncome({ sources, history }) {
  const declared = sources.map(declaredMonth);
  const fixed = sum(declared.map((d) => d.fixed));
  const months = history.filter((m) => m > 0);
  if (months.length >= MIN_HISTORY_MONTHS) {
    const normal = median(months.slice(0, 6));
    // El sueldo fijo llega igual en un mes flaco: no se planea con menos que eso.
    const lean = Math.max(Math.min(...months.slice(0, 3)), fixed);
    return { normal: Math.round(normal), lean: Math.round(lean), fixed: Math.round(fixed), basis: 'history', estimated: false };
  }
  if (declared.length === 0 || sum(declared.map((d) => d.normal)) === 0) {
    return { normal: 0, lean: 0, fixed: 0, basis: 'none', estimated: false };
  }
  return {
    normal: Math.round(sum(declared.map((d) => d.normal))),
    lean: Math.round(sum(declared.map((d) => d.lean))),
    fixed: Math.round(fixed),
    basis: 'declared',
    estimated: declared.some((d) => d.estimated),
  };
}

/**
 * @param {IncomeSource[]} sources
 * @returns {boolean} Tiene ingresos que suben y bajan.
 */
export const hasVariableIncome = (sources) => sources.some((s) => ['comisiones', 'proyectos', 'diario'].includes(s.kind));

/**
 * @param {IncomeSource[]} sources
 * @returns {boolean} Trabaja por su cuenta (paga seguridad social sola).
 */
export const isIndependent = (sources) => sources.some((s) => ['proyectos', 'diario'].includes(s.kind));

/**
 * "Págate un sueldo": el mes flaco menos el ahorro, redondeado a $50.000. Solo para quien no tiene
 * un sueldo fijo: a ese ya le pagan uno.
 * @param {{ sources: IncomeSource[], lean: number }} data
 * @returns {number|null}
 */
export function ownSalary({ sources, lean }) {
  if (!hasVariableIncome(sources) || sources.some((s) => s.kind === 'sueldo') || lean <= 0) return null;
  return roundTo(lean * (1 - SAVE_SHARE), 50_000);
}

/**
 * Colchón para meses flacos: de uno a tres meses de lo que necesita (pagos + gasto normal). Quien
 * tiene ingresos variables apunta a tres; quien no, a uno.
 * @param {{ commitments: number, pace: number|null, variable: boolean }} data `commitments`: total de pagos del mes.
 * @returns {number} Redondeado a $10.000.
 */
export function cushionGoal({ commitments, pace, variable }) {
  const month = commitments + (pace ?? 0) * 30;
  return roundTo(month * (variable ? 3 : 1), 10_000);
}

/**
 * Aporte mensual aproximado a salud y pensión de un independiente.
 * @param {number} monthlyIncome Ingreso del mes.
 * @param {typeof SOCIAL_SECURITY} [rules]
 * @returns {{ ibc: number, health: number, pension: number, total: number }}
 */
export function socialSecurity(monthlyIncome, rules = SOCIAL_SECURITY) {
  const ibc = Math.min(Math.max(monthlyIncome * rules.ibcShare, rules.smmlv), rules.smmlv * rules.maxSmmlv);
  const health = Math.round(ibc * rules.health);
  const pension = Math.round(ibc * rules.pension);
  return { ibc: Math.round(ibc), health, pension, total: health + pension };
}

/**
 * "Reparte lo que entró": primero los pagos que faltan este mes, luego (independientes) lo de la
 * seguridad social de ese ingreso, luego lo que falte del sueldo propio de este mes y el resto al
 * colchón hasta llenarlo. Lo que sobre después queda libre.
 * @param {object} data
 * @param {number} data.amount Lo que entró.
 * @param {number} data.pendingCommitments Pagos de este mes que aún no se pagan.
 * @param {number} data.salaryLeft Lo que falta del sueldo propio este mes.
 * @param {number} data.cushionGap Lo que falta para llenar el colchón.
 * @param {boolean} data.independent
 * @returns {{ commitments: number, socialSecurity: number, salary: number, cushion: number, free: number }}
 */
export function splitIncome({ amount, pendingCommitments, salaryLeft, cushionGap, independent }) {
  let left = amount;
  const take = (want) => {
    const value = Math.max(0, Math.min(left, Math.round(want)));
    left -= value;
    return value;
  };
  const commitments = take(pendingCommitments);
  // Sobre lo que entró: 40 % de base y 28,5 % de aporte. Sin el mínimo, que aplica al mes completo.
  const ss = independent ? take(amount * SOCIAL_SECURITY.ibcShare * (SOCIAL_SECURITY.health + SOCIAL_SECURITY.pension)) : 0;
  const salary = take(salaryLeft);
  const cushion = take(cushionGap);
  return { commitments, socialSecurity: ss, salary, cushion, free: left };
}

/**
 * ¿Merece la tarjeta de reparto? Desde dos días de gasto normal; sin historial, desde $100.000.
 * @param {{ amount: number, pace: number|null }} data
 * @returns {boolean}
 */
export const isLargeIncome = ({ amount, pace }) => amount > (pace ? pace * 2 : 100_000);

/**
 * Días de trabajo que quedan en el mes desde `today` (incluido). Sin saber qué días descansa, se
 * supone que trabaja de lunes en adelante (6 días: descansa el domingo).
 * @param {string} today AAAA-MM-DD
 * @param {number} workDays Días por semana.
 * @returns {number}
 */
export function workDaysLeft(today, workDays) {
  let count = 0;
  for (let date = today; date.slice(0, 7) === today.slice(0, 7); date = addDays(date, 1)) {
    const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // lunes = 0
    if (weekday < workDays) count += 1;
  }
  return count;
}

/**
 * Meta por día de trabajo: lo que falta del mes repartido solo en los días que trabaja. Si hoy ya
 * hizo más de lo que tocaba, cuánto le sobró.
 * @param {{ target: number, earned: number, todayIncome: number, today: string, workDays: number }} data
 *   `earned`: lo que lleva el mes, incluido hoy.
 * @returns {{ target: number, earned: number, daysLeft: number, perDay: number, extraToday: number }}
 */
export function workDayGoal({ target, earned, todayIncome, today, workDays }) {
  const daysLeft = workDaysLeft(today, workDays);
  const beforeToday = earned - todayIncome;
  // La meta de hoy se fija con lo que llevaba al empezar el día, para que no cambie con cada ingreso.
  const todayGoal = daysLeft > 0 ? Math.max(0, target - beforeToday) / daysLeft : 0;
  const after = Math.max(0, daysLeft - (todayIncome > 0 ? 1 : 0));
  const perDay = after > 0 ? Math.ceil(Math.max(0, target - earned) / after / 100) * 100 : 0;
  return {
    target: Math.round(target),
    earned: Math.round(earned),
    daysLeft,
    perDay,
    extraToday: Math.max(0, Math.round(todayIncome - todayGoal)),
  };
}

/**
 * Plata que se espera entre `from` y `to` (incluidos), para el motor de liquidez (FT-0059).
 * `sure` solo para lo fijo (sueldo, base de comisiones, mesada). Lo variable va con el valor del
 * mes flaco: las comisiones el último día de pago del mes, lo de proyectos sin fecha (`null`, una
 * vez por mes) y lo diario repartido en los días que trabaja.
 * @param {{ sources: IncomeSource[], from: string, to: string }} data
 * @returns {Array<{ date: string|null, amount: number, sourceId: string|undefined, sure: boolean }>}
 */
export function expectedIncomeFor({ sources, from, to }) {
  const out = [];
  const inRange = (date) => date >= from && date <= to;
  for (let month = from.slice(0, 7); `${month}-01` <= to; month = shiftMonth(month, 1)) {
    for (const s of sources) {
      const month0 = declaredMonth(s);
      const days = [...s.payDays].sort((a, b) => a - b);
      if (['sueldo', 'comisiones', 'mesada'].includes(s.kind) && month0.fixed > 0) {
        if (days.length === 0) out.push({ date: null, amount: Math.round(month0.fixed), sourceId: s.id, sure: true });
        for (const day of days) {
          const date = dateInMonth(month, day);
          if (inRange(date)) out.push({ date, amount: Math.round(month0.fixed / days.length), sourceId: s.id, sure: true });
        }
      }
      const variable = month0.lean - month0.fixed;
      if (variable <= 0) continue;
      if (s.kind === 'comisiones') {
        const date = days.length ? dateInMonth(month, days.at(-1)) : null;
        if (date === null || inRange(date)) out.push({ date, amount: Math.round(variable), sourceId: s.id, sure: false });
      } else if (s.kind === 'diario' && s.workDays > 0) {
        const perDay = variable / (s.workDays * WEEKS_PER_MONTH);
        for (let date = `${month}-01`; date.startsWith(month); date = addDays(date, 1)) {
          const weekday = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
          if (weekday < s.workDays && inRange(date)) out.push({ date, amount: Math.round(perDay), sourceId: s.id, sure: false });
        }
      } else {
        out.push({ date: null, amount: Math.round(variable), sourceId: s.id, sure: false });
      }
    }
  }
  return out.sort((a, b) => (a.date ?? '9999').localeCompare(b.date ?? '9999'));
}

/**
 * `tipo_ingreso` de siempre (compatibilidad): con fecha fija si alguna fuente fija tiene días.
 * @param {IncomeSource[]} sources
 * @returns {{ incomeType: 'fecha_fija'|'sin_fecha'|null, payDays: number[] }}
 */
export function legacyIncomeType(sources) {
  if (sources.length === 0) return { incomeType: null, payDays: [] };
  const fixedDays = sources
    .filter((s) => ['sueldo', 'mesada', 'comisiones'].includes(s.kind))
    .flatMap((s) => s.payDays);
  const payDays = [...new Set(fixedDays)].sort((a, b) => a - b).slice(0, 4);
  return payDays.length > 0 ? { incomeType: 'fecha_fija', payDays } : { incomeType: 'sin_fecha', payDays: [] };
}
