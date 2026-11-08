/**
 * Transición entre pantallas tipo iPhone (FT-0050). Al avanzar, la pantalla nueva entra desde la
 * derecha y la anterior se corre un poco a la izquierda y se oscurece; al volver, el mismo camino al
 * revés. Resorte sin rebote: navegar no lleva impulso, así que nada debe pasarse de largo.
 */

/** Resorte críticamente amortiguado; `duration` es la "respuesta" de Apple (~0.35 s). */
export const PAGE_SPRING = { type: 'spring', bounce: 0, duration: 0.4 };

/** Con movimiento reducido: solo un fundido corto, sin desplazamientos. */
const FADE = { type: 'tween', duration: 0.18 };

/** Cuánto se corre la pantalla de atrás, como el efecto de profundidad del iPhone. */
const BEHIND = '-28%';

/**
 * Posición de una pantalla en cada momento de la transición.
 * `direction`: 1 al avanzar, -1 al volver, 0 sin animación (p. ej. Anotar, que sube por su cuenta).
 * @param {{ reduced: boolean, wide: boolean }} options `wide`: computador, donde basta un deslizamiento corto.
 */
export function pageVariants({ reduced, wide }) {
  if (reduced) {
    return {
      enter: { opacity: 0 },
      center: { opacity: 1, transition: FADE },
      exit: { opacity: 0, transition: FADE },
    };
  }
  if (wide) {
    return {
      enter: (direction) => ({ opacity: 0, x: 16 * direction }),
      center: { opacity: 1, x: 0, transition: PAGE_SPRING },
      // En computador la anterior desaparece al instante: dos columnas a la vez se verían montadas.
      exit: { opacity: 0, transition: { duration: 0 } },
    };
  }
  return {
    enter: (direction) => (direction === 0 ? { x: 0 } : { x: direction > 0 ? '100%' : BEHIND, filter: 'brightness(1)' }),
    center: { x: 0, filter: 'brightness(1)', transition: PAGE_SPRING },
    exit: (direction) =>
      direction === 0
        ? { opacity: 0, transition: { duration: 0 } }
        : { x: direction > 0 ? BEHIND : '100%', filter: direction > 0 ? 'brightness(0.85)' : 'brightness(1)', transition: PAGE_SPRING },
  };
}

/**
 * `behavior` para `scrollIntoView`/`scrollTo`: el desplazamiento suave también es movimiento, así
 * que con "reducir movimiento" se salta directo.
 * @returns {'smooth'|'auto'}
 */
export function scrollBehavior() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
}
