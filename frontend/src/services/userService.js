/**
 * Perfil del usuario, según `docs/api/openapi.yaml` (`/users/me`).
 */
import { apiRequest } from '@/lib/apiRequest';
import { regionForCountry } from '@/lib/region';

/**
 * @typedef {object} Profile
 * @property {string} id
 * @property {string} email
 * @property {string|null} name Nombre visible; `null` si no lo ha puesto.
 * @property {string} timezone
 * @property {boolean} isAdmin Si administra Lo que viene.
 * @property {string} country País donde está ahora (`CO`).
 * @property {string} currency Moneda principal (`COP`): la de todos sus montos.
 * @property {string} language Idioma de la app (`es`, `en`, `pt`, `zh`).
 */

/** Largo máximo del nombre (igual que `usuarios.nombre` en la base). */
export const MAX_NAME_LENGTH = 60;

/** @returns {Promise<Profile>} */
export function getProfile() {
  return apiRequest('/users/me');
}

/**
 * Cambia el nombre visible. `null` o un texto vacío lo borran.
 * @param {string|null} name
 * @returns {Promise<Profile>}
 */
export function updateProfile(name) {
  return apiRequest('/users/me', { method: 'PATCH', body: { name } });
}

/**
 * Guarda el país (y el idioma, si se da). La moneda principal sigue al país solo mientras no haya
 * movimientos: si ya hay, el servidor responde `CURRENCY_LOCKED` y se guarda el país sin tocarla.
 * Así quien viaja cambia el país y sus montos siguen en su moneda.
 * @param {string} country Código del país (`MX`).
 * @param {string} [language]
 * @returns {Promise<Profile>}
 */
export async function saveCountry(country, language) {
  const { currency } = regionForCountry(country);
  const body = { country, ...(language && { language }) };
  try {
    return await apiRequest('/users/me', { method: 'PATCH', body: { ...body, currency } });
  } catch (err) {
    if (err.code !== 'CURRENCY_LOCKED') throw err;
    return apiRequest('/users/me', { method: 'PATCH', body });
  }
}

/**
 * Cambia el idioma de la app.
 * @param {string} language `es`, `en`, `pt` o `zh`.
 * @returns {Promise<Profile>}
 */
export function saveLanguage(language) {
  return apiRequest('/users/me', { method: 'PATCH', body: { language } });
}

/**
 * Elimina la cuenta y todos sus datos (FT-0017). No se puede deshacer.
 * @param {{ password: string } | { googleCredential: string }} confirmation Contraseña, o el
 *   `credential` de Google para las cuentas creadas con Google.
 * @returns {Promise<null>}
 * @throws {Error} Con `code: 'CONFIRMATION_FAILED'` si la contraseña o la cuenta de Google no coinciden.
 */
export function deleteAccount(confirmation) {
  return apiRequest('/users/me', { method: 'DELETE', body: confirmation });
}

/**
 * Acepta los términos y la política de privacidad en la versión que la persona leyó (FT-0017).
 * El servidor solo acepta la vigente.
 * @param {string} version AAAA-MM-DD
 * @returns {Promise<object>} El perfil, con `termsAccepted: true`.
 */
export function acceptTerms(version) {
  return apiRequest('/users/me/terms', { method: 'POST', body: { version } });
}
