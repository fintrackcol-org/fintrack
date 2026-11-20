import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { build } from 'vite';

/**
 * Empaqueta la página «Rin de Rinde» (`rin-lab.html`) en un solo HTML, con estilos, fuente y código
 * adentro, para compartirlo sin servidor. Uso: `node scripts/build-rin-lab.mjs salida.html [entrada.html]` (por defecto `rin-lab.html`; el laboratorio es `rin-taller.html`).
 * No forma parte del build de la app.
 */
const [out, entry = 'rin-lab.html'] = process.argv.slice(2);
if (!out) throw new Error('Falta el archivo de salida: node scripts/build-rin-lab.mjs salida.html');

const root = fileURLToPath(new URL('..', import.meta.url));
const { output } = await build({
  root,
  configFile: false,
  logLevel: 'warn',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.join(root, 'src') } },
  build: {
    write: false,
    cssCodeSplit: false,
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
    rollupOptions: { input: path.join(root, entry), output: { inlineDynamicImports: true } },
  },
});

const title = (await readFile(path.join(root, entry), 'utf8')).match(/<title>(.*?)<\/title>/)[1];
const js = output.find((file) => file.type === 'chunk').code.replaceAll('</script', '<\\/script');
const css = output.find((file) => file.fileName.endsWith('.css')).source;
await writeFile(out, `<meta charset="utf-8" />
<title>${title}</title>\n<style>${css}</style>\n<div id="root"></div>\n<script type="module">${js}</script>\n`);
console.log(`${out}: ${Math.round((js.length + css.length) / 1024)} KB`);
