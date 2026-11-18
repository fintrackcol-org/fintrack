
import { dateLocale } from '@/lib/region';
import { t } from '@/lib/i18n';/**
 * Cuánto hace que pasó algo, en palabras cortas: "ahora", "hace 5 min", "hace 3 h", "ayer",
 * "hace 4 días" o la fecha ("12 de oct.") si pasó hace más de una semana.
 * @param {string|Date} when
 * @param {Date} [now]
 * @returns {string}
 */
export function timeAgo(when, now = new Date()) {
  const date = new Date(when);
  const minutes = Math.floor((now.getTime() - date.getTime()) / 60_000);
  if (minutes < 1) return 'ahora';
  if (minutes < 60) return t('hace {minutes} min', { minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t('hace {hours} h', { hours });
  const days = Math.floor(hours / 24);
  if (days === 1) return 'ayer';
  if (days < 7) return t('hace {days} días', { days });
  return date.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' });
}
