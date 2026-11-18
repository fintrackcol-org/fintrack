/** Cuentas de las metas de ahorro (Rinde v2): plan por semana, colchón y cuánto alcanzaría la plata. */

const DAY_MS = 86_400_000;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** Parte de los ingresos de la semana que ya es "mucho" para una sola meta. */
export const TOO_MUCH_SHARE = 0.3;
/** Meses de gastos fijos que debe cubrir el colchón (fondo de emergencia). */
export const CUSHION_MONTHS = 3;

/**
 * Cuánto apartar cada semana para llegar a la meta en la fecha. Sin fecha o con la fecha pasada, `null`.
 * @param {{ goal: number, saved?: number, deadline?: string|null, today?: string }} plan Fechas AAAA-MM-DD.
 * @returns {{ perWeek: number, weeks: number }|null}
 */
export function weeklyPlan({ goal, saved = 0, deadline, today }) {
  if (!(goal > 0) || !deadline || !today) return null;
  const days = Math.round((Date.parse(`${deadline}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / DAY_MS);
  if (days <= 0) return null;
  const weeks = Math.max(1, Math.ceil(days / 7));
  return { perWeek: Math.ceil(Math.max(0, goal - saved) / weeks / 1000) * 1000, weeks };
}

/**
 * ¿El plan se come mucho de lo que entra? Más del 30 % de los ingresos de una semana.
 * @param {number} perWeek
 * @param {number|null|undefined} weeklyIncome
 */
export const isTooMuch = (perWeek, weeklyIncome) => weeklyIncome > 0 && perWeek > weeklyIncome * TOO_MUCH_SHARE;

/**
 * Gastos fijos de un mes, con los anuales repartidos en 12.
 * @param {Array<{ amount: number, frequency?: string }>} commitments
 */
export const monthlyFixed = (commitments = []) =>
  Math.round(commitments.reduce((sum, c) => sum + (c.frequency === 'yearly' ? c.amount / 12 : c.amount), 0));

/**
 * El colchón: la meta (3 meses de gastos fijos) y cuántos días se aguanta hoy sin ingresos.
 * @param {{ fixed: number, saved: number }} data
 * @returns {{ goal: number, days: number }|null} `null` sin gastos fijos anotados.
 */
export function cushion({ fixed, saved }) {
  if (!(fixed > 0)) return null;
  return { goal: fixed * CUSHION_MONTHS, days: Math.floor(saved / (fixed / 30)) };
}

/** ¿Es la meta del colchón? Por el nombre: "Fondo de emergencia", "colchón"… */
export const isCushionGoal = (meta) => /emergenc|colch[oó]n|cushion|reserva para/i.test(meta.name);

/** "15 dic" desde AAAA-MM-DD. */
export function shortDate(iso) {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}
