/**
 * Tarjetas de Ingresos y Gastos del Inicio (FT-0068): que se note que se pueden tocar.
 */

/**
 * Nombre accesible de la tarjeta: "Ver ingresos de noviembre", "Ver gastos de esta semana".
 * @param {'ingresos'|'gastos'} kind
 * @param {string} [period] Periodo legible (`noviembre`, `esta semana`, `2026`).
 * @returns {string}
 */
export function totalLinkLabel(kind, period) {
  return period ? `Ver ${kind} de ${period}` : `Ver ${kind}`;
}

/**
 * Clases comunes: borde que se marca al pasar el mouse, fondo y escala al presionar, y foco visible.
 * El `group` deja que la flecha de la esquina se mueva un poco al pasar o presionar.
 */
export const TOTAL_LINK_CLASSES =
  'group relative min-w-0 rounded-2xl border border-ink/10 bg-surface transition-[transform,border-color,background-color] duration-150 hover:border-ink/25 focus-visible:outline-2 focus-visible:outline-violet active:bg-ink/[0.04] motion-safe:active:scale-[0.97]';

/** Flecha sutil de la esquina superior derecha. */
export const TOTAL_ARROW_CLASSES =
  'pointer-events-none absolute right-3 top-3 size-4 text-ink/40 transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-ink/60 group-active:translate-x-0.5';
