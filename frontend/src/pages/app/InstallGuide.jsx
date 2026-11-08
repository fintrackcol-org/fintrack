import { useState } from 'react';
import { CircleCheck, Download, EllipsisVertical, Share, SquarePlus } from 'lucide-react';
import { LogoMark } from '@/components/common/Logo';
import Tabs from '@/components/common/Tabs';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import useInstallPrompt from '@/hooks/useInstallPrompt';
import usePageTitle from '@/hooks/usePageTitle';

const TABS = [
  { value: 'android', label: 'Android' },
  { value: 'ios', label: 'iPhone' },
];

/**
 * Qué pestaña abrir según el celular. iPadOS se presenta como Mac, pero con pantalla táctil.
 * @param {string} userAgent
 * @param {number} [touchPoints] `navigator.maxTouchPoints`
 * @returns {'ios'|'android'}
 */
export function detectPlatform(userAgent, touchPoints = 0) {
  if (/iPhone|iPad|iPod/i.test(userAgent)) return 'ios';
  if (/Macintosh/i.test(userAgent) && touchPoints > 1) return 'ios';
  return 'android';
}

/** Un paso numerado con su dibujo a la derecha. */
function Step({ number, title, children, art }) {
  return (
    <li className="flex items-center gap-4 rounded-2xl border border-ink/10 p-4">
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">
        {number}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-medium">{title}</p>
        <p className="text-sm text-ink/60">{children}</p>
      </div>
      <span aria-hidden="true" className="grid size-12 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
        {art}
      </span>
    </li>
  );
}

/** Así queda el ícono en la pantalla de inicio. */
const HomeIcon = (
  <span className="flex flex-col items-center">
    <LogoMark className="size-7" />
  </span>
);

function AndroidGuide({ canInstall, install }) {
  return (
    <div className="space-y-4">
      {canInstall && (
        <Panel className="flex flex-wrap items-center gap-4">
          <p className="min-w-40 flex-1">Este dispositivo deja instalarla con un toque.</p>
          <Button onClick={install}>
            <Download aria-hidden="true" />
            Instalar FinTrack
          </Button>
        </Panel>
      )}
      <p className="text-sm text-ink/60">{canInstall ? 'O hazlo a mano desde Chrome:' : 'Desde Chrome:'}</p>
      <ol className="space-y-3">
        <Step number={1} title="Abre el menú de Chrome" art={<EllipsisVertical className="size-6" />}>
          Los tres puntos arriba a la derecha.
        </Step>
        <Step number={2} title="Toca “Instalar app”" art={<Download className="size-6" />}>
          En algunos celulares dice “Agregar a la pantalla principal”.
        </Step>
        <Step number={3} title="Ábrela desde tu pantalla" art={HomeIcon}>
          Queda con el ícono de FinTrack, como cualquier app.
        </Step>
      </ol>
    </div>
  );
}

function IosGuide() {
  return (
    <div className="space-y-4">
      <p className="text-sm text-ink/60">En el iPhone se instala desde Safari:</p>
      <ol className="space-y-3">
        <Step number={1} title="Toca Compartir" art={<Share className="size-6" />}>
          El cuadro con la flecha hacia arriba, en la barra de Safari.
        </Step>
        <Step number={2} title="Elige “Agregar a inicio”" art={<SquarePlus className="size-6" />}>
          Desliza hacia abajo en el menú si no lo ves.
        </Step>
        <Step number={3} title="Toca Agregar" art={HomeIcon}>
          FinTrack queda en tu pantalla de inicio y abre sin la barra de Safari.
        </Step>
      </ol>
      <p className="text-sm text-ink/60">¿Usas Chrome en el iPhone? Abre esta página en Safari: Apple solo deja instalar desde ahí.</p>
    </div>
  );
}

/** Página privada `/app/instalar` (FT-0049): cómo poner FinTrack en la pantalla de inicio. */
export default function InstallGuide() {
  usePageTitle('Instalar la app');
  const { canInstall, isInstalled, install } = useInstallPrompt();
  const [platform, setPlatform] = useState(() => detectPlatform(navigator.userAgent, navigator.maxTouchPoints));

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Instala FinTrack" description="Ábrela con un toque, a pantalla completa y aunque no tengas internet." />
      {isInstalled ? (
        <Panel className="flex items-center gap-3">
          <CircleCheck className="size-6 shrink-0 text-positive" aria-hidden="true" />
          <p>Ya tienes FinTrack instalada en este dispositivo.</p>
        </Panel>
      ) : (
        <Tabs label="Tu celular" tabs={TABS} value={platform} onChange={setPlatform}>
          {(value) => (
            <div className="mt-5">
              {value === 'ios' ? <IosGuide /> : <AndroidGuide canInstall={canInstall} install={install} />}
            </div>
          )}
        </Tabs>
      )}
    </div>
  );
}
