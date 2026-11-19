import { pool } from '../config/db.js';

/**
 * @typedef {object} DebtRecord
 * @property {string} id UUID de la cuenta.
 * @property {'receivable'|'payable'} kind `receivable`: me deben; `payable`: debo.
 * @property {string} person A quién se le debe o quién debe.
 * @property {number} amount Monto.
 * @property {string|null} dueDate Fecha límite AAAA-MM-DD.
 * @property {string|null} note Nota libre.
 * @property {Date|null} settledAt Cuándo se saldó.
 * @property {string|null} transactionId Movimiento creado al saldarla.
 * @property {Date} createdAt Cuándo se creó.
 * @property {Date} updatedAt Último cambio.
 * @property {string|null} loanDate Cuándo se prestó (FT-0064).
 * @property {number|null} installments Número de cuotas; `null` si es a fecha fija.
 * @property {'weekly'|'biweekly'|'monthly'|null} frequency Cada cuánto es una cuota.
 * @property {string|null} firstDueDate Fecha de la primera cuota.
 * @property {number} paid Suma de los abonos.
 */

/** `kind` de la API → `tipo` en la base. */
export const KIND_TO_DB = { receivable: 'por_cobrar', payable: 'por_pagar' };

const COLUMNS = `id, CASE tipo WHEN 'por_cobrar' THEN 'receivable' ELSE 'payable' END AS kind,
  persona AS person, monto::float8 AS amount, to_char(fecha_limite, 'YYYY-MM-DD') AS "dueDate",
  nota AS note, saldada_at AS "settledAt", transaccion_id AS "transactionId",
  created_at AS "createdAt", updated_at AS "updatedAt",
  to_char(fecha_prestamo, 'YYYY-MM-DD') AS "loanDate", cuotas::int AS installments,
  CASE frecuencia WHEN 'semanal' THEN 'weekly' WHEN 'quincenal' THEN 'biweekly'
                  WHEN 'mensual' THEN 'monthly' END AS frequency,
  to_char(primera_cuota, 'YYYY-MM-DD') AS "firstDueDate",
  (SELECT COALESCE(sum(a.monto), 0)::float8 FROM abonos_cuenta a
    WHERE a.cuenta_id = cuentas_personales.id) AS paid`;

/** `frequency` de la API → `frecuencia` en la base (FT-0064). */
const FREQUENCY_TO_DB = { weekly: 'semanal', biweekly: 'quincenal', monthly: 'mensual' };

/** Campo editable → columna. */
const UPDATABLE = {
  person: 'persona',
  amount: 'monto',
  dueDate: 'fecha_limite',
  note: 'nota',
  loanDate: 'fecha_prestamo',
  installments: 'cuotas',
  frequency: 'frecuencia',
  firstDueDate: 'primera_cuota',
};

/**
 * Inserta una cuenta.
 * @param {{ userId: string, kind: 'receivable'|'payable', person: string, amount: number, dueDate?: string|null, note?: string|null, loanDate?: string|null, installments?: number|null, frequency?: string|null, firstDueDate?: string|null }} data
 * @returns {Promise<DebtRecord>}
 */
export async function insertDebt(data) {
  const { rows } = await pool.query(
    `INSERT INTO cuentas_personales
       (usuario_id, tipo, persona, monto, fecha_limite, nota, fecha_prestamo, cuotas, frecuencia, primera_cuota)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING ${COLUMNS}`,
    [
      data.userId,
      KIND_TO_DB[data.kind],
      data.person,
      data.amount,
      data.dueDate ?? null,
      data.note ?? null,
      data.loanDate ?? null,
      data.installments ?? null,
      data.frequency ? FREQUENCY_TO_DB[data.frequency] : null,
      data.firstDueDate ?? null,
    ],
  );
  return rows[0];
}

/**
 * Cuentas del usuario: primero las pendientes (por fecha límite, las sin fecha al final) y luego
 * las saldadas, de la más reciente a la más vieja.
 * @param {string} userId
 * @returns {Promise<DebtRecord[]>}
 */
export async function listDebts(userId) {
  const { rows } = await pool.query(
    `SELECT ${COLUMNS} FROM cuentas_personales WHERE usuario_id = $1
     ORDER BY saldada_at IS NOT NULL, saldada_at DESC, fecha_limite ASC NULLS LAST, created_at DESC`,
    [userId],
  );
  return rows;
}

/**
 * Una cuenta del usuario (RN-01: nunca la de otro).
 * @param {string} id
 * @param {string} userId
 * @param {import('pg').Pool|import('pg').PoolClient} [client]
 * @returns {Promise<DebtRecord|undefined>}
 */
