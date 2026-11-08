import { shiftMonth } from './analytics.service.js';
import { RISK_DAYS } from './payment-calendar.service.js';
import { dateInMonth } from './money-plan.service.js';

/**
 * Motor de liquidez (FT-0059): cálculo puro, sin base de datos. Proyecta día por día la plata del
 * usuario restando su gasto normal y todos sus pagos, y dice cuándo y cuánto le faltaría.
 * Es la evolución de `buildPaymentCalendar`: mismo saldo de partida y misma regla de riesgo, pero
 * día a día. La plata futura nunca se cuenta como si ya estuviera: solo entra lo que viene en
 * `inflows` (por ahora nada; FT-0060 traerá el ingreso esperado conservador).
 */

/**
 * @typedef {object} Flow
 * @property {string} date AAAA-MM-DD (si ya pasó, se paga hoy).
 * @property {number} amount
 * @property {'compromiso'|'card'|'vaca'|'deuda'|'esperado'} kind
 * @property {string} name
 */

/**
 * @typedef {object} LiquidityDay
 * @property {string} date AAAA-MM-DD
 * @property {number} start Plata al empezar el día.
 * @property {number} out Lo que sale: gasto normal más pagos.
 * @property {number} in Lo que entra (ingresos esperados).
 * @property {number} end Plata al terminar el día.
 * @property {Flow[]} events Pagos e ingresos de ese día.
 */

/**
 * @param {string} date AAAA-MM-DD
 * @param {number} days
 * @returns {string} AAAA-MM-DD, `days` días después (en días de calendario, sin zona horaria).
 */
