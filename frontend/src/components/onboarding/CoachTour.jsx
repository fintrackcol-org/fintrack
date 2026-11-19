import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

/**
 * Pasos del tutorial (FT-0071). `target` es el `data-tour` del elemento que se resalta; si no está en
 * pantalla (p. ej. sin movimientos todavía), la tarjeta sale en el centro y el paso se explica igual.
 * `tramo`: el recorrido corto, la pregunta de si ver lo demás, y el recorrido largo.
 */
export const TOUR_STEPS = [
  {
    tramo: 'corto',
    target: 'saldo',
    title: t('Esto es lo que te queda'),
    text: t('La cifra grande es tu plata del mes. La línea muestra hasta qué día te alcanza, y la moneda verde es donde llega.'),
  },
  {
    tramo: 'corto',
    target: 'anotar',
    title: t('Anota en dos toques'),
    text: t('Pon cuánto fue y en qué, o dilo con el micrófono: «taxi 9 mil» llena las dos casillas y la IA elige la categoría. También puedes anotar por WhatsApp.'),
  },
  {
    tramo: 'corto',
    target: 'totales',
    title: t('Ingresos y Gastos se tocan'),
    text: t('Ábrelos para ver en qué se fue cada peso y cuánto te entró este mes.'),
  },
  {
    tramo: 'corto',
    target: 'graficos',
    title: t('En qué gastas y cómo van tus topes'),
    text: t('Mira tus categorías más altas y tus presupuestos. Si uno pasa del 90 %, se pone rojo.'),
  },
  {
    tramo: 'corto',
    target: 'planear',
    title: t('Lo que viene, en Planear'),
    text: t('Pagos fijos, calendario, presupuestos, metas, deudas y tarjetas. Ponle fecha a una meta y Rinde te dice cuánto apartar.'),
  },
  {
    tramo: 'pregunta',
    target: null,
    title: t('¿Quieres ver lo demás?'),
    text: t('Toca tu saldo para ver Mi plata: por confirmar, consejos de la IA, renta y tus próximos días.'),
  },
  {
    tramo: 'largo',
    target: 'saldo',
    title: t('Mi plata reúne lo demás'),
    text: t('Tu saldo, por confirmar, consejos, renta y lo que entra y sale en los próximos días. Todo a un toque.'),
  },
  {
    tramo: 'largo',
    target: 'cuenta',
    title: t('Yo: tu cuenta'),
    text: t('Conecta WhatsApp, elige tus avisos, cambia a modo oscuro o repite este tutorial cuando quieras.'),
  },
];

const PAD = 6;
const GAP = 12;
const MARGIN = 12;

/** El primer elemento visible con ese `data-tour` (el del celular o el del computador). */
function findTarget(name) {
  if (!name) return null;
  for (const el of document.querySelectorAll(`[data-tour="${name}"]`)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return el;
  }
  return null;
}

/** Rectángulo con esquinas redondeadas como trazo SVG (para recortar el hueco del fondo). */
function roundedRect({ x, y, w, h }, r) {
  const k = Math.min(r, w / 2, h / 2);
  return `M${x + k} ${y}H${x + w - k}A${k} ${k} 0 0 1 ${x + w} ${y + k}V${y + h - k}A${k} ${k} 0 0 1 ${x + w - k} ${y + h}H${x + k}A${k} ${k} 0 0 1 ${x} ${y + h - k}V${y + k}A${k} ${k} 0 0 1 ${x + k} ${y}Z`;
}

/**
 * Máscara del fondo: todo opaco menos el hueco del elemento resaltado. Así el desenfoque y la sombra
 * no tapan lo que se explica.
 */
function maskFor(hole, vw, vh) {
  const outer = `M0 0H${vw}V${vh}H0Z`;
  const path = hole ? `${outer}${roundedRect(hole, hole.r)}` : outer;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vw}" height="${vh}"><path fill-rule="evenodd" d="${path}"/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}

