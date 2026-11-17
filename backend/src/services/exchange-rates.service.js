import { AppError } from '../errors/app-error.js';
import * as repository from '../repositories/exchange-rates.repository.js';

/** API gratuita, sin clave y de código abierto; para el peso colombiano usa la TRM del Banco de la República. */
const FRANKFURTER = 'https://api.frankfurter.dev/v2/rates';
const TIMEOUT_MS = 5000;

/**
 * Crea el servicio de tasas de cambio. Cada par y día se pide a Frankfurter una sola vez y queda
 * guardado para todos; si Frankfurter no responde se usa la última tasa guardada de ese par.
 * Solo viajan los códigos de moneda y la fecha, nunca datos de la persona.
 * @param {{ fetch?: typeof fetch, repository?: typeof repository }} [deps]
 * @returns {{ getRate: (query: { from: string, to: string, date: string }) => Promise<{ from: string, to: string, date: string, rate: number, stale: boolean }> }}
 */
export function createExchangeRateService(deps = {}) {
  const get = deps.fetch ?? fetch;
  const repo = deps.repository ?? repository;

  /**
   * Cuánto vale 1 `from` en `to` el día `date`.
   * @param {{ from: string, to: string, date: string }} query
   * @returns {Promise<{ from: string, to: string, date: string, rate: number, stale: boolean }>}
   *   `stale` si no se pudo traer la de ese día y es la última que se tenía.
   * @throws {AppError} 503 `RATE_UNAVAILABLE` si no hay ninguna (la persona la escribe a mano).
   */
  async function getRate({ from, to, date }) {
    if (from === to) return { from, to, date, rate: 1, stale: false };
    const saved = await repo.findRate(date, from, to);
    if (saved !== null) return { from, to, date, rate: saved, stale: false };

    try {
      const url = `${FRANKFURTER}?base=${from}&quotes=${to}&date=${date}`;
      const res = await get(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
      if (!res.ok) throw new Error(`Frankfurter respondió ${res.status}`);
      const rate = (await res.json()).find((r) => r.quote === to)?.rate;
      if (!(rate > 0)) throw new Error('Frankfurter no tiene esa moneda');
      // Un fin de semana Frankfurter da la del último día hábil: se guarda con el día pedido.
      await repo.saveRate(date, from, to, rate);
      return { from, to, date, rate, stale: false };
    } catch {
      const last = await repo.latestRate(from, to);
      if (last) return { from, to, date: last.date, rate: last.rate, stale: true };
      throw new AppError(503, 'RATE_UNAVAILABLE', 'No pudimos traer la tasa de cambio. Escríbela tú.');
    }
  }

  return { getRate };
}

export const exchangeRateService = createExchangeRateService();
