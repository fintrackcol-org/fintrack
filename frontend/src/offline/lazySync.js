/**
 * Las mismas funciones de `./sync`, pero la base local (Dexie, ~31 KB gzip) se descarga la primera
 * vez que se llama una, no con la página que las importa (auditoría H4). Todas devuelven promesa,
 * igual que las originales. Las pantallas importan de aquí; `./sync` queda para lo que ya corre
 * después de cargar (cola, sincronización).
 */
export { SYNC_EVENT, SYNC_TAG } from './syncEvents';

const lazy =
  (name) =>
  (...args) =>
    import('./sync').then((m) => m[name](...args));

export const listPending = lazy('listPending');
export const listCached = lazy('listCached');
export const listConflicts = lazy('listConflicts');
export const dismissConflicts = lazy('dismissConflicts');
export const discardPending = lazy('discardPending');
export const queueUpdate = lazy('queueUpdate');
export const queueDelete = lazy('queueDelete');
export const cacheTransaction = lazy('cacheTransaction');
export const uncacheTransaction = lazy('uncacheTransaction');
