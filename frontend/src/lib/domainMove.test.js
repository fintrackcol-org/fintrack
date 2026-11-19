import { describe, expect, it, vi } from 'vitest';
import { countUnsent, forgetOldDomain, isOldHost, moveToNewDomain, newAddress } from './domainMove';

const location = { pathname: '/app/vacas/unirse/ABC123', search: '?x=1', hash: '#top' };

function deps(overrides = {}) {
  return {
    sync: vi.fn().mockResolvedValue(),
    countUnsent: vi.fn().mockResolvedValue(0),
    forget: vi.fn().mockResolvedValue(),
    go: vi.fn(),
    location,
    ...overrides,
  };
}

describe('mudanza de dominio', () => {
  it('reconoce los dominios viejos y no el nuevo ni QA', () => {
    expect(isOldHost('www.fintrackcol.online')).toBe(true);
    expect(isOldHost('fintrackcol.online')).toBe(true);
    expect(isOldHost('fintrack-seven-delta.vercel.app')).toBe(true);
    expect(isOldHost('WWW.FINTRACKCOL.ONLINE')).toBe(true);
    expect(isOldHost('www.rindecol.online')).toBe(false);
    expect(isOldHost('qa.rindecol.online')).toBe(false);
    expect(isOldHost('localhost')).toBe(false);
  });

  it('lleva a la misma pantalla en el dominio nuevo', () => {
    expect(newAddress(location)).toBe('https://www.rindecol.online/app/vacas/unirse/ABC123?x=1#top');
  });

  it('envía lo pendiente, limpia el dominio viejo y redirige', async () => {
    const d = deps();
    const result = await moveToNewDomain(d);
    expect(d.sync).toHaveBeenCalledOnce();
    expect(d.forget).toHaveBeenCalledOnce();
    expect(d.go).toHaveBeenCalledWith('https://www.rindecol.online/app/vacas/unirse/ABC123?x=1#top');
    expect(result).toEqual({ moved: true, unsent: 0 });
    // Primero envía y después limpia: si limpiara antes, se perdería lo pendiente.
    expect(d.sync.mock.invocationCallOrder[0]).toBeLessThan(d.forget.mock.invocationCallOrder[0]);
  });

  it('no se va si quedan movimientos sin enviar (p. ej. sin internet)', async () => {
    const d = deps({ countUnsent: vi.fn().mockResolvedValue(3), online: false });
    const result = await moveToNewDomain(d);
    expect(d.sync).not.toHaveBeenCalled();
    expect(d.forget).not.toHaveBeenCalled();
    expect(d.go).not.toHaveBeenCalled();
    expect(result).toEqual({ moved: false, unsent: 3 });
  });

  it('con "Ir sin enviarlos" se va aunque queden pendientes', async () => {
    const d = deps({ countUnsent: vi.fn().mockResolvedValue(2), force: true });
    expect(await moveToNewDomain(d)).toEqual({ moved: true, unsent: 2 });
    expect(d.go).toHaveBeenCalledOnce();
  });

  it('si la sincronización falla o se demora, igual revisa qué quedó', async () => {
    const failing = deps({ sync: vi.fn().mockRejectedValue(new Error('500')) });
    expect((await moveToNewDomain(failing)).moved).toBe(true);

    const hanging = deps({ sync: () => new Promise(() => {}), timeoutMs: 10, countUnsent: vi.fn().mockResolvedValue(1) });
    expect(await moveToNewDomain(hanging)).toEqual({ moved: false, unsent: 1 });
  });

  it('cuenta los pendientes de las tres colas sin los rechazados', async () => {
    const table = (ops) => ({ filter: (fn) => ({ count: async () => ops.filter(fn).length }) });
    const db = {
      pending: table([{}, { rejected: true }, {}]),
      vacaPending: table([{}]),
      businessPending: table([{ rejected: true }]),
    };
    expect(await countUnsent(db)).toBe(3);
  });

  it('quita el service worker, las notificaciones y la caché del dominio viejo', async () => {
    const unsubscribe = vi.fn().mockResolvedValue(true);
    const unregister = vi.fn().mockResolvedValue(true);
    const registration = { pushManager: { getSubscription: async () => ({ unsubscribe }) }, unregister };
    const caches = { keys: async () => ['workbox-precache', 'imagenes'], delete: vi.fn().mockResolvedValue(true) };
    await forgetOldDomain({ serviceWorker: { getRegistrations: async () => [registration] }, caches });
    expect(unsubscribe).toHaveBeenCalledOnce();
    expect(unregister).toHaveBeenCalledOnce();
    expect(caches.delete).toHaveBeenCalledTimes(2);

    // Sin service worker ni Cache Storage no falla.
    await expect(forgetOldDomain({ serviceWorker: undefined, caches: undefined })).resolves.toBeUndefined();
  });
});
