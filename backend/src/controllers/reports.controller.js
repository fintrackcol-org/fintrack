import { exportTransactions, previewReport } from '../services/reports.service.js';
import { parseExportQuery, parsePreviewQuery } from '../validators/reports.validator.js';

/**
 * `GET /api/v1/reports/preview?from=AAAA-MM-DD&to=AAAA-MM-DD`: las cifras que traerá el reporte del
 * periodo, para mostrarlas antes de descargar. Responde 200 con el JSON, o 422 `NO_DATA`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getPreview(req, res) {
  const preview = await previewReport(req.userId, parsePreviewQuery(req.query));
  res.set('Cache-Control', 'no-store').json(preview);
}

/**
 * `GET /api/v1/reports/export?format=csv&from=AAAA-MM-DD&to=AAAA-MM-DD`: descarga los movimientos
 * del periodo como archivo (FT-0012). Responde 200 con el archivo adjunto, o 422 `NO_DATA`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getExport(req, res) {
  const query = parseExportQuery(req.query);
  const file = await exportTransactions(req.userId, query);
  res
    .set({
      'Content-Type': file.contentType,
      'Content-Disposition': `attachment; filename="${file.filename}"`,
      // Datos financieros personales: que ningún navegador ni proxy guarde una copia.
      'Cache-Control': 'no-store',
    })
    .send(file.body);
}
