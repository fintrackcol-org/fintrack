import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Download, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import useInstallPrompt from '@/hooks/useInstallPrompt';
import { chromeIntentUrl } from '@/lib/google';
import { cn } from '@/lib/utils';
import { INSTALL_GUIDES, installPlatform } from './installGuide';
import { handleTabKeys } from './tabKeys';

/**
 * Pantallas reales de la app (390 × 844, tema claro) con la cuenta de ejemplo de la vista
 * simulada. Se rehacen cuando cambie la app; `bg` es el fondo de cada una, para la barra de estado.
 */
const SCREENS = [
  {
    id: 'inicio',
    label: 'Inicio',
    caption: 'Lo que tienes libre para gastar, de un vistazo.',
    alt: 'Pantalla de Inicio de Rinde: 412.300 pesos libres para gastar, ingresos y gastos del mes y el próximo pago de la tarjeta.',
    bg: '#f5f4f9',
  },
  {
    id: 'anotar',
    label: 'Anotar',
    caption: 'Escribes o dices el gasto, y la IA le pone la categoría.',
    alt: 'Pantalla para anotar un gasto en Rinde: monto, descripción con micrófono y la categoría que elige la IA.',
    bg: '#ffffff',
  },
  {
    id: 'movimientos',
    label: 'Movimientos',
    caption: 'Todo lo que entra y sale, por semana, mes o año.',
    alt: 'Pantalla de Movimientos de Rinde: los gastos de noviembre por día, con su categoría y su monto.',
    bg: '#f5f4f9',
  },
];

/**
 * Celular: marco con botones laterales e isla, en la proporción de un celular real (9:19,5).
 * Adentro, una barra de estado de 24 px y la captura, que a cualquier ancho llena lo que queda.
 * Las tres capturas están apiladas y se cruzan con un fundido al cambiar de pantalla.
 */
