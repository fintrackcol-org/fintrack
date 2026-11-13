import { cacheTransaction, queueUpdate } from './sync';
import { updateTransaction } from '@/services/transactionService';

/**
 * Guarda un cambio pequeño de un movimiento que ya está en el servidor (por ejemplo la emoción o
 * el grupo Kakeibo, FT-0070). Con conexión lo envía; sin conexión lo deja en la cola, igual que
 * la pantalla de edición.
 * @param {import('./db').CachedTransaction} current Cómo está el movimiento ahora.
 * @param {object} changes Solo los campos que cambian.
 * @returns {Promise<{ transaction: object, offline: boolean }>} El movimiento como queda.
 * @throws {Error} Si el servidor rechaza el cambio.
 */
export async function saveTransactionChanges(current, changes) {
  try {
    if (!navigator.onLine) throw Object.assign(new Error(), { code: 'NETWORK_ERROR' });
    const updated = await updateTransaction(current.id, changes);
    // La copia local es un respaldo: si falla, se corrige en la próxima sincronización.
    cacheTransaction(updated.transaction).catch(() => {});
    return { transaction: updated.transaction, offline: false };
  } catch (err) {
    if (err.code !== 'NETWORK_ERROR') throw err;
    await queueUpdate(current, changes);
    return { transaction: { ...current, ...changes }, offline: true };
  }
}
