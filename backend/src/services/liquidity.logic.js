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
