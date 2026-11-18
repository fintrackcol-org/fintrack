import { afterEach, describe, expect, it } from 'vitest';
import { clearDraft, loadDraft, saveDraft } from '@/lib/onboardingDraft';

/** Almacenamiento de mentira: las pruebas corren en Node, sin `localStorage`. */
function fakeStorage() {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => data.set(k, v),
    removeItem: (k) => data.delete(k),
  };
  return data;
}

afterEach(() => {
  delete globalThis.localStorage;
});

describe('borrador de la bienvenida', () => {
  it('guarda, recupera y borra lo de cada usuario por separado', () => {
    fakeStorage();
    saveDraft('ana', { position: 7, balance: '250000' });
    expect(loadDraft('ana')).toEqual({ position: 7, balance: '250000' });
    expect(loadDraft('luis')).toEqual({});
    clearDraft('ana');
    expect(loadDraft('ana')).toEqual({});
  });

  it('un borrador dañado o sin almacenamiento no rompe la bienvenida', () => {
    expect(loadDraft('ana')).toEqual({}); // sin localStorage
    expect(() => saveDraft('ana', { position: 1 })).not.toThrow();
    const data = fakeStorage();
    data.set('rinde.bienvenida.ana', '{mal');
    expect(loadDraft('ana')).toEqual({});
    data.set('rinde.bienvenida.ana', '[1,2]');
    expect(loadDraft('ana')).toEqual({});
  });
});