function Phone({ active }) {
  const screen = SCREENS[active];
  return (
    <div className="relative w-[min(300px,78vw)]">
      <span className="absolute -left-[3px] top-[22%] h-10 w-[3px] rounded-l bg-obsidian/80" aria-hidden="true" />
      <span className="absolute -left-[3px] top-[32%] h-14 w-[3px] rounded-l bg-obsidian/80" aria-hidden="true" />
      <span className="absolute -right-[3px] top-[28%] h-16 w-[3px] rounded-r bg-obsidian/80" aria-hidden="true" />
      <div className="aspect-[9/19.5] rounded-[3rem] bg-obsidian p-2.5 shadow-[0_40px_80px_-30px_rgba(20,20,20,0.6),inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        <div
          className="relative flex size-full flex-col overflow-hidden rounded-[2.5rem] transition-colors duration-200"
          style={{ backgroundColor: screen.bg }}
        >
          <div className="flex h-6 shrink-0 items-center justify-between px-7 text-[11px] font-semibold text-obsidian" aria-hidden="true">
            <span>9:41</span>
            <span className="h-2 w-3.5 rounded-[2px] border border-obsidian/70" />
          </div>
          <span className="absolute left-1/2 top-1 z-10 h-5 w-20 -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
          <div className="relative flex-1">
            {SCREENS.map((s, i) => (
              <img
                key={s.id}
                src={`/screenshots/landing/${s.id}.webp`}
                alt={i === active ? s.alt : ''}
                aria-hidden={i !== active}
                width={390}
                height={844}
                loading="lazy"
                decoding="async"
                className={cn(
                  'absolute inset-x-0 top-0 h-auto w-full motion-safe:transition-opacity motion-safe:duration-200',
                  i === active ? 'opacity-100' : 'opacity-0',
                )}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * "Tus finanzas, en el bolsillo": la app instalable (PWA), mostrada con pantallas reales en un
 * celular. La persona elige cuál ver (no cambian solas).
 * Los pasos para instalarla son los de su dispositivo (`installGuide`): con botón si el navegador
 * lo permite, desde Compartir en iPhone, desde el menú en Android, o abriendo Safari/Chrome si
 * está en el navegador interno de otra app. Nada aparece solo ni en ventanas emergentes.
 */
export default function AppDevices() {
  const { canInstall, isInstalled, install } = useInstallPrompt();
  const [active, setActive] = useState(0);
  const [platform] = useState(() => installPlatform());
  const guide = INSTALL_GUIDES[canInstall ? 'prompt' : platform];

  return (
    <section id="app" className="scroll-mt-20 bg-white py-16 sm:py-24 md:py-32">
      <div className="container-page grid items-center gap-14 lg:grid-cols-[1fr_1.2fr]">
        <div className="text-obsidian">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet">App instalable</p>
          <h2 className="mt-4 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-6xl">
            Tus finanzas, en el bolsillo.
          </h2>
          <p className="mt-6 max-w-md text-lg text-muted-foreground md:text-xl">
            Rinde es una aplicación web progresiva: rápida, liviana y lista para usarse sin conexión.
          </p>
          {isInstalled ? (
            <p className="mt-9 flex items-center gap-3 text-lg font-medium text-emerald-700">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-mint text-emerald-800">
                <Check className="size-4" aria-hidden="true" />
              </span>
              Ya tienes Rinde instalada en este dispositivo.
            </p>
          ) : (
            <>
              <h3 className="mt-9 text-sm font-semibold uppercase tracking-[0.12em] text-obsidian/60">
                Cómo instalarla · {guide.title}
              </h3>
              <ol className="mt-4 space-y-4">
                {guide.steps.map((step, i) => (
                  <li key={step} className="flex items-start gap-3 text-lg">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet text-sm font-semibold text-white">
                      {i + 1}
                    </span>
                    <span className="pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </>
          )}
          <div className="mt-10 flex flex-wrap gap-3">
            {!isInstalled && canInstall && (
              <Button size="lg" className="rounded-full px-7" onClick={install}>
                <Download /> Instalar app
              </Button>
            )}
            {!isInstalled && !canInstall && platform === 'android-inapp' && (
              <Button asChild size="lg" className="rounded-full px-7">
                <a href={chromeIntentUrl()}>
                  <ExternalLink /> Abrir en Chrome
                </a>
              </Button>
            )}
            {/* Crear la cuenta siempre está; es la acción principal cuando no hay otra. */}
            <Button
              asChild
              size="lg"
              variant={canInstall || platform === 'android-inapp' ? 'outline-light' : 'default'}
              className="rounded-full px-7"
            >
              <Link to="/registro">Empieza gratis</Link>
            </Button>
          </div>
        </div>

        {/* El celular sobre un fondo suave, las pestañas para elegir la pantalla y qué muestra cada una. */}
        <div className="flex flex-col items-center gap-6 rounded-[2rem] bg-pink/60 px-4 py-8 sm:px-6 sm:py-12">
          <div className="relative">
            <Phone active={active} />
            <p className="absolute -left-6 bottom-24 hidden items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-obsidian shadow-[0_18px_40px_-16px_rgba(20,20,20,0.35)] sm:flex">
              <span className="size-2.5 rounded-full bg-mint ring-4 ring-mint/40" aria-hidden="true" />
              Se guarda aunque no tengas señal
            </p>
          </div>
          <div
            role="tablist"
            aria-label="Pantallas de la app"
            onKeyDown={(e) => handleTabKeys(e, active, SCREENS.length, setActive)}
            className="flex flex-wrap justify-center gap-2"
          >
            {SCREENS.map(({ id, label }, i) => (
              <button
                key={id}
                type="button"
                role="tab"
                id={`pantalla-${id}`}
                aria-selected={i === active}
                aria-controls="pantalla-app"
                tabIndex={i === active ? 0 : -1}
                onClick={() => setActive(i)}
                className={cn(
                  'h-11 rounded-full px-5 font-medium transition-colors',
                  i === active ? 'bg-obsidian text-white' : 'bg-white text-obsidian hover:bg-white/70',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div id="pantalla-app" role="tabpanel" aria-labelledby={`pantalla-${SCREENS[active].id}`} className="-mt-2 text-center">
            <p className="text-base font-medium text-obsidian">{SCREENS[active].caption}</p>
            <p className="mt-1 text-sm text-obsidian/60">Pantallas reales de Rinde, con datos de ejemplo.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
