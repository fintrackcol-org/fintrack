/**
 * Idioma, moneda y país con los que el servidor le habla a cada persona: errores, correos, reportes,
 * avisos, la IA y el bot de WhatsApp.
 *
 * - En las peticiones de la app llegan en las cabeceras (`Accept-Language`, `X-Rinde-Currency`,
 *   `X-Rinde-Country`): ver `regionMiddleware`.
 * - En el bot y en los avisos programados se leen del usuario (`usuarios.idioma`, `moneda`, `pais`)
 *   y se usan con `withRegion(region, fn)`.
 *
 * Como en la web, el texto en español es la clave: `t('Datos inválidos')` da «Invalid data» en
 * inglés, y lo que no tenga traducción sale en español. Las traducciones viven en
 * `i18n/locales/<idioma>/*.json`. `t()` se llama al usar el texto, nunca al cargar el módulo.
 */
import { AsyncLocalStorage } from 'node:async_hooks';
import { readFileSync, readdirSync } from 'node:fs';
import { COUNTRY_DATA } from './countries.js';

export const LANGUAGES = ['es', 'en', 'pt', 'zh'];
export const DEFAULT_REGION = Object.freeze({ language: 'es', currency: 'COP', country: 'CO' });

const CURRENCIES = new Set(Intl.supportedValuesOf('currency'));
const COUNTRIES = COUNTRY_DATA.map((row) => {
  const [code, currency, language] = row.split(' ');
  return { code, currency, language };
});

/** Todas las traducciones, cargadas una vez al arrancar. */
const MESSAGES = Object.fromEntries(
  LANGUAGES.filter((l) => l !== 'es').map((language) => {
    const dir = new URL(`./locales/${language}/`, import.meta.url);
    let merged = {};
    try {
      for (const name of readdirSync(dir).sort()) {
        if (name.endsWith('.json')) merged = { ...merged, ...JSON.parse(readFileSync(new URL(name, dir), 'utf8')) };
      }
    } catch {
      // Aún no hay traducciones de ese idioma: sale en español.
    }
    return [language, merged];
  }),
);

const store = new AsyncLocalStorage();

/**
 * Deja la región en un valor válido: lo que no se reconoce vuelve al de siempre (Colombia).
 * @param {{ language?: string, currency?: string, country?: string }} [raw]
 * @returns {{ language: string, currency: string, country: string }}
 */
export function cleanRegion(raw = {}) {
  const language = String(raw.language ?? '').trim().slice(0, 2).toLowerCase();
  const currency = String(raw.currency ?? '').trim().toUpperCase();
  const country = String(raw.country ?? '').trim().toUpperCase();
  return {
    language: LANGUAGES.includes(language) ? language : DEFAULT_REGION.language,
    currency: CURRENCIES.has(currency) ? currency : DEFAULT_REGION.currency,
    country: /^[A-Z]{2}$/.test(country) ? country : DEFAULT_REGION.country,
  };
}

/**
 * Corre `fn` hablando con la región dada (el bot, los avisos programados).
 * @template T
 * @param {{ language?: string, currency?: string, country?: string }} region
 * @param {() => T} fn
 * @returns {T}
 */
export function withRegion(region, fn) {
  return store.run(cleanRegion(region), fn);
}

/** @returns {{ language: string, currency: string, country: string }} La región actual. */
export const currentRegion = () => store.getStore() ?? DEFAULT_REGION;

/**
 * Middleware: toma la región de las cabeceras que manda la app y la deja para todo lo que pase en
 * esta petición (también para los errores). Sin cabeceras, Colombia en español.
 * @type {import('express').RequestHandler}
 */
export function regionMiddleware(req, _res, next) {
  withRegion(
    {
      language: (req.get('Accept-Language') ?? '').split(/[,;-]/)[0],
      currency: req.get('X-Rinde-Currency'),
      country: req.get('X-Rinde-Country'),
    },
    next,
  );
}

/**
 * El texto en el idioma de la región actual.
 * @param {string} text En español (es la clave).
 * @param {Record<string, string|number>} [vars] Valores para `{nombre}` dentro del texto.
 * @returns {string}
 */
