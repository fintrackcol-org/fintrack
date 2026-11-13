import { Link } from 'react-router-dom';
import { Check, Download, Flag, Home, List, Wallet, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LogoMark } from '@/components/common/Logo';
import useInstallPrompt from '@/hooks/useInstallPrompt';
import { cn } from '@/lib/utils';

const STEPS = [
  'Abre Rinde en el navegador',
  'Agrégala a tu pantalla de inicio',
  'Ábrela como cualquier otra app, incluso sin internet',
];

/** Gastos del mes por categoría (los mismos datos de ejemplo de la app). */
const CATEGORIES = [
  { name: 'Alimentación', amount: '$412.000', pct: 38, tone: 'bg-violet' },
  { name: 'Transporte', amount: '$238.000', pct: 22, tone: 'bg-violet-light' },
  { name: 'Vivienda', amount: '$216.000', pct: 20, tone: 'bg-orchid' },
];

/** Pestañas de la app: las mismas cuatro de la barra inferior. */
const TABS = [
  { icon: Home, label: 'Inicio', on: true },
  { icon: List, label: 'Movimientos' },
  { icon: Wallet, label: 'Mi plata' },
  { icon: Flag, label: 'Metas' },
];

/**
 * Pantalla de Inicio de la app, en tema oscuro: saldo, hasta cuándo alcanza, gastos por
 * categoría y la barra de pestañas. Es una ilustración: nada aquí es interactivo.
 */
