import { pool } from '../config/db.js';
import { AppError } from '../errors/app-error.js';
import * as repo from '../repositories/debts.repository.js';
import * as reminders from '../repositories/reminder-configs.repository.js';
import { insertTransaction } from '../repositories/transactions.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import { todayIso } from './insights.service.js';
import { progress } from './debt-schedule.js';
import { t } from '../i18n/index.js';

// Cuentas personales por cobrar y por pagar (FT-0046). Son una lista para recordar: no tocan
// Mi plata. Solo al saldarlas, si el usuario quiere, se crea el ingreso o el gasto.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new AppError(404, 'NOT_FOUND', t('Cuenta no encontrada'));
/** Así se llaman las cuentas personales en el motor de recordatorios (FT-0063). */
export const DEBT_REMINDER_TYPE = 'cuenta';
const alreadySettled = () => new AppError(409, 'ALREADY_SETTLED', t('Esta cuenta ya está saldada'));

/**
 * El movimiento que se crea al saldar: cobrar es un ingreso; pagar, un gasto. Van en "Otros"
 * porque no se sabe en qué era el préstamo; el usuario puede cambiar la categoría después.
 * @param {{ kind: 'receivable'|'payable', person: string }} debt
 * @returns {{ type: 'ingreso'|'gasto', category: string, description: string }}
 */
export function settlementMovement({ kind, person }) {
  return kind === 'receivable'
    ? { type: 'ingreso', category: 'otros_ingresos', description: t('{person} me pagó', { person }) }
    : { type: 'gasto', category: 'otros', description: t('Le pagué a {person}', { person }) };
}

/**
 * El movimiento de un abono (FT-0064): como el de saldar, pero dice que fue un abono.
 * @param {{ kind: 'receivable'|'payable', person: string }} debt
 * @returns {{ type: 'ingreso'|'gasto', category: string, description: string }}
 */
export function paymentMovement({ kind, person }) {
  return kind === 'receivable'
    ? { type: 'ingreso', category: 'otros_ingresos', description: t('Abono de {person}', { person }) }
    : { type: 'gasto', category: 'otros', description: t('Abono a {person}', { person }) };
}

/**
 * La cuenta como la devuelve la API: con lo pagado, lo pendiente, las cuotas pagadas, la próxima
 * cuota y sus abonos (FT-0064).
 * @param {import('../repositories/debts.repository.js').DebtRecord} debt
 * @param {import('../repositories/debts.repository.js').PaymentRecord[]} [payments]
 * @returns {object}
 */
export function present(debt, payments = []) {
  const p = progress(debt, debt.paid ?? 0);
  return {
    ...debt,
    paid: p.paid,
    pending: debt.settledAt ? 0 : p.pending,
    paidInstallments: p.paidInstallments,
    nextInstallment: debt.settledAt ? null : p.next,
    payments: payments.map(({ debtId: _debtId, ...payment }) => payment),
  };
}

/**
 * Suma lo pendiente de cada lado (lo saldado no cuenta).
 * @param {import('../repositories/debts.repository.js').DebtRecord[]} items
 * @returns {{ receivable: number, payable: number }}
 */
export function pendingTotals(items) {
  const totals = { receivable: 0, payable: 0 };
  // Lo pendiente es el monto menos los abonos (FT-0064).
  for (const d of items) if (!d.settledAt) totals[d.kind] += d.amount - (d.paid ?? 0);
  totals.receivable = Math.round(totals.receivable * 100) / 100;
  totals.payable = Math.round(totals.payable * 100) / 100;
  return totals;
}

/**
 * @param {string} userId
 * @returns {Promise<{ items: object[], totals: { receivable: number, payable: number } }>}
 */
export async function list(userId) {
  const debts = await repo.listDebts(userId);
  const ids = debts.map((d) => d.id);
  const configs = await reminders.findReminderConfigs(DEBT_REMINDER_TYPE, ids);
  const payments = await repo.listPayments(userId, ids);
  const items = debts.map((d) => ({ ...present(d, payments.get(d.id)), reminder: configs.get(d.id) }));
  return { items, totals: pendingTotals(debts) };
}

