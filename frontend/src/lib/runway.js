
import { t } from '@/lib/i18n';/**
 * "Te alcanza N días más" de la tarjeta Mi plata del inicio (Rinde v2), calculado en el dispositivo con
 * lo que ya llega: el saldo y lo gastado en el mes. Es una cuenta sencilla y honesta: a tu ritmo de este
 * mes (gastado ÷ días que van), ¿cuántos días dura la plata que tienes?
 */

const DAY_MS = 86_400_000;

/** Meses cortos, sin depender de cómo los escriba cada navegador ("24 de nov.", "24 nov"). */
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * @param {{ balance: number|null|undefined, monthExpense: number|null|undefined, today?: Date }} input
 * @returns {{ days: number, until: Date, pace: number, coverage: number, lasts: boolean } | null}
 *   `null` si falta el saldo o aún no hay gastos para medir el ritmo. `coverage` (0 a 1) es qué parte de
 *   lo que queda del mes cubre la plata; `lasts` dice si llega a fin de mes.
 */
export function runway({ balance, monthExpense, today = new Date() }) {
  if (typeof balance !== 'number' || !monthExpense || monthExpense <= 0) return null;
  const day = today.getDate();
  const pace = monthExpense / day;
  const days = Math.max(0, Math.floor(balance / pace));
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const left = Math.max(lastDay - day, 1);
  const until = new Date(today.getFullYear(), today.getMonth(), day);
  until.setTime(until.getTime() + days * DAY_MS);
  return { days, until, pace: Math.round(pace), coverage: Math.min(days / left, 1), lasts: days >= left };
}

/**
 * "hasta el 24 nov", o "hasta fin de mes y más" cuando pasa del mes.
 * @param {{ until: Date, lasts: boolean }} result
 */
export function untilText({ until, lasts }) {
  if (lasts) return 'pasa el fin de mes';
  return t('hasta el {getDate} {v2}', { getDate: until.getDate(), v2: MONTHS[until.getMonth()] });
}

/** "1 día" o "14 días". */
export const daysLabel = (days) => (days === 1 ? t('1 día') : t('{days} días', { days }));
