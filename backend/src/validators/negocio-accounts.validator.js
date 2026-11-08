import { AppError } from '../errors/app-error.js';
import { ACCOUNT_KINDS } from '../services/negocio-accounts.logic.js';

/** Lo máximo que cabe en `numeric(12,2)`. */
const MAX_AMOUNT = 9_999_999_999.99;
const cents = (n) => Math.round(n * 100) / 100;
const MOVEMENT_KINDS = ['sale', 'otherIncome', 'cost', 'fixed', 'variable'];

/**
 * @param {unknown} v
 * @returns {boolean} Si es una fecha AAAA-MM-DD que existe.
 */
const isDate = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

const isObject = (body) => typeof body === 'object' && body !== null && !Array.isArray(body);
const given = (v) => v !== undefined && v !== null && v !== '';

/**
 * @param {unknown} amount
 * @param {object[]} details
 * @returns {number}
 */
function parseAmount(amount, details) {
  const ok = typeof amount === 'number' && Number.isFinite(amount);
  if (!ok || cents(amount) <= 0 || amount > MAX_AMOUNT) {
    details.push({ field: 'amount', problem: 'Debe ser un número mayor que 0' });
  }
  return ok ? cents(amount) : 0;
}

/**
 * Valida `POST /businesses/:id/accounts`.
 * @param {unknown} body
 * @returns {{ kind: 'receivable'|'payable', party: string, description: string|null, amount: number, dueDate: string|null }}
 */
export function parseNewAccount(body) {
  if (!isObject(body)) throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  const details = [];
  if (!ACCOUNT_KINDS.includes(body.kind)) {
    details.push({ field: 'kind', problem: `Debe ser: ${ACCOUNT_KINDS.join(', ')}` });
  }
  const party = typeof body.party === 'string' ? body.party.trim() : '';
  if (party.length < 1 || party.length > 80) {
    details.push({ field: 'party', problem: 'Debe tener entre 1 y 80 caracteres' });
  }
  let description = null;
  if (given(body.description)) {
    const text = typeof body.description === 'string' ? body.description.trim() : '';
    if (text.length >= 1 && text.length <= 120) description = text;
    else details.push({ field: 'description', problem: 'Máximo 120 caracteres' });
  }
  const amount = parseAmount(body.amount, details);
  let dueDate = null;
  if (given(body.dueDate)) {
    if (isDate(body.dueDate)) dueDate = body.dueDate;
    else details.push({ field: 'dueDate', problem: 'Debe ser una fecha AAAA-MM-DD' });
  }
  if (details.length > 0) throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  return { kind: body.kind, party, description, amount, dueDate };
}

/**
 * Valida `POST /businesses/:id/accounts/:accountId/payments`. Si el movimiento corresponde al tipo
 * de cuenta lo revisa el servicio, que es quien conoce la cuenta.
 * @param {unknown} body
 * @returns {{ amount: number, date: string|null, movementKind: string|null }}
 */
export function parsePayment(body) {
  if (!isObject(body)) throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  const details = [];
  const amount = parseAmount(body.amount, details);
  let date = null;
  if (given(body.date)) {
    if (isDate(body.date)) date = body.date;
    else details.push({ field: 'date', problem: 'Debe ser una fecha AAAA-MM-DD' });
  }
  let movementKind = null;
  if (given(body.movementKind)) {
    if (MOVEMENT_KINDS.includes(body.movementKind)) movementKind = body.movementKind;
    else details.push({ field: 'movementKind', problem: `Debe ser: ${MOVEMENT_KINDS.join(', ')}` });
  }
  if (details.length > 0) throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  return { amount, date, movementKind };
}

/**
 * Valida `POST /businesses/:id/tax-dates`.
 * @param {unknown} body
 * @returns {{ name: string, date: string }}
 */
export function parseTaxDate(body) {
  if (!isObject(body)) throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  const details = [];
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (name.length < 1 || name.length > 40) {
    details.push({ field: 'name', problem: 'Debe tener entre 1 y 40 caracteres' });
  }
  if (!isDate(body.date)) details.push({ field: 'date', problem: 'Debe ser una fecha AAAA-MM-DD' });
  if (details.length > 0) throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  return { name, date: body.date };
}
