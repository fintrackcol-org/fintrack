import { completeText } from './ai-client.service.js';
import { listMonth } from './negocio-movements.service.js';

// Consejo sobre el mes del negocio (FT-0058). Lo da la IA con cifras agregadas del mes (sin
// nombres de socios, clientes ni descripciones) y, si no está disponible, se arma con reglas.

const money = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/** Horas que se guarda un consejo mientras las cifras del mes no cambien. */
export const ADVICE_TTL_HOURS = 12;

/**
 * Consejo armado con reglas, del problema más urgente al más leve.
 * @param {object} panel El panel del mes (`buildPanel`).
 * @param {{ current: boolean }} options `current`: es el mes en curso (todavía puede cambiar).
 * @returns {string}
 */
export function ruleBusinessAdvice(panel, { current }) {
  const { sale, netProfit, breakEven, breakEvenReached, fixed, previous, cost } = panel;
  const spent = cost + panel.variable + fixed;
  if (sale === 0 && spent === 0) {
    return 'Aún no hay movimientos este mes. Registra tus ventas y gastos para ver la utilidad y cuánto necesitas vender.';
  }
  if (sale === 0) {
    return 'Este mes hay gastos pero ninguna venta registrada. Si ya vendiste, anótalo para ver la utilidad real.';
  }
  if (breakEven === null && fixed > 0) {
    return 'Con estos costos, vender no alcanza a cubrir los gastos fijos: revisa tus precios o lo que te cuesta producir.';
  }
  if (netProfit < 0 && breakEven !== null && !breakEvenReached) {
    const missing = money.format(breakEven - sale);
    return current
      ? `Vas en pérdida: te faltan ${missing} en ventas para llegar al punto de equilibrio este mes.`
      : `El mes cerró en pérdida: faltaron ${missing} en ventas para cubrir los gastos fijos.`;
  }
  if (netProfit < 0) {
    return 'Este mes los gastos superan lo que entra. Revisa cuáles gastos variables puedes bajar.';
  }
  if (previous.saleChange !== null && previous.saleChange <= -20) {
    return `Las ventas bajaron ${Math.abs(previous.saleChange)} % frente al mes anterior. Mira qué cambió y si vale la pena una promoción.`;
  }
  if (panel.netMargin !== null && panel.netMargin < 10) {
    return `Ganas poco por cada venta (margen de ${panel.netMargin} %). Revisa precios o costos para que te quede más.`;
  }
  return current
    ? `Vas bien: llevas ${money.format(netProfit)} de utilidad. Aparta una parte para los meses flojos antes de repartir.`
    : `Buen mes: quedaron ${money.format(netProfit)} de utilidad. Aparta una parte para los meses flojos antes de repartir.`;
}

/**
 * Prompt para la IA: solo cifras del mes.
 * @param {object} panel
 * @param {{ current: boolean }} options
 * @returns {string}
 */
export function businessAdvicePrompt(panel, { current }) {
  const f = (n) => money.format(n);
  return [
    `Mes ${current ? 'en curso' : 'cerrado'}.`,
    `Ventas: ${f(panel.sale)}. Costo de venta: ${f(panel.cost)}. Gastos variables: ${f(panel.variable)}. Gastos fijos: ${f(panel.fixed)}. Otros ingresos: ${f(panel.otherIncome)}.`,
    `Utilidad neta: ${f(panel.netProfit)}${panel.netMargin === null ? '' : ` (margen ${panel.netMargin} %)`}.`,
    panel.breakEven === null
      ? 'Sin punto de equilibrio calculable.'
      : `Punto de equilibrio: ${f(panel.breakEven)} en ventas (${panel.breakEvenReached ? 'alcanzado' : 'no alcanzado'}).`,
    panel.previous.saleChange === null ? '' : `Ventas frente al mes anterior: ${panel.previous.saleChange} %.`,
  ]
    .filter(Boolean)
    .join('\n');
}

const SYSTEM =
  'Eres el asistente de Rinde, una app colombiana, y ayudas a dueños de negocios pequeños. Con las ' +
  'cifras del mes da UN consejo práctico en español de Colombia, de máximo 2 frases y 280 caracteres, ' +
  'sin saludos, sin emojis y sin inventar datos. Usa pesos colombianos con el formato de los datos.';

/**
 * @param {object} [deps]
 * @param {typeof completeText} [deps.generate]
 * @param {typeof listMonth} [deps.loadMonth]
 * @param {() => number} [deps.now]
 */
export function createBusinessAdvice(deps = {}) {
  const generate = deps.generate ?? completeText;
  const loadMonth = deps.loadMonth ?? listMonth;
  const now = deps.now ?? Date.now;
  /** @type {Map<string, { advice: string, at: number }>} Por negocio, mes y cifras. */
  const cache = new Map();

  /**
   * Consejo del mes. Todos los socios lo pueden pedir.
   * @param {string} userId
   * @param {string} id
   * @param {string|undefined} month AAAA-MM
   * @returns {Promise<{ advice: string, source: 'ia'|'reglas', month: string }>}
   */
  async function getBusinessAdvice(userId, id, month) {
    const data = await loadMonth(userId, id, month);
    const { panel } = data;
    const current = data.month === new Date(now()).toLocaleDateString('en-CA', { timeZone: 'America/Bogota' }).slice(0, 7);
    if (panel.sale === 0 && panel.cost + panel.variable + panel.fixed === 0) {
      return { advice: ruleBusinessAdvice(panel, { current }), source: 'reglas', month: data.month };
    }
    const key = `${id}|${data.month}|${panel.sale}|${panel.cost}|${panel.variable}|${panel.fixed}|${panel.otherIncome}`;
    const hit = cache.get(key);
    if (hit && now() - hit.at < ADVICE_TTL_HOURS * 3_600_000) {
      return { advice: hit.advice, source: 'ia', month: data.month };
    }
    try {
      const text = String(await generate({ system: SYSTEM, prompt: businessAdvicePrompt(panel, { current }), maxTokens: 400 }))
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400);
      if (!text) throw new Error('Respuesta vacía');
      if (cache.size > 500) cache.clear();
      cache.set(key, { advice: text, at: now() });
      return { advice: text, source: 'ia', month: data.month };
    } catch {
      return { advice: ruleBusinessAdvice(panel, { current }), source: 'reglas', month: data.month };
    }
  }

  return { getBusinessAdvice };
}

export const { getBusinessAdvice } = createBusinessAdvice();
