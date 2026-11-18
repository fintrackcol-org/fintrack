/**
 * País, moneda principal e idioma de la persona, y el formato de dinero que sale de ellos.
 *
 * - País: donde está ahora. Cambia si viaja.
 * - Moneda principal: la de todos sus montos y totales. Se elige con el país al empezar y no cambia
 *   al viajar (lo anotado en otra moneda se convierte a ella).
 * - Idioma: se sugiere con el país al empezar y después se cambia aparte, nunca al viajar.
 *
 * Vive en el módulo (no en un contexto de React) para que `formatMoney` siga siendo una función
 * simple que usan cientos de lugares. Se guarda en el dispositivo para que la app abra con el formato
 * correcto antes de hablar con el servidor. Todo sale de `Intl`, que trae el navegador: sin API.
 */

/** Idiomas en los que está la app, con su nombre en ese mismo idioma. */
export const LANGUAGES = [
  { code: 'es', name: 'Español' },
  { code: 'en', name: 'English' },
  { code: 'pt', name: 'Português' },
  // El mandarín (zh) vuelve aquí cuando existan sus traducciones en src/locales/zh (pausado el 18-nov-2026).
];

/**
 * País (ISO 3166), su moneda (ISO 4217), el idioma que se sugiere y su zona horaria principal (para
 * adivinarlo). Los países con un idioma que la app no tiene van en inglés.
 */
const COUNTRY_DATA = [
  // América
  'AR ARS es America/Argentina/Buenos_Aires', 'BO BOB es America/La_Paz', 'BR BRL pt America/Sao_Paulo',
  'CA CAD en America/Toronto', 'CL CLP es America/Santiago', 'CO COP es America/Bogota',
  'CR CRC es America/Costa_Rica', 'CU CUP es America/Havana', 'DO DOP es America/Santo_Domingo',
  'EC USD es America/Guayaquil', 'SV USD es America/El_Salvador', 'GT GTQ es America/Guatemala',
  'HN HNL es America/Tegucigalpa', 'MX MXN es America/Mexico_City', 'NI NIO es America/Managua',
  'PA USD es America/Panama', 'PY PYG es America/Asuncion', 'PE PEN es America/Lima',
  'PR USD es America/Puerto_Rico', 'UY UYU es America/Montevideo', 'VE VES es America/Caracas',
  'US USD en America/New_York', 'JM JMD en America/Jamaica', 'TT TTD en America/Port_of_Spain',
  // Europa
  'ES EUR es Europe/Madrid', 'PT EUR pt Europe/Lisbon', 'FR EUR en Europe/Paris', 'DE EUR en Europe/Berlin',
  'IT EUR en Europe/Rome', 'NL EUR en Europe/Amsterdam', 'BE EUR en Europe/Brussels', 'IE EUR en Europe/Dublin',
  'AT EUR en Europe/Vienna', 'GR EUR en Europe/Athens', 'FI EUR en Europe/Helsinki', 'GB GBP en Europe/London',
  'CH CHF en Europe/Zurich', 'SE SEK en Europe/Stockholm', 'NO NOK en Europe/Oslo', 'DK DKK en Europe/Copenhagen',
  'PL PLN en Europe/Warsaw', 'CZ CZK en Europe/Prague', 'HU HUF en Europe/Budapest', 'RO RON en Europe/Bucharest',
  'TR TRY en Europe/Istanbul', 'UA UAH en Europe/Kyiv',
  // Asia y Oceanía
  'CN CNY zh Asia/Shanghai', 'TW TWD zh Asia/Taipei', 'HK HKD zh Asia/Hong_Kong', 'MO MOP zh Asia/Macau',
  'SG SGD en Asia/Singapore', 'JP JPY en Asia/Tokyo', 'KR KRW en Asia/Seoul', 'IN INR en Asia/Kolkata',
  'ID IDR en Asia/Jakarta', 'MY MYR en Asia/Kuala_Lumpur', 'PH PHP en Asia/Manila', 'TH THB en Asia/Bangkok',
  'VN VND en Asia/Ho_Chi_Minh', 'AE AED en Asia/Dubai', 'IL ILS en Asia/Jerusalem', 'SA SAR en Asia/Riyadh',
  'AU AUD en Australia/Sydney', 'NZ NZD en Pacific/Auckland',
  // África
  'ZA ZAR en Africa/Johannesburg', 'NG NGN en Africa/Lagos', 'EG EGP en Africa/Cairo', 'MA MAD en Africa/Casablanca',
  'KE KES en Africa/Nairobi', 'AO AOA pt Africa/Luanda', 'MZ MZN pt Africa/Maputo', 'GQ XAF es Africa/Malabo',
];

