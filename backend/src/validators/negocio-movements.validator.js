import { AppError } from '../errors/app-error.js';
import { CATEGORIES, DEFAULT_CATEGORY, KINDS } from '../services/negocio-panel.logic.js';

/** Lo máximo que cabe en `numeric(12,2)`. */
const MAX_AMOUNT = 9_999_999_999.99;
const cents = (n) => Math.round(n * 100) / 100;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Clave de una categoría propia del negocio (FT-0058). */
export const CUSTOM_CATEGORY_RE = /^c_[a-z0-9]{8}$/;

/**
 * @param {unknown} v
 * @returns {boolean} Si es una fecha AAAA-MM-DD que existe.
 */
const isDate = (v) =>
  typeof v === 'string' &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  new Date(`${v}T00:00:00Z`).toISOString().startsWith(v);

/**
 * Valida `?month=` del listado.
 * @param {unknown} value
 * @returns {string|undefined} AAAA-MM, o `undefined` para el mes actual.
 */
export function parseMonth(value) {
  if (value === undefined || value === '') return undefined;
  if (typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return value;
  throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
    { field: 'month', problem: 'Debe ser AAAA-MM' },
  ]);
}

/**
 * Valida `POST /businesses/:id/movements`.
 * @param {unknown} body
 * @returns {{ kind: string, category: string, amount: number, description: string, date: string|null, localId: string|null }}
 */
export function parseNewMovement(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }
  const details = [];
  if (!KINDS.includes(body.kind)) {
    details.push({ field: 'kind', problem: `Debe ser: ${KINDS.join(', ')}` });
  }
  const amountOk = typeof body.amount === 'number' && Number.isFinite(body.amount);
  if (!amountOk || cents(body.amount) <= 0 || body.amount > MAX_AMOUNT) {
    details.push({ field: 'amount', problem: 'Debe ser un número mayor que 0' });
  }
  const description = typeof body.description === 'string' ? body.description.trim() : '';
  if (description.length < 1 || description.length > 120) {
    details.push({ field: 'description', problem: 'Debe tener entre 1 y 120 caracteres' });
  }
  let category = DEFAULT_CATEGORY[body.kind] ?? 'otros';
  if (body.category !== undefined && body.category !== null && body.category !== '') {
    // Las propias del negocio empiezan por "c_"; si existen lo revisa el servicio (FT-0058).
    if (CATEGORIES.includes(body.category) || CUSTOM_CATEGORY_RE.test(body.category)) category = body.category;
    else details.push({ field: 'category', problem: `Debe ser: ${CATEGORIES.join(', ')} o una propia del negocio` });
  }
  let date = null;
  if (body.date !== undefined && body.date !== null && body.date !== '') {
    if (isDate(body.date)) date = body.date;
    else details.push({ field: 'date', problem: 'Debe ser una fecha AAAA-MM-DD' });
  }
  let localId = null;
  if (body.localId !== undefined && body.localId !== null) {
    if (typeof body.localId === 'string' && UUID_RE.test(body.localId)) localId = body.localId;
    else details.push({ field: 'localId', problem: 'Debe ser un UUID' });
  }
  if (details.length > 0) throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  return { kind: body.kind, category, amount: cents(body.amount), description, date, localId };
}

/**
 * Valida `POST /businesses/:id/withdrawals` (retiro del socio).
 * @param {unknown} body
 * @returns {{ amount: number, date: string|null, note: string|null, localId: string|null }}
 */
export function parseWithdrawal(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }
  const details = [];
  const amountOk = typeof body.amount === 'number' && Number.isFinite(body.amount);
  if (!amountOk || cents(body.amount) <= 0 || body.amount > MAX_AMOUNT) {
    details.push({ field: 'amount', problem: 'Debe ser un número mayor que 0' });
  }
  let note = null;
  if (body.note !== undefined && body.note !== null && body.note !== '') {
    const text = typeof body.note === 'string' ? body.note.trim() : '';
    if (text.length >= 1 && text.length <= 120) note = text;
    else details.push({ field: 'note', problem: 'Máximo 120 caracteres' });
  }
  let date = null;
  if (body.date !== undefined && body.date !== null && body.date !== '') {
    if (isDate(body.date)) date = body.date;
    else details.push({ field: 'date', problem: 'Debe ser una fecha AAAA-MM-DD' });
  }
  let localId = null;
  if (body.localId !== undefined && body.localId !== null) {
    if (typeof body.localId === 'string' && UUID_RE.test(body.localId)) localId = body.localId;
    else details.push({ field: 'localId', problem: 'Debe ser un UUID' });
  }
  if (details.length > 0) throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', details);
  return { amount: cents(body.amount), date, note, localId };
}

/**
 * Valida `GET /businesses/:id/export?month=&format=`.
 * @param {Record<string, unknown>} query
 * @returns {{ month: string|undefined, format: 'xlsx'|'pdf' }}
 */
export function parseExport(query) {
  const month = parseMonth(query.month);
  if (query.format !== 'xlsx' && query.format !== 'pdf') {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'format', problem: 'Debe ser xlsx o pdf' },
    ]);
  }
  return { month, format: query.format };
}

/**
 * Valida `POST /businesses/:id/categories` (FT-0058).
 * @param {unknown} body
 * @returns {{ name: string }}
 */
export function parseCategory(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', 'El cuerpo de la petición no es válido');
  }
  const name = typeof body.name === 'string' ? body.name.trim().replace(/\s+/g, ' ') : '';
  if (name.length < 1 || name.length > 30) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'name', problem: 'Debe tener entre 1 y 30 caracteres' },
    ]);
  }
  return { name };
}
