import { pool } from '../config/db.js';

/**
 * Tasa guardada para ese día: 1 `base` = `tasa` `quote`.
 * @param {string} date AAAA-MM-DD
 * @param {string} base
 * @param {string} quote
 * @returns {Promise<number|null>}
 */
export async function findRate(date, base, quote) {
  const { rows } = await pool.query(
    'SELECT tasa::float8 AS rate FROM tasas_cambio WHERE fecha = $1 AND base = $2 AND moneda = $3',
    [date, base, quote],
  );
  return rows[0]?.rate ?? null;
}

/**
 * La tasa más reciente que se tenga de ese par, de cualquier día (por si Frankfurter no responde).
 * @param {string} base
 * @param {string} quote
 * @returns {Promise<{ rate: number, date: string }|null>}
 */
export async function latestRate(base, quote) {
  const { rows } = await pool.query(
    `SELECT tasa::float8 AS rate, to_char(fecha, 'YYYY-MM-DD') AS date FROM tasas_cambio
     WHERE base = $1 AND moneda = $2 ORDER BY fecha DESC LIMIT 1`,
    [base, quote],
  );
  return rows[0] ?? null;
}

/**
 * Guarda la tasa de un día (si ya estaba, la deja).
 * @param {string} date
 * @param {string} base
 * @param {string} quote
 * @param {number} rate
 * @returns {Promise<void>}
 */
export async function saveRate(date, base, quote, rate) {
  await pool.query(
    `INSERT INTO tasas_cambio (fecha, base, moneda, tasa) VALUES ($1, $2, $3, $4)
     ON CONFLICT (fecha, base, moneda) DO NOTHING`,
    [date, base, quote, rate],
  );
}
