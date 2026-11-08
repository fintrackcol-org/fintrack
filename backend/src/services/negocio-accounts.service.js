import { AppError } from '../errors/app-error.js';
import * as repo from '../repositories/negocio-accounts.repository.js';
import * as taxDates from '../repositories/negocio-reminders.repository.js';
import { deleteMovement } from '../repositories/negocio-movements.repository.js';
import {
  ACCOUNT_KIND_TO_DB,
  DEFAULT_PAYMENT_MOVEMENT,
  PAYMENT_MOVEMENT_KINDS,
  accountState,
  accountTotals,
  sortAccounts,
} from './negocio-accounts.logic.js';
import { DEFAULT_CATEGORY, KIND_TO_DB } from './negocio-panel.logic.js';
import { requirePartner, today } from './negocio-movements.service.js';

// Cuentas por cobrar (clientes) y por pagar (proveedores) del negocio, con abonos parciales
// (FT-0058). Todos los socios las ven; dueños y editores las registran y abonan. Cada abono crea el
// movimiento que le corresponde, así el panel del mes y la exportación ya lo incluyen.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const readOnly = () =>
  new AppError(403, 'FORBIDDEN', 'Eres lector del negocio: puedes ver, pero no registrar ni borrar');
const accountNotFound = () => new AppError(404, 'NOT_FOUND', 'Cuenta no encontrada');
const invalid = (field, problem) =>
  new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [{ field, problem }]);

/**
 * Agrega saldo y estado a una cuenta de la base.
 * @param {import('../repositories/negocio-accounts.repository.js').BusinessAccountRecord} account
 * @param {string} now AAAA-MM-DD
 * @returns {object}
 */
function present(account, now) {
  const { authorId, ...rest } = account;
  return { ...rest, createdBy: authorId, ...accountState(account, now) };
}

/**
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<{ canRecord: boolean, items: object[], totals: object }>}
 */
export async function list(userId, id) {
  const business = await requirePartner(userId, id);
  const [accounts, now] = await Promise.all([repo.listAccounts(business.id), today(userId)]);
  const items = sortAccounts(accounts.map((a) => present(a, now)));
  return { canRecord: business.role !== 'lector', items, totals: accountTotals(items) };
}

/**
 * @param {string} userId
 * @param {string} id
 * @param {ReturnType<import('../validators/negocio-accounts.validator.js').parseNewAccount>} input
 * @returns {Promise<object>} La cuenta creada.
 */
export async function create(userId, id, input) {
  const business = await requirePartner(userId, id);
  if (business.role === 'lector') throw readOnly();
  const accountId = await repo.insertAccount({
    businessId: business.id,
    userId,
    kindDb: ACCOUNT_KIND_TO_DB[input.kind],
    party: input.party,
    description: input.description,
    amount: input.amount,
    dueDate: input.dueDate,
  });
  return present(await repo.findAccount(business.id, accountId), await today(userId));
}

/**
 * Borra una cuenta y sus abonos. Las ventas y pagos que ya se registraron se quedan: fueron plata
 * que sí entró o salió. La borra quien la registró o un dueño.
 * @param {string} userId
 * @param {string} id
 * @param {string} accountId
 * @returns {Promise<void>}
 */
export async function remove(userId, id, accountId) {
  const business = await requirePartner(userId, id);
  if (business.role === 'lector') throw readOnly();
  const account = UUID_RE.test(accountId) && (await repo.findAccount(business.id, accountId));
  if (!account) throw accountNotFound();
  if (business.role !== 'dueno' && account.authorId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Solo quien la registró o un dueño puede borrarla');
  }
  await repo.deleteAccount(business.id, accountId);
}

/**
 * Registra un abono. No puede pasar del saldo, ni tener fecha futura. Crea el movimiento del
 * negocio: el cobro de un cliente como venta (u otro ingreso); el pago a un proveedor como el gasto
 * que se elija (costo de venta por defecto).
 * @param {string} userId
 * @param {string} id
 * @param {string} accountId
 * @param {ReturnType<import('../validators/negocio-accounts.validator.js').parsePayment>} input
 * @returns {Promise<object>} La cuenta con el abono.
 */
