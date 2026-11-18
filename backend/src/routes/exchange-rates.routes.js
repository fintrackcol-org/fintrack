import { Router } from 'express';
import { getExchangeRate } from '../controllers/exchange-rates.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de tasas de cambio (se montan en `/api/v1/exchange-rates`). Exigen access token.
 * - `GET /?from=MXN&to=COP&date=AAAA-MM-DD` → `{ from, to, date, rate, stale }`.
 */
const router = Router();

router.get('/', requireAuth, getExchangeRate);

export default router;
