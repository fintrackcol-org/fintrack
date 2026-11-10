import { pool } from '../config/db.js';
import { DEFAULT_REMINDER } from '../validators/reminders.validator.js';

// Motor de recordatorios (FT-0063). `type` dice de qué es el aviso ('cuenta', y después 'tarjeta',
// 'suscripcion'…) e `id` es el de esa fila. Quien no ha configurado nada recibe DEFAULT_REMINDER.

/** @typedef {import('../validators/reminders.validator.js').ReminderConfig} ReminderConfig */

/**
 * Guarda cómo avisar de algo (crea o reemplaza).
 * @param {string} userId
 * @param {string} type
 * @param {string} id
 * @param {ReminderConfig} config
 * @returns {Promise<void>}
 */
export async function saveReminderConfig(userId, type, id, { daysBefore, time, channel }) {
  await pool.query(
    `INSERT INTO avisos (usuario_id, origen_tipo, origen_id, dias_antes, hora, canal)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (origen_tipo, origen_id) DO UPDATE SET
       dias_antes = EXCLUDED.dias_antes, hora = EXCLUDED.hora, canal = EXCLUDED.canal, updated_at = now()`,
    [userId, type, id, daysBefore, time, channel],
  );
}

/**
 * Cómo avisar de cada cosa; las que no tienen configuración traen la de siempre.
 * @param {string} type
 * @param {string[]} ids
 * @returns {Promise<Map<string, ReminderConfig>>}
 */
export async function findReminderConfigs(type, ids) {
  const configs = new Map(ids.map((id) => [id, { ...DEFAULT_REMINDER }]));
  if (ids.length === 0) return configs;
  const { rows } = await pool.query(
    `SELECT origen_id AS id, dias_antes::int[] AS "daysBefore", to_char(hora, 'HH24:MI') AS time, canal AS channel
     FROM avisos WHERE origen_tipo = $1 AND origen_id = ANY($2::uuid[])`,
    [type, ids],
  );
  for (const { id, ...config } of rows) configs.set(id, config);
  return configs;
}

/**
 * Borra la configuración y las marcas de envío de algo que ya no existe.
 * @param {string} type
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function deleteReminderConfig(type, id) {
  await pool.query('DELETE FROM avisos WHERE origen_tipo = $1 AND origen_id = $2', [type, id]);
  await pool.query('DELETE FROM avisos_enviados WHERE origen_tipo = $1 AND origen_id = $2', [type, id]);
}

/**
 * Deja constancia de que el aviso salió. Va antes de enviar: si el envío falla a medias, no se repite.
 * @param {{ type: string, id: string, userId: string, dueDate: string, daysBefore: number }} reminder
 * @returns {Promise<boolean>} `false` si ya estaba marcado (otro ciclo lo envió).
 */
export async function markReminderSent({ type, id, userId, dueDate, daysBefore }) {
  const { rowCount } = await pool.query(
    `INSERT INTO avisos_enviados (usuario_id, origen_tipo, origen_id, fecha_vence, dias_antes)
     VALUES ($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING`,
    [userId, type, id, dueDate, daysBefore],
  );
  return rowCount === 1;
}