/** @type {{ code: string, currency: string, language: string, timeZone: string }[]} */
export const COUNTRIES = COUNTRY_DATA.map((row) => {
  const [code, currency, language, timeZone] = row.split(' ');
  return { code, currency, language, timeZone };
});

/** Quien no ha dicho nada: Rinde nació en Colombia. Las cuentas viejas son así. */
export const DEFAULT_REGION = { country: 'CO', currency: 'COP', language: 'es' };

const STORAGE_KEY = 'rinde.region';

/** @param {string} code */
export const findCountry = (code) => COUNTRIES.find((c) => c.code === code);

/**
 * Adivina el país para proponerlo al empezar: primero por la zona horaria (dice dónde está, no qué
 * idioma tiene el celular), luego por la región del idioma (`es-CO`). Sin GPS, sin IP, sin permisos.
 * @param {string} [timeZone]
 * @param {readonly string[]} [languages]
 * @returns {string} Código del país; Colombia si no se sabe.
 */
export function suggestCountry(
  timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone,
  languages = globalThis.navigator?.languages ?? [],
) {
  const byZone = COUNTRIES.find((c) => c.timeZone === timeZone);
  if (byZone) return byZone.code;
  for (const tag of languages) {
    const region = tag.split('-')[1]?.toUpperCase();
    if (region && findCountry(region)) return region;
  }
  return DEFAULT_REGION.country;
}

/**
 * Lo que se propone al elegir un país al empezar: su moneda y su idioma.
 * @param {string} code
 * @returns {{ country: string, currency: string, language: string }}
 */
export function regionForCountry(code) {
  const country = findCountry(code) ?? findCountry(DEFAULT_REGION.country);
  // Un idioma que la app aún no tiene (el mandarín) se propone en inglés.
  const language = LANGUAGES.some((l) => l.code === country.language) ? country.language : 'en';
  return { country: country.code, currency: country.currency, language };
}

const upperFirst = (text) => (text ? text[0].toLocaleUpperCase() + text.slice(1) : text);

/**
 * Nombre del país en el idioma dado (`Colombia`, `Estados Unidos`).
 * @param {string} code
 * @param {string} [language]
 */
export function countryName(code, language = region.language) {
  return new Intl.DisplayNames([language], { type: 'region' }).of(code) ?? code;
}

/**
 * Nombre de la moneda en el idioma dado (`Peso colombiano`).
 * @param {string} code
 * @param {string} [language]
 */
export function currencyName(code, language = region.language) {
  return upperFirst(new Intl.DisplayNames([language], { type: 'currency' }).of(code) ?? code);
}

/**
 * Formato de los números (`es-CO`): el de la casa de la moneda principal, como la escriben allá.
 * En reales se escribe `R$ 1.234,56` aunque la app esté en español; quien viaja sigue viendo los
 * números como en su casa (un colombiano en México no pasa a `15,000.00`). El idioma no entra aquí:
 * mezclarlo daría formatos que no existen (`es-BR`).
 * @param {{ country: string, currency: string }} current
 * @returns {string}
 */
export function localeFor({ country, currency }) {
  const here = findCountry(country);
  const home = here?.currency === currency ? here : COUNTRIES.find((c) => c.currency === currency);
  return home ? `${home.language}-${home.code}` : 'es-CO';
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved?.country && saved.currency && saved.language) return saved;
  } catch {
    // Sin almacenamiento (modo privado o pruebas): se usa el de siempre.
  }
  // Antes de entrar (login, registro) habla el idioma del navegador si la app lo tiene. Solo en el
  // navegador: Node también tiene `navigator` y las pruebas deben correr en español.
  const browser = globalThis.document ? globalThis.navigator?.language?.slice(0, 2) : null;
  return LANGUAGES.some((l) => l.code === browser) ? { ...DEFAULT_REGION, language: browser } : DEFAULT_REGION;
}

