import { pool } from '../config/db.js';

/** Código de error de PostgreSQL por violar un índice único. */
const UNIQUE_VIOLATION = '23505';

/**
 * Número vinculado de un usuario.
 * @param {string} userId
 * @returns {Promise<string|null>}
 */
export async function findPhone(userId) {
  const { rows } = await pool.query(
    'SELECT telefono AS phone FROM whatsapp_vinculos WHERE usuario_id = $1',
    [userId],
  );
  return rows[0]?.phone ?? null;
}

/**
 * Dueño de un número vinculado.
 * @param {string} phone
 * @returns {Promise<string|null>}
 */
export async function findUserIdByPhone(phone) {
  const { rows } = await pool.query(
    'SELECT usuario_id AS "userId" FROM whatsapp_vinculos WHERE telefono = $1',
    [phone],
  );
  return rows[0]?.userId ?? null;
}

/**
 * Guarda el código para vincular. Reemplaza el anterior y no toca el número ya vinculado.
 * @param {{ userId: string, codeHash: string, expiresAt: Date }} data
 * @returns {Promise<void>}
 */
export async function saveLinkCode({ userId, codeHash, expiresAt }) {
  await pool.query(
    `INSERT INTO whatsapp_vinculos (usuario_id, codigo_hash, codigo_expira)
     VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id)
     DO UPDATE SET codigo_hash = EXCLUDED.codigo_hash, codigo_expira = EXCLUDED.codigo_expira`,
    [userId, codeHash, expiresAt],
  );
}

/**
 * Gasta un código vigente y le asigna el número a su usuario, en una sola sentencia.
 * @param {{ codeHash: string, phone: string }} data
 * @returns {Promise<'linked'|'invalid'|'taken'>} `taken` si el número es de otra cuenta.
 */
export async function confirmLink({ codeHash, phone }) {
  try {
    const { rowCount } = await pool.query(
      `UPDATE whatsapp_vinculos
       SET telefono = $2, codigo_hash = NULL, codigo_expira = NULL
       WHERE codigo_hash = $1 AND codigo_expira > now()`,
      [codeHash, phone],
    );
    return rowCount > 0 ? 'linked' : 'invalid';
  } catch (err) {
    if (err.code === UNIQUE_VIOLATION) return 'taken';
    throw err;
  }
}

/**
 * Desconecta el número del usuario.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function removeLink(userId) {
  await pool.query('DELETE FROM whatsapp_vinculos WHERE usuario_id = $1', [userId]);
}

/**
 * Reserva un mensaje para procesarlo y borra los de más de 30 días.
 * @param {{ messageId: string, userId: string }} data
 * @returns {Promise<boolean>} `false` si ya se había procesado.
 */
export async function claimMessage({ messageId, userId }) {
  const { rowCount } = await pool.query(
    `WITH viejos AS (
       DELETE FROM whatsapp_mensajes WHERE created_at < now() - interval '30 days'
     )
     INSERT INTO whatsapp_mensajes (mensaje_id, usuario_id)
     VALUES ($1, $2)
     ON CONFLICT (mensaje_id) DO NOTHING`,
    [messageId, userId],
  );
  return rowCount > 0;
}

/**
 * Mensajes de un usuario en las últimas 24 horas.
 * @param {string} userId
 * @returns {Promise<number>}
 */
export async function countRecentMessages(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM whatsapp_mensajes
     WHERE usuario_id = $1 AND created_at > now() - interval '1 day'`,
    [userId],
  );
  return rows[0].n;
}

/** Inicio del mes en curso, en hora de Colombia. */
const MONTH_START =
  "date_trunc('month', now() AT TIME ZONE 'America/Bogota') AT TIME ZONE 'America/Bogota'";

/**
 * Respuestas enviadas en el mes en curso (las que Meta cobra).
 * @returns {Promise<number>}
 */
export async function countMonthSends() {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM whatsapp_envios WHERE created_at >= ${MONTH_START}`,
  );
  return rows[0].n;
}

