import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, ChevronDown, ChevronUp, Loader2, Pause, Play, RotateCcw, SkipBack, SkipForward, VolumeX, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import useGuidedTour, { TOUR_DURATION, TOUR_SEGMENTS } from './useGuidedTour';

/** Nombre corto de cada sección para el reproductor. */
const LABELS = {
  inicio: 'Inicio',
  'que-es': 'Qué es',
  'como-funciona': 'Cómo funciona',
  funcionalidades: 'Funcionalidades',
  alertas: 'Alertas',
  app: 'App',
  seguridad: 'Seguridad',
  empieza: 'Empieza',
};

/** Botón redondo secundario del reproductor: 44 px para el dedo. */
const ICON_BUTTON =
  'grid size-11 shrink-0 place-items-center rounded-full text-white/65 transition-colors hover:bg-white/10 hover:text-white disabled:pointer-events-none disabled:opacity-30';
const SHELL =
  'fixed bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 bg-obsidian/95 text-white shadow-[0_20px_50px_-15px_rgba(0,0,0,0.6)] ring-1 ring-white/10 backdrop-blur-md';

/**
 * Pantallas donde el reproductor arranca minimizado: celulares en vertical (menos de 640 px de
 * ancho) y en horizontal (menos de 500 px de alto). Ahí el completo tapaba media sección.
 */
const COMPACT = '(max-width: 639px), (max-height: 500px)';

/** Cuánto va de cada tramo (0 a 1), un tramo por frase. */
const fills = (progress, done) =>
  TOUR_SEGMENTS.map((s) => (done ? 1 : Math.min(Math.max((progress * TOUR_DURATION - s.start) / (s.end - s.start), 0), 1)));

const TourContext = createContext({ status: 'idle', start: () => {} });

/** `start` y `status` del recorrido, para el botón "Comenzar" del hero. */
export const useTour = () => useContext(TourContext);

/**
 * Reproductor flotante. Completo: anterior, pausa/seguir, siguiente, la sección y la frase que
 * suenan (subtítulos), minimizar, cerrar y el avance por secciones (cada tramo lleva a la suya).
 * Minimizado (por defecto en celular): una barra de 56 px con pausa/seguir, la sección, el avance,
 * ampliar y cerrar; los subtítulos siguen ahí para lectores de pantalla y se ven al ampliar.
 * Escape cierra el recorrido. Al terminar invita a crear la cuenta.
 */
