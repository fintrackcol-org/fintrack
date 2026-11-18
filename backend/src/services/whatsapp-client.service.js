import { env } from '../config/env.js';

/** Versión de la Graph API de Meta. */
const GRAPH_URL = 'https://graph.facebook.com/v25.0';
const SEND_TIMEOUT_MS = 8000;

/**
 * Envía un texto por WhatsApp. No registra el número ni el contenido si falla.
 * @param {string} to Número con indicativo (solo dígitos) o BSUID (lleva punto, p. ej. `CO.123`).
 * @param {string} body
 * @param {typeof fetch} [http]
 * @returns {Promise<void>}
 * @throws {Error} Si Meta no acepta el mensaje.
 */
export async function sendText(to, body, http = fetch) {
  // A quien Meta solo identifica por BSUID se le escribe con `recipient` en vez de `to`.
  const target = to.includes('.') ? { recipient_type: 'individual', recipient: to } : { to };
  const response = await http(`${GRAPH_URL}/${env.whatsappPhoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.whatsappAccessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      ...target,
      type: 'text',
      text: { body },
    }),
    signal: AbortSignal.timeout(SEND_TIMEOUT_MS),
  });
  if (!response.ok) {
    // Solo el código de Meta (p. ej. 131047), sin el número ni el texto.
    const code = await response
      .json()
      .then((data) => data?.error?.code)
      .catch(() => undefined);
    throw new Error(`Meta respondió ${response.status}${code ? ` (${code})` : ''}`);
  }
}