function AppScreen() {
  return (
    <div className="flex h-full flex-col bg-obsidian text-white">
      {/* Barra de estado del celular */}
      <div className="flex items-center justify-between px-6 pt-3 text-[11px] font-semibold">
        <span>9:41</span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-3.5 rounded-[2px] border border-white/80" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 overflow-hidden px-4 pt-6">
        <div className="flex items-center gap-2">
          <LogoMark className="size-7" />
          <span className="text-sm font-semibold">Hola, Ana</span>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">
            <WifiOff className="size-3" aria-hidden="true" />
            Sin conexión
          </span>
        </div>

        <div className="relative overflow-hidden rounded-3xl bg-violet p-4">
          <span className="absolute -right-10 -top-10 size-28 rounded-full border-[18px] border-white/15" />
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-white/80">Mi plata · noviembre</p>
          <p className="mt-1 text-[28px] font-extrabold leading-tight tracking-[-0.02em]">$412.300</p>
          <div className="relative mt-3 h-1 rounded-full bg-white/30">
            <div className="h-full w-[64%] rounded-full bg-white" />
            <span className="absolute left-[64%] top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-mint" />
          </div>
          <p className="mt-2 text-[11px] text-white/85">Te alcanza 14 días más</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-2xl bg-white/[0.06] p-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">Ingresos</p>
            <p className="mt-0.5 text-sm font-bold text-mint">+$700.000</p>
          </div>
          <div className="rounded-2xl bg-white/[0.06] p-3">
            <p className="text-[10px] uppercase tracking-[0.08em] text-white/55">Gastos</p>
            <p className="mt-0.5 text-sm font-bold">$287.700</p>
          </div>
        </div>

        <div className="rounded-2xl bg-white/[0.06] p-3">
          <p className="text-xs font-semibold">En qué gastas</p>
          <ul className="mt-2 space-y-2.5">
            {CATEGORIES.map(({ name, amount, pct, tone }) => (
              <li key={name}>
                <div className="flex justify-between text-[11px]">
                  <span className="text-white/75">{name}</span>
                  <span className="font-semibold">{amount}</span>
                </div>
                <div className="mt-1 h-1 rounded-full bg-white/10">
                  <div className={cn('h-full rounded-full', tone)} style={{ width: `${pct * 2}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Barra de pestañas */}
      <div className="grid grid-cols-4 border-t border-white/10 bg-[#1f1f23] px-2 pb-5 pt-2">
        {TABS.map(({ icon: Icon, label, on }) => (
          <span key={label} className={cn('flex flex-col items-center gap-0.5 text-[9px] font-semibold', on ? 'text-violet-light' : 'text-white/45')}>
            <Icon className="size-4" aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

/**
 * Celular: marco con borde, botones laterales e isla. Mantiene la proporción de un celular
 * real (9:19,5), así la pantalla nunca se ve aplastada ni estirada.
 */
function Phone() {
  return (
    <div role="img" aria-label="La pantalla de Inicio de Rinde en un celular: te quedan 412.300 pesos y te alcanza 14 días más" className="relative w-[min(300px,78vw)]">
      {/* Botones laterales */}
      <span className="absolute -left-[3px] top-[22%] h-10 w-[3px] rounded-l bg-obsidian/80" aria-hidden="true" />
      <span className="absolute -left-[3px] top-[32%] h-14 w-[3px] rounded-l bg-obsidian/80" aria-hidden="true" />
      <span className="absolute -right-[3px] top-[28%] h-16 w-[3px] rounded-r bg-obsidian/80" aria-hidden="true" />
      <div className="aspect-[9/19.5] rounded-[3rem] bg-obsidian p-2.5 shadow-[0_40px_80px_-30px_rgba(20,20,20,0.6),inset_0_0_0_1px_rgba(255,255,255,0.08)]">
        <div className="relative size-full overflow-hidden rounded-[2.5rem]">
          <span className="absolute left-1/2 top-2.5 z-10 h-6 w-24 -translate-x-1/2 rounded-full bg-black" aria-hidden="true" />
          <AppScreen />
        </div>
      </div>
    </div>
  );
}

/**
 * "Tus finanzas, en el bolsillo": la app instalable (PWA), mostrada en un celular.
 * Si el navegador permite instalarla muestra "Instalar app"; si no, invita a crear la cuenta.
 */
export default function AppDevices() {
  const { canInstall, isInstalled, install } = useInstallPrompt();

  return (
    <section id="app" className="scroll-mt-20 bg-white py-24 md:py-32">
      <div className="container-page grid items-center gap-14 lg:grid-cols-[1fr_1.2fr]">
        <div className="text-obsidian">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-violet">App instalable</p>
          <h2 className="mt-4 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-6xl">
            Tus finanzas, en el bolsillo.
          </h2>
          <p className="mt-6 max-w-md text-lg text-muted-foreground md:text-xl">
            Rinde es una aplicación web progresiva: rápida, liviana y lista para usarse sin conexión.
          </p>
          <ol className="mt-9 space-y-4">
            {STEPS.map((step) => (
              <li key={step} className="flex items-center gap-3 text-lg">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-violet text-white">
                  <Check className="size-4" aria-hidden="true" />
                </span>
                {step}
              </li>
            ))}
          </ol>
          <div className="mt-10">
            {isInstalled ? (
              <p className="font-medium text-emerald-700">Ya tienes Rinde instalada en este dispositivo.</p>
            ) : canInstall ? (
              <Button size="lg" className="rounded-full px-7" onClick={install}>
                <Download /> Instalar app
              </Button>
            ) : (
              <Button asChild size="lg" className="rounded-full px-7">
                <Link to="/registro">Empieza gratis</Link>
              </Button>
            )}
          </div>
        </div>

        {/* El celular, sobre un fondo suave; la etiqueta recuerda que funciona sin internet. */}
        <div className="relative flex justify-center rounded-[2rem] bg-pink/60 px-6 py-10 sm:py-12">
          <div className="relative">
            <Phone />
            <p className="absolute -left-6 bottom-24 hidden items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-obsidian shadow-[0_18px_40px_-16px_rgba(20,20,20,0.35)] sm:flex">
              <span className="size-2.5 rounded-full bg-mint ring-4 ring-mint/40" aria-hidden="true" />
              Se guarda aunque no tengas señal
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