/**
 * Anota una respuesta enviada y borra las de más de 62 días.
 * @param {{ userId: string|null, phoneHash: string }} data `userId` es `null` si el número no está conectado.
 * @returns {Promise<number>} Respuestas del mes, contando esta.
 */
export async function recordSend({ userId, phoneHash }) {
  await pool.query(
    `WITH viejos AS (
       DELETE FROM whatsapp_envios WHERE created_at < now() - interval '62 days'
     )
     INSERT INTO whatsapp_envios (usuario_id, telefono_hash) VALUES ($1, $2)`,
    [userId, phoneHash],
  );
  return countMonthSends();
}

/**
 * Respuestas de las últimas 24 horas a un número sin conectar.
 * @param {string} phoneHash
 * @returns {Promise<number>}
 */
export async function countStrangerSends(phoneHash) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM whatsapp_envios
     WHERE telefono_hash = $1 AND usuario_id IS NULL AND created_at > now() - interval '1 day'`,
    [phoneHash],
  );
  return rows[0].n;
}

/**
 * Estado del acceso de un usuario al bot.
 * @param {string} userId
 * @returns {Promise<'pendiente'|'aprobado'|'rechazado'|null>} `null` si no lo ha pedido.
 */
export async function findAccess(userId) {
  const { rows } = await pool.query('SELECT estado FROM whatsapp_accesos WHERE usuario_id = $1', [
    userId,
  ]);
  return rows[0]?.estado ?? null;
}

/**
 * Guarda la solicitud de acceso. No cambia una que ya existe.
 * @param {string} userId
 * @returns {Promise<boolean>} `false` si ya había una.
 */
export async function requestAccess(userId) {
  const { rowCount } = await pool.query(
    'INSERT INTO whatsapp_accesos (usuario_id) VALUES ($1) ON CONFLICT (usuario_id) DO NOTHING',
    [userId],
  );
  return rowCount > 0;
}

/**
 * Aprueba o rechaza el acceso de un usuario, lo haya pedido o no.
 * @param {string} userId
 * @param {'aprobado'|'rechazado'} status
 * @returns {Promise<string|null>} Correo del usuario, o `null` si no existe.
 */
export async function setAccess(userId, status) {
  const { rows } = await pool.query(
    `WITH acceso AS (
       INSERT INTO whatsapp_accesos (usuario_id, estado, resuelto_at)
       SELECT id, $2, now() FROM usuarios WHERE id = $1
       ON CONFLICT (usuario_id) DO UPDATE SET estado = EXCLUDED.estado, resuelto_at = now()
       RETURNING usuario_id
     )
     SELECT u.email FROM usuarios u JOIN acceso a ON a.usuario_id = u.id`,
    [userId, status],
  );
  return rows[0]?.email ?? null;
}

/**
 * Quienes pidieron acceso, con las respuestas que llevan en el mes. Primero los pendientes.
 * @returns {Promise<Array<{ userId: string, email: string, name: string|null, status: string, requestedAt: Date, linked: boolean, monthSends: number }>>}
 */
export async function listAccess() {
  const { rows } = await pool.query(
    `SELECT a.usuario_id AS "userId", u.email, u.nombre AS name, a.estado AS status,
            a.solicitado_at AS "requestedAt",
            COALESCE(v.telefono IS NOT NULL, false) AS linked,
            (SELECT COUNT(*)::int FROM whatsapp_envios e
              WHERE e.usuario_id = a.usuario_id AND e.created_at >= ${MONTH_START}) AS "monthSends"
     FROM whatsapp_accesos a
     JOIN usuarios u ON u.id = a.usuario_id
     LEFT JOIN whatsapp_vinculos v ON v.usuario_id = a.usuario_id
     ORDER BY (a.estado = 'pendiente') DESC, a.solicitado_at DESC`,
  );
  return rows;
}
