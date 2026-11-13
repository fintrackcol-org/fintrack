import express, { Router } from 'express';
import {
  deleteLink,
  getAdmin,
  getLink,
  getWebhook,
  patchAdminAccess,
  postAccessRequest,
  postLink,
  postWebhook,
} from '../controllers/whatsapp.controller.js';
import { requireAdmin } from '../middlewares/admin.middleware.js';
import { requireAuth } from '../middlewares/auth.middleware.js';

/**
 * Webhook de Meta (FT-0029), montado en `/api/v1/whatsapp/webhook` antes de `express.json()`: la
 * firma se calcula sobre el cuerpo original. No usa token: lo protege esa firma.
 */
export const webhookRouter = Router();
webhookRouter.get('/', getWebhook);
webhookRouter.post('/', express.raw({ type: '*/*', limit: '1mb' }), postWebhook);

/**
 * Conexión del número (FT-0029), montada en `/api/v1/whatsapp/link`. Exige access token.
 * - `GET /` → estado · `POST /` → código para vincular · `DELETE /` → desconectar.
 * - `POST /request` → pedir acceso al bot.
 */
export const linkRouter = Router();
linkRouter.use(requireAuth);
linkRouter.get('/', getLink);
linkRouter.post('/', postLink);
linkRouter.delete('/', deleteLink);
linkRouter.post('/request', postAccessRequest);

/**
 * Panel del equipo, montado en `/api/v1/whatsapp/admin`. Solo `ADMIN_EMAILS`.
 * - `GET /` → respuestas del mes y solicitudes · `PATCH /:userId` → aprobar o rechazar.
 */
export const adminRouter = Router();
adminRouter.use(requireAuth, requireAdmin);
adminRouter.get('/', getAdmin);
adminRouter.patch('/:userId', patchAdminAccess);
