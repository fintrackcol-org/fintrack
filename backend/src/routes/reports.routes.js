import { Router } from 'express';
import { getExport, getPreview } from '../controllers/reports.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de reportes (se montan en `/api/v1/reports`). Exigen access token.
 * - `GET /export` → descarga el reporte del periodo en Excel, PDF o CSV.
 * - `GET /preview` → las cifras de ese reporte, para verlas antes de descargar.
 */
const router = Router();

router.use(requireAuth);
router.get('/export', getExport);
router.get('/preview', getPreview);

export default router;
