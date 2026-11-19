import { useCallback, useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LogoMark } from '@/components/common/Logo';
import { t } from '@/lib/i18n';
import { NEW_ORIGIN, countUnsent, forgetOldDomain, moveToNewDomain, newAddress } from '@/lib/domainMove';
import { db } from '@/offline/db';
import { syncNow } from '@/offline/sync';
import { flushContributions } from '@/offline/vacaQueue';
import { flushBusinessMovements } from '@/offline/businessQueue';

/** Envía todas las colas de este dispositivo (gastos, aportes a vacas y movimientos de negocios). */
function syncAll() {
  return Promise.allSettled([syncNow(), flushContributions(), flushBusinessMovements()]);
}

/**
 * Pantalla que se ve al abrir Rinde en el dominio viejo (fintrackcol.online). Envía lo que estaba
 * guardado sin conexión y lleva al dominio nuevo. Si queda algo sin enviar (sin internet), no se va
 * sola: avisa cuántos movimientos faltan para no perderlos.
 * @param {{ deps?: Partial<Parameters<typeof moveToNewDomain>[0]> }} props `deps` solo para pruebas.
 */
export default function DomainMove({ deps = {} }) {
  const [state, setState] = useState({ status: 'moving', unsent: 0 });
  const target = newAddress(deps.location ?? window.location);

  const run = useCallback(
    async (force = false) => {
      setState((s) => ({ ...s, status: 'moving' }));
      const result = await moveToNewDomain({
        sync: syncAll,
        countUnsent: () => countUnsent(db),
        forget: () => forgetOldDomain(),
        go: (url) => window.location.replace(url),
        location: window.location,
        online: navigator.onLine,
        force,
        ...deps,
      });
      if (!result.moved) setState({ status: 'unsent', unsent: result.unsent });
    },
    // `deps` solo cambia en pruebas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    run();
    const retry = () => run();
    window.addEventListener('online', retry);
    return () => window.removeEventListener('online', retry);
  }, [run]);

  return (
    <main className="flex min-h-dvh items-center justify-center bg-obsidian px-6 py-10 text-white">
      <div className="w-full max-w-sm text-center">
        <LogoMark className="mx-auto size-14" />
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">{t('Rinde se mudó')}</h1>
        <p className="mt-3 text-white/75">
          {t('Ahora vivimos en')} <b className="text-white">{NEW_ORIGIN.replace('https://', '')}</b>.{' '}
          {t('Tus datos siguen ahí: solo vuelve a iniciar sesión y, si tenías la app instalada, instálala de nuevo desde la dirección nueva.')}
        </p>

        {state.status === 'moving' ? (
          <p role="status" className="mt-8 flex items-center justify-center gap-2 text-sm text-white/75">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('Guardando lo pendiente y llevándote a la dirección nueva…')}
          </p>
        ) : (
          <div role="alert" className="mt-8 rounded-2xl bg-white/10 p-4 text-left text-sm">
            <p>
              {t('Tienes {n} movimientos guardados en este celular que todavía no se envían. Conéctate a internet para no perderlos: te llevamos apenas se envíen.', {
                n: state.unsent,
              })}
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                onClick={() => run()}
                className="rounded-full bg-violet px-4 py-2.5 font-semibold text-white"
              >
                {t('Intentar de nuevo')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (window.confirm(t('Los movimientos sin enviar se perderán. ¿Ir de todas formas?'))) run(true);
                }}
                className="rounded-full px-4 py-2.5 text-white/70 underline-offset-2 hover:underline"
              >
                {t('Ir sin enviarlos')}
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 break-all text-sm text-violet-light">{target.replace('https://', '')}</p>
      </div>
    </main>
  );
}
