import { Router } from 'express';
import {
  deleteBusiness,
  deleteCategory,
  deleteInvitation,
  deleteMovement,
  deletePartner,
  getAdvice,
  getBusiness,
  getBusinesses,
  getExport,
  getInvitationPreview,
  getMovements,
  patchBusiness,
  patchPartner,
  postBusiness,
  postCategory,
  postCode,
  postInvitation,
  postJoin,
  postMovement,
  postWithdrawal,
} from '../controllers/negocios.controller.js';
import {
  deleteAccount,
  deletePayment,
  deleteTaxDate,
  getAccounts,
  getTaxDates,
  postAccount,
  postPayment,
  postTaxDate,
} from '../controllers/negocio-accounts.controller.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Rutas de Emprendimientos (FT-0016), montadas en `/api/v1/businesses`. Todas exigen access
 * token. Un negocio solo existe para sus socios: a los demás se les responde 404.
 * Roles: `dueno` administra el negocio y sus socios, `editor` registra movimientos, `lector` ve.
 * - `GET /` · `POST /` → mis negocios · crear uno (quien lo crea queda de dueño).
 * - `GET /invitations/:code` · `POST /join` → ver el negocio de un enlace · unirse con el código.
 * - `GET /:id` · `PATCH /:id` · `DELETE /:id` → detalle · editar · eliminar (dueños).
 * - `POST /:id/code` → código de invitación nuevo (dueños).
 * - `POST /:id/invitations` · `DELETE /:id/invitations?email=` → invitar por correo · cancelar (dueños).
 * - `PATCH /:id/partners/:userId` · `DELETE /:id/partners/:userId` → rol o participación · sacar o salirse.
 * - `GET /:id/movements?month=` · `POST /:id/movements` · `DELETE /:id/movements/:movementId` →
 *   movimientos y panel del mes · registrar (dueños y editores) · borrar (quien lo registró o un dueño).
 * - `POST /:id/withdrawals` → retiro del socio, que entra a sus finanzas personales (FT-0018).
 * - `GET /:id/export?month=&format=xlsx|pdf` → el mes para el contador (todos los socios).
 * - `GET /:id/accounts` · `POST /:id/accounts` · `DELETE /:id/accounts/:accountId` → cuentas por
 *   cobrar y por pagar · crear (dueños y editores) · borrar (quien la registró o un dueño) (FT-0058).
 * - `POST /:id/accounts/:accountId/payments` · `DELETE /:id/accounts/:accountId/payments/:paymentId`
 *   → abono parcial, que crea su movimiento del negocio · deshacerlo.
 * - `GET /:id/tax-dates` · `POST /:id/tax-dates` · `DELETE /:id/tax-dates/:dateId` → fechas de
 *   impuestos (IVA, retención…), con aviso 3 días antes (FT-0058).
 * - `POST /:id/categories` · `DELETE /:id/categories/:key` → categorías propias del negocio (dueños
 *   y editores); al borrar una, sus movimientos pasan a "Otros". Se listan en `GET /:id/movements`.
 * - `GET /:id/advice?month=` → consejo sobre el mes (IA con cifras agregadas, o reglas) (FT-0058).
 */
const router = Router();

router.use(requireAuth);
router.get('/', getBusinesses);
router.post('/', postBusiness);
router.get('/invitations/:code', getInvitationPreview);
router.post('/join', postJoin);
router.get('/:id', getBusiness);
router.patch('/:id', patchBusiness);
router.delete('/:id', deleteBusiness);
router.post('/:id/code', postCode);
router.post('/:id/invitations', postInvitation);
router.delete('/:id/invitations', deleteInvitation);
router.patch('/:id/partners/:userId', patchPartner);
router.delete('/:id/partners/:userId', deletePartner);
router.get('/:id/movements', getMovements);
router.post('/:id/movements', postMovement);
router.delete('/:id/movements/:movementId', deleteMovement);
router.post('/:id/withdrawals', postWithdrawal);
router.get('/:id/export', getExport);
router.get('/:id/advice', getAdvice);
router.get('/:id/accounts', getAccounts);
router.post('/:id/accounts', postAccount);
router.delete('/:id/accounts/:accountId', deleteAccount);
router.post('/:id/accounts/:accountId/payments', postPayment);
router.delete('/:id/accounts/:accountId/payments/:paymentId', deletePayment);
router.get('/:id/tax-dates', getTaxDates);
router.post('/:id/tax-dates', postTaxDate);
router.delete('/:id/tax-dates/:dateId', deleteTaxDate);
router.post('/:id/categories', postCategory);
router.delete('/:id/categories/:key', deleteCategory);

export default router;
