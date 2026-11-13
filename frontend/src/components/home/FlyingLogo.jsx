import { useLayoutEffect, useRef } from 'react';
import { motion } from 'framer-motion';

/** Tamaño base del logo en px; el recorrido lo escala con `transform` hacia cada parada. */
const SIZE = 192;

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Centro y ancho de un elemento, en coordenadas de la pantalla. */
function box(el) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2, size: r.width };
}

/**
 * Logo de Rinde en SVG: la "r" crece desde abajo y luego salta la moneda (misma geometría
 * que `LogoMark`). `animateIn` apaga la entrada cuando la persona pide menos movimiento.
 */
export function LogoArt({ animateIn = true, className }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#6142ff" />
      <motion.path
        d="M9.75 21.5V16.25A5.75 5.75 0 0 1 15.5 10.5"
        fill="none"
        stroke="#fff"
        strokeWidth="4.25"
        strokeLinecap="round"
        style={{ transformBox: 'fill-box', originY: 1 }}
        initial={animateIn ? { scaleY: 0 } : false}
        animate={{ scaleY: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.3 }}
      />
      <motion.circle
        cx="22"
        cy="10.5"
        r="2.375"
        fill="#2fd6a3"
        style={{ transformBox: 'fill-box' }}
        initial={animateIn ? { scale: 0 } : false}
        animate={{ scale: 1 }}
        transition={{ type: 'spring', stiffness: 220, damping: 14, delay: 0.6 }}
      />
    </svg>
  );
}

/**
 * El logo que baja con el scroll, sin 3D. Hace el mismo recorrido que hacía la escena:
 *   1. empieza en el hueco del hero (`data-logo-hero`);
 *   2. al bajar a "Qué es" viaja a la derecha (en celular, arriba a la derecha);
 *   3. en "Cómo funciona" aterriza en el hueco del celular (`data-logo-slot`) y lo sigue.
 *
 * Vive dentro de la capa pegada (sticky) del escenario. Cada cuadro de scroll mide las tres
 * paradas, mezcla las posiciones y mueve el logo solo con `transform`, que el navegador
 * resuelve en la tarjeta gráfica sin recalcular el diseño de la página.
 */
export default function FlyingLogo() {
  const ref = useRef(null);

  useLayoutEffect(() => {
    const el = ref.current;
    // El escenario se busca desde el logo: su `ref` aún no existe cuando corre este efecto
    // (React conecta primero los hijos).
    const stage = el?.closest('[data-stage-root]');
    const layer = el?.closest('[data-scene-layer]');
    const sticky = el?.parentElement;
    if (!stage || !el || !layer || !sticky) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const hero = stage.querySelector('[data-stage="hero"]');
      const how = stage.querySelector('[data-stage="how"]');
      const heroSlot = stage.querySelector('[data-logo-hero]');
      const phoneSlot = stage.querySelector('[data-logo-slot]');
      if (!hero || !how || !heroSlot || !phoneSlot) return;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const stageTop = stage.getBoundingClientRect().top;
      const scrolled = -stageTop;
      const howTop = how.getBoundingClientRect().top - stageTop;

      // Avance de cada tramo (0 → 1): del hero a "Qué es", y de ahí al celular.
      const travel = easeInOut(clamp01(scrolled / hero.offsetHeight));
      const dock = easeInOut(clamp01((scrolled - (howTop - vh * 0.95)) / (vh * 0.75)));

      const start = box(heroSlot);
      const wide = vw > vh * 1.1;
      const about = wide
        ? { x: vw * 0.72, y: vh * 0.5, size: Math.min(vw * 0.3, vh * 0.5, 420) }
        : { x: vw * 0.78, y: vh * 0.17, size: Math.min(vw * 0.26, 120) };
      const end = box(phoneSlot);

      let x = lerp(start.x, about.x, travel);
      let y = lerp(start.y, about.y, travel);
      let size = lerp(start.size, about.size, travel);
      if (dock > 0) {
        x = lerp(x, end.x, dock);
        y = lerp(y, end.y, dock);
        size = lerp(size, end.size, dock);
      }

      // La capa pegada deja de estar arriba al final del escenario: se descuenta su posición.
      const top = sticky.getBoundingClientRect().top;
      el.style.transform = `translate3d(${x - SIZE / 2}px, ${y - top - SIZE / 2}px, 0) scale(${size / SIZE})`;
      el.dataset.docked = dock > 0.5 ? 'true' : 'false';
      // Al aterrizar, el logo pasa por encima del celular (antes iba detrás del texto).
      layer.style.zIndex = dock > 0.25 ? '20' : '0';
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };

    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    const ro = new ResizeObserver(schedule);
    ro.observe(stage);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      ro.disconnect();
    };
  }, []);

  return (
    <div
      ref={ref}
      data-docked="false"
      className="group/logo absolute left-0 top-0 origin-center will-change-transform"
      style={{ width: SIZE, height: SIZE }}
    >
      <div className="size-full animate-float group-data-[docked=true]/logo:animate-none">
        <LogoArt className="size-full" />
      </div>
    </div>
  );
}