export function addDays(date, days) {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/**
 * Compromisos mensuales repetidos en cada mes hasta `until` (sin incluirlo). El del mes actual no
 * se cuenta si ya se pagó; si ya pasó y no se pagó, queda con su fecha y la proyección lo resta hoy.
 * Un día 31 cae el último día de los meses más cortos.
 * @param {{ commitments: Array<{ id: string, name: string, amount: number, dayOfMonth: number }>, paidThisMonth: (c: object) => boolean, today: string, until: string }} data
 * @returns {Flow[]} Por fecha.
 */
export function monthlyOutflows({ commitments, paidThisMonth, today, until }) {
  const current = today.slice(0, 7);
  const out = [];
  for (const c of commitments) {
    for (let month = current; `${month}-01` < until; month = shiftMonth(month, 1)) {
      const date = dateInMonth(month, c.dayOfMonth);
      if (date >= until) break;
      if (month === current && paidThisMonth(c)) continue;
      out.push({ date, amount: c.amount, kind: 'compromiso', name: c.name, id: c.id });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/**
 * Proyecta la plata día por día desde hoy.
 *
 * - Hoy solo resta lo atrasado (el gasto de hoy ya está en `money`); desde mañana, el gasto normal.
 * - `firstShortfall`: primer día que termina en negativo, con lo que falta y los pagos que lo
 *   causan (los de ese día; si ese día solo hay gasto normal, los más grandes antes de él).
 * - `safeDailySpend`: lo máximo que puede gastar al día (además de los pagos) para no quedar en
 *   negativo hasta el hueco, o hasta el final si no hay hueco: el menor de (plata − pagos hasta el
 *   día k + ingresos hasta el día k) ÷ k. Redondeado hacia abajo a cien pesos.
 *
 * @param {{ today: string, money: number, pace: number|null, outflows: Flow[], inflows?: Flow[], horizonDays?: number }} data
 *   `pace` `null`: sin historial de gasto, solo se restan los pagos.
 * @returns {{ days: LiquidityDay[], firstShortfall: { date: string, missing: number, causes: Flow[] }|null, lowest: { date: string, amount: number }, risk: 'ok'|'riesgo'|'falta', safeDailySpend: number }}
 */
export function projectLiquidity({ today, money, pace, outflows, inflows = [], horizonDays = 45 }) {
  const last = addDays(today, horizonDays);
  const onDay = (flows, date) =>
    flows.filter((f) => (f.date < today ? today : f.date) === date && f.date <= last);
  const daily = pace ?? 0;

  const days = [];
  let balance = money;
  for (let i = 0; i <= horizonDays; i += 1) {
    const date = addDays(today, i);
    const outs = onDay(outflows, date);
    const ins = onDay(inflows, date);
    const out = (i === 0 ? 0 : daily) + outs.reduce((acc, f) => acc + f.amount, 0);
    const income = ins.reduce((acc, f) => acc + f.amount, 0);
    const start = balance;
    balance = start - out + income;
    days.push({
      date,
      start: Math.round(start),
      out: Math.round(out),
      in: Math.round(income),
      end: Math.round(balance),
      events: [...ins, ...outs],
    });
  }

  const shortfallIndex = days.findIndex((d) => d.end < 0);
  let firstShortfall = null;
  if (shortfallIndex >= 0) {
    const day = days[shortfallIndex];
    let causes = day.events.filter((e) => e.kind !== 'esperado');
    if (causes.length === 0) {
      causes = days
        .slice(0, shortfallIndex)
        .flatMap((d) => d.events.filter((e) => e.kind !== 'esperado'))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 3);
    }
    firstShortfall = { date: day.date, missing: -day.end, causes };
  }

  const low = days.reduce((min, d) => (d.end < min.end ? d : min), days[0]);
  const lowest = { date: low.date, amount: low.end };

  // Tope diario: para cada día k desde mañana, lo que queda sin el gasto normal ÷ k.
  const until = shortfallIndex >= 0 ? shortfallIndex : horizonDays;
  let committed = 0;
  let safe = Infinity;
  for (let k = 0; k <= until; k += 1) {
    committed += days[k].out - (k === 0 ? 0 : daily) - days[k].in;
    if (k > 0) safe = Math.min(safe, (money - committed) / k);
  }
  const safeDailySpend = Number.isFinite(safe) ? Math.max(0, Math.floor(safe / 100) * 100) : 0;

  let risk = 'ok';
  if (firstShortfall) risk = 'falta';
  else if (pace !== null && lowest.amount < pace * RISK_DAYS) risk = 'riesgo';

  return { days, firstShortfall, lowest, risk, safeDailySpend };
}

/** Días antes del hueco en que se avisa. */
export const ALERT_DAYS = [7, 3, 1];
/** Si lo que falta cambia más que esto, se vuelve a avisar aunque ya se haya avisado a esa distancia. */
export const ALERT_CHANGE = 0.1;

/**
 * ¿Toca avisar hoy del hueco? Sí, si está exactamente a 7, 3 o 1 días y no se avisó ya de ese
 * mismo hueco a esa misma distancia, salvo que lo que falta haya cambiado más del 10 %.
 * @param {{ today: string, shortfall: { date: string, missing: number }|null, last: { date: string, daysBefore: number, missing: number }|null }} data
 *   `last`: el último aviso enviado, o `null`.
 * @returns {number|null} A cuántos días está el hueco, o `null` si no toca avisar.
 */
export function liquidityAlertDue({ today, shortfall, last }) {
  if (!shortfall) return null;
  const daysBefore = Math.round(
    (Date.parse(`${shortfall.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000,
  );
  if (!ALERT_DAYS.includes(daysBefore)) return null;
  if (last && last.date === shortfall.date && last.daysBefore === daysBefore) {
    const change = Math.abs(shortfall.missing - last.missing) / Math.max(last.missing, 1);
    if (change <= ALERT_CHANGE) return null;
  }
  return daysBefore;
}

const dayMonth = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const cop = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;

/**
 * "20 de noviembre" a partir de AAAA-MM-DD.
 * @param {string} date
 * @returns {string}
 */
export function longDay(date) {
  return dayMonth.format(new Date(`${date}T12:00:00Z`));
}

/**
 * "Tarjeta ($250.000) e Internet ($50.000)": las causas del hueco en una frase.
 * @param {Flow[]} causes
 * @returns {string}
 */
function causesText(causes) {
  const parts = causes.map((c) => `${c.name} (${cop(c.amount)})`);
  if (parts.length <= 1) return parts.join('');
  const lastPart = parts.pop();
  // "e" antes de palabras que empiezan por el sonido "i" ("e Internet", "e hipoteca").
  const joiner = /^h?i(?![aeou])/i.test(lastPart) ? ' e ' : ' y ';
  return `${parts.join(', ')}${joiner}${lastPart}`;
}

/**
 * Aviso antes del hueco: "El 20 de noviembre te faltarían $300.000 por: Tarjeta ($250.000) e
 * Internet ($50.000). Si gastas $28.000 al día, llegas."
 * @param {{ firstShortfall: { date: string, missing: number, causes: Flow[] }, safeDailySpend: number, pace: number|null }} liquidity
 * @returns {{ title: string, body: string, url: string }}
 */
export function liquidityAlertPayload({ firstShortfall, safeDailySpend, pace }) {
  const why = firstShortfall.causes.length ? ` por: ${causesText(firstShortfall.causes)}` : '';
  const reach =
    pace !== null && safeDailySpend > 0 && safeDailySpend < pace
      ? ` Si gastas ${cop(safeDailySpend)} al día, llegas.`
      : '';
  return {
    title: 'Ojo con tu plata',
    body: `El ${longDay(firstShortfall.date)} te faltarían ${cop(firstShortfall.missing)}${why}.${reach}`,
    url: '/app/liquidez',
  };
}

/**
 * Una línea para el bot: "Hasta el 30 de noviembre vas bien.", "Justo: el 18 de noviembre te
 * quedan $40.000." u "Ojo: el 20 de noviembre te faltan $300.000."
 * @param {{ ready: boolean, risk?: string, firstShortfall?: object|null, lowest?: object, until?: string }} liquidity
 * @returns {string|null} `null` sin Mi plata configurada.
 */
export function liquidityLine(liquidity) {
  if (!liquidity?.ready) return null;
  const { risk, firstShortfall, lowest, until } = liquidity;
  if (risk === 'falta') {
    return `Ojo: el ${longDay(firstShortfall.date)} te faltan ${cop(firstShortfall.missing)}.`;
  }
  if (risk === 'riesgo') return `Justo: el ${longDay(lowest.date)} te quedan ${cop(lowest.amount)}.`;
  return `Hasta el ${longDay(until)} vas bien.`;
}
