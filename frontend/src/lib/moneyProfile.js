/** Pagos que más se repiten, para no escribirlos en la bienvenida. */
export const SUGGESTED_COMMITMENTS = ['Arriendo', 'Internet', 'Celular', 'Transporte', 'Universidad', 'Cuota'];

/** FT-0057: aviso junto a cada formulario de saldo, para que nadie lo "arregle" con un ingreso falso. */
export const NOT_INCOME = 'No la anotes como ingreso: si no, tus reportes dirán que ese mes te entró esa plata.';

/** Días de pago por mes que acepta la API. */
export const MAX_PAY_DAYS = 4;

/**
 * Elige o quita un día de pago. Si ya hay el máximo, no agrega más.
 * @param {number[]} days
 * @param {number} day
 * @returns {number[]} Días ordenados.
 */
export function togglePayDay(days, day) {
  if (days.includes(day)) return days.filter((d) => d !== day);
  if (days.length >= MAX_PAY_DAYS) return days;
  return [...days, day].sort((a, b) => a - b);
}

/**
 * Convierte lo escrito en el perfil que recibe la API. Lo que quedó sin responder va en `null`.
 * @param {{ incomeType: string, payDays: number[], balance: string }} form `balance` es el texto de `MoneyInput`.
 * @returns {{ incomeType: string|null, payDays: number[], balance: number|null }}
 */
export function toProfileData({ incomeType, payDays, balance }) {
  return {
    incomeType: incomeType || null,
    payDays: incomeType === 'fecha_fija' ? payDays : [],
    balance: balance === '' ? null : Number(balance),
  };
}

/**
 * Cuánta plata dicen tener los movimientos. Si solo hay gastos, o gastó más de lo registrado como
 * ingreso, no dicen nada útil y no se propone ningún número.
 * @param {{ income: number, expense: number }} totals
 * @returns {number|null}
 */
export function balanceProposal({ income, expense }) {
  const total = Math.round(income - expense);
  return total > 0 ? total : null;
}

/**
 * Cómo le entra la plata al usuario, en una línea.
 * @param {{ incomeType: string|null, payDays: number[] }} profile
 * @returns {string}
 */
export function incomeSummary({ incomeType, payDays }) {
  if (incomeType === 'sin_fecha') return 'Sin fecha fija';
  if (incomeType !== 'fecha_fija') return 'Aún no nos has dicho';
  const days = payDays.join(', ').replace(/, (\d+)$/, ' y $1');
  return `Con fecha fija, ${payDays.length === 1 ? 'el día' : 'los días'} ${days}`;
}

/** Meses para elegir el cobro de un pago anual (FT-0067). */
export const MONTH_NAMES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Tipos de compromiso, con un ejemplo para no confundirlos (FT-0067). */
export const COMMITMENT_KIND_OPTIONS = [
  { value: 'fixed', label: 'Pago fijo', hint: 'Lo que pagas sí o sí: arriendo, internet, la cuota del carro.' },
  { value: 'subscription', label: 'Suscripción', hint: 'Un servicio que se cobra solo y puedes cancelar: Netflix, Spotify, iCloud.' },
];

export const COMMITMENT_FREQUENCY_OPTIONS = [
  { value: 'monthly', label: 'Cada mes' },
  { value: 'yearly', label: 'Una vez al año' },
];

/**
 * Revisa un compromiso escrito en un formulario.
 * @param {{ name: string, amount: string, dayOfMonth: string, kind?: string, frequency?: string, month?: string }} form
 * @returns {{ data?: { name: string, amount: number, dayOfMonth: number, kind: string, frequency: string, month: number|null }, error?: string }}
 */
export function readCommitmentForm({ name, amount, dayOfMonth, kind = 'fixed', frequency = 'monthly', month = '' }) {
  const cleanName = name.trim();
  const cleanAmount = Number(amount);
  const day = Number(dayOfMonth);
  if (!cleanName) return { error: 'Escribe el nombre del pago.' };
  if (!(cleanAmount > 0)) return { error: `Escribe cuánto pagas por ${cleanName}.` };
  if (!Number.isInteger(day) || day < 1 || day > 31) return { error: `Escribe un día entre 1 y 31 para ${cleanName}.` };
  const yearly = frequency === 'yearly';
  const monthNumber = Number(month);
  if (yearly && !(Number.isInteger(monthNumber) && monthNumber >= 1 && monthNumber <= 12)) {
    return { error: `Elige en qué mes se cobra ${cleanName}.` };
  }
  return {
    data: { name: cleanName, amount: cleanAmount, dayOfMonth: day, kind, frequency, month: yearly ? monthNumber : null },
  };
}

/**
 * Cuándo se cobra, en pocas palabras: "día 20", "cada año, el 5 de marzo".
 * @param {{ dayOfMonth: number, frequency?: string, month?: number|null }} commitment
 * @returns {string}
 */
export function commitmentWhen({ dayOfMonth, frequency, month }) {
  return frequency === 'yearly' ? `cada año, el ${dayOfMonth} de ${MONTH_NAMES[month - 1]}` : `día ${dayOfMonth}`;
}
