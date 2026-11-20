// Nombres compartidos de la sincronización, sin Dexie: los puede importar cualquier pantalla.

/** Evento de `window` que se emite al cambiar la cola o terminar una sincronización. */
export const SYNC_EVENT = 'fintrack:sync';

/** Etiqueta de Background Sync que registra la app y atiende el service worker. */
export const SYNC_TAG = 'fintrack-sync';
