import { pool } from '../config/db.js';

// Avisos del negocio (FT-0058): cuentas por vencer o vencidas y fechas de impuestos. Cada aviso se
// marca en su fila para no repetirlo.

/** Saldo de la cuenta `c`. */
const REMAINING = `(c.monto - COALESCE((SELECT SUM(a.monto) FROM negocio_abonos a WHERE a.cuenta_id = c.id), 0))`;

/**
 * Cuentas con saldo que vencen mañana (`previo`) o que ya vencieron hace menos de 30 días
 * (`vencida`), sin el aviso correspondiente.
 * @param {string} today AAAA-MM-DD (Colombia).
 * @returns {Promise<Array<{ id: string, businessId: string, businessName: string, kind: 'receivable'|'payable', party: string, remaining: number, dueDate: string, stage: 'previo'|'vencida' }>>}
 */
export async function listAccountAlerts(today) {
  const { rows } = await pool.query(
    `SELECT c.id, n.id AS "businessId", n.nombre AS "businessName",
            CASE c.tipo WHEN 'cobrar' THEN 'receivable' ELSE 'payable' END AS kind,
            c.tercero AS party, ${REMAINING}::float8 AS remaining,
            to_char(c.vence, 'YYYY-MM-DD') AS "dueDate",
            CASE WHEN c.vence = $1::date + 1 THEN 'previo' ELSE 'vencida' END AS stage
     FROM negocio_cuentas c JOIN negocios n ON n.id = c.negocio_id
     WHERE ${REMAINING} > 0
       AND ((c.vence = $1::date + 1 AND c.aviso_previo_at IS NULL)
         OR (c.vence < $1::date AND c.vence >= $1::date - 30 AND c.aviso_vencida_at IS NULL))`,
    [today],
  );
  return rows;
}

/**
 * Fechas de impuestos de hoy a 3 días que aún no se han avisado.
 * @param {string} today AAAA-MM-DD (Colombia).
 * @returns {Promise<Array<{ id: string, businessId: string, businessName: string, name: string, date: string }>>}
 */
export async function listTaxDateAlerts(today) {
  const { rows } = await pool.query(
    `SELECT f.id, n.id AS "businessId", n.nombre AS "businessName", f.nombre AS name,
            to_char(f.fecha, 'YYYY-MM-DD') AS date
     FROM negocio_fechas_impuesto f JOIN negocios n ON n.id = f.negocio_id
     WHERE f.avisada_at IS NULL AND f.fecha BETWEEN $1::date AND $1::date + 3`,
    [today],
  );
  return rows;
}

/**
 * Socios que registran en el negocio (dueños y editores): a ellos les llegan los avisos.
 * @param {string} businessId
 * @returns {Promise<string[]>}
 */
export async function listRecorders(businessId) {
  const { rows } = await pool.query(
    "SELECT usuario_id AS id FROM negocio_socios WHERE negocio_id = $1 AND rol IN ('dueno', 'editor')",
    [businessId],
  );
  return rows.map((r) => r.id);
}

/**
 * @param {string} id
 * @param {'previo'|'vencida'} stage
 * @returns {Promise<void>}
 */
export async function markAccountAlert(id, stage) {
  const column = stage === 'previo' ? 'aviso_previo_at' : 'aviso_vencida_at';
  await pool.query(`UPDATE negocio_cuentas SET ${column} = now() WHERE id = $1`, [id]);
}

/**
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function markTaxDateAlert(id) {
  await pool.query('UPDATE negocio_fechas_impuesto SET avisada_at = now() WHERE id = $1', [id]);
}

/* ---------- Fechas de impuestos del negocio ---------- */

/**
 * @param {string} businessId
 * @returns {Promise<Array<{ id: string, name: string, date: string }>>} De la más próxima a la más lejana.
 */
export async function listTaxDates(businessId) {
  const { rows } = await pool.query(
    `SELECT id, nombre AS name, to_char(fecha, 'YYYY-MM-DD') AS date
     FROM negocio_fechas_impuesto WHERE negocio_id = $1 ORDER BY fecha, nombre`,
    [businessId],
  );
  return rows;
}

/**
 * @param {string} businessId
 * @param {{ name: string, date: string }} data
 * @returns {Promise<{ id: string, name: string, date: string }>}
 */
export async function insertTaxDate(businessId, { name, date }) {
  const { rows } = await pool.query(
    `INSERT INTO negocio_fechas_impuesto (negocio_id, nombre, fecha) VALUES ($1, $2, $3)
     RETURNING id, nombre AS name, to_char(fecha, 'YYYY-MM-DD') AS date`,
    [businessId, name, date],
  );
  return rows[0];
}

/**
 * @param {string} businessId
 * @param {string} id
 * @returns {Promise<boolean>}
 */
export async function deleteTaxDate(businessId, id) {
  const { rowCount } = await pool.query(
    'DELETE FROM negocio_fechas_impuesto WHERE negocio_id = $1 AND id = $2',
    [businessId, id],
  );
  return rowCount > 0;
}
