/**
 * Bloque "Avisarme" (FT-0063): el mismo en cuentas, tarjetas, suscripciones y calendario.
 * @typedef {object} ReminderConfig
 * @property {number[]} daysBefore Con cuántos días de anticipación avisar (0 = el mismo día). Vacío = no avisar.
 * @property {string|null} time `HH:MM` en la hora del usuario; `null` = su hora de Notificaciones.
 * @property {'push'|'whatsapp'|'both'} channel Por dónde llega.
 */

/** Anticipaciones que se pueden elegir. */
export const REMINDER_DAYS = [0, 1, 3, 7];
export const REMINDER_CHANNELS = ['push', 'whatsapp', 'both'];

/** Lo que pasa si el usuario no toca nada: un día antes, por notificación, a su hora de siempre. */
export const DEFAULT_REMINDER = Object.freeze({ daysBefore: [1], time: null, channel: 'push' });

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Valida el bloque "Avisarme" de cualquier formulario.
 * @param {unknown} value
 * @param {Array<{ field: string, problem: string }>} details Se le agregan los problemas.
 * @param {string} [field] Nombre del campo en el cuerpo.
 * @returns {ReminderConfig|undefined} `undefined` si hubo problemas.
 */
export function parseReminder(value, details, field = 'reminder') {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    details.push({ field, problem: 'Debe ser un objeto con daysBefore, time y channel' });
    return undefined;
  }
  const before = details.length;
  const { daysBefore, time = null, channel = 'push' } = value;
  if (!Array.isArray(daysBefore) || daysBefore.some((d) => !REMINDER_DAYS.includes(d))) {
    details.push({ field: `${field}.daysBefore`, problem: `Solo se permite: ${REMINDER_DAYS.join(', ')}` });
  }
  if (time !== null && !(typeof time === 'string' && TIME_RE.test(time))) {
    details.push({ field: `${field}.time`, problem: 'Debe ser una hora HH:MM o null' });
  }
  if (!REMINDER_CHANNELS.includes(channel)) {
    details.push({ field: `${field}.channel`, problem: `Debe ser: ${REMINDER_CHANNELS.join(', ')}` });
  }
  if (details.length > before) return undefined;
  return { daysBefore: [...new Set(daysBefore)].sort((a, b) => a - b), time, channel };
}
