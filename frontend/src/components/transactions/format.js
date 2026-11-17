import { regionFormats } from '@/lib/region';

/**
 * @param {number} amount
 * @returns {string} Monto en la moneda principal de la persona, p. ej. `$ 12.500` o `US$ 12,50`.
 */
export function formatMoney(amount) {
  return regionFormats().money(amount);
}

/**
 * Monto corto para ejes y centros de gráficos, p. ej. `$ 850 mil` o `$ 1,2 M`.
 * @param {number} amount
 * @returns {string}
 */
export function formatMoneyCompact(amount) {
  return regionFormats().compactMoney(amount);
}

/**
 * Formatea una fecha AAAA-MM-DD sin pasar por UTC (evita que se corra un día).
 * @param {string} iso
 * @returns {string} p. ej. `12 oct 2026`.
 */
export function formatDate(iso) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Día corto y cercano para listas: `Hoy`, `Ayer` o `12 oct` (con año solo si no es el actual).
 * @param {string} iso Fecha AAAA-MM-DD.
 * @param {Date} [now]
 * @returns {string}
 */
export function formatRelativeDay(iso, now = new Date()) {
  const [year, month, day] = iso.split('-').map(Number);
  const date = new Date(year, month - 1, day);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const days = Math.round((today - date) / 86_400_000);
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Ayer';
  return date.toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    ...(year !== now.getFullYear() && { year: 'numeric' }),
  });
}
