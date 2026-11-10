/**
 * Lógica de la pantalla Calendario (FT-0025), separada de la vista para poder probarla.
 * Los eventos vienen de `GET /money-profile/calendar` (ver `moneyProfileService`).
 */
import { monthCells } from '@/lib/calendar';

/** Filtros de la pantalla: `mios` son los pagos propios y los días de pago. */
export const FILTERS = [
  { id: 'todo', label: 'Todo' },
  { id: 'mios', label: 'Míos' },
  { id: 'vacas', label: 'Vacas' },
];

/**
 * @template {{ kind: string }} T
 * @param {T[]} events
 * @param {'todo'|'mios'|'vacas'} filter
 * @returns {T[]}
 */
export function filterEvents(events, filter) {
  if (filter === 'vacas') return events.filter((e) => e.kind === 'vaca');
  if (filter === 'mios') return events.filter((e) => e.kind !== 'vaca');
  return events;
}

/**
 * Monto corto para la cuadrícula: `89 mil`, `1,2 M`.
 * @param {number} amount
 * @returns {string}
 */
export function shortMoney(amount) {
  if (amount >= 1_000_000) return `${(amount / 1_000_000).toFixed(1).replace('.', ',').replace(',0', '')} M`;
  if (amount >= 1000) return `${Math.round(amount / 1000)} mil`;
  return String(Math.round(amount));
}

/** Lo más grave de un día manda en su color. */
const TONE_ORDER = ['negativo', 'riesgo', 'ok', 'pago', 'ingreso'];

/** Lo que entra (día de pago o plata que le deben): no es un pago del usuario. */
const isInflow = (event) => event.kind === 'ingreso' || event.kind === 'cobro';

/**
 * Semáforo del calendario (FT-0069), siempre con su texto: el color nunca va solo.
 * Sale de lo que le queda al usuario después de los pagos del día.
 */
export const LEGEND = [
  { tone: 'ok', label: 'Te alcanza con holgura' },
  { tone: 'riesgo', label: 'Te queda poco' },
  { tone: 'negativo', label: 'No alcanza o está atrasado' },
];

/**
 * Tono de un evento: rojo si no alcanza o está atrasado, amarillo si queda poco, verde si alcanza.
 * `pago` es un pago sin saldo calculado (falta Mi plata, o es después del próximo ingreso).
 * @param {{ kind: string, status: string|null, risk: string|null }} event
 * @returns {'negativo'|'riesgo'|'ok'|'pago'|'ingreso'|null} `null` si ya está pagado.
 */
export function toneOf(event) {
  if (isInflow(event)) return 'ingreso';
  if (event.status === 'pagado') return null;
  if (event.risk === 'negativo' || event.status === 'atrasado') return 'negativo';
  if (event.risk === 'riesgo' || event.risk === 'ok') return event.risk;
  return 'pago';
}

/**
 * A dónde lleva cada elemento del calendario para verlo o cambiarlo.
 * @param {{ kind: string, id: string|null }} event
 * @returns {string}
 */
export function eventLink({ kind, id }) {
  if (kind === 'vaca') return `/app/vacas/${id}`;
  if (kind === 'card') return `/app/tarjetas/${id}`;
  if (kind === 'cuenta' || kind === 'cobro') return '/app/cuentas';
  return kind === 'ingreso' ? '/app/mi-plata' : '/app/mi-plata/pagos';
}

/**
 * Celdas del mes con el total por pagar de cada día y su tono.
 * @param {string} month AAAA-MM
 * @param {Array<{ date: string, kind: string, amount: number|null, status: string|null, risk: string|null }>} events
 * @param {string} today AAAA-MM-DD
 * @returns {Array<null|{ day: number, date: string, isToday: boolean, isPast: boolean, total: number, tone: string|null, count: number }>}
 *   `count`: cuántas cosas hay ese día (para decirlo al lector de pantalla).
 */
export function calendarCells(month, events, today) {
  return monthCells(month, today).map((cell) => {
    if (!cell) return null;
    const ofDay = events.filter((e) => e.date === cell.date);
    const tones = ofDay.map(toneOf).filter(Boolean);
    return {
      ...cell,
      count: ofDay.length,
      total: ofDay
        .filter((e) => !isInflow(e) && e.status !== 'pagado')
        .reduce((acc, e) => acc + e.amount, 0),
      tone: TONE_ORDER.find((t) => tones.includes(t)) ?? null,
    };
  });
}

/**
 * Agrupa los eventos por fecha, en orden.
 * @template {{ date: string }} T
 * @param {T[]} events Ya ordenados por fecha.
 * @returns {Array<{ date: string, events: T[] }>}
 */
export function groupByDate(events) {
  const groups = [];
  for (const event of events) {
    const last = groups.at(-1);
    if (last?.date === event.date) last.events.push(event);
    else groups.push({ date: event.date, events: [event] });
  }
  return groups;
}

/** Texto del estado de un pago. */
export const STATUS_TEXT = {
  pagado: 'Pagado',
  pendiente: 'Por pagar',
  atrasado: 'Atrasado',
  sin_registro: 'Sin registro',
};
