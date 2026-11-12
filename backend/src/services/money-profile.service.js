import { AppError } from '../errors/app-error.js';
import * as repo from '../repositories/money-profile.repository.js';
import * as reminders from '../repositories/reminder-configs.repository.js';
import { currentMoney } from './money-plan.service.js';
import { MAX_COMMITMENTS } from '../validators/money-profile.validator.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** @returns {AppError} 404 sin revelar si el compromiso existe pero es de otro (RN-01). */
function notFound() {
  return new AppError(404, 'NOT_FOUND', 'Compromiso no encontrado');
}

/** @returns {AppError} 409: el nombre identifica el pago en los movimientos del mes. */
function duplicated() {
  return new AppError(409, 'COMMITMENT_EXISTS', 'Ya tienes un compromiso con ese nombre');
}

/**
 * Perfil del usuario con sus compromisos. Quien no ha respondido recibe un perfil vacío.
 * @param {string} userId
 * @returns {Promise<object>} Ver `GET /api/v1/money-profile` en `docs/api/openapi.yaml`.
 */
export async function get(userId) {
  const [profile, commitments, totals, changes] = await Promise.all([
    repo.findProfile(userId),
    repo.listCommitments(userId),
    repo.movementTotals(userId),
    repo.changesSinceBalance(userId),
  ]);
  // "Avisarme" de cada compromiso (FT-0067): `null` si no avisa.
  const configs = await reminders.findReminderConfigs('compromiso', commitments.map((c) => c.id), null);
  return {
    incomeType: profile?.incomeType ?? null,
    payDays: profile?.payDays ?? [],
    balance: profile?.balance ?? null,
    balanceAt: profile?.balanceAt ?? null,
    money: currentMoney({ profile, changes, totals }),
    totals,
    welcomeDone: Boolean(profile?.welcomeAt),
    commitments: commitments.map((c) => ({ ...c, reminder: configs.get(c.id) ?? null })),
    subscriptions: subscriptionsSummary(commitments),
  };
}

/**
 * Cuánto se va en suscripciones al mes (FT-0067): las anuales cuentan su doceava parte.
 * @param {Array<{ kind: string, frequency: string, amount: number }>} commitments
 * @returns {{ count: number, monthly: number }}
 */
export function subscriptionsSummary(commitments) {
  const subs = commitments.filter((c) => c.kind === 'subscription');
  const monthly = subs.reduce((acc, c) => acc + (c.frequency === 'yearly' ? c.amount / 12 : c.amount), 0);
  return { count: subs.length, monthly: Math.round(monthly) };
}

/**
 * Cambia cómo le entra la plata al usuario y cuánta tiene.
 * @param {string} userId
 * @param {import('../validators/money-profile.validator.js').ProfileData} data
 * @returns {Promise<object>} El perfil actualizado.
 */
export async function update(userId, data) {
  // Corregir el saldo deja rastro en el historial si de verdad cambió (FT-0062).
  const correcting = data.resetBalance && typeof data.balance === 'number';
  const before = correcting ? (await get(userId)).money : null;
  const changed = typeof before === 'number' && Math.round(before) !== Math.round(data.balance);
  await repo.saveProfile(userId, data, changed ? { before, after: data.balance } : null);
  return get(userId);
}

/**
 * Correcciones de saldo, para mostrarlas en el historial. No son ingresos ni gastos.
 * @param {string} userId
 * @param {{ from?: string, to?: string }} range
 * @returns {Promise<Array<{ id: string, before: number, after: number, date: string, createdAt: Date }>>}
 */
export function listAdjustments(userId, range) {
  return repo.listAdjustments(userId, range);
}

/**
 * Guarda lo respondido en la bienvenida, o solo que se omitió.
 * @param {string} userId
 * @param {import('../validators/money-profile.validator.js').ProfileData & { commitments: import('../validators/money-profile.validator.js').NewCommitment[] }} data
 * @returns {Promise<object>} El perfil actualizado.
 */
export async function finishWelcome(userId, data) {
  const current = await repo.findProfile(userId);
  // Omitir no borra lo que ya estaba: quien ya respondió pudo cambiarlo en Cuenta.
  const answered = data.incomeType !== null || data.balance !== null;
  await repo.saveWelcome(userId, answered || !current ? data : { ...current, commitments: data.commitments });
  return get(userId);
}

/**
 * Crea un compromiso.
 * @param {string} userId
 * @param {import('../validators/money-profile.validator.js').NewCommitment} data
 * @returns {Promise<import('../repositories/money-profile.repository.js').CommitmentRecord>}
 * @throws {AppError} 409 `COMMITMENT_LIMIT` o `COMMITMENT_EXISTS`.
 */
export async function createCommitment(userId, data) {
  if ((await repo.countCommitments(userId)) >= MAX_COMMITMENTS) {
    throw new AppError(409, 'COMMITMENT_LIMIT', `Puedes tener hasta ${MAX_COMMITMENTS} compromisos`);
  }
  const commitment = await repo.insertCommitment(userId, data);
  if (!commitment) throw duplicated();
  return withReminder(userId, commitment, data.reminder);
}

/** Origen de los avisos de los compromisos en el motor de recordatorios (FT-0063). */
const REMINDER_TYPE = 'compromiso';

/**
 * Guarda o quita el "Avisarme" de un compromiso (FT-0067) y lo devuelve junto al compromiso.
 * `undefined`: no se tocó; `null` o sin días: no avisar.
 * @param {string} userId
 * @param {object} commitment
 * @param {import('../validators/reminders.validator.js').ReminderConfig|null|undefined} reminder
 * @returns {Promise<object>}
 */
async function withReminder(userId, commitment, reminder) {
  if (reminder === null || (reminder && reminder.daysBefore.length === 0)) {
    await reminders.deleteReminderConfig(REMINDER_TYPE, commitment.id);
    return { ...commitment, reminder: null };
  }
  if (reminder) {
    await reminders.saveReminderConfig(userId, REMINDER_TYPE, commitment.id, reminder);
    return { ...commitment, reminder };
  }
  const configs = await reminders.findReminderConfigs(REMINDER_TYPE, [commitment.id], null);
  return { ...commitment, reminder: configs.get(commitment.id) };
}

/**
 * Cambia un compromiso propio.
 * @param {string} userId
 * @param {string} id
 * @param {import('../validators/money-profile.validator.js').NewCommitment} data
 * @returns {Promise<import('../repositories/money-profile.repository.js').CommitmentRecord>}
 * @throws {AppError} 404 `NOT_FOUND` o 409 `COMMITMENT_EXISTS`.
 */
export async function updateCommitment(userId, id, data) {
  if (!UUID_RE.test(id)) throw notFound();
  const commitment = await repo.updateCommitment(id, userId, data);
  if (commitment === 'duplicate') throw duplicated();
  if (!commitment) throw notFound();
  return withReminder(userId, commitment, data.reminder);
}

/**
 * Elimina un compromiso propio.
 * @param {string} userId
 * @param {string} id
 * @returns {Promise<void>}
 * @throws {AppError} 404 `NOT_FOUND`.
 */
export async function removeCommitment(userId, id) {
  if (!UUID_RE.test(id) || !(await repo.deleteCommitment(id, userId))) throw notFound();
  await reminders.deleteReminderConfig(REMINDER_TYPE, id);
}