export function t(text, vars) {
  const out = MESSAGES[currentRegion().language]?.[text] || text;
  return vars ? out.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : out;
}

/**
 * Nombre de una categoría para mostrar: las 15 del catálogo se traducen (`locales/<idioma>/catalogo.json`)
 * y las propias quedan como las escribió la persona, porque no están en el diccionario.
 * @param {string|null|undefined} name Nombre guardado; sin nombre, «Sin clasificar».
 * @returns {string}
 */
export const categoryText = (name) => (name ? t(name) : t('Sin clasificar'));

/** Formato de fechas: el idioma con el país (`es-CO`, `en-US`). */
export const dateLocale = () => `${currentRegion().language}-${currentRegion().country}`;

/**
 * Formato de números: el de la casa de la moneda principal (como en la app). En reales se escribe
 * `R$ 1.234,56` aunque la persona use la app en español.
 * @returns {string}
 */
export function numberLocale() {
  const { country, currency } = currentRegion();
  const here = COUNTRIES.find((c) => c.code === country);
  const home = here?.currency === currency ? here : COUNTRIES.find((c) => c.currency === currency);
  return home ? `${home.language}-${home.code}` : 'es-CO';
}

const LANGUAGE_NAMES = { es: 'español', en: 'inglés', pt: 'portugués de Brasil', zh: 'chino mandarín simplificado' };

/**
 * Regla que se agrega a las instrucciones de la IA (escritas en español para Colombia) cuando la
 * persona usa otro idioma u otra moneda: así responde en su idioma y no habla de pesos.
 * @returns {string} Vacío en español con pesos colombianos.
 */
export function aiRegionRule() {
  const { language, currency } = currentRegion();
  if (language === 'es' && currency === 'COP') return '';
  const name = LANGUAGE_NAMES[language] ?? LANGUAGE_NAMES.es;
  return (
    `\nIMPORTANTE: esta persona usa la app en ${name} y su moneda principal es ${currency}. ` +
    `Responde solo en ${name} y escribe el dinero en ${currency} con el formato de los datos, ` +
    'aunque arriba diga español o pesos colombianos.'
  );
}

/**
 * Decimales con que se escriben los totales de la moneda principal: los pesos colombianos van sin
 * centavos (como en la app), el resto con los de su moneda (2 en dólares, 0 en yenes).
 * @returns {number}
 */
export function currencyDigits() {
  const { currency } = currentRegion();
  if (currency === 'COP') return 0;
  return new Intl.NumberFormat('en', { style: 'currency', currency }).resolvedOptions().maximumFractionDigits;
}

/**
 * Formato de dinero de Excel en la moneda principal: `"$" #,##0;[Red]-"$" #,##0` en pesos,
 * `"R$" #,##0.00;[Red]-"R$" #,##0.00` en reales.
 * @param {{ red?: boolean }} [options] `red: false` sin la sección de negativos en rojo (ejes de gráficos).
 * @returns {string}
 */
export function excelMoneyFormat({ red = true } = {}) {
  const { currency } = currentRegion();
  const parts = new Intl.NumberFormat(numberLocale(), { style: 'currency', currency }).formatToParts(0);
  const symbol = parts.find((p) => p.type === 'currency')?.value ?? currency;
  const digits = currencyDigits();
  const number = `"${symbol}" #,##0${digits ? `.${'0'.repeat(digits)}` : ''}`;
  return red ? `${number};[Red]-${number}` : number;
}

/**
 * Dinero en la moneda principal: sin decimales si no los tiene (`$ 12.500`), con centavos si los
 * tiene (`$12.50`). `digits` fuerza los decimales (los reportes van sin centavos).
 * @param {number} amount
 * @param {{ digits?: number, currency?: string }} [options] `currency` para otra moneda (lo pagado al viajar).
 * @returns {string}
 */
export function formatMoney(amount, { digits, currency = currentRegion().currency } = {}) {
  const fraction = digits ?? (Number.isInteger(Math.round(amount * 100) / 100) ? 0 : 2);
  return new Intl.NumberFormat(numberLocale(), {
    style: 'currency',
    currency,
    minimumFractionDigits: fraction,
    maximumFractionDigits: fraction,
  }).format(amount);
}
