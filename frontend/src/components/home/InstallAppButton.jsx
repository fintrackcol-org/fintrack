import { useState } from 'react';
import { Download, Share, SquarePlus } from 'lucide-react';
import Sheet from '@/components/common/Sheet';
import useInstallPrompt from '@/hooks/useInstallPrompt';

/** Safari en iPhone/iPad no dispara `beforeinstallprompt`: ahí solo se puede explicar cómo. */
const isIos = () =>
  typeof navigator !== 'undefined' &&
  (/iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));

const IOS_STEPS = [
  { icon: Share, text: 'Toca Compartir en la barra de Safari.' },
  { icon: SquarePlus, text: 'Elige «Agregar a inicio».' },
  { icon: Download, text: 'Toca «Agregar». Rinde queda con su ícono, como una app.' },
];

/**
 * "Instalar app" del hero, solo en celular. En Android abre el instalador del navegador; en iPhone,
 * los pasos de Safari. No aparece si ya está instalada o si el navegador no permite instalarla.
 */
export default function InstallAppButton() {
  const { canInstall, isInstalled, install } = useInstallPrompt();
  const [steps, setSteps] = useState(false);
  const ios = isIos();
  if (isInstalled || (!canInstall && !ios)) return null;

  return (
    <>
      <button
        type="button"
        onClick={canInstall ? install : () => setSteps(true)}
        className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 px-6 font-semibold text-white transition-colors hover:bg-white/10 md:hidden"
      >
        <Download className="size-5" aria-hidden="true" /> Instalar app
      </button>
      <Sheet open={steps} title="Instala Rinde en tu iPhone" onClose={() => setSteps(false)}>
        <ol className="space-y-4">
          {IOS_STEPS.map(({ icon: Icon, text }, i) => (
            <li key={text} className="flex items-center gap-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-violet text-white">
                <Icon className="size-5" aria-hidden="true" />
              </span>
              <span>
                <span className="font-semibold">{i + 1}.</span> {text}
              </span>
            </li>
          ))}
        </ol>
      </Sheet>
    </>
  );
}