/** Radio del resaltado: el del elemento si lo tiene, si no 16. */
function radiusOf(el) {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(r) && r > 0 ? r + PAD : 16;
}

/**
 * Tutorial sobre la app real (FT-0071): el fondo se oscurece y desenfoca, y queda resaltado solo el
 * elemento que se explica, con una tarjeta corta. Recorrido corto (lo esencial), una pregunta, y el
 * largo (lo menos visible). Omitir siempre visible; se cierra con Esc o tocando fuera. El foco queda
 * dentro de la tarjeta mientras está abierto y vuelve a donde estaba al cerrar.
 * @param {{ onClose: (completed: boolean) => void }} props `completed` si llegó al final.
 */
export default function CoachTour({ onClose }) {
  const reduced = useReducedMotion();
  const [index, setIndex] = useState(0);
  const [hole, setHole] = useState(null);
  const [viewport, setViewport] = useState({ w: window.innerWidth, h: window.innerHeight });
  const [cardHeight, setCardHeight] = useState(0);
  const cardRef = useRef(null);
  const titleId = useId();
  const textId = useId();
  const step = TOUR_STEPS[index];
  const corto = TOUR_STEPS.filter((s) => s.tramo === 'corto');
  const largo = TOUR_STEPS.filter((s) => s.tramo === 'largo');
  const firstLong = TOUR_STEPS.findIndex((s) => s.tramo === 'largo');

  // Mide el elemento del paso y lo sigue si la pantalla cambia de tamaño o se desplaza.
  const measure = useCallback(() => {
    setViewport({ w: window.innerWidth, h: window.innerHeight });
    const el = findTarget(step.target);
    if (!el) return setHole(null);
    const r = el.getBoundingClientRect();
    setHole({ x: r.left - PAD, y: r.top - PAD, w: r.width + PAD * 2, h: r.height + PAD * 2, r: radiusOf(el) });
  }, [step.target]);

  useLayoutEffect(() => {
    const el = findTarget(step.target);
    // Lo que está fuera de la pantalla se trae al centro antes de medirlo.
    if (el) {
      const r = el.getBoundingClientRect();
      if (r.top < 0 || r.bottom > window.innerHeight) el.scrollIntoView({ block: 'center', behavior: 'instant' });
    }
    measure();
  }, [measure, step.target]);

  useEffect(() => {
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [measure]);

  useLayoutEffect(() => {
    if (cardRef.current) setCardHeight(cardRef.current.offsetHeight);
  }, [index, viewport.w]);

  // El foco entra a la tarjeta al abrir y en cada paso; al cerrar vuelve a donde estaba.
  useEffect(() => {
    const before = document.activeElement;
    return () => before?.focus?.();
  }, []);
  useEffect(() => {
    cardRef.current?.focus();
  }, [index]);

  const close = useCallback((completed = false) => onClose(completed), [onClose]);
  const next = () => (index === TOUR_STEPS.length - 1 ? close(true) : setIndex(index + 1));
  const back = () => setIndex(index === firstLong ? index - 1 : Math.max(0, index - 1));

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === 'ArrowRight' && step.tramo !== 'pregunta') next();
    if (event.key === 'ArrowLeft' && index > 0) back();
    if (event.key !== 'Tab') return;
    // Foco atrapado: Tab da la vuelta dentro de la tarjeta.
    const items = [...cardRef.current.querySelectorAll('button:not([disabled])')];
    if (items.length === 0) return;
    const first = items[0];
    const last = items.at(-1);
    if (event.shiftKey && (document.activeElement === first || document.activeElement === cardRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  // La tarjeta va debajo del resaltado si cabe; si no, encima; sin resaltado, en el centro.
  const width = Math.min(360, viewport.w - MARGIN * 2);
  let top = (viewport.h - cardHeight) / 2;
  let left = (viewport.w - width) / 2;
  if (hole) {
    const below = hole.y + hole.h + GAP;
    const above = hole.y - GAP - cardHeight;
    top = below + cardHeight <= viewport.h - MARGIN ? below : above >= MARGIN ? above : Math.max(MARGIN, viewport.h - cardHeight - MARGIN);
    left = Math.min(Math.max(MARGIN, hole.x + hole.w / 2 - width / 2), viewport.w - width - MARGIN);
  }

  let label = '';
  let dots = [];
  if (step.tramo === 'corto') {
    label = t('Paso {v1} de {length}', { v1: index + 1, length: corto.length });
    dots = corto.map((_, k) => ({ current: k === index, done: k <= index, tone: 'bg-brand' }));
  } else if (step.tramo === 'largo') {
    const k0 = index - firstLong;
    label = t('Lo demás · {v1} de {length}', { v1: k0 + 1, length: largo.length });
    dots = largo.map((_, k) => ({ current: k === k0, done: k <= k0, tone: 'bg-success' }));
  }
  // Solo transform: mover top/left recalcula el layout en cada cuadro.
  const transition = reduced ? '' : 'transition-transform duration-[240ms] ease-[cubic-bezier(0.23,1,0.32,1)]';
  const container = document.querySelector('[data-theme]') ?? document.body;

  return createPortal(
    <div className="fixed inset-0 z-[55]" onKeyDown={onKeyDown}>
      {/* El fondo: tocarlo cierra el tutorial (no se obliga a terminarlo). */}
      <button
        type="button"
        tabIndex={-1}
        aria-label={t('Cerrar el tutorial')}
        onClick={() => close()}
        className="absolute inset-0 cursor-default bg-black/55 backdrop-blur-[3px]"
        style={{ maskImage: maskFor(hole, viewport.w, viewport.h), WebkitMaskImage: maskFor(hole, viewport.w, viewport.h) }}
      />
      {hole && (
        <span
          aria-hidden="true"
          className={cn('pointer-events-none absolute left-0 top-0 ring-2 ring-white/90', transition)}
          style={{ transform: `translate3d(${hole.x}px, ${hole.y}px, 0)`, width: hole.w, height: hole.h, borderRadius: hole.r }}
        />
      )}
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        tabIndex={-1}
        className={cn('absolute left-0 top-0 rounded-3xl bg-surface p-5 text-ink shadow-elevated ring-1 ring-ink/10 outline-none', transition)}
        style={{ transform: `translate3d(${left}px, ${top}px, 0)`, width }}
      >
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-brand" aria-live="polite">
            {label}
          </p>
          <button
            type="button"
            onClick={() => close()}
            className="-mr-2 min-h-11 rounded-full px-3 text-sm font-semibold text-ink/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-violet"
          >
            {t('Omitir')}
          </button>
        </div>
        <h2 id={titleId} className="mt-1 text-lg font-semibold tracking-tight">
          {step.title}
        </h2>
        <p id={textId} className="mt-1 text-[15px] leading-snug text-ink/70">
          {step.text}
        </p>
        <div className="mt-4 flex items-center gap-2">
          {dots.length > 0 && (
            <span aria-hidden="true" className="mr-auto flex items-center gap-1">
              {dots.map((d, k) => (
                <span
                  key={k}
                  className={cn('h-1.5 rounded-full', d.current ? 'w-[18px]' : 'w-1.5', d.done ? d.tone : 'bg-ink/15')}
                />
              ))}
            </span>
          )}
          {step.tramo === 'pregunta' ? (
            <>
              <Button variant="outline" className="ml-auto" onClick={() => close(true)}>
                {t('Ya entendí')}
              </Button>
              <Button onClick={next}>{t('Ver lo demás')}</Button>
            </>
          ) : (
            <>
              {index > 0 && (
                <Button variant="ghost" className="text-brand" onClick={back}>
                  {t('Atrás')}
                </Button>
              )}
              <Button onClick={next} className={cn(dots.length === 0 && 'ml-auto')}>
                {index === TOUR_STEPS.length - 1 ? t('Listo') : t('Siguiente')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>,
    container,
  );
}
