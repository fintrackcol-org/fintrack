import { Download } from 'lucide-react';
import useInstallPrompt from '@/hooks/useInstallPrompt';

const CLASS =
  'inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-6 text-base font-semibold text-white transition-colors hover:bg-white/10 md:hidden';

/**
 * "Instalar app" del hero, solo en celular. Si el navegador ofrece instalar (Android), abre su
 * ventana; si no (iPhone, navegador de otra app…), baja a "App instalable", donde `installGuide`
 * muestra los pasos de ese dispositivo. No aparece si ya está instalada.
 */
export default function InstallAppButton() {
  const { canInstall, isInstalled, install } = useInstallPrompt();
  if (isInstalled) return null;
  return canInstall ? (
    <button type="button" onClick={install} className={CLASS}>
      <Download className="size-5" aria-hidden="true" /> Instalar app
    </button>
  ) : (
    <a href="#app" className={CLASS}>
      <Download className="size-5" aria-hidden="true" /> Instalar app
    </a>
  );
}