function TourPlayer({ tour }) {
  const { status, index, text, progress, muted, loading, pause, resume, start, stop, goTo, remeasure } = tour;
  const [mini, setMini] = useState(() => window.matchMedia(COMPACT).matches);
  const playing = status === 'playing';
  const done = status === 'done';
  const segment = TOUR_SEGMENTS[index];
  const label = done ? 'Fin del recorrido' : LABELS[segment.id];

  // El recorrido ubica cada sección entre la barra de arriba y este reproductor: si cambia de
  // alto (al aparecer, minimizar o ampliar), se vuelve a medir.
  const ref = useRef(null);
  useEffect(() => {
    const ro = new ResizeObserver(() => remeasure());
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [mini, remeasure]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && stop();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [stop]);

  const main = done ? (
    <button
      type="button"
      onClick={start}
      aria-label="Repetir el recorrido"
      className="grid size-11 shrink-0 place-items-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
    >
      <RotateCcw className="size-5" aria-hidden="true" />
    </button>
  ) : (
    <button
      type="button"
      onClick={playing ? pause : resume}
      aria-label={playing ? 'Pausar el recorrido' : 'Seguir el recorrido'}
      className="grid size-11 shrink-0 place-items-center rounded-full bg-violet transition-[background-color,transform] hover:bg-violet-light motion-safe:active:scale-95"
    >
      {loading ? (
        <Loader2 className="size-5 motion-safe:animate-spin" aria-hidden="true" />
      ) : playing ? (
        <Pause className="size-5" aria-hidden="true" />
      ) : (
        <Play className="size-5 translate-x-px" aria-hidden="true" />
      )}
    </button>
  );
  const close = (
    <button type="button" onClick={stop} aria-label="Cerrar el recorrido" className={ICON_BUTTON}>
      <X className="size-4" aria-hidden="true" />
    </button>
  );
  const motionProps = {
    role: 'region',
    'aria-label': 'Recorrido con voz',
    initial: { opacity: 0, y: 16 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: 16 },
    transition: { duration: 0.24, ease: [0.22, 1, 0.36, 1] },
  };

  if (mini) {
    return (
      <motion.div
        key="mini"
        ref={ref}
        {...motionProps}
        className={cn(SHELL, 'inset-x-0 mx-auto flex w-[calc(100%-1.5rem)] max-w-sm items-center gap-1 rounded-full p-1.5')}
      >
        {main}
        {done ? (
          <Link to="/registro" className="flex min-h-11 min-w-0 flex-1 items-center gap-1.5 px-2 text-sm font-semibold">
            Crear cuenta gratis <ArrowRight className="size-4 shrink-0" aria-hidden="true" />
          </Link>
        ) : (
          <div className="min-w-0 flex-1 px-2">
            <p className="truncate text-sm font-medium">
              {label}
              {loading && <span className="font-normal text-white/50"> · cargando…</span>}
              {status === 'paused' && <span className="font-normal text-white/50"> · en pausa</span>}
              {muted && <span className="font-normal text-white/50"> · sin audio</span>}
            </p>
            <div className="mt-1.5 flex gap-0.5" aria-hidden="true">
              {fills(progress, done).map((fill, i) => (
                <span key={TOUR_SEGMENTS[i].id} className="h-[3px] overflow-hidden rounded-full bg-white/15" style={{ flex: `${TOUR_SEGMENTS[i].end - TOUR_SEGMENTS[i].start} 1 0%` }}>
                  <span className="block h-full origin-left rounded-full bg-violet-light" style={{ transform: `scaleX(${fill})` }} />
                </span>
              ))}
            </div>
            <p aria-live={muted ? 'polite' : 'off'} className="sr-only">
              {text}
            </p>
          </div>
        )}
        <button type="button" onClick={() => setMini(false)} aria-label="Ampliar el reproductor" className={ICON_BUTTON}>
          <ChevronUp className="size-5" aria-hidden="true" />
        </button>
        {close}
      </motion.div>
    );
  }

  return (
    <motion.div
      key="full"
      ref={ref}
      {...motionProps}
      className={cn(SHELL, 'inset-x-0 mx-auto w-[calc(100%-1.5rem)] max-w-3xl rounded-[1.75rem] p-2 pb-3')}
    >
      {/* En celular los subtítulos van arriba, a todo el ancho; en pantallas anchas, entre los controles. */}
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1.5 sm:flex-nowrap sm:gap-x-2">
        <div className="flex shrink-0 items-center">
          {!done && (
            <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Sección anterior" className={ICON_BUTTON}>
              <SkipBack className="size-4" aria-hidden="true" />
            </button>
          )}
          {main}
          {!done && (
            <button
              type="button"
              onClick={() => goTo(index + 1)}
              disabled={index === TOUR_SEGMENTS.length - 1}
              aria-label="Sección siguiente"
              className={ICON_BUTTON}
            >
              <SkipForward className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="order-first min-w-0 basis-full px-2 pt-1 sm:order-none sm:basis-0 sm:flex-1 sm:px-1 sm:pt-0">
          <p className="flex items-center gap-2 text-xs font-medium text-orchid">
            {label}
            {muted && !done && (
              <span className="inline-flex items-center gap-1 text-white/50">
                <VolumeX className="size-3" aria-hidden="true" /> sin audio
              </span>
            )}
            {loading && <span className="text-white/50">· cargando…</span>}
            {status === 'paused' && <span className="text-white/50">· en pausa</span>}
          </p>
          {/* Alto fijo (3 renglones en celular, 2 en ancho): el reproductor no salta de tamaño entre frases. */}
          <p
            aria-live={muted ? 'polite' : 'off'}
            className="mt-0.5 line-clamp-3 min-h-[3.375rem] text-[0.8125rem] leading-[1.125rem] text-white/90 sm:line-clamp-2 sm:min-h-[2.25rem]"
          >
            {done ? 'Crea tu cuenta gratis y anota tu primer gasto.' : text}
          </p>
        </div>

        {done && (
          <Link
            to="/registro"
            className="inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-4 text-sm font-semibold text-violet transition-colors hover:bg-white/90"
          >
            Crear cuenta <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
        <button
          type="button"
          onClick={() => setMini(true)}
          aria-label="Minimizar el reproductor"
          className={cn(ICON_BUTTON, 'ml-auto sm:ml-0')}
        >
          <ChevronDown className="size-5" aria-hidden="true" />
        </button>
        {close}
      </div>

      {/* Avance por secciones: un tramo por frase, proporcional a lo que dura; tocarlo lleva a esa sección. */}
      <div className="mt-1 flex gap-1 px-2">
        {fills(progress, done).map((fill, i) => {
          const s = TOUR_SEGMENTS[i];
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`Ir a ${LABELS[s.id]}`}
              aria-current={!done && i === index ? 'step' : undefined}
              className="group -my-2 min-w-0 py-2"
              style={{ flex: `${s.end - s.start} 1 0%` }}
            >
              <span className="block h-1 overflow-hidden rounded-full bg-white/15 transition-colors group-hover:bg-white/30">
                <span className="block h-full origin-left rounded-full bg-violet-light" style={{ transform: `scaleX(${fill})` }} />
              </span>
            </button>
          );
        })}
      </div>
    </motion.div>
  );
}

/**
 * Envuelve la landing: mantiene el estado del recorrido y muestra el reproductor y el velo de
 * los fundidos entre secciones (lo pinta el reloj del recorrido; queda bajo el menú y el reproductor).
 * La landing llega como `children`, así el avance del audio (que cambia cada cuadro)
 * solo vuelve a pintar el reproductor y no toda la página.
 */
export default function GuidedTour({ children }) {
  const tour = useGuidedTour();
  const value = useMemo(() => ({ status: tour.status, start: tour.start }), [tour.status, tour.start]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {tour.status !== 'idle' && (
        <div ref={tour.veil} aria-hidden="true" className="pointer-events-none fixed inset-0 z-40 opacity-0" />
      )}
      <AnimatePresence>{tour.status !== 'idle' && <TourPlayer key="tour" tour={tour} />}</AnimatePresence>
    </TourContext.Provider>
  );
}
