import { isAdminEmail } from '../config/env.js';
import { LEGAL_VERSION } from '../config/legal.js';
import { AppError } from '../errors/app-error.js';
import { acceptTerms, findUserById, hasTransactions, updateUserProfile } from '../repositories/users.repository.js';

/**
 * @typedef {object} Profile
 * @property {string} id
 * @property {string} email
 * @property {string|null} name Nombre visible; `null` si no lo ha puesto.
 * @property {string} timezone
 * @property {boolean} termsAccepted Si aceptó la versión vigente de los términos y la privacidad.
 * @property {string} country País donde está ahora (ISO 3166).
 * @property {string} currency Moneda principal (ISO 4217): la de todos sus montos y totales.
 * @property {string} language Idioma de la app.
 */

/**
 * Perfil público a partir del registro de la base (sin el hash de la contraseña).
 * @param {import('../repositories/users.repository.js').UserRecord} user
 * @returns {Profile}
 */
function toProfile(user) {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    timezone: user.timezone,
    isAdmin: isAdminEmail(user.email),
    termsAccepted: user.termsVersion === LEGAL_VERSION,
    country: user.country,
    currency: user.currency,
    language: user.language,
  };
}

/** @returns {AppError} 401: el token es válido pero la cuenta ya no existe. */
function accountGone() {
  return new AppError(401, 'UNAUTHORIZED', 'Token inválido o ausente');
}

/**
 * Devuelve el perfil público del usuario autenticado.
 * @param {string} userId
 * @returns {Promise<Profile>}
 */
export async function getProfile(userId) {
  const user = await findUserById(userId);
  if (!user) throw accountGone();
  return toProfile(user);
}

/**
 * Cambia el nombre visible, el país, la moneda principal o el idioma del usuario autenticado. La
 * moneda principal solo cambia mientras no haya movimientos: si no, sus montos se leerían en otra
 * moneda. Quien viaja cambia el país, no la moneda.
 * @param {string} userId
 * @param {{ name?: string|null, country?: string, currency?: string, language?: string }} changes Datos ya validados.
 * @returns {Promise<Profile>}
 */
export async function updateProfile(userId, changes) {
  if (changes.currency) {
    const current = await findUserById(userId);
    if (!current) throw accountGone();
    if (current.currency !== changes.currency && (await hasTransactions(userId))) {
      throw new AppError(409, 'CURRENCY_LOCKED', `Ya tienes movimientos en ${current.currency}: tu moneda principal no se puede cambiar`);
    }
  }
  const user = await updateUserProfile(userId, changes);
  if (!user) throw accountGone();
  return toProfile(user);
}

/**
 * Guarda que el usuario aceptó los términos y la política de privacidad (FT-0017). Solo vale la
 * versión vigente: si la app trae una vieja (estaba abierta cuando se publicó otra), se rechaza y
 * la persona ve el texto nuevo antes de aceptar.
 * @param {string} userId
 * @param {string} version Ya validada como texto.
 * @returns {Promise<Profile>}
 */
export async function acceptCurrentTerms(userId, version) {
  if (version !== LEGAL_VERSION) {
    throw new AppError(422, 'VALIDATION_ERROR', 'Datos inválidos', [
      { field: 'version', problem: 'No es la versión vigente de los términos; recarga la página' },
    ]);
  }
  const user = await acceptTerms(userId, version);
  if (!user) throw accountGone();
  return toProfile(user);
}