/**
 * Guarda el bloque "Avisarme" si vino y devuelve la cuenta con el que quedó.
 * @param {string} userId
 * @param {import('../repositories/debts.repository.js').DebtRecord} debt
 * @param {import('../validators/reminders.validator.js').ReminderConfig} [reminder]
 * @returns {Promise<object>}
 */
async function withReminder(userId, debt, reminder) {
  if (reminder) await reminders.saveReminderConfig(userId, DEBT_REMINDER_TYPE, debt.id, reminder);
  const configs = await reminders.findReminderConfigs(DEBT_REMINDER_TYPE, [debt.id]);
  const payments = await repo.listPayments(userId, [debt.id]);
  return { ...present(debt, payments.get(debt.id)), reminder: configs.get(debt.id) };
}

/**
 * Con cuotas, la fecha límite es la de la próxima cuota pendiente: así el motor de avisos (FT-0063)
 * avisa cada cuota con la anticipación elegida. Se recalcula al crear, editar o abonar.
 * @param {string} userId
 * @param {import('../repositories/debts.repository.js').DebtRecord} debt
 * @param {import('pg').Pool|import('pg').PoolClient} [client]
 * @returns {Promise<import('../repositories/debts.repository.js').DebtRecord>}
 */
async function syncNextDueDate(userId, debt, client = pool) {
  if (!debt.installments) return debt;
  const next = progress(debt, debt.paid ?? 0).next;
  if (!next || next.date === debt.dueDate) return debt;
  return (await repo.updateDebt(debt.id, userId, { dueDate: next.date }, client)) ?? debt;
}

/**
 * Con cuotas, la fecha que llega como `dueDate` es la de la primera cuota.
 * @param {object} input
 * @returns {object}
 */
function withFirstDueDate(input) {
  if (input.installments) return { ...input, firstDueDate: input.dueDate };
  if (input.installments === null) return { ...input, frequency: null, firstDueDate: null };
  return input;
}

/**
 * @param {string} userId
 * @param {ReturnType<import('../validators/debts.validator.js').parseNewDebt>} input
 * @returns {Promise<object>}
 */
export async function create(userId, { reminder, ...input }) {
  return withReminder(userId, await repo.insertDebt({ userId, ...withFirstDueDate(input) }), reminder);
}

/**
 * Edita una cuenta pendiente; una saldada ya no se edita (409).
 * @param {string} userId
 * @param {string} id
 * @param {object} changes
 * @param {object} [changes.reminder] Bloque Avisarme (FT-0063).
 * @returns {Promise<object>}
 */
export async function update(userId, id, { reminder, ...changes }) {
  if (!UUID_RE.test(id)) throw notFound();
  const updated = await repo.updateDebt(id, userId, withFirstDueDate(changes));
  if (updated) return withReminder(userId, await syncNextDueDate(userId, updated), reminder);
  throw (await repo.findDebt(id, userId)) ? alreadySettled() : notFound();
}

/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 */
export async function remove(userId, id) {
  if (!UUID_RE.test(id) || !(await repo.deleteDebt(id, userId))) throw notFound();
  await reminders.deleteReminderConfig(DEBT_REMINDER_TYPE, id);
}

/**
 * Salda la cuenta. Si `createTransaction`, crea el ingreso o el gasto en la misma transacción SQL,
 * así nunca queda saldada sin su movimiento ni con dos movimientos si se toca dos veces.
 * @param {string} userId
 * @param {string} id
 * @param {{ createTransaction: boolean, date?: string }} input
 * @returns {Promise<{ debt: object, transaction: object|null }>}
 */
