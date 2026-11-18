
import { t } from '@/lib/i18n';/** Textos de las cuentas por cobrar y por pagar (FT-0046). */

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
      text: days === -1 ? t('Venció ayer') : t('Venció hace {v1} días', { v1: -days }),
      late: true,
    };
  }
  if (days === 0) return { text: t('Vence hoy'), late: false };
  if (days === 1) return { text: t('Vence mañana'), late: false };
  if (days <= 7) return { text: t('Vence en {days} días', { days }), late: false };
  const [y, m, d] = dueDate.split('-').map(Number);
  const year = today.slice(0, 4) === dueDate.slice(0, 4) ? '' : ` ${y}`;
  return { text: `Vence el ${d} ${MONTHS[m - 1]}${year}`, late: false };
}

/** Palabras de cada lado: la pestaña, el botón de saldar y el movimiento que se crea. */
export const DEBT_WORDS = {
  receivable: {
    tab: t('Me deben'),
    settle: t('Ya me pagó'),
    settleAll: t('Ya me pagó todo'),
    left: t('Te falta recibir'),
    movement: t('Registrar el ingreso en Movimientos'),
    empty: t('Nadie te debe nada. Anota aquí cuando le prestes plata a alguien.'),
  },
  payable: {
    tab: t('Debo'),
    settle: t('Ya pagué'),
    settleAll: t('Ya pagué todo'),
    left: t('Te falta pagar'),
    movement: t('Registrar el gasto en Movimientos'),
    empty: t('No le debes a nadie. Anota aquí lo que te prestan para no olvidarlo.'),
  },
};

/** Cada cuánto se paga una cuenta en cuotas. */
export const FREQUENCY_LABELS = { weekly: t('Cada semana'), biweekly: t('Cada quincena'), monthly: t('Cada mes') };

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
  return debt.installments ? t('{base} · {v2} de {installments} cuotas', { base, v2: debt.paidInstallments ?? 0, installments: debt.installments }) : base;
}

/**
 * Las iniciales para el avatar: "Laura Gómez" → "LG", "mamá" → "M".
 * @param {string} name
 */
export function initials(name) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)[0] : '')).toUpperCase() || '?';
}
