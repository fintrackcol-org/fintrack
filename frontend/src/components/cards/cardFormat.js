
import { dateLocale } from '@/lib/region';
import { t } from '@/lib/i18n';/** "15 nov" a partir de AAAA-MM-DD, sin pasar por UTC. */
export function shortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const month = new Date(y, m - 1, d).toLocaleDateString(dateLocale(), { month: 'short' }).replace('.', '');
  return `${d} ${month}`;
}

/** Cuándo toca pagar: "Pagas en 5 días (15 nov)". */
export function paymentText(card) {
  if (card.paidThisCycle) return t('Pago de este mes al día');
  if (card.daysToPayment < 0) return t('Pago atrasado desde el {nextPaymentDate}', { nextPaymentDate: shortDate(card.nextPaymentDate) });
  const when = card.nextPaymentDate ? ` (${shortDate(card.nextPaymentDate)})` : '';
  if (card.daysToPayment === 0) return t('Pagas hoy{when}', { when });
  if (card.daysToPayment === 1) return t('Pagas en 1 día{when}', { when });
  return t('Pagas en {daysToPayment} días{when}', { daysToPayment: card.daysToPayment, when });
}

/**
 * Qué hará "Actualizar con el banco" con el disponible escrito (misma cuenta que el backend).
 * @param {{ limit: number, used: number }} card
 * @param {string} available Texto crudo del `MoneyInput`.
 * @param {(n: number) => string} money
 * @returns {string} Vacío si el disponible no es un número.
 */
export function syncPreview({ limit, used }, available, money) {
  const value = available === '' ? NaN : Number(available);
  if (!Number.isFinite(value)) return '';
  const difference = Math.round((limit - value - used) * 100) / 100;
  return difference > 0
    ? t('Se registrará un gasto de {difference} en Cargos del banco.', { difference: money(difference) })
    : t('Se corregirá el cupo sin registrar gasto.');
}

/**
 * Texto corto de una tarjeta: su nombre con los últimos 4 dígitos. Los nombres por defecto
 * ("Amex Blue ••1234") ya los traen; los personalizados ("Mi Amex") se completan.
 * @param {{ name: string, last4: string }} card
 * @returns {string}
 */
/**
 * Cuándo se paga, para los avisos: "Se paga en 3 días". Si ya se pagó o está atrasada, como `paymentText`.
 * @param {{ daysToPayment: number, paidThisCycle: boolean }} card
 * @returns {string}
 */
export function dueText(card) {
  const { daysToPayment: days } = card;
  if (card.paidThisCycle || days < 0) return paymentText(card);
  return t('Se paga {v1}', { v1: days === 0 ? 'hoy' : days === 1 ? t('mañana') : `en ${days} días` });
}

export function cardMark({ name, last4 }) {
  return name.includes(`••${last4}`) ? name : `${name} ••${last4}`;
}

/**
 * Aviso del vencimiento del plástico (FT-0065), con `card.expiry` que calcula el backend.
 * @param {{ expiry?: { label: string, expired: boolean, soon: boolean }|null }} card
 * @returns {{ text: string, tone: 'negative'|'caution' }|null} `null` si no vence pronto.
 */
export function expiryNotice(card) {
  if (!card.expiry) return null;
  if (card.expiry.expired) return { text: t('Vencida ({label}) · actualiza la fecha', { label: card.expiry.label }), tone: 'negative' };
  if (card.expiry.soon) return { text: t('Vence pronto ({label}) · pide la nueva al banco', { label: card.expiry.label }), tone: 'caution' };
  return null;
}
