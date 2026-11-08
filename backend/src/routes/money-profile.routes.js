import { Router } from 'express';
import {
  deleteCommitment,
  getCalendar,
  getIncome,
  getSplit,
  getPlan,
  getProfile,
  postCommitment,
  postWelcome,
  putCommitment,
  putProfile,
  putSources,
} from '../controllers/money-profile.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de Mi plata (se montan en `/api/v1/money-profile`). Todas exigen access token y solo
 * operan sobre los datos del usuario autenticado (RN-01).
 * - `GET /` → perfil y compromisos.
 * - `GET /plan` → cuánto puede gastar o necesita ganar hoy.
 * - `GET /calendar?month=AAAA-MM` → pagos del mes y cuánto queda después de cada uno.
 * - `PUT /` → cómo le entra la plata y cuánta tiene.
 * - `GET /income` → mes normal y flaco, sueldo propio, colchón y seguridad social (FT-0060).
 * - `GET /income/split?amount=` → cómo repartir un ingreso.
 * - `PUT /sources` → fuentes de ingreso (reemplaza todas).
 * - `POST /welcome` → guarda la bienvenida o la marca como omitida.
 * - `POST /commitments` → crear un compromiso.
 * - `PUT /commitments/:id` → cambiarlo.
 * - `DELETE /commitments/:id` → eliminarlo.
 */
const router = Router();

router.use(requireAuth);
router.get('/', getProfile);
router.get('/plan', getPlan);
router.get('/calendar', getCalendar);
router.put('/', putProfile);
router.get('/income', getIncome);
router.get('/income/split', getSplit);
router.put('/sources', putSources);
router.post('/welcome', postWelcome);
router.post('/commitments', postCommitment);
router.put('/commitments/:id', putCommitment);
router.delete('/commitments/:id', deleteCommitment);

export default router;
