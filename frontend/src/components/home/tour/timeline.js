/**
 * Cuentas del recorrido con voz, sin DOM, para poder probarlas:
 * en qué frase va el audio, a qué altura debe estar la página, cuánto tapa el velo
 * y desde qué frase seguir.
 *
 * Cada frase (`segment`) tiene `start` y `end` en segundos y el `id` de la sección que muestra.
 * Hay dos formas de pasar de una sección a otra, y las dos ocurren en la pausa entre frases:
 *   - `move: "glide"`: la página baja de corrido (secciones que comparten el logo que viaja);
 *   - el resto: fundido. Un velo del color de la sección que llega tapa la pantalla, la página
 *     cambia de sitio debajo y el velo se retira. Así nunca cruza la pantalla un borde de color.
 * Con movimiento reducido todas usan el fundido.
 */

const clamp01 = (v) => Math.min(Math.max(v, 0), 1);
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/** Duración de la bajada de corrido y cuánto antes de la frase empieza (termina ya con la voz). */
export const GLIDE = 1.1;
export const GLIDE_LEAD = 0.75;
/** El velo entra, la página salta debajo, y el velo sale justo cuando empieza la frase. */
export const FADE_IN = 0.2;
export const FADE_OUT = 0.35;

/** ¿Se llega a `segment` bajando de corrido (y no con fundido)? */
export const glides = (segment, reduced = false) => segment.move === 'glide' && !reduced;

/** Segundos antes de su frase en que empieza la transición hacia `segment`. */
export const leadOf = (segment, reduced = false) => (glides(segment, reduced) ? GLIDE_LEAD : FADE_IN + FADE_OUT);

/**
 * Índice de la sección hacia la que va (o en la que está) la página en el segundo `time`.
 * @param {number} time
 * @param {{ start: number, move?: string }[]} segments
 * @param {boolean} [reduced=false]
 */
export function segmentAt(time, segments, reduced = false) {
  let index = 0;
  for (let i = 1; i < segments.length; i += 1) {
    if (segments[i].start - leadOf(segments[i], reduced) <= time) index = i;
  }
  return index;
}

/** Índice de la frase que se oye (para los subtítulos): no se adelanta con la transición. */
export function captionAt(time, segments) {
  let index = 0;
  for (let i = 1; i < segments.length; i += 1) {
    if (segments[i].start - 0.1 <= time) index = i;
  }
  return index;
}

/**
 * Altura de scroll que corresponde al segundo `time`.
 * @param {number[]} tops Altura (scrollY) de cada sección, en el mismo orden que `segments`.
 */
export function scrollAt(time, segments, tops, reduced = false) {
  const i = segmentAt(time, segments, reduced);
  if (i === 0) return tops[0];
  const from = segments[i].start - leadOf(segments[i], reduced);
  if (!glides(segments[i], reduced)) return time < from + FADE_IN ? tops[i - 1] : tops[i];
  return tops[i - 1] + (tops[i] - tops[i - 1]) * easeInOut(clamp01((time - from) / GLIDE));
}

/** Opacidad del velo (0 a 1) en el segundo `time`; llega a 1 en el momento del salto. */
export function veilAt(time, segments, reduced = false) {
  const i = segmentAt(time, segments, reduced);
  if (i === 0 || glides(segments[i], reduced)) return 0;
  const dt = time - (segments[i].start - leadOf(segments[i], reduced));
  return dt < FADE_IN ? dt / FADE_IN : clamp01(1 - (dt - FADE_IN) / FADE_OUT);
}

/**
 * Frase desde la que conviene seguir si la persona bajó por su cuenta: la última sección
 * cuyo inicio ya pasó el 30% superior de la pantalla.
 * @param {number} scrollY
 * @param {number[]} tops
 * @param {number} viewportHeight
 */
export function segmentForScroll(scrollY, tops, viewportHeight) {
  let index = 0;
  for (let i = 0; i < tops.length; i += 1) {
    if (tops[i] <= scrollY + viewportHeight * 0.3) index = i;
  }
  return index;
}

/** Segundo desde el que se entra a la sección `index` (con su transición antes de la frase). */
export const entryTime = (index, segments, reduced = false) =>
  index <= 0 ? 0 : Math.max(0, segments[index].start - leadOf(segments[index], reduced));

/**
 * Qué hacer si la persona toca un enlace `#ancla` mientras suena el recorrido: si la voz habla
 * de esa sección, su índice; si no (p. ej. `#faq` o el inicio), -1: se pausa y el navegador baja normal.
 * @param {string} hash
 * @param {{ id: string }[]} segments
 */
export function jumpFor(hash, segments) {
  const index = segments.findIndex(({ id }) => `#${id}` === hash);
  return index > 0 ? index : -1;
}
