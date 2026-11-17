/**
 * Tasas de cambio para anotar en otra moneda al viajar (`GET /exchange-rates`). El servidor las trae
 * de Frankfurter y las guarda; aquí se recuerda la última de cada par para poder anotar sin conexión.
 */
import { apiRequest } from '@/lib/apiRequest';

const key = (from, to) => `rinde.rate.${from}-${to}`;

/**
 * Cuánto vale 1 `from` en `to` el día `date`. Sin conexión devuelve la última que se trajo de ese
 * par (`stale: true`); si nunca se trajo, falla y la persona la escribe a mano.
 * @param {string} from Moneda en la que se pagó (`MXN`).
 * @param {string} to Moneda principal (`COP`).
 * @param {string} date AAAA-MM-DD
 * @returns {Promise<{ rate: number, date: string, stale: boolean }>}
 */
export async function getExchangeRate(from, to, date) {
  try {
    const { rate, date: day, stale } = await apiRequest(`/exchange-rates?from=${from}&to=${to}&date=${date}`);
    try {
      localStorage.setItem(key(from, to), JSON.stringify({ rate, date: day }));
    } catch {
      // Sin almacenamiento: solo se pierde poder usarla sin conexión.
    }
    return { rate, date: day, stale };
  } catch (err) {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(key(from, to)));
    } catch {
      // Nada guardado.
    }
    if (saved?.rate > 0) return { rate: saved.rate, date: saved.date, stale: true };
    throw err;
  }
}
