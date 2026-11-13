import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowDown, ArrowRight, BarChart3, Play, Sparkles, WifiOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import FlyingLogo, { LogoArt } from './FlyingLogo';
import HowItWorks from './HowItWorks';
import { useTour } from './tour/GuidedTour';

const ABOUT_POINTS = [
  { icon: BarChart3, label: 'Reportes de ingresos y gastos' },
  { icon: Sparkles, label: 'Análisis con IA' },
  { icon: WifiOff, label: 'Funciona sin conexión' },
];

/** Entrada escalonada del texto del hero. */
const fadeUp = (delay) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.8, delay, ease: [0.22, 1, 0.36, 1] },
});

/**
 * Escenario del inicio: el hero (negro), "Qué es" (violeta profundo) y "Cómo funciona" (lavanda),
 * cada uno con su color sólido, comparten una capa pegada (sticky) con el logo de Rinde. Al
 * bajar, el logo viaja del centro a la derecha y aterriza en el celular. Todo es SVG y CSS.
 * Los fondos de las secciones no llevan `position`: así se pintan debajo del logo, y el texto
 * (`relative z-10`) queda encima.
 * Con "reducir movimiento" el logo no viaja: queda quieto en el hero y otro en el celular.
 */
export default function HeroStage() {
  const tour = useTour();
  const reducedMotion = useReducedMotion() ?? false;
  const fly = !reducedMotion;

  return (
    <div data-stage-root data-fly={fly ? 'on' : 'off'} className="group/stage relative bg-black text-white">
      {/*
        Capa del logo: del tamaño exacto del escenario (recortada con `overflow: clip`, que a
        diferencia de `hidden` no rompe el sticky) y dentro, una capa pegada arriba de la pantalla.
      */}
      <div data-scene-layer className="pointer-events-none absolute inset-0 [overflow:clip]" aria-hidden="true">
        <div className="sticky top-0 h-[100svh] overflow-hidden">
          {fly && <FlyingLogo />}
        </div>
      </div>

      {/*
        Hero: logo, titular y acciones en una sola columna centrada. El logo tiene su propio
        espacio reservado (`data-logo-hero`) y el logo que viaja arranca justo ahí, así nunca tapa el texto,
        sea cual sea el tamaño de la pantalla. Si no cabe todo, el hero crece en vez de encimarse.
      */}
      <section
        id="inicio"
        data-stage="hero"
        className="flex min-h-[100svh] flex-col items-center justify-center bg-black px-4 pb-12 pt-[calc(5.5rem+env(safe-area-inset-top))] text-center"
      >
        {/* Hueco del logo: el logo que viaja sale de aquí. Sin animación, queda uno quieto. */}
        <div data-logo-hero className="relative mb-8 size-[clamp(6.5rem,20svh,12rem)] shrink-0 md:mb-10">
          {!fly && <LogoArt animateIn={false} className="size-full" />}
        </div>
        <h1 className="relative z-10 max-w-5xl text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] sm:text-6xl md:text-7xl lg:text-[5.25rem]">
          Todos tus ingresos y gastos en un solo lugar
        </h1>
        <motion.p {...fadeUp(0.15)} className="relative z-10 mt-6 max-w-xl text-pretty text-lg text-white/70 md:text-xl">
          Registra tus movimientos en segundos, mira reportes claros de a dónde va tu dinero y recibe recomendaciones
          de ahorro con inteligencia artificial.
        </motion.p>
        <motion.div {...fadeUp(0.3)} className="relative z-10 mt-9 flex flex-col items-center gap-4">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-orchid">Un minuto, con voz</p>
          <div className="flex flex-col items-center gap-3 sm:flex-row">
            {/* "Comenzar": la voz explica Rinde y la página baja sola, sección por sección. */}
            <button
              type="button"
              onClick={tour.start}
              className="group inline-flex h-14 items-center gap-3 rounded-full bg-white pl-2 pr-7 text-lg font-semibold text-obsidian transition-[background-color,transform] hover:bg-pink motion-safe:active:scale-[0.98]"
            >
              <span className="grid size-10 place-items-center rounded-full bg-violet text-white transition-transform group-hover:scale-105">
                <Play className="size-5 translate-x-px" aria-hidden="true" />
              </span>
              Comenzar
            </button>
            <Button
              asChild
              size="lg"
              className="h-14 rounded-full px-7 text-lg motion-safe:transition-[background-color,transform] motion-safe:active:scale-[0.98]"
            >
              <Link to="/registro">
                Crear cuenta gratis <ArrowRight className="!size-5" aria-hidden="true" />
              </Link>
            </Button>
          </div>
          <a href="#que-es" className="inline-flex items-center gap-1.5 text-white/60 transition-colors hover:text-white">
            o baja a tu ritmo <ArrowDown className="size-4 motion-safe:animate-bounce" aria-hidden="true" />
          </a>
        </motion.div>
      </section>

      {/* Qué es: texto a la izquierda; el logo llega por la derecha. */}
      <section
        id="que-es"
        data-stage="about"
        className="flex min-h-[110svh] bg-[#1c1248] scroll-mt-20 items-center pb-[10svh] pt-[30svh] lg:pt-0"
      >
        <div className="container-page relative z-10">
          <div className="max-w-xl">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-mint">Qué es Rinde</p>
            <h2 className="mt-4 text-balance text-5xl font-semibold leading-[0.98] tracking-[-0.04em] md:text-6xl lg:text-7xl">
              Tu plata, bajo control.
            </h2>
            <p className="mt-6 max-w-md text-lg text-white/80 md:text-xl">
              Tus gastos, ingresos y presupuestos, y hasta las cuentas de tu negocio, en una sola app que funciona
              incluso sin internet.
            </p>
            <ul className="mt-9 space-y-3">
              {ABOUT_POINTS.map(({ icon: Icon, label }) => (
                <li key={label} className="flex items-center gap-3 text-lg font-medium">
                  <span className="grid size-10 place-items-center rounded-full bg-white/15">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  {label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <HowItWorks />
    </div>
  );
}
