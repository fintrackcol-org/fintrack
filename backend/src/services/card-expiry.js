import { t } from '../i18n/index.js';
// Vencimiento del plástico de una tarjeta (FT-0065). Lógica pura, sin base de datos.
// Se guarda solo el mes y el año (MM/AA): nunca el número completo ni el CVV.

const DAY_MS = 86_400_000;
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** Con cuántos días de anticipación se avisa, del más lejano al más cercano. */
export const EXPIRY_NOTICES = [60, 30];

/**
 * Cómo está el vencimiento: "03/27", cuántos días faltan para el mes en que vence y si ya venció.
 * Se cuenta hasta el primer día de ese mes, para pedir la nueva con tiempo; vencida es cuando ya
 * pasó el último día del mes.
 * @param {{ expiryMonth: number|null, expiryYear: number|null }} card
 * @param {string} today AAAA-MM-DD
 * @returns {{ label: string, daysLeft: number, expired: boolean, monthName: string }|null}
 */
export function expiryStatus({ expiryMonth, expiryYear }, today) {
  if (!expiryMonth || !expiryYear) return null;
  const now = Date.parse(`${today}T00:00:00Z`);
  const start = Date.UTC(expiryYear, expiryMonth - 1, 1);
  const end = Date.UTC(expiryYear, expiryMonth, 1); // el día siguiente al último del mes
  return {
    label: `${String(expiryMonth).padStart(2, '0')}/${String(expiryYear).slice(2)}`,
    daysLeft: Math.round((start - now) / DAY_MS),
    expired: now >= end,
    monthName: MONTHS[expiryMonth - 1],
  };
}

/**
 * Qué aviso toca hoy, si alguno: el de 30 días si ya está a 30 o menos, si no el de 60. Uno ya
 * enviado no se repite, y si toca el de 30 sin haber ido el de 60, se manda solo el de 30.
 * @param {{ expiryMonth: number|null, expiryYear: number|null, expiryNotified?: number[] }} card
 * @param {string} today AAAA-MM-DD
 * @returns {number|null} 60, 30 o `null`.
 */
export function dueExpiryNotice(card, today) {
  const status = expiryStatus(card, today);
  if (!status || status.expired || status.daysLeft < 0) return null;
  const sent = card.expiryNotified ?? [];
  const due = [...EXPIRY_NOTICES].reverse().find((days) => status.daysLeft <= days);
  return due && !sent.includes(due) ? due : null;
}

/**
 * El aviso: "Tu Visa ••8456 vence en marzo: pide la nueva".
 * @param {{ id: string, name: string, last4: string, expiryMonth: number, expiryYear: number }} card
 * @param {string} today
 * @returns {{ title: string, body: string, url: string }}
 */
export function expiryReminderPayload(card, today) {
  const status = expiryStatus(card, today);
  return {
    title: t('Tu tarjeta está por vencer'),
    body: t('Tu {name} ••{last4} vence en {monthName} ({label}): pide la nueva al banco.', { name: card.name, last4: card.last4, monthName: status.monthName, label: status.label }),
    url: `/app/tarjetas/${card.id}`,
  };
}
