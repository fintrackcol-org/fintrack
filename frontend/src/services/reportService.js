/**
 * Exportación de movimientos, según `docs/api/openapi.yaml` (`GET /reports/export` y
 * `GET /reports/preview`, FT-0012).
 */
import { authFetch } from '@/lib/authFetch';
import { apiRequest, CONNECTION_ERROR, toApiError } from '@/lib/apiRequest';

/**
 * Saca el nombre del archivo de `Content-Disposition: attachment; filename="rinde_2026-10.csv"`.
 * @param {string|null} header
 * @param {string} fallback Nombre si el encabezado no llega (p. ej. un proxy lo quitó).
 * @returns {string}
 */
export function filenameFrom(header, fallback) {
  const match = header?.match(/filename="?([^";]+)"?/i);
  return match ? match[1] : fallback;
}

/**
 * Pide las cifras del reporte del periodo, para mostrarlas antes de descargar.
 * @param {{ from: string, to: string }} range Fechas AAAA-MM-DD.
 * @returns {Promise<object>} Totales, categorías, serie, hallazgos y las primeras filas del CSV.
 * @throws {Error} Con `code` (`NO_DATA` si no hay movimientos en el periodo).
 */
export function previewReport({ from, to }) {
  return apiRequest(`/reports/preview?${new URLSearchParams({ from, to })}`);
}

/**
 * Pide el archivo de exportación del periodo.
 * @param {{ format: 'xlsx'|'csv'|'pdf', from: string, to: string, detail?: boolean }} options Fechas
 *   AAAA-MM-DD. `detail: false` deja el PDF sin la tabla de movimientos.
 * @returns {Promise<{ blob: Blob, filename: string }>}
 * @throws {Error} Con `code` (`NO_DATA` si no hay movimientos en el periodo, REQ-033).
 */
export async function exportTransactions({ format, from, to, detail = true }) {
  const query = new URLSearchParams({ format, from, to });
  if (!detail) query.set('detail', 'false');
  let res;
  try {
    res = await authFetch(`/reports/export?${query}`);
  } catch {
    throw new Error(CONNECTION_ERROR);
  }
  if (!res.ok) throw await toApiError(res);

  return {
    blob: await res.blob(),
    filename: filenameFrom(res.headers.get('Content-Disposition'), `rinde_${from}_${to}.${format}`),
  };
}
