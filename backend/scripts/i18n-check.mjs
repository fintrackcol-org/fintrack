// Textos del servidor (errores, correos, bot, avisos, reportes) y traducciones que faltan. Uso (desde backend/): npm run i18n
//   npm run i18n               → cuántos textos hay y cuántos faltan por idioma
//   npm run i18n -- --missing en   → lista en JSON los que faltan en inglés (para traducirlos)
// El texto en español es la clave (ver src/i18n/index.js). Lee los t('…') y tr('…') del código.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SRC = new URL('../src/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const LANGUAGES = ['en', 'pt']; // zh vuelve cuando se retome el mandarín
const CALL = /\btr?\(\s*(['"])((?:\\.|(?!\1).)*)\1/g;

const unescape = (s) => s.replace(/\\n/g, '\n').replace(/\\(['"\\])/g, '$1');

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path, out);
    else if (/\.jsx?$/.test(name) && !/\.test\.jsx?$/.test(name)) out.push(path);
  }
  return out;
}

const keys = new Set();
for (const file of walk(SRC)) {
  const code = readFileSync(file, 'utf8');
  if (!code.includes("i18n/index.js'")) continue;
  for (const [, , text] of code.matchAll(CALL)) keys.add(unescape(text));
}

function translations(language) {
  const dir = join(SRC, 'i18n', 'locales', language);
  let merged = {};
  try {
    for (const name of readdirSync(dir).sort()) merged = { ...merged, ...JSON.parse(readFileSync(join(dir, name), 'utf8')) };
  } catch {
    // Aún no hay archivos de ese idioma.
  }
  return merged;
}

const wanted = process.argv.indexOf('--missing');
if (wanted > -1) {
  const language = process.argv[wanted + 1];
  const done = translations(language);
  console.log(JSON.stringify([...keys].filter((k) => !done[k]).sort(), null, 1));
} else {
  console.log(`Textos en el servidor: ${keys.size}`);
  for (const language of LANGUAGES) {
    const done = translations(language);
    const missing = [...keys].filter((k) => !done[k]).length;
    // catalogo.json son los nombres de las categorías de todos: vienen de la base, no del código.
    const catalog = translationsFile(language, 'catalogo.json');
    const unused = Object.keys(done).filter((k) => !keys.has(k) && !(k in catalog)).length;
    console.log(`  ${language}: faltan ${missing}${unused ? ` · sobran ${unused} (ya no se usan)` : ''}`);
  }
}

function translationsFile(language, name) {
  try {
    return JSON.parse(readFileSync(join(SRC, 'i18n', 'locales', language, name), 'utf8'));
  } catch {
    return {};
  }
}
