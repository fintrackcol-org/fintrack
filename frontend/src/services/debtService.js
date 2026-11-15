/**
 * Cuentas por cobrar y por pagar (FT-0046), según `docs/api/openapi.yaml` (`/debts`).
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {object} Debt
 * @property {string} id
 * @property {'receivable'|'payable'} kind `receivable`: me deben; `payable`: debo.
 * @property {string} person
 * @property {number} amount
 * @property {string|null} dueDate AAAA-MM-DD.
 * @property {string|null} note
 * @property {string|null} settledAt Fecha ISO en que se saldó.
 * @property {string|null} transactionId Movimiento creado al saldarla.
 * @property {import('@/lib/reminder').Reminder} reminder Cuándo y por dónde se avisa (FT-0063).
 * @property {string|null} loanDate AAAA-MM-DD en que se prestó (FT-0064).
 * @property {number|null} installments Número de cuotas (2–60); `null` si se paga de una.
 * @property {'weekly'|'biweekly'|'monthly'|null} frequency Cada cuánto va una cuota.
 * @property {string|null} firstDueDate Fecha de la primera cuota.
 * @property {number} paid Suma de los abonos.
 * @property {number} pending Lo que falta (0 si está saldada).
 * @property {number} paidInstallments Cuotas completas.
 * @property {{ number: number, date: string, amount: number }|null} nextInstallment
 * @property {DebtPayment[]} payments Abonos, del más reciente al más viejo.
 */

/**
 * @typedef {object} DebtPayment
 * @property {string} id
 * @property {number} amount
 * @property {string} date AAAA-MM-DD.
 * @property {string|null} transactionId Movimiento creado con el abono.
 */

/** @returns {Promise<{ items: Debt[], totals: { receivable: number, payable: number } }>} */
export const listDebts = () => apiRequest('/debts');

/** @returns {Promise<Debt>} */
export const createDebt = (data) => apiRequest('/debts', { method: 'POST', body: data });

/** @returns {Promise<Debt>} */
export const updateDebt = (id, data) => apiRequest(`/debts/${id}`, { method: 'PUT', body: data });

/** @returns {Promise<null>} */
export const deleteDebt = (id) => apiRequest(`/debts/${id}`, { method: 'DELETE' });

/**
 * Salda la cuenta; con `createTransaction` también registra el ingreso o el gasto.
 * @param {string} id
 * @param {{ createTransaction: boolean }} options
 * @returns {Promise<{ debt: Debt, transaction: object|null }>}
 */
export const settleDebt = (id, { createTransaction }) =>
  apiRequest(`/debts/${id}/settle`, {
    method: 'POST',
    body: { createTransaction },
  });

/**
 * Registra un abono; si cubre lo pendiente, la cuenta queda saldada.
 * @param {string} id
 * @param {{ amount: number, date?: string, createTransaction: boolean }} data
 * @returns {Promise<{ debt: Debt, payment: DebtPayment, transaction: object|null }>}
 */
export const addDebtPayment = (id, data) => apiRequest(`/debts/${id}/payments`, { method: 'POST', body: data });

/**
 * Borra un abono (para corregir un error).
 * @returns {Promise<Debt>} La cuenta como queda.
 */
export const deleteDebtPayment = (id, paymentId) =>
  apiRequest(`/debts/${id}/payments/${paymentId}`, { method: 'DELETE' });
