/** Textos de las cuentas por cobrar y por pagar (FT-0046). */

const DAY_MS = 86_400_000;
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/**
 * Días entre dos fechas AAAA-MM-DD (positivo si `to` es después de `from`).
 * @param {string} from
 * @param {string} to
 * @returns {number}
 */
function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS);
}

/**
 * Cuándo vence una cuenta pendiente, en palabras.
 * @param {string|null} dueDate AAAA-MM-DD.
 * @param {string} today AAAA-MM-DD.
 * @returns {{ text: string, late: boolean }|null} `null` si no tiene fecha.
 */
export function dueText(dueDate, today) {
  if (!dueDate) return null;
  const days = daysBetween(today, dueDate);
  if (days < 0) {
    return {
      text: days === -1 ? 'Venció ayer' : `Venció hace ${-days} días`,
      late: true,
    };
  }
  if (days === 0) return { text: 'Vence hoy', late: false };
  if (days === 1) return { text: 'Vence mañana', late: false };
  if (days <= 7) return { text: `Vence en ${days} días`, late: false };
  const [y, m, d] = dueDate.split('-').map(Number);
  const year = today.slice(0, 4) === dueDate.slice(0, 4) ? '' : ` ${y}`;
  return { text: `Vence el ${d} ${MONTHS[m - 1]}${year}`, late: false };
}

/** Palabras de cada lado: la pestaña, el botón de saldar y el movimiento que se crea. */
export const DEBT_WORDS = {
  receivable: {
    tab: 'Me deben',
    settle: 'Ya me pagó',
    settleAll: 'Ya me pagó todo',
    left: 'Te falta recibir',
    movement: 'Registrar el ingreso en Movimientos',
    empty: 'Nadie te debe nada. Anota aquí cuando le prestes plata a alguien.',
  },
  payable: {
    tab: 'Debo',
    settle: 'Ya pagué',
    settleAll: 'Ya pagué todo',
    left: 'Te falta pagar',
    movement: 'Registrar el gasto en Movimientos',
    empty: 'No le debes a nadie. Anota aquí lo que te prestan para no olvidarlo.',
  },
};

/** Cada cuánto se paga una cuenta en cuotas. */
export const FREQUENCY_LABELS = { weekly: 'Cada semana', biweekly: 'Cada quincena', monthly: 'Cada mes' };

/**
 * Fecha corta: "12 nov" (o "12 nov 2027" si no es este año).
 * @param {string} date AAAA-MM-DD
 * @param {string} today AAAA-MM-DD
 */
export function shortDate(date, today) {
  const [y, m, d] = date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}${today.slice(0, 4) === date.slice(0, 4) ? '' : ` ${y}`}`;
}

/**
 * Cómo va una cuenta: lo pagado sobre el total y, si es en cuotas, cuántas van.
 * @param {{ amount: number, paid?: number, installments?: number|null, paidInstallments?: number }} debt
 * @param {(n: number) => string} money
 * @returns {string} "Pagado $50.000 de $200.000 · 1 de 4 cuotas"
 */
export function progressText(debt, money) {
  const base = `Pagado ${money(debt.paid ?? 0)} de ${money(debt.amount)}`;
  return debt.installments ? `${base} · ${debt.paidInstallments ?? 0} de ${debt.installments} cuotas` : base;
}

/**
 * Las iniciales para el avatar: "Laura Gómez" → "LG", "mamá" → "M".
 * @param {string} name
 */
export function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?';
}
