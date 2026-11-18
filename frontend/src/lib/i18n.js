/**
 * Textos de la app en el idioma de la persona (español, inglés, portugués o mandarín simplificado).
 *
 * El texto en español es el original y la clave: `t('Guardar gasto')` da «Save expense» en inglés.
 * Lo que no tenga traducción sale en español, nunca vacío. Las traducciones viven en
 * `src/locales/<idioma>/*.json` y se cargan una sola vez al abrir la app, antes que el resto del
 * código (ver `main.jsx`): así `t()` sirve también en constantes de módulo. Cambiar de idioma recarga.
 *
 * Variables con llaves: `t('Hola, {name}', { name })`.
 */

/** Todas las traducciones; Vite separa cada archivo y solo se descarga el idioma elegido. */
const LOADERS = import.meta.glob('../locales/*/*.json', { import: 'default' });

let messages = {};
let current = 'es';

/**
 * Carga las traducciones de un idioma. El español no necesita nada.
 * @param {string} language `es`, `en`, `pt` o `zh`.
 * @returns {Promise<void>}
 */
export async function loadMessages(language) {
  current = language;
  if (globalThis.document) document.documentElement.lang = language === 'zh' ? 'zh-Hans' : language;
  if (language === 'es') {
    messages = {};
    return;
  }
  const own = Object.entries(LOADERS).filter(([path]) => path.includes(`/locales/${language}/`));
  messages = Object.assign({}, ...(await Promise.all(own.map(([, load]) => load()))));
}

/**
 * El texto en el idioma de la persona.
 * @param {string} text El texto en español (es la clave).
 * @param {Record<string, string|number>} [vars] Valores para `{nombre}` dentro del texto.
 * @returns {string}
 */
export function t(text, vars) {
  const out = messages[text] || text;
  return vars ? out.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? String(vars[name]) : match)) : out;
}

/** @returns {string} El idioma cargado. */
export const currentLanguage = () => current;
