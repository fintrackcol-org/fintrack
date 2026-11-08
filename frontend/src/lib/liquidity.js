/**
 * Ayudas de la pantalla del motor de liquidez (FT-0059): datos de la gráfica y consejos para
 * evitar el hueco. Sin React, para probarlas fácil.
 */

import { dayLabel } from './calendar';

/**
 * "20 nov" a partir de AAAA-MM-DD, sin corrimientos por zona horaria (el mismo del Calendario).
 * @param {string} iso
 * @returns {string}
 */
export const shortDay = dayLabel;

/**
 * Un punto por día para la gráfica: plata al final del día, si ese día hay pagos y si es el hueco.
 * @param {Array<{ date: string, end: number, events: Array<{ kind: string, name: string, amount: number }> }>} days
 * @param {string|null} shortfallDate
 * @returns {Array<{ date: string, label: string, end: number, payments: Array<{ name: string, amount: number }>, incomes: Array<{ name: string, amount: number }>, shortfall: boolean }>}
 */
export function chartPoints(days, shortfallDate) {
  return days.map((d) => ({
    date: d.date,
    label: shortDay(d.date),
    end: d.end,
    payments: d.events.filter((e) => e.kind !== 'esperado').map(({ name, amount }) => ({ name, amount })),
    // Plata que se espera recibir ese día (FT-0060), con el valor de un mes flaco.
    incomes: d.events.filter((e) => e.kind === 'esperado').map(({ name, amount }) => ({ name, amount })),
    shortfall: d.date === shortfallDate,
  }));
}

/** Tipos de pago que se pueden mover o reducir, con el texto de la sugerencia. */
const MOVABLE = {
  card: (name) => `Paga el mínimo de ${name} y abona el resto después.`,
  compromiso: (name) => `Mira si puedes correr unos días «${name}».`,
  deuda: (name) => `Habla con ${name} para pagarle por partes.`,
};

/**
 * Consejos para que no falte la plata, del más fácil al más difícil. Son sugerencias: la app no
 * cambia nada sola.
 * @param {{ risk: string, firstShortfall: { missing: number, causes: Array<{ kind: string, name: string, amount: number }> }|null, safeDailySpend: number, pace: number|null, receivable?: number }} liquidity
 * @param {(amount: number) => string} money
 * @returns {string[]}
 */
export function avoidTips(liquidity, money) {
  const { risk, firstShortfall, safeDailySpend, pace, receivable = 0 } = liquidity;
  if (risk !== 'falta' || !firstShortfall) return [];
  const tips = [];
  if (pace !== null && safeDailySpend > 0 && safeDailySpend < pace) {
    tips.push(`Gasta máximo ${money(safeDailySpend)} al día (hoy gastas unos ${money(pace)}).`);
  }
  if (receivable > 0) {
    tips.push(
      receivable >= firstShortfall.missing
        ? `Cobra lo que te deben (${money(receivable)}): con eso llegas.`
        : `Cobra lo que te deben (${money(receivable)}): te faltaría menos.`,
    );
  }
  const seen = new Set();
  for (const cause of [...firstShortfall.causes].sort((a, b) => b.amount - a.amount)) {
    const tip = MOVABLE[cause.kind]?.(cause.name);
    if (tip && !seen.has(tip)) {
      seen.add(tip);
      tips.push(tip);
    }
    if (tips.length >= 4) break;
  }
  return tips;
}

/**
 * ¿Hay algo que proyectar? Sin pagos ni gasto normal la gráfica sería una línea plana.
 * @param {{ pace: number|null, days: Array<{ events: unknown[] }> }} liquidity
 * @returns {boolean}
 */
export function hasData(liquidity) {
  return liquidity.pace !== null || liquidity.days.some((d) => d.events.length > 0);
}
