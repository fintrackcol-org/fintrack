import { pool } from '../config/db.js';

/**
 * Guarda el hash de un refresh token recién emitido.
 * @param {{ userId: string, tokenHash: string, expiresAt: Date }} data
 * @returns {Promise<void>}
 */
export async function saveRefreshToken({ userId, tokenHash, expiresAt }) {
  await pool.query(
    `INSERT INTO refresh_tokens (usuario_id, token_hash, expires_at)
     VALUES ($1, $2, $3)`,
    [userId, tokenHash, expiresAt],
  );
}

/**
 * Consume un refresh token: si es válido (existe, no está revocado ni vencido) devuelve a quién
 * pertenece y lo deja vencer en 60 s. No se revoca al instante: si la respuesta con el token nuevo
 * no llega al celular (servidor despertando, app cerrada a mitad), el reintento con el viejo aún
 * sirve y la sesión no se pierde. El logout y el cambio de contraseña sí lo revocan de una vez.
 * @param {string} tokenHash
 * @returns {Promise<string|null>} Id del usuario dueño, o `null` si el token no es válido.
 */
export async function consumeRefreshToken(tokenHash) {
  const { rows } = await pool.query(
    `UPDATE refresh_tokens
     SET expires_at = LEAST(expires_at, now() + interval '60 seconds')
     WHERE token_hash = $1 AND revoked_at IS NULL AND expires_at > now()
     RETURNING usuario_id AS "userId"`,
    [tokenHash],
  );
  return rows[0]?.userId ?? null;
}

/**
 * Revoca un refresh token de un usuario (logout). No falla si ya estaba revocado o no existe.
 * @param {{ userId: string, tokenHash: string }} data
 * @returns {Promise<void>}
 */
export async function revokeRefreshToken({ userId, tokenHash }) {
  await pool.query(
    `UPDATE refresh_tokens
     SET revoked_at = now()
     WHERE token_hash = $1 AND usuario_id = $2 AND revoked_at IS NULL`,
    [tokenHash, userId],
  );
}
