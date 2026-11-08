import { pool } from '../config/db.js';

const COLUMNS = `id, nombre AS name, tipo AS kind, frecuencia AS frequency, dias_pago::int[] AS "payDays",
  monto_dicho::float8 AS amount, monto_bajo::float8 AS low, monto_alto::float8 AS high,
  montos_meses::float8[] AS "lastMonths", dias_semana::int AS "workDays"`;

/**
 * Fuentes de ingreso activas del usuario (FT-0060), en el orden en que las dijo.
 * @param {string} userId
 * @returns {Promise<import('../services/income.logic.js').IncomeSource[]>}
 */
export async function listSources(userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM fuentes_ingreso WHERE usuario_id = $1 AND activo ORDER BY created_at, id`,
    [userId],
  );
  return rows;
}

/**
 * Reemplaza las fuentes del usuario y actualiza `tipo_ingreso`/`dias_pago` del perfil (compatibilidad).
 * Las anteriores se desactivan en vez de borrarse: los ingresos ya asociados conservan su fuente.
 * @param {string} userId
 * @param {import('../services/income.logic.js').IncomeSource[]} sources
 * @param {{ incomeType: string|null, payDays: number[] }} legacy
 * @returns {Promise<void>}
 */
export async function replaceSources(userId, sources, legacy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE fuentes_ingreso SET activo = false WHERE usuario_id = $1 AND activo', [userId]);
    for (const s of sources) {
      await client.query(
        `INSERT INTO fuentes_ingreso
           (usuario_id, nombre, tipo, frecuencia, dias_pago, monto_dicho, monto_bajo, monto_alto, montos_meses, dias_semana, es_fijo, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, clock_timestamp())`,
        // clock_timestamp y no now(): now() es igual en toda la transacción y se perdería el orden.
        [
          userId,
          s.name,
          s.kind,
          s.frequency,
          s.payDays,
          s.amount,
          s.low,
          s.high,
          s.lastMonths,
          s.workDays,
          ['sueldo', 'mesada'].includes(s.kind),
        ],
      );
    }
    // El perfil existe desde la bienvenida; si no, se crea sin saldo.
    await client.query(
      `INSERT INTO perfiles_financieros (usuario_id, tipo_ingreso, dias_pago) VALUES ($1, $2, $3)
       ON CONFLICT (usuario_id) DO UPDATE SET tipo_ingreso = EXCLUDED.tipo_ingreso,
         dias_pago = EXCLUDED.dias_pago, updated_at = now()`,
      [userId, legacy.incomeType, legacy.payDays],
    );
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Ingresos de cada mes completo antes de `month` (sin incluirlo), del más reciente al más viejo.
 * Solo meses con algún ingreso. No cuenta los ingresos de "Ahorro" que vuelven de una meta.
 * @param {string} userId
 * @param {string} month AAAA-MM (el actual).
 * @param {number} [count] Meses hacia atrás.
 * @returns {Promise<number[]>}
 */
export async function monthlyIncomeHistory(userId, month, count = 6) {
  const { rows } = await pool.query(
    `SELECT to_char(fecha, 'YYYY-MM') AS month, SUM(monto)::float8 AS total
     FROM transacciones
     WHERE usuario_id = $1 AND deleted_at IS NULL AND tipo = 'ingreso'
       AND fecha < ($2 || '-01')::date AND fecha >= (($2 || '-01')::date - make_interval(months => $3))
     GROUP BY 1 ORDER BY 1 DESC`,
    [userId, month, count],
  );
  return rows.map((r) => r.total);
}
