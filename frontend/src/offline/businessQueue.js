/**
 * Movimientos del negocio sin conexión y copia local del mes (FT-0058).
 *
 * Igual que los aportes a vacas (`vacaQueue.js`): `saveBusinessMovement` intenta enviar el
 * movimiento; si no hay red (o el servidor no responde) lo guarda en `db.businessPending` con su
 * `localId`. `flushBusinessMovements` los envía cuando vuelve la conexión (lo llaman `syncNow` y la
 * pantalla del negocio). El backend no duplica un `localId` que ya recibió.
 *
 * Si el servidor rechaza uno (ya no eres socio, eres lector, datos inválidos), queda marcado con el
 * motivo para que el usuario lo descarte; nunca se borra solo. Los retiros no se encolan: tocan las
 * finanzas personales y se registran con conexión.
 *
 * Cada cambio se anuncia en `window` con `BUSINESS_SYNC_EVENT`.
 */
import { db } from './db';
import { getSession } from '@/auth/tokenStorage';
import { createMovement } from '@/services/negocioService';

/** Evento en `window`: `detail` es `{ businessId?, synced?, rejected? }`. */
export const BUSINESS_SYNC_EVENT = 'fintrack:business-sync';

/** Códigos que no se arreglan reintentando: el movimiento queda rechazado. */
const PERMANENT_CODES = ['VALIDATION_ERROR', 'NOT_FOUND', 'FORBIDDEN'];

/** Envío en curso: si se pide otro a la vez, se comparte el mismo. */
let running = null;

const currentUserId = () => getSession()?.user?.id ?? null;
const announce = (detail = {}) => window.dispatchEvent(new CustomEvent(BUSINESS_SYNC_EVENT, { detail }));

/** Pide al service worker que avise cuando vuelva la conexión (llega a `syncNow`). */
async function requestBackgroundSync() {
  try {
    const registration = await navigator.serviceWorker?.ready;
    await registration?.sync?.register('fintrack-sync');
  } catch {
    // Sin service worker o sin permiso: se envía con el evento `online`.
  }
}

/**
 * Registra un movimiento: lo envía si hay conexión y, si no, lo deja en la cola del dispositivo.
 * @param {string} businessId
 * @param {{ kind: string, category: string, amount: number, description: string, date: string, localId?: string }} values
 * @returns {Promise<{ queued: true } | { queued: false, movement: object }>}
 * @throws {Error} Si el servidor lo rechaza (p. ej. 422): no se encola, el usuario lo corrige.
 */
export async function saveBusinessMovement(businessId, values) {
  const userId = currentUserId();
  if (!userId) throw new Error('Tu sesión venció. Inicia sesión de nuevo.');
  const movement = { ...values, localId: values.localId ?? crypto.randomUUID() };

  if (navigator.onLine) {
    try {
      const saved = await createMovement(businessId, movement);
      announce({ businessId, synced: 1 });
      return { queued: false, movement: saved };
    } catch (err) {
      // Con `code` respondió el servidor: es un error de los datos o de permisos.
      if (err.code && err.code !== 'RATE_LIMITED' && err.code !== 'INTERNAL_ERROR') throw err;
    }
  }

  await db.businessPending.add({
    localId: movement.localId,
    userId,
    businessId,
    movement,
    createdAt: new Date().toISOString(),
  });
  announce({ businessId });
  requestBackgroundSync();
  return { queued: true };
}

/**
 * Movimientos pendientes del usuario actual (todos o los de un negocio), del más antiguo al más nuevo.
 * @param {string} [businessId]
 * @returns {Promise<Array<{ localId: string, businessId: string, movement: object, createdAt: string, rejected?: string }>>}
 */
export async function listPendingMovements(businessId) {
  const userId = currentUserId();
  if (!userId) return [];
  const all = await db.businessPending.where('userId').equals(userId).sortBy('createdAt');
  return businessId ? all.filter((p) => p.businessId === businessId) : all;
}

/**
 * Descarta un movimiento pendiente (el usuario decide, p. ej. tras un rechazo).
 * @param {string} localId
 * @returns {Promise<void>}
 */
export async function discardPendingMovement(localId) {
  const pending = await db.businessPending.get(localId);
  await db.businessPending.delete(localId);
  announce({ businessId: pending?.businessId });
}

async function doFlush() {
  if (!currentUserId() || !navigator.onLine) return;
  for (const pending of (await listPendingMovements()).filter((p) => !p.rejected)) {
    try {
      await createMovement(pending.businessId, pending.movement);
      await db.businessPending.delete(pending.localId);
      announce({ businessId: pending.businessId, synced: 1 });
    } catch (err) {
      if (!PERMANENT_CODES.includes(err.code)) return; // sin red, servidor caído o 429: después
      await db.businessPending.update(pending.localId, { rejected: err.message });
      announce({ businessId: pending.businessId, rejected: 1 });
    }
  }
}

/**
 * Envía los movimientos pendientes. Sin conexión o sin sesión no hace nada.
 * @returns {Promise<void>}
 */
export function flushBusinessMovements() {
  running ??= doFlush()
    .catch((err) => console.error('No se pudieron enviar los movimientos del negocio', err))
    .finally(() => {
      running = null;
    });
  return running;
}

/**
 * Guarda el mes del negocio para verlo sin conexión.
 * @param {string} businessId
 * @param {object} month Respuesta de `GET /businesses/:id/movements`.
 * @returns {Promise<void>}
 */
export async function cacheBusinessMonth(businessId, month) {
  const userId = currentUserId();
  if (userId) await db.meta.put({ key: `negocio:${userId}:${businessId}:${month.month}`, value: month });
}

/**
 * Mes guardado del negocio, o `null`.
 * @param {string} businessId
 * @param {string} month AAAA-MM
 * @returns {Promise<object|null>}
 */
export async function getCachedBusinessMonth(businessId, month) {
  const userId = currentUserId();
  if (!userId) return null;
  return (await db.meta.get(`negocio:${userId}:${businessId}:${month}`))?.value ?? null;
}

/**
 * Borra la copia de los negocios de un usuario al cerrar sesión. Los pendientes se conservan.
 * @param {string} userId
 * @returns {Promise<void>}
 */
export async function clearBusinessCache(userId) {
  await db.meta.where('key').startsWith(`negocio:${userId}:`).delete();
}
