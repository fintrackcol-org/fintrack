import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** Tabla en memoria con lo que usa `businessQueue` de Dexie. */
function fakeTable(key) {
  const rows = new Map();
  return {
    rows,
    add: vi.fn(async (row) => rows.set(row[key], row)),
    put: vi.fn(async (row) => rows.set(row[key], row)),
    get: vi.fn(async (id) => rows.get(id)),
    delete: vi.fn(async (id) => rows.delete(id)),
    update: vi.fn(async (id, changes) => rows.set(id, { ...rows.get(id), ...changes })),
    where: (field) => ({
      equals: (value) => ({
        sortBy: async (by) => [...rows.values()].filter((r) => r[field] === value).sort((a, b) => (a[by] < b[by] ? -1 : 1)),
      }),
      startsWith: (prefix) => ({
        delete: async () => [...rows.keys()].filter((k) => k.startsWith(prefix)).forEach((k) => rows.delete(k)),
      }),
    }),
  };
}

const db = { businessPending: fakeTable('localId'), meta: fakeTable('key') };
vi.mock('./db', () => ({ db }));
vi.mock('@/auth/tokenStorage', () => ({ getSession: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/services/negocioService', () => ({ createMovement: vi.fn() }));

const { createMovement } = await import('@/services/negocioService');
const queue = await import('./businessQueue');

const values = { kind: 'sale', category: 'ventas', amount: 20000, description: 'Arepas', date: '2026-11-08', localId: 'l1' };

describe('businessQueue (FT-0058, movimientos del negocio sin conexión)', () => {
  let isOnline;
  const online = { mockReturnValue: (v) => (isOnline = v) };
  beforeEach(() => {
    isOnline = true;
    vi.stubGlobal('navigator', {
      get onLine() {
        return isOnline;
      },
    });
    vi.stubGlobal('window', new EventTarget());
    db.businessPending.rows.clear();
    db.meta.rows.clear();
    createMovement.mockReset();
  });
  afterEach(() => vi.unstubAllGlobals());

  it('con conexión lo envía; sin conexión lo encola con el mismo localId', async () => {
    online.mockReturnValue(true);
    createMovement.mockResolvedValueOnce({ id: 'm1' });
    expect(await queue.saveBusinessMovement('n1', values)).toEqual({ queued: false, movement: { id: 'm1' } });

    online.mockReturnValue(false);
    expect(await queue.saveBusinessMovement('n1', { ...values, localId: 'l2' })).toEqual({ queued: true });
    const pending = await queue.listPendingMovements('n1');
    expect(pending.map((p) => p.localId)).toEqual(['l2']);
  });

  it('si el servidor no responde lo encola; si rechaza los datos, no', async () => {
    online.mockReturnValue(true);
    createMovement.mockRejectedValueOnce(Object.assign(new Error('caído'), { code: 'INTERNAL_ERROR' }));
    expect(await queue.saveBusinessMovement('n1', values)).toEqual({ queued: true });
    createMovement.mockRejectedValueOnce(Object.assign(new Error('Datos inválidos'), { code: 'VALIDATION_ERROR' }));
    await expect(queue.saveBusinessMovement('n1', { ...values, localId: 'l3' })).rejects.toThrow('Datos inválidos');
  });

  it('al volver la conexión envía los pendientes y marca los rechazados sin borrarlos', async () => {
    online.mockReturnValue(false);
    await queue.saveBusinessMovement('n1', values);
    await queue.saveBusinessMovement('n1', { ...values, localId: 'l2' });
    online.mockReturnValue(true);
    createMovement
      .mockResolvedValueOnce({ id: 'm1' })
      .mockRejectedValueOnce(Object.assign(new Error('Eres lector'), { code: 'FORBIDDEN' }));
    await queue.flushBusinessMovements();
    const pending = await queue.listPendingMovements('n1');
    expect(pending).toHaveLength(1);
    expect(pending[0]).toMatchObject({ localId: 'l2', rejected: 'Eres lector' });
    expect(createMovement).toHaveBeenCalledWith('n1', expect.objectContaining({ localId: 'l1' }));
  });

  it('guarda y lee el mes del negocio para verlo sin conexión', async () => {
    await queue.cacheBusinessMonth('n1', { month: '2026-11', movements: [] });
    expect(await queue.getCachedBusinessMonth('n1', '2026-11')).toEqual({ month: '2026-11', movements: [] });
    await queue.clearBusinessCache('u1');
    expect(await queue.getCachedBusinessMonth('n1', '2026-11')).toBeNull();
  });
});
