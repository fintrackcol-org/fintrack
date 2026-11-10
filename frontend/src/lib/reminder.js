/**
 * Bloque "Avisarme" (FT-0063): el mismo en cuentas, tarjetas, suscripciones y calendario.
 * @typedef {object} Reminder
 * @property {number[]} daysBefore Con cuántos días de anticipación avisar (0 = el mismo día). Vacío = no avisar.
 * @property {string|null} time `HH:MM`; `null` = la hora de Notificaciones del usuario.
 * @property {'push'|'whatsapp'|'both'} channel
 */

/** Lo que pasa si el usuario no toca nada (igual que en el servidor). */
export const DEFAULT_REMINDER = { daysBefore: [1], time: null, channel: 'push' };

export const REMINDER_DAY_OPTIONS = [
  { value: 0, label: 'El mismo día' },
  { value: 1, label: '1 día antes' },
  { value: 3, label: '3 días antes' },
  { value: 7, label: '7 días antes' },
];

export const REMINDER_CHANNEL_OPTIONS = [
  { value: 'push', label: 'Notificación' },
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'both', label: 'Ambos' },
];

/**
 * El aviso en una frase, para confirmar lo elegido: "Te avisamos 3 días antes y el mismo día, a las 07:30, por WhatsApp."
 * @param {Reminder} reminder
 * @returns {string}
 */
export function reminderSummary({ daysBefore, time, channel }) {
  if (daysBefore.length === 0) return 'No te avisaremos.';
  const days = [...daysBefore]
    .sort((a, b) => b - a)
    .map((d) => REMINDER_DAY_OPTIONS.find((o) => o.value === d).label.toLowerCase());
  const when = days.length === 1 ? days[0] : `${days.slice(0, -1).join(', ')} y ${days.at(-1)}`;
  const by = { push: 'por notificación', whatsapp: 'por WhatsApp', both: 'por notificación y WhatsApp' }[channel];
  return `Te avisamos ${when}, ${time ? `a las ${time}` : 'a tu hora de avisos'}, ${by}.`;
}
