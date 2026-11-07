import { Router } from 'express';
import { getLiquidity } from '../controllers/liquidity.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Motor de liquidez (FT-0059), montado en `/api/v1/liquidity`. Exige access token y solo usa los
 * datos del usuario autenticado.
 * - `GET /?days=45` → proyección de la plata, primer día en que faltaría y cuánto gastar al día.
 */
const router = Router();

router.get('/', requireAuth, getLiquidity);

export default router;