export async function findDebt(id, userId, client = pool) {
  const { rows } = await client.query(
    `SELECT ${COLUMNS} FROM cuentas_personales WHERE id = $1 AND usuario_id = $2`,
    [id, userId],
  );
  return rows[0];
}

/**
 * Edita una cuenta pendiente. Si cambia la fecha límite, se vuelve a poder avisar.
 * @param {string} id
 * @param {string} userId
 * @param {Partial<Pick<DebtRecord, 'person'|'amount'|'dueDate'|'note'|'loanDate'|'installments'|'frequency'|'firstDueDate'>>} changes
 * @param {import('pg').Pool|import('pg').PoolClient} [client]
 * @returns {Promise<DebtRecord|undefined>} `undefined` si no existe o ya está saldada.
 */
export async function updateDebt(id, userId, changes, client = pool) {
  const sets = [];
  const values = [id, userId];
  for (const [field, column] of Object.entries(UPDATABLE)) {
    if (changes[field] === undefined) continue;
    values.push(field === 'frequency' && changes[field] ? FREQUENCY_TO_DB[changes[field]] : changes[field]);
    sets.push(`${column} = $${values.length}`);
  }
  if (changes.dueDate !== undefined) sets.push('recordatorio_enviado = false');
  sets.push('updated_at = now()');
  const { rows } = await client.query(
    `UPDATE cuentas_personales SET ${sets.join(', ')}
     WHERE id = $1 AND usuario_id = $2 AND saldada_at IS NULL RETURNING ${COLUMNS}`,
    values,
  );
  return rows[0];
}

/**
 * Borra la cuenta (no borra el movimiento que se haya creado al saldarla).
 * @param {string} id
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function deleteDebt(id, userId) {
  const { rowCount } = await pool.query(
    'DELETE FROM cuentas_personales WHERE id = $1 AND usuario_id = $2',
    [id, userId],
  );
  return rowCount === 1;
}

/**
 * Marca la cuenta como saldada si sigue pendiente. Con `client` va dentro de la transacción SQL
 * que también crea el movimiento.
 * @param {{ id: string, userId: string, transactionId: string|null }} data
 * @param {import('pg').Pool|import('pg').PoolClient} [client]
 * @returns {Promise<DebtRecord|undefined>} `undefined` si otra petición ya la saldó.
 */
export async function markSettled({ id, userId, transactionId }, client = pool) {
  const { rows } = await client.query(
    `UPDATE cuentas_personales SET saldada_at = now(), transaccion_id = $3, updated_at = now()
     WHERE id = $1 AND usuario_id = $2 AND saldada_at IS NULL RETURNING ${COLUMNS}`,
    [id, userId, transactionId],
  );
  return rows[0];
}

/**
 * Cuentas pendientes cuyo aviso toca hoy (hora local de su dueño) y aún no salió (FT-0063).
 * Cada cuenta avisa con la anticipación, la hora y el canal que eligió el usuario; sin configuración,
 * un día antes, por notificación y a la primera hora de su recordatorio diario (o 09:00).
 * @returns {Promise<{ id: string, userId: string, timezone: string, time: string, kind: 'receivable'|'payable', person: string, amount: number, dueDate: string, daysBefore: number, channel: 'push'|'whatsapp'|'both', installments: number|null, frequency: string|null, firstDueDate: string|null, paid: number }[]>}
 */
