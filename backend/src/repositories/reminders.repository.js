import { pool } from '../config/db.js';

/**
 * @typedef {object} ReminderSettings
 * @property {string[]} times Horas locales del recordatorio (HH:mm), ordenadas; vacío si está desactivado.
 * @property {string} timezone Zona horaria IANA del usuario.
 * @property {boolean} cardReminders Si quiere el aviso de pago de tarjetas.
 */

/**
 * @typedef {object} ReminderCandidate
 * @property {string} id Identificador del usuario.
 * @property {string[]} times Horas locales del recordatorio (HH:mm).
 * @property {string} timezone Zona horaria IANA del usuario.
 * @property {boolean} hasSubscription Si el usuario tiene al menos un dispositivo suscrito.
 */

const SETTINGS_COLUMNS = `ARRAY(
  SELECT to_char(t, 'HH24:MI') FROM unnest(reminder_times) AS t ORDER BY t
) AS times, timezone, recordar_tarjetas AS "cardReminders"`;

/**
 * Lee la configuración del recordatorio de un usuario.
 * @param {string} userId
 * @returns {Promise<ReminderSettings|null>} `null` si el usuario no existe.
 */
export async function findReminderSettings(userId) {
  const { rows } = await pool.query(`SELECT ${SETTINGS_COLUMNS} FROM usuarios WHERE id = $1`, [
    userId,
  ]);
  return rows[0] ?? null;
}

/**
 * Guarda las horas y la zona horaria del recordatorio.
 * @param {string} userId
 * @param {ReminderSettings} settings
 * @returns {Promise<ReminderSettings|null>} La configuración guardada, o `null` si el usuario no existe.
 */
export async function saveReminderSettings(userId, { times, timezone, cardReminders = null }) {
  const { rows } = await pool.query(
    `UPDATE usuarios SET reminder_times = $2::time[], timezone = $3,
         recordar_tarjetas = COALESCE($4, recordar_tarjetas)
     WHERE id = $1
     RETURNING ${SETTINGS_COLUMNS}`,
    [userId, times, timezone, cardReminders],
  );
  return rows[0] ?? null;
}

/**
 * Lista a los usuarios que tienen el recordatorio activado.
 * @returns {Promise<ReminderCandidate[]>}
 */
export async function listReminderCandidates() {
  const { rows } = await pool.query(
    `SELECT u.id,
            ARRAY(SELECT to_char(t, 'HH24:MI') FROM unnest(u.reminder_times) AS t ORDER BY t) AS times,
            u.timezone,
            EXISTS (SELECT 1 FROM push_subscriptions p WHERE p.usuario_id = u.id) AS "hasSubscription"
     FROM usuarios u
     WHERE cardinality(u.reminder_times) > 0`,
  );
  return rows;
}

/**
 * Usuarios con tarjetas activas que quieren el aviso de pago. Sin push igual se avisa: queda en la
 * bandeja de la app (FT-0045).
 * `time` es su primera hora de recordatorio, o 09:00 si no tiene ninguna.
 * @returns {Promise<{ id: string, timezone: string, time: string }[]>}
 */
export async function listCardReminderUsers() {
  const { rows } = await pool.query(
    `SELECT u.id, u.timezone,
            COALESCE(to_char((SELECT min(t) FROM unnest(u.reminder_times) AS t), 'HH24:MI'), '09:00') AS time
     FROM usuarios u
     WHERE u.recordar_tarjetas
       AND EXISTS (SELECT 1 FROM tarjetas c WHERE c.usuario_id = u.id AND c.deleted_at IS NULL)`,
  );
  return rows;
}

/**
 * Usuarios con Mi plata configurada, a quienes el motor de liquidez puede avisar (FT-0059), con
 * el último aviso que se les envió. `time` es su primera hora de recordatorio, o 09:00.
 * @returns {Promise<{ id: string, timezone: string, time: string, last: { date: string, daysBefore: number, missing: number }|null }[]>}
 */
export async function listLiquidityReminderUsers() {
  const { rows } = await pool.query(
    `SELECT u.id, u.timezone,
            COALESCE(to_char((SELECT min(t) FROM unnest(u.reminder_times) AS t), 'HH24:MI'), '09:00') AS time,
            to_char(p.aviso_liquidez_fecha, 'YYYY-MM-DD') AS "lastDate",
            p.aviso_liquidez_dias AS "lastDays",
            p.aviso_liquidez_monto::float8 AS "lastMissing"
     FROM usuarios u
     JOIN perfiles_financieros p ON p.usuario_id = u.id
     WHERE p.tipo_ingreso IS NOT NULL`,
  );
  return rows.map(({ lastDate, lastDays, lastMissing, ...user }) => ({
    ...user,
    last: lastDate ? { date: lastDate, daysBefore: lastDays, missing: lastMissing } : null,
  }));
}

/**
 * Guarda el último aviso del motor de liquidez para no repetirlo.
 * @param {string} userId
 * @param {{ date: string, daysBefore: number, missing: number }} alert
 * @returns {Promise<void>}
 */
export async function saveLiquidityAlert(userId, { date, daysBefore, missing }) {
  await pool.query(
    `UPDATE perfiles_financieros
     SET aviso_liquidez_fecha = $2, aviso_liquidez_dias = $3, aviso_liquidez_monto = $4
     WHERE usuario_id = $1`,
    [userId, date, daysBefore, missing],
  );
}
