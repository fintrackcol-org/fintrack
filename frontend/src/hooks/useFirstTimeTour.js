import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { finishTutorial } from '@/services/moneyProfileService';

/** Marca local: el tutorial ya se vio en este dispositivo aunque el servidor aún no lo sepa (sin conexión). */
export const TOUR_SEEN_KEY = 'rinde.tutorialSeen';

const readSeen = () => {
  try {
    return localStorage.getItem(TOUR_SEEN_KEY) === '1';
  } catch {
    return false;
  }
};

/**
 * Cuándo mostrar el tutorial de primera vez (FT-0071): solo después de la bienvenida y si el servidor
 * no lo tiene como visto; o siempre que se abra el inicio con `?tutorial=1` (desde Cuenta). Al cerrarlo se
 * guarda en el servidor; si no hay conexión queda la marca local y se envía la próxima vez.
 * @param {{ profile: { welcomeDone?: boolean, tutorialDone?: boolean }|undefined, online: boolean, onSaved?: () => void }} options
 * @returns {{ touring: boolean, closeTour: () => void }}
 */
export default function useFirstTimeTour({ profile, online, onSaved }) {
  const [params, setParams] = useSearchParams();
  const [touring, setTouring] = useState(false);
  const forced = params.get('tutorial') === '1';

  useEffect(() => {
    if (forced) {
      setTouring(true);
      setParams((p) => {
        p.delete('tutorial');
        return p;
      }, { replace: true });
      return;
    }
    if (!profile?.welcomeDone || profile.tutorialDone) return;
    if (!readSeen()) {
      setTouring(true);
      return;
    }
    // Se vio sin conexión: ahora sí se le cuenta al servidor.
    if (online) finishTutorial().then(onSaved, () => {});
  }, [forced, profile?.welcomeDone, profile?.tutorialDone, online, onSaved, setParams]);

  const closeTour = useCallback(() => {
    setTouring(false);
    try {
      localStorage.setItem(TOUR_SEEN_KEY, '1');
    } catch {
      // Sin almacenamiento (modo privado): solo queda el servidor.
    }
    if (!profile?.tutorialDone) finishTutorial().then(onSaved, () => {});
  }, [profile?.tutorialDone, onSaved]);

  return { touring, closeTour };
}