export async function listDebtsDueTomorrow() {
  const { rows } = await pool.query(
    `SELECT c.id, c.usuario_id AS "userId", u.timezone,
            COALESCE(to_char(a.hora, 'HH24:MI'),
                     to_char((SELECT min(t) FROM unnest(u.reminder_times) AS t), 'HH24:MI'), '09:00') AS time,
            CASE c.tipo WHEN 'por_cobrar' THEN 'receivable' ELSE 'payable' END AS kind,
            c.persona AS person, c.monto::float8 AS amount,
            to_char(c.fecha_limite, 'YYYY-MM-DD') AS "dueDate", d.dias AS "daysBefore",
            COALESCE(a.canal, 'push') AS channel,
            -- Para avisar lo que falta de la cuota y no el total (FT-0064).
            c.cuotas::int AS installments,
            CASE c.frecuencia WHEN 'semanal' THEN 'weekly' WHEN 'quincenal' THEN 'biweekly'
                              WHEN 'mensual' THEN 'monthly' END AS frequency,
            to_char(c.primera_cuota, 'YYYY-MM-DD') AS "firstDueDate",
            (SELECT COALESCE(sum(ab.monto), 0)::float8 FROM abonos_cuenta ab WHERE ab.cuenta_id = c.id) AS paid
     FROM cuentas_personales c
     JOIN usuarios u ON u.id = c.usuario_id
     LEFT JOIN avisos a ON a.origen_tipo = 'cuenta' AND a.origen_id = c.id
     CROSS JOIN LATERAL (SELECT c.fecha_limite - (now() AT TIME ZONE u.timezone)::date AS dias) d
     WHERE c.saldada_at IS NULL AND c.fecha_limite IS NOT NULL
       AND d.dias = ANY(COALESCE(a.dias_antes, '{1}'))
       -- Las que ya se avisaron con el sistema anterior (un día antes) no se repiten.
       AND NOT (a.id IS NULL AND c.recordatorio_enviado)
       AND NOT EXISTS (SELECT 1 FROM avisos_enviados e
                       WHERE e.origen_tipo = 'cuenta' AND e.origen_id = c.id
                         AND e.fecha_vence = c.fecha_limite AND e.dias_antes = d.dias)`,
  );
  return rows;
}

/**
 * @typedef {object} PaymentRecord Un abono a una cuenta (FT-0064).
 * @property {string} id
 * @property {string} debtId
 * @property {number} amount
 * @property {string} date AAAA-MM-DD
 * @property {string|null} transactionId Ingreso o gasto creado con el abono.
 * @property {Date} createdAt
 */

const PAYMENT_COLUMNS = `id, cuenta_id AS "debtId", monto::float8 AS amount, to_char(fecha, 'YYYY-MM-DD') AS date,
  transaccion_id AS "transactionId", created_at AS "createdAt"`;

/**
 * Registra un abono. Va dentro de la transacción SQL que también puede crear el movimiento.
 * @param {{ debtId: string, userId: string, amount: number, date: string, transactionId: string|null }} data
 * @param {import('pg').Pool|import('pg').PoolClient} [client]
 * @returns {Promise<PaymentRecord>}
 */
export async function insertPayment({ debtId, userId, amount, date, transactionId }, client = pool) {
  const { rows } = await client.query(
    `INSERT INTO abonos_cuenta (cuenta_id, usuario_id, monto, fecha, transaccion_id)
     VALUES ($1, $2, $3, $4, $5) RETURNING ${PAYMENT_COLUMNS}`,
    [debtId, userId, amount, date, transactionId],
  );
  return rows[0];
}

/**
 * Abonos de varias cuentas del usuario, del más reciente al más viejo.
 * @param {string} userId
 * @param {string[]} debtIds
 * @returns {Promise<Map<string, PaymentRecord[]>>} Cuenta → sus abonos.
 */
export async function listPayments(userId, debtIds) {
  const map = new Map(debtIds.map((id) => [id, []]));
  if (debtIds.length === 0) return map;
  const { rows } = await pool.query(
    `SELECT ${PAYMENT_COLUMNS} FROM abonos_cuenta
     WHERE usuario_id = $1 AND cuenta_id = ANY($2::uuid[]) ORDER BY fecha DESC, created_at DESC`,
    [userId, debtIds],
  );
  for (const row of rows) map.get(row.debtId)?.push(row);
  return map;
}

/**
 * Borra un abono de una cuenta pendiente del usuario (para corregir un error) y, en la misma
 * transacción, el movimiento que se creó con él (borrado lógico, para que la sincronización lo
 * propague): si el abono estaba mal, el ingreso o el gasto también.
 * @param {{ id: string, debtId: string, userId: string }} data
 * @returns {Promise<{ transactionId: string|null }|null>} `null` si no existe o la cuenta ya está saldada.
 */
export async function deletePayment({ id, debtId, userId }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `DELETE FROM abonos_cuenta a USING cuentas_personales c
       WHERE a.id = $1 AND a.cuenta_id = $2 AND a.usuario_id = $3
         AND c.id = a.cuenta_id AND c.saldada_at IS NULL
       RETURNING a.transaccion_id AS "transactionId"`,
      [id, debtId, userId],
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    const { transactionId } = rows[0];
    if (transactionId) {
      await client.query(
        `UPDATE transacciones SET deleted_at = now(), updated_at = now()
         WHERE id = $1 AND usuario_id = $2 AND deleted_at IS NULL`,
        [transactionId, userId],
      );
    }
    await client.query('COMMIT');
    return { transactionId };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
