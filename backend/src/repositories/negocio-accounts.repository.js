import { pool } from '../config/db.js';

/**
 * @typedef {object} BusinessAccountRecord
 * @property {string} id
 * @property {'receivable'|'payable'} kind
 * @property {string} party Cliente o proveedor.
 * @property {string|null} description
 * @property {number} amount Monto total.
 * @property {number} paid Suma de los abonos.
 * @property {string|null} dueDate AAAA-MM-DD.
 * @property {string|null} authorId Quién la registró.
 * @property {Date} createdAt
 * @property {Array<{ id: string, amount: number, date: string, movementId: string, registeredBy: { id: string, name: string|null }|null }>} payments
 */

const ACCOUNT_COLUMNS = `c.id,
  CASE c.tipo WHEN 'cobrar' THEN 'receivable' ELSE 'payable' END AS kind,
  c.tercero AS party, c.descripcion AS description, c.monto::float8 AS amount,
  COALESCE((SELECT SUM(a.monto) FROM negocio_abonos a WHERE a.cuenta_id = c.id), 0)::float8 AS paid,
  to_char(c.vence, 'YYYY-MM-DD') AS "dueDate", c.usuario_id AS "authorId", c.created_at AS "createdAt"`;

const PAYMENTS = `COALESCE((
  SELECT json_agg(json_build_object(
           'id', a.id, 'amount', a.monto::float8, 'date', to_char(a.fecha, 'YYYY-MM-DD'),
           'movementId', a.movimiento_id,
           'registeredBy', CASE WHEN u.id IS NULL THEN NULL ELSE json_build_object('id', u.id, 'name', u.nombre) END
         ) ORDER BY a.fecha, a.created_at)
  FROM negocio_abonos a LEFT JOIN usuarios u ON u.id = a.usuario_id
  WHERE a.cuenta_id = c.id), '[]'::json) AS payments`;

/**
 * Cuentas del negocio con sus abonos.
 * @param {string} businessId
 * @returns {Promise<BusinessAccountRecord[]>}
 */
export async function listAccounts(businessId) {
  const { rows } = await pool.query(
    `SELECT ${ACCOUNT_COLUMNS}, ${PAYMENTS} FROM negocio_cuentas c WHERE c.negocio_id = $1`,
    [businessId],
  );
  return rows;
}

/**
 * @param {string} businessId
 * @param {string} id
 * @returns {Promise<BusinessAccountRecord|null>}
 */
export async function findAccount(businessId, id) {
  const { rows } = await pool.query(
    `SELECT ${ACCOUNT_COLUMNS}, ${PAYMENTS} FROM negocio_cuentas c WHERE c.negocio_id = $1 AND c.id = $2`,
    [businessId, id],
  );
  return rows[0] ?? null;
}

/**
 * @param {{ businessId: string, userId: string, kindDb: string, party: string, description: string|null, amount: number, dueDate: string|null }} data
 * @returns {Promise<string>} Id de la cuenta.
 */
export async function insertAccount(data) {
  const { rows } = await pool.query(
    `INSERT INTO negocio_cuentas (negocio_id, usuario_id, tipo, tercero, descripcion, monto, vence)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [data.businessId, data.userId, data.kindDb, data.party, data.description, data.amount, data.dueDate],
  );
  return rows[0].id;
}

/**
 * @param {string} businessId
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteAccount(businessId, id) {
  const { rowCount } = await pool.query(
    'DELETE FROM negocio_cuentas WHERE negocio_id = $1 AND id = $2',
    [businessId, id],
  );
  return rowCount > 0;
}

/**
 * Registra un abono y su movimiento en una sola transacción. Bloquea la cuenta para que dos abonos
 * al mismo tiempo no pasen del saldo.
 * @param {{ businessId: string, accountId: string, userId: string, amount: number, date: string, movement: { kindDb: string, category: string, description: string } }} data
 * @returns {Promise<{ ok: true, paymentId: string }|{ ok: false, remaining: number }|null>} `null` si la cuenta no existe.
 */
export async function insertPayment(data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Primero el bloqueo y después la suma, en otra consulta: en READ COMMITTED cada consulta ve lo
    // confirmado hasta que empieza, así la suma incluye el abono de quien tenía el bloqueo.
    const { rows: locked } = await client.query(
      `SELECT monto::float8 AS amount FROM negocio_cuentas
       WHERE negocio_id = $1 AND id = $2 FOR UPDATE`,
      [data.businessId, data.accountId],
    );
    if (!locked[0]) {
      await client.query('ROLLBACK');
      return null;
    }
    const { rows: sum } = await client.query(
      'SELECT COALESCE(SUM(monto), 0)::float8 AS paid FROM negocio_abonos WHERE cuenta_id = $1',
      [data.accountId],
    );
    const remaining = Math.round((locked[0].amount - sum[0].paid) * 100) / 100;
    if (data.amount > remaining) {
      await client.query('ROLLBACK');
      return { ok: false, remaining };
    }
    const { rows: movement } = await client.query(
      `INSERT INTO negocio_movimientos (negocio_id, usuario_id, tipo, categoria, monto, descripcion, fecha)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [
        data.businessId,
        data.userId,
        data.movement.kindDb,
        data.movement.category,
        data.amount,
        data.movement.description,
        data.date,
      ],
    );
    const { rows: payment } = await client.query(
      `INSERT INTO negocio_abonos (cuenta_id, usuario_id, monto, fecha, movimiento_id)
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [data.accountId, data.userId, data.amount, data.date, movement[0].id],
    );
    await client.query('COMMIT');
    return { ok: true, paymentId: payment[0].id };
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Abono de una cuenta del negocio, con quién lo registró y su movimiento.
 * @param {string} businessId
 * @param {string} accountId
 * @param {string} paymentId
 * @returns {Promise<{ id: string, authorId: string|null, movementId: string }|null>}
 */
export async function findPayment(businessId, accountId, paymentId) {
  const { rows } = await pool.query(
    `SELECT a.id, a.usuario_id AS "authorId", a.movimiento_id AS "movementId"
     FROM negocio_abonos a JOIN negocio_cuentas c ON c.id = a.cuenta_id
     WHERE c.negocio_id = $1 AND c.id = $2 AND a.id = $3`,
    [businessId, accountId, paymentId],
  );
  return rows[0] ?? null;
}
