/**
 * Conexión del número con el bot de WhatsApp, según `docs/api/openapi.yaml` (`/whatsapp/link`).
 */
import { apiRequest } from '@/lib/apiRequest';

/**
 * @typedef {object} WhatsappLink
 * @property {boolean} available Si el usuario ve el bot: tiene acceso o puede pedirlo.
 * @property {'approved'|'pending'|'rejected'|'none'} access Acceso aprobado por el equipo.
 * @property {boolean} admin Si puede abrir el panel del equipo.
 * @property {boolean} linked
 * @property {string|null} phone Solo los últimos cuatro dígitos.
 * @property {string|null} botNumber
 */

/** @returns {Promise<WhatsappLink>} */
export function getWhatsappLink() {
  return apiRequest('/whatsapp/link');
}

/** @returns {Promise<{ code: string, expiresAt: string, botNumber: string|null }>} */
export function createWhatsappCode() {
  return apiRequest('/whatsapp/link', { method: 'POST' });
}

/** @returns {Promise<null>} */
export function deleteWhatsappLink() {
  return apiRequest('/whatsapp/link', { method: 'DELETE' });
}

/**
 * Pide acceso al bot; el equipo lo aprueba.
 * @returns {Promise<WhatsappLink>}
 */
export function requestWhatsappAccess() {
  return apiRequest('/whatsapp/link/request', { method: 'POST' });
}

/**
 * Panel del equipo: respuestas del mes y quién pidió acceso.
 * @returns {Promise<{ month: { sent: number, max: number }, users: Array<{ userId: string, email: string, name: string|null, status: 'approved'|'pending'|'rejected', requestedAt: string, linked: boolean, monthSends: number }> }>}
 */
export function getWhatsappAdmin() {
  return apiRequest('/whatsapp/admin');
}

/**
 * Aprueba o rechaza el acceso de un usuario.
 * @param {string} userId
 * @param {'approved'|'rejected'} status
 * @returns {Promise<null>}
 */
export function setWhatsappAccess(userId, status) {
  return apiRequest(`/whatsapp/admin/${userId}`, { method: 'PATCH', body: { status } });
}