export async function pay(userId, id, accountId, input) {
  const business = await requirePartner(userId, id);
  if (business.role === 'lector') throw readOnly();
  const account = UUID_RE.test(accountId) && (await repo.findAccount(business.id, accountId));
  if (!account) throw accountNotFound();

  const movementKind = input.movementKind ?? DEFAULT_PAYMENT_MOVEMENT[account.kind];
  if (!PAYMENT_MOVEMENT_KINDS[account.kind].includes(movementKind)) {
    throw invalid('movementKind', `Debe ser: ${PAYMENT_MOVEMENT_KINDS[account.kind].join(', ')}`);
  }
  const now = await today(userId);
  const date = input.date ?? now;
  if (date > now) throw invalid('date', 'No puede ser una fecha futura');

  const description = (
    account.kind === 'receivable' ? `Abono de ${account.party}` : `Pago a ${account.party}`
  ).slice(0, 120);
  const result = await repo.insertPayment({
    businessId: business.id,
    accountId: account.id,
    userId,
    amount: input.amount,
    date,
    movement: {
      kindDb: KIND_TO_DB[movementKind],
      category: DEFAULT_CATEGORY[movementKind],
      description,
    },
  });
  if (!result) throw accountNotFound();
  if (!result.ok) {
    throw invalid(
      'amount',
      result.remaining === 0
        ? 'Esta cuenta ya está pagada'
        : `No puede ser mayor que el saldo (${result.remaining})`,
    );
  }
  return present(await repo.findAccount(business.id, account.id), now);
}

/**
 * Deshace un abono: borra su movimiento (y con él el abono). Lo hace quien lo registró o un dueño.
 * @param {string} userId
 * @param {string} id
 * @param {string} accountId
 * @param {string} paymentId
 * @returns {Promise<object>} La cuenta sin el abono.
 */
export async function removePayment(userId, id, accountId, paymentId) {
  const business = await requirePartner(userId, id);
  if (business.role === 'lector') throw readOnly();
  const payment =
    UUID_RE.test(accountId) &&
    UUID_RE.test(paymentId) &&
    (await repo.findPayment(business.id, accountId, paymentId));
  if (!payment) throw new AppError(404, 'NOT_FOUND', 'Abono no encontrado');
  if (business.role !== 'dueno' && payment.authorId !== userId) {
    throw new AppError(403, 'FORBIDDEN', 'Solo quien lo registró o un dueño puede deshacerlo');
  }
  await deleteMovement(business.id, payment.movementId);
  return present(await repo.findAccount(business.id, accountId), await today(userId));
}

/* ---------- Fechas de impuestos (FT-0058) ---------- */

/**
 * Fechas de impuestos del negocio (IVA, retención…). Se avisa 3 días antes a dueños y editores.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<{ canEdit: boolean, items: Array<{ id: string, name: string, date: string }> }>}
 */
export async function listTaxDates(userId, id) {
  const business = await requirePartner(userId, id);
  return { canEdit: business.role !== 'lector', items: await taxDates.listTaxDates(business.id) };
}

/**
 * @param {string} userId
 * @param {string} id
 * @param {{ name: string, date: string }} input
 * @returns {Promise<{ id: string, name: string, date: string }>}
 */
export async function addTaxDate(userId, id, input) {
  const business = await requirePartner(userId, id);
  if (business.role === 'lector') throw readOnly();
  return taxDates.insertTaxDate(business.id, input);
}

/**
 * @param {string} userId
 * @param {string} id
 * @param {string} dateId
 * @returns {Promise<void>}
 */
export async function removeTaxDate(userId, id, dateId) {
  const business = await requirePartner(userId, id);
  if (business.role === 'lector') throw readOnly();
  const deleted = UUID_RE.test(dateId) && (await taxDates.deleteTaxDate(business.id, dateId));
  if (!deleted) throw new AppError(404, 'NOT_FOUND', 'Fecha no encontrada');
}
