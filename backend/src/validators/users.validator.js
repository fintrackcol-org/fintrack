import { AppError } from '../errors/app-error.js';
import { t } from '../i18n/index.js';

/** Lo máximo que cabe en `usuarios.nombre` (varchar(60)). */
export const MAX_NAME_LENGTH = 60;

/** Idiomas en los que está la app. */
export const LANGUAGES = ['es', 'en', 'pt', 'zh'];

/** Monedas que conoce Node (ISO 4217), para no guardar una que no existe. */
const CURRENCIES = new Set(Intl.supportedValuesOf('currency'));

const invalid = (field, problem) => new AppError(422, 'VALIDATION_ERROR', t('Datos inválidos'), [{ field, problem }]);

/**
 * Valida el cuerpo de `PATCH /users/me`: `{ name?, country?, currency?, language? }`, al menos uno.
 * El nombre se recorta y los espacios repetidos se dejan en uno; `null` o `""` lo borran. El país
 * va en ISO 3166 (`CO`), la moneda en ISO 4217 (`COP`) y el idioma es uno de {@link LANGUAGES}.
 * @param {unknown} body
 * @returns {{ name?: string|null, country?: string, currency?: string, language?: string }} Datos limpios.
 */
export function parseUpdateProfile(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', t('El cuerpo de la petición no es válido'));
  }
  const { name, country, currency, language } = body;
  const clean = {};

  if ('name' in body) {
    if (name !== null && typeof name !== 'string') throw invalid('name', t('Debe ser un texto o null'));
    const trimmed = name === null ? '' : name.trim().replace(/\s+/g, ' ');
    if (trimmed.length > MAX_NAME_LENGTH) throw invalid('name', t('Máximo {MAX_NAME_LENGTH} caracteres', { MAX_NAME_LENGTH }));
    clean.name = trimmed || null;
  }
  if ('country' in body) {
    if (typeof country !== 'string' || !/^[A-Z]{2}$/.test(country)) throw invalid('country', t('Debe ser un código de país como "CO"'));
    clean.country = country;
  }
  if ('currency' in body) {
    if (typeof currency !== 'string' || !CURRENCIES.has(currency)) throw invalid('currency', t('Debe ser un código de moneda como "COP"'));
    clean.currency = currency;
  }
  if ('language' in body) {
    if (!LANGUAGES.includes(language)) throw invalid('language', t('Debe ser uno de: {join}', { join: LANGUAGES.join(', ') }));
    clean.language = language;
  }

  if (Object.keys(clean).length === 0) {
    throw invalid('name', t('Envía al menos uno: name, country, currency o language (name: null lo borra)'));
  }
  return clean;
}

/**
 * Valida el cuerpo de `DELETE /users/me` (FT-0017): `{ password }` o `{ googleCredential }`, uno
 * solo. Con qué se confirma lo decide quien usa la app (las cuentas de Google no saben su clave).
 * @param {unknown} body
 * @returns {{ password: string }|{ googleCredential: string }}
 */
export function parseDeleteAccount(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', t('El cuerpo de la petición no es válido'));
  }
  const { password, googleCredential } = body;
  const hasPassword = typeof password === 'string' && password.length > 0;
  const hasGoogle = typeof googleCredential === 'string' && googleCredential.length > 0;
  if (hasPassword === hasGoogle) {
    throw new AppError(422, 'VALIDATION_ERROR', t('Datos inválidos'), [
      { field: 'password', problem: t('Confirma con tu contraseña o con Google (solo uno)') },
    ]);
  }
  // Más largo que esto no es una contraseña de Rinde ni un token de Google: no se gasta bcrypt.
  if ((hasPassword && password.length > 200) || (hasGoogle && googleCredential.length > 4096)) {
    throw new AppError(422, 'VALIDATION_ERROR', t('Datos inválidos'), [
      { field: hasPassword ? 'password' : 'googleCredential', problem: t('Es demasiado largo') },
    ]);
  }
  return hasPassword ? { password } : { googleCredential };
}

/**
 * Valida el cuerpo de `POST /users/me/terms` (FT-0017): `{ version }`, la que la persona leyó.
 * @param {unknown} body
 * @returns {string}
 */
export function parseAcceptTerms(body) {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    throw new AppError(400, 'VALIDATION_ERROR', t('El cuerpo de la petición no es válido'));
  }
  if (typeof body.version !== 'string' || body.version.length > 10) {
    throw new AppError(422, 'VALIDATION_ERROR', t('Datos inválidos'), [
      { field: 'version', problem: t('Debe ser la versión de los términos (AAAA-MM-DD)') },
    ]);
  }
  return body.version;
}
