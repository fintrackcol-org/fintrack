import { AppError } from '../errors/app-error.js';
import * as whatsapp from '../services/whatsapp.service.js';

/**
 * `GET /api/v1/whatsapp/webhook`: Meta comprueba el webhook y espera recibir su `challenge`.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {void}
 */
export function getWebhook(req, res) {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query;
  if (!whatsapp.isValidVerification(mode, token)) {
    res.sendStatus(403);
    return;
  }
  res.type('text/plain').send(String(challenge ?? ''));
}

/**
 * `POST /api/v1/whatsapp/webhook`: avisos de Meta. Responde de inmediato, porque Meta reintenta si
 * tarda, y procesa después. Sin una firma válida no se lee el contenido.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {void}
 */
export function postWebhook(req, res) {
  if (
    !Buffer.isBuffer(req.body) ||
    !whatsapp.isValidSignature(req.body, req.get('x-hub-signature-256'))
  ) {
    res.sendStatus(401);
    return;
  }
  let payload;
  try {
    payload = JSON.parse(req.body.toString('utf8'));
  } catch {
    res.sendStatus(400);
    return;
  }
  res.sendStatus(200);
  whatsapp.handleWebhook(payload).catch((err) => {
    console.error(`No se pudo procesar el aviso de WhatsApp (${err.message})`);
  });
}

/**
 * `GET /api/v1/whatsapp/link`: estado de la conexión del usuario.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getLink(req, res) {
  res.json(await whatsapp.status(req.userId));
}

/**
 * `POST /api/v1/whatsapp/link`: genera el código para vincular el número.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postLink(req, res) {
  res.status(201).json(await whatsapp.createLinkCode(req.userId));
}

/**
 * `DELETE /api/v1/whatsapp/link`: desconecta el número.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function deleteLink(req, res) {
  await whatsapp.unlink(req.userId);
  res.status(204).end();
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * `POST /api/v1/whatsapp/link/request`: pide acceso al bot; el equipo lo aprueba.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function postAccessRequest(req, res) {
  res.json(await whatsapp.requestAccess(req.userId));
}

/**
 * `GET /api/v1/whatsapp/admin`: respuestas del mes y quién pidió acceso (solo `ADMIN_EMAILS`).
 * @param {import('express').Request} _req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 */
export async function getAdmin(_req, res) {
  res.json(await whatsapp.adminOverview());
}

/**
 * `PATCH /api/v1/whatsapp/admin/:userId`: aprueba o rechaza el acceso de un usuario.
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<void>}
 * @throws {AppError} 422 si el id o el estado no son válidos.
 */
export async function patchAdminAccess(req, res) {
  const status = req.body?.status;
  if (!UUID_RE.test(req.params.userId) || !['approved', 'rejected'].includes(status)) {
    throw new AppError(422, 'VALIDATION_ERROR', 'El estado debe ser approved o rejected');
  }
  await whatsapp.setAccess(req.params.userId, status);
  res.status(204).end();
}
