/**
 * Textos de las cuentas por cobrar y por pagar del negocio (FT-0058).
 */
import { dayLabel } from '@/lib/calendar';
import { t } from '@/lib/i18n';

export const ACCOUNT_TABS = [
  { value: 'receivable', label: t('Por cobrar') },
  { value: 'payable', label: t('Por pagar') },
];

/** Cómo entra al negocio cada abono, según el tipo de cuenta. */
export const PAYMENT_KIND_OPTIONS = {
  receivable: [
    { value: 'sale', label: t('Venta') },
    { value: 'otherIncome', label: t('Otro ingreso') },
  ],
  payable: [
    { value: 'cost', label: t('Costo de venta') },
    { value: 'variable', label: t('Gasto variable') },
    { value: 'fixed', label: t('Gasto fijo') },
  ],
};

/**
 * @param {string} from AAAA-MM-DD
 * @param {string} to AAAA-MM-DD
 * @returns {number}
 */
const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);

/**
 * "Vence hoy", "Vence el 20 nov", "Venció hace 3 días", "Pagada" o "Sin fecha".
 * @param {{ status: string, dueDate: string|null }} account
 * @param {string} today AAAA-MM-DD
 * @returns {string}
 */
export function dueText({ status, dueDate }, today) {
  if (status === 'pagada') return t('Pagada');
  if (!dueDate) return t('Sin fecha');
  const days = daysBetween(today, dueDate);
  if (days === 0) return t('Vence hoy');
  if (days === 1) return t('Vence mañana');
  if (days > 0) return `Vence el ${dayLabel(dueDate)}`;
  return days === -1 ? t('Venció ayer') : t('Venció hace {v1} días', { v1: -days });
}

/**
 * Porcentaje abonado, para la barra (0 a 100).
 * @param {{ amount: number, paid: number }} account
 * @returns {number}
 */
export const paidPercent = ({ amount, paid }) => Math.min(100, Math.round((paid / amount) * 100));