let region = load();
let formats = null;

/** @returns {{ country: string, currency: string, language: string }} */
export const getRegion = () => region;

/** Formato de fechas y listas: el idioma de la app con el país (`es-CO`, `en-US`, `pt-BR`). */
export const dateLocale = () => `${region.language}-${region.country}`;

/** Formato de números y porcentajes: el de la casa de la moneda principal, como el dinero. */
export const numberLocale = () => regionFormats().locale;

/**
 * Cabeceras para el servidor: así responde (errores, correos, reportes, IA) en el idioma y con la
 * moneda de la persona, sin tener que consultarlos en cada petición.
 * @returns {Record<string, string>}
 */
export const regionHeaders = () => ({
  'Accept-Language': region.language,
  'X-Rinde-Currency': region.currency,
  'X-Rinde-Country': region.country,
});

/** Moneda del país donde está ahora: la de lo que paga allá si viaja. */
export const localCurrency = () => findCountry(region.country)?.currency ?? region.currency;

/** Si está en un país con otra moneda: lo que anote puede ir en la de allá y se convierte. */
export const isAbroad = () => localCurrency() !== region.currency;

/**
 * Monto en otra moneda, escrito como lo lee la persona: desde Colombia `MXN 200` o `US$ 15,50`
 * (con el código, para no confundirlo con el `$` del peso).
 * @param {number} amount
 * @param {string} currency
 * @returns {string}
 */
export function formatIn(amount, currency) {
  const digits = Number.isInteger(amount) ? 0 : 2;
  return new Intl.NumberFormat(regionFormats().locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

/**
 * Símbolo con el que se escribe una moneda (`$`, `MXN`, `US$`), para ponerlo delante de un campo.
 * @param {string} currency
 * @returns {string}
 */
export function currencySymbol(currency) {
  if (currency === region.currency) return regionFormats().symbol;
  const parts = new Intl.NumberFormat(regionFormats().locale, { style: 'currency', currency }).formatToParts(1);
  return parts.find((p) => p.type === 'currency')?.value ?? currency;
}

/**
 * Cambia el país, la moneda o el idioma con los que se da formato, y lo recuerda en el dispositivo.
 * @param {{ country: string, currency: string, language: string }} next
 * @returns {boolean} Si cambió la moneda o el idioma y quedó guardado: lo ya dibujado en pantalla
 *   tiene el formato anterior y vale la pena recargar (sin guardar, recargar daría vueltas sin fin).
 */
export function setRegion({ country, currency, language }) {
  const changed = currency !== region.currency || language !== region.language;
  region = { country, currency, language };
  formats = null;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(region));
    return changed;
  } catch {
    return false; // sin almacenamiento: dura hasta que se cierre la app
  }
}

/**
 * Formatos de la región actual, creados una vez por cambio (crear un `Intl.NumberFormat` cuesta).
 * @returns {{ locale: string, money: (amount: number) => string, compactMoney: (amount: number) => string, symbol: string, group: string, decimal: string }}
 */
export function regionFormats() {
  if (formats) return formats;
  const locale = localeFor(region);
  const currency = (digits) =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: region.currency, minimumFractionDigits: digits, maximumFractionDigits: digits });
  // Sin decimales si no los tiene ("$ 12.500"); con centavos completos si los tiene ("US$ 12,50").
  const whole = currency(0);
  const cents = currency(2);
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 });
  // Dónde va el símbolo y con qué espacio, para armar "$ 1,2 M" con el número corto del idioma.
  const pattern = whole.formatToParts(1).filter((p) => ['currency', 'literal', 'integer'].includes(p.type));
  const parts = new Intl.NumberFormat(locale).formatToParts(12345.6);
  formats = {
    locale,
    money: (amount) => (Number.isInteger(amount) ? whole : cents).format(amount),
    compactMoney: (amount) => pattern.map((p) => (p.type === 'integer' ? compact.format(amount) : p.value)).join(''),
    symbol: pattern.find((p) => p.type === 'currency')?.value ?? region.currency,
    group: parts.find((p) => p.type === 'group')?.value ?? '.',
    decimal: parts.find((p) => p.type === 'decimal')?.value ?? ',',
  };
  return formats;
}
