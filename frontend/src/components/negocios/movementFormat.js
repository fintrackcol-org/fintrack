
import { numberLocale } from '@/lib/region';
import { t } from '@/lib/i18n';/**
 * Textos de los movimientos y el panel del negocio (FT-0017).
 */

/** Tipos de movimiento: nombre, si entra plata y la categoría que se propone. */
export const MOVEMENT_KINDS = {
  sale: { label: t('Venta'), income: true, category: 'ventas', hint: t('Lo que vendiste') },
  cost: { label: t('Costo de venta'), income: false, category: 'insumos', hint: t('Lo que cuesta hacer lo que vendes') },
  variable: { label: t('Gasto variable'), income: false, category: 'otros', hint: t('Cambia según cuánto vendes') },
  fixed: { label: t('Gasto fijo'), income: false, category: 'arriendo', hint: t('Se paga igual aunque no vendas') },
  otherIncome: { label: t('Otro ingreso'), income: true, category: 'otros', hint: t('Plata que no viene de vender') },
  // Los retiros no se registran con el formulario: van por "Registrar mi retiro" (FT-0018).
  withdrawal: { label: t('Retiro de socio'), income: false, category: 'retiros', hint: t('Plata que un socio sacó para él') },
};

export const KIND_OPTIONS = Object.entries(MOVEMENT_KINDS)
  .filter(([value]) => value !== 'withdrawal')
  .map(([value, { label }]) => ({ value, label }));

/** Categorías del negocio. */
export const BUSINESS_CATEGORIES = {
  ventas: t('Ventas'),
  insumos: t('Insumos'),
  arriendo: t('Arriendo'),
  nomina: t('Nómina'),
  servicios: t('Servicios'),
  publicidad: t('Publicidad'),
  transporte: t('Transporte'),
  impuestos: t('Impuestos'),
  otros: t('Otros'),
  retiros: t('Retiros'),
};

export const CATEGORY_OPTIONS = Object.entries(BUSINESS_CATEGORIES)
  .filter(([value]) => value !== 'retiros')
  .map(([value, label]) => ({ value, label }));

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

/**
 * @param {string} month AAAA-MM.
 * @param {string} [current] Mes actual AAAA-MM: si es del mismo año, no se muestra el año.
 * @returns {string} p. ej. `noviembre` o `diciembre 2025`.
 */
export function monthLabel(month, current) {
  const [y, m] = month.split('-').map(Number);
  const name = MONTHS[m - 1];
  return current && current.slice(0, 4) === String(y) ? name : `${name} ${y}`;
}

/**
 * @param {string} month AAAA-MM.
 * @param {number} delta Meses a sumar (negativo para atrás).
 * @returns {string} AAAA-MM.
 */
export function shiftMonth(month, delta) {
  const [y, m] = month.split('-').map(Number);
  const total = y * 12 + (m - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/**
 * Cambio frente al mes anterior en palabras.
 * @param {number|null} change Porcentaje.
 * @returns {string|null} p. ej. `+12 % que octubre`.
 */
export function changeText(change, previousLabel) {
  if (change === null || change === undefined) return null;
  if (change === 0) return t('Igual que {previousLabel}', { previousLabel });
  const sign = change > 0 ? '+' : '−';
  return t('{sign}{toLocaleString} % que {previousLabel}', { sign, toLocaleString: Math.abs(change).toLocaleString(numberLocale(), { maximumFractionDigits: 1 }), previousLabel });
}

/**
 * Nombre de la categoría de un movimiento: la propia del negocio (FT-0058) o una de siempre.
 * @param {{ category: string, categoryName?: string|null }} movement
 * @returns {string}
 */
export const categoryLabel = (movement) =>
  movement.categoryName ?? BUSINESS_CATEGORIES[movement.category] ?? BUSINESS_CATEGORIES.otros;

/** Filtro de tipo del historial: todos o uno (FT-0058). */
export const KIND_FILTERS = [
  { value: 'all', label: t('Todos') },
  ...Object.entries(MOVEMENT_KINDS).map(([value, { label }]) => ({ value, label })),
];

/**
 * Movimientos del mes filtrados por tipo y por quién los registró (FT-0058).
 * @template {{ kind: string, registeredBy: { id: string }|null }} T
 * @param {T[]} movements
 * @param {{ kind: string, partner: string }} filter `all` en cualquiera de los dos para no filtrar.
 * @returns {T[]}
 */
export function filterMovements(movements, { kind, partner }) {
  return movements.filter(
    (m) => (kind === 'all' || m.kind === kind) && (partner === 'all' || m.registeredBy?.id === partner),
  );
}
