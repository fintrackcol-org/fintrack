/**
 * Mudanza de dominio: Rinde pasó de fintrackcol.online a rindecol.online.
 *
 * Para el navegador cada dominio es un sitio distinto: la sesión, los movimientos guardados sin
 * conexión y el service worker se quedan en el viejo. Quien tenía la app instalada desde el dominio
 * viejo la sigue abriendo ahí (el service worker la sirve sin pasar por la redirección del servidor).
 * Por eso, al abrirse en un dominio viejo, la app primero envía lo pendiente, luego quita el service
 * worker y las notificaciones de ese dominio (así, de ahí en adelante, el servidor redirige solo) y
 * por último lleva a la persona al dominio nuevo, en la misma pantalla.
 */

/** Dominio oficial de la app. */
export const NEW_ORIGIN = 'https://www.rindecol.online';

/** Dominios por los que se servía la app antes de la mudanza. */
export const OLD_HOSTS = ['fintrackcol.online', 'www.fintrackcol.online', 'fintrack-seven-delta.vercel.app'];

/** Cuánto se espera a que la sincronización termine antes de revisar qué quedó pendiente. */
export const SYNC_TIMEOUT_MS = 15_000;

/**
 * ¿La app se abrió en un dominio viejo?
 * @param {string} hostname
 * @returns {boolean}
 */
export function isOldHost(hostname) {
  return OLD_HOSTS.includes(hostname.toLowerCase());
}

/**
 * La misma pantalla en el dominio nuevo (camino, parámetros y #).
 * @param {{ pathname: string, search: string, hash: string }} location
 * @returns {string}
 */
export function newAddress({ pathname, search, hash }) {
  return `${NEW_ORIGIN}${pathname}${search}${hash}`;
}

/**
 * Movimientos guardados en este dispositivo que todavía no llegan al servidor (gastos, aportes a
 * vacas y movimientos de negocios). Los rechazados por el servidor no cuentan: no se van a enviar.
 * @param {import('dexie').Dexie} db
 * @returns {Promise<number>}
 */
export async function countUnsent(db) {
  const tables = [db.pending, db.vacaPending, db.businessPending];
  const counts = await Promise.all(tables.map((table) => table.filter((op) => !op.rejected).count()));
  return counts.reduce((sum, n) => sum + n, 0);
}

/**
 * Quita del dominio viejo el service worker, su caché y la suscripción a notificaciones. Si algo
 * falla se sigue: lo importante es llevar a la persona al dominio nuevo.
 * @param {{ serviceWorker?: ServiceWorkerContainer, caches?: CacheStorage }} [env]
 * @returns {Promise<void>}
 */
export async function forgetOldDomain({ serviceWorker = navigator.serviceWorker, caches = globalThis.caches } = {}) {
  try {
    const registrations = (await serviceWorker?.getRegistrations()) ?? [];
    for (const registration of registrations) {
      const subscription = await registration.pushManager?.getSubscription().catch(() => null);
      await subscription?.unsubscribe().catch(() => {});
      await registration.unregister().catch(() => {});
    }
  } catch {
    // Sin service worker: nada que quitar.
  }
  try {
    const names = (await caches?.keys()) ?? [];
    await Promise.all(names.map((name) => caches.delete(name)));
  } catch {
    // Sin Cache Storage: nada que borrar.
  }
}

/**
 * Hace la mudanza: envía lo pendiente, y si ya no queda nada (o `force`), limpia el dominio viejo
 * y lleva al nuevo.
 * @param {{
 *   sync: () => Promise<unknown>,
 *   countUnsent: () => Promise<number>,
 *   forget: () => Promise<void>,
 *   go: (url: string) => void,
 *   location: { pathname: string, search: string, hash: string },
 *   online?: boolean,
 *   force?: boolean,
 *   timeoutMs?: number,
 * }} deps
 * @returns {Promise<{ moved: boolean, unsent: number }>}
 */
export async function moveToNewDomain({
  sync,
  countUnsent: count,
  forget,
  go,
  location,
  online = true,
  force = false,
  timeoutMs = SYNC_TIMEOUT_MS,
}) {
  if (online) {
    let timer;
    const timeout = new Promise((resolve) => {
      timer = setTimeout(resolve, timeoutMs);
    });
    await Promise.race([Promise.resolve().then(sync).catch(() => {}), timeout]);
    clearTimeout(timer);
  }
  const unsent = await count().catch(() => 0);
  if (unsent > 0 && !force) return { moved: false, unsent };
  await forget();
  go(newAddress(location));
  return { moved: true, unsent };
}
