import { AppError } from '../errors/app-error.js';
import { isValidDate } from './transactions.validator.js';
import { t } from '../i18n/index.js';

const FORMATS = ['xlsx', 'csv', 'pdf'];

/**
 * Revisa el rango de fechas de una query y anota los problemas en `details`.
 * @param {Record<string, unknown>} query
 * @param {Array<{ field: string, problem: string }>} details
 * @returns {void}
 */
function checkRange({ from, to }, details) {
  if (!isValidDate(from)) {
    details.push({ field: 'from', problem: t('Debe ser una fecha AAAA-MM-DD') });
  }
  if (!isValidDate(to)) {
    details.push({ field: 'to', problem: t('Debe ser una fecha AAAA-MM-DD') });
  }
  // Las fechas AAAA-MM-DD se pueden comparar como texto: el orden alfabético es el cronológico.
  if (isValidDate(from) && isValidDate(to) && from > to) {
    details.push({ field: 'to', problem: t('Debe ser igual o posterior a from') });
  }
}

/**
 * Valida la query de `GET /reports/preview`: `?from=AAAA-MM-DD&to=AAAA-MM-DD`.
 * @param {Record<string, unknown>} query `req.query` de Express.
 * @returns {{ from: string, to: string }} Datos limpios.
 * @throws {AppError} 422 `VALIDATION_ERROR` con el problema de cada campo.
 */
export function parsePreviewQuery(query) {
  const details = [];
  checkRange(query, details);
  if (details.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', t('Datos inválidos'), details);
  }
  return { from: query.from, to: query.to };
}

/**
 * Valida la query de `GET /reports/export`:
 * `?format=xlsx|csv|pdf&from=AAAA-MM-DD&to=AAAA-MM-DD&detail=false`.
 * `detail=false` (opcional, solo afecta al PDF) deja el reporte sin la tabla de movimientos.
 * @param {Record<string, unknown>} query `req.query` de Express.
 * @returns {{ format: 'xlsx'|'csv'|'pdf', from: string, to: string, detail: boolean }} Datos limpios.
 * @throws {AppError} 422 `VALIDATION_ERROR` con el problema de cada campo.
 */
export function parseExportQuery(query) {
  const details = [];
  const { format, from, to, detail } = query;

  if (!FORMATS.includes(format)) {
    details.push({ field: 'format', problem: t('Debe ser xlsx, csv o pdf') });
  }
  checkRange(query, details);
  if (detail !== undefined && detail !== 'true' && detail !== 'false') {
    details.push({ field: 'detail', problem: t('Debe ser true o false') });
  }

  if (details.length > 0) {
    throw new AppError(422, 'VALIDATION_ERROR', t('Datos inválidos'), details);
  }
  return { format, from, to, detail: detail !== 'false' };
}
