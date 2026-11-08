// Cuentas por cobrar y por pagar de un negocio (FT-0058): cálculos puros, sin base de datos.

/** `kind` en la API → `tipo` en la base. */
export const ACCOUNT_KIND_TO_DB = { receivable: 'cobrar', payable: 'pagar' };
export const ACCOUNT_KINDS = Object.keys(ACCOUNT_KIND_TO_DB);

/** Movimiento que crea un abono: un cobro entra como venta u otro ingreso; un pago, como gasto. */
export const PAYMENT_MOVEMENT_KINDS = {
  receivable: ['sale', 'otherIncome'],
  payable: ['cost', 'fixed', 'variable'],
};
export const DEFAULT_PAYMENT_MOVEMENT = { receivable: 'sale', payable: 'cost' };

const round2 = (n) => Math.round(n * 100) / 100;

/**
 * Saldo y estado de una cuenta.
 * - `pagada`: los abonos cubren el monto.
 * - `vencida`: tiene fecha, ya pasó y falta plata.
 * - `pendiente`: el resto.
 * @param {{ amount: number, paid: number, dueDate: string|null }} account
 * @param {string} today AAAA-MM-DD
 * @returns {{ remaining: number, status: 'pendiente'|'vencida'|'pagada' }}
 */
export function accountState({ amount, paid, dueDate }, today) {
  const remaining = Math.max(0, round2(amount - paid));
  if (remaining === 0) return { remaining, status: 'pagada' };
  if (dueDate && dueDate < today) return { remaining, status: 'vencida' };
  return { remaining, status: 'pendiente' };
}

/**
 * Totales pendientes por tipo, y cuánto está vencido.
 * @param {Array<{ kind: 'receivable'|'payable', remaining: number, status: string }>} accounts
 * @returns {{ receivable: number, payable: number, overdueReceivable: number, overduePayable: number }}
 */
export function accountTotals(accounts) {
  const totals = { receivable: 0, payable: 0, overdueReceivable: 0, overduePayable: 0 };
  for (const a of accounts) {
    totals[a.kind] += a.remaining;
    if (a.status === 'vencida') {
      totals[a.kind === 'receivable' ? 'overdueReceivable' : 'overduePayable'] += a.remaining;
    }
  }
  for (const k of Object.keys(totals)) totals[k] = round2(totals[k]);
  return totals;
}

/** Orden de la lista: primero lo vencido, luego lo pendiente por fecha y al final lo pagado. */
const STATUS_ORDER = { vencida: 0, pendiente: 1, pagada: 2 };

/**
 * @template {{ status: string, dueDate: string|null, createdAt: string|Date }} T
 * @param {T[]} accounts
 * @returns {T[]}
 */
export function sortAccounts(accounts) {
  return [...accounts].sort(
    (a, b) =>
      STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
      (a.dueDate ?? '9999').localeCompare(b.dueDate ?? '9999') ||
      new Date(b.createdAt) - new Date(a.createdAt),
  );
}