export async function settle(userId, id, input) {
  const debt = UUID_RE.test(id) && (await repo.findDebt(id, userId));
  if (!debt) throw notFound();
  if (debt.settledAt) throw alreadySettled();
  const user = await findUserById(userId);
  const today = todayIso(new Date(), user?.timezone);
  if (input.date && input.date > today) {
    throw new AppError(422, 'VALIDATION_ERROR', t('Datos inválidos'), [
      { field: 'date', problem: t('No puede ser una fecha futura') },
    ]);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const transaction = input.createTransaction
      ? await insertTransaction(
          {
            userId,
            // Lo que falta: los abonos ya quedaron registrados (FT-0064).
            amount: Math.round((debt.amount - (debt.paid ?? 0)) * 100) / 100,
            date: input.date ?? today,
            source: 'manual',
            ...settlementMovement(debt),
          },
          client,
        )
      : null;
    const settled = await repo.markSettled(
      { id, userId, transactionId: transaction?.id ?? null },
      client,
    );
    if (!settled) throw alreadySettled(); // otra petición la saldó mientras tanto
    await client.query('COMMIT');
    return { debt: present(settled), transaction };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

const futureDate = () =>
  new AppError(422, 'VALIDATION_ERROR', t('Datos inválidos'), [{ field: 'date', problem: t('No puede ser una fecha futura') }]);

/**
 * Registra un abono (FT-0064). No puede pasar de lo pendiente. Si con él se completa la cuenta,
 * queda saldada; si no, la fecha límite pasa a la próxima cuota. Todo en una transacción SQL, junto
 * con el ingreso o el gasto del abono si se pide.
 * @param {string} userId
 * @param {string} id
 * @param {{ amount: number, date?: string, createTransaction: boolean }} input
 * @returns {Promise<{ debt: object, payment: object, transaction: object|null }>}
 */
export async function addPayment(userId, id, input) {
  const debt = UUID_RE.test(id) && (await repo.findDebt(id, userId));
  if (!debt) throw notFound();
  if (debt.settledAt) throw alreadySettled();
  const pending = Math.round((debt.amount - debt.paid) * 100) / 100;
  if (input.amount > pending) {
    throw new AppError(422, 'VALIDATION_ERROR', t('Datos inválidos'), [
      { field: 'amount', problem: t('No puede pasar de lo pendiente ({pending})', { pending }) },
    ]);
  }
  const user = await findUserById(userId);
  const today = todayIso(new Date(), user?.timezone);
  if (input.date && input.date > today) throw futureDate();
  const date = input.date ?? today;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Bloquea la cuenta: dos abonos al tiempo no pueden pasarse de lo pendiente.
    await client.query('SELECT 1 FROM cuentas_personales WHERE id = $1 FOR UPDATE', [id]);
    const transaction = input.createTransaction
      ? await insertTransaction({ userId, amount: input.amount, date, source: 'manual', ...paymentMovement(debt) }, client)
      : null;
    const payment = await repo.insertPayment(
      { debtId: id, userId, amount: input.amount, date, transactionId: transaction?.id ?? null },
      client,
    );
    let current = await repo.findDebt(id, userId, client);
    if (current.paid > current.amount + 0.004) throw alreadySettled();
    current =
      current.amount - current.paid < 0.005
        ? await repo.markSettled({ id, userId, transactionId: null }, client)
        : await syncNextDueDate(userId, current, client);
    if (!current) throw alreadySettled();
    await client.query('COMMIT');
    return { debt: await withReminder(userId, current), payment, transaction };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Borra un abono de una cuenta pendiente (para corregir un error), junto con el movimiento que se
 * anotó con él, y vuelve a calcular la próxima cuota.
 * @param {string} userId
 * @param {string} id
 * @param {string} paymentId
 * @returns {Promise<object>} La cuenta como queda.
 */
export async function removePayment(userId, id, paymentId) {
  if (!UUID_RE.test(id) || !UUID_RE.test(paymentId)) throw notFound();
  if (!(await repo.deletePayment({ id: paymentId, debtId: id, userId }))) {
    throw new AppError(404, 'NOT_FOUND', t('Abono no encontrado'));
  }
  const debt = await repo.findDebt(id, userId);
  return withReminder(userId, await syncNextDueDate(userId, debt));
}
