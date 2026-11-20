// Textos de la app y traducciones que faltan. Uso (desde frontend/): npm run i18n
//   npm run i18n               → cuántos textos hay y cuántos faltan por idioma
//   npm run i18n -- --missing en   → lista en JSON los que faltan en inglés (para traducirlos)
//   npm run i18n -- --check        → igual que sin opciones, pero falla si falta alguno (CI)
// El texto en español es la clave (ver src/lib/i18n.js). Lee los t('…') y tr('…') del código.
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
  if (!code.includes("from '@/lib/i18n'")) continue;
  for (const [, , text] of code.matchAll(CALL)) keys.add(unescape(text));
}

function translations(language) {
  const dir = join(SRC, 'locales', language);
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
  console.log(`Textos en la app: ${keys.size}`);
  for (const language of LANGUAGES) {
    const done = translations(language);
    const missing = [...keys].filter((k) => !done[k]).length;
    const unused = Object.keys(done).filter((k) => !keys.has(k)).length;
    console.log(`  ${language}: faltan ${missing}${unused ? ` · sobran ${unused} (sin t('…') literal; ojo: las categorías fijas se traducen con t(c.name), no las borres)` : ''}`);
    if (missing && process.argv.includes('--check')) process.exitCode = 1;
  }
}
