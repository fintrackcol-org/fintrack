import { sep } from 'node:path';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/** Página de cada ruta principal: sus archivos se piden desde el HTML, sin esperar a React. */
const ROUTE_PAGES = {
  '/': 'src/pages/Home.jsx',
  '/login': 'src/pages/auth/Login.jsx',
  '/registro': 'src/pages/auth/Register.jsx',
  '/app': 'src/pages/app/Dashboard.jsx',
  '/app/movimientos': 'src/pages/app/Movements.jsx',
  '/app/anotar': 'src/pages/app/Anotar.jsx',
  '/app/presupuestos': 'src/pages/app/Budgets.jsx',
};
/** Lo que `main.jsx` importa siempre, y el marco que solo se usa bajo `/app`. */
const ALWAYS = ['src/App.jsx', 'src/auth/AuthContext.jsx'];
const SHELL = 'src/components/layout/AppShell.jsx';

/**
 * Precarga por ruta (auditoría H4). La app baja en cadena: entrada → App → marco → página, y cada
 * salto es una ida y vuelta al servidor. Este plugin anota en el HTML qué archivos necesita cada
 * ruta principal y un script mínimo los pide todos a la vez con `modulepreload` (descarga sin
 * ejecutar: el orden de arranque no cambia). También abre antes la conexión con la API.
 * shortcut: solo las rutas de `ROUTE_PAGES`; las demás cargan como antes. Agrega aquí las nuevas.
 * @param {string} apiUrl Origen de la API para el `preconnect`.
 * @returns {import('vite').Plugin}
 */
function routePreload(apiUrl) {
  return {
    name: 'rinde-route-preload',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html, { bundle }) {
        const chunks = Object.values(bundle).filter((c) => c.type === 'chunk');
        const entry = chunks.find((c) => c.isEntry);
        // Archivos de `source` y todo lo que importa de forma estática, menos lo que ya trae la entrada.
        const skip = new Set([entry.fileName, ...entry.imports]);
        const filesOf = (source) => {
          const start = chunks.find((c) => c.moduleIds.some((id) => id.split(sep).join('/').endsWith(source)));
          if (!start) throw new Error(`routePreload: no hay archivo para ${source}`);
          const seen = new Set();
          const walk = (name) => {
            if (seen.has(name) || skip.has(name)) return;
            seen.add(name);
            bundle[name].imports.forEach(walk);
          };
          walk(start.fileName);
          return [...seen];
        };
        const map = {
          all: [...new Set(ALWAYS.flatMap(filesOf))],
          shell: filesOf(SHELL),
          routes: Object.fromEntries(Object.entries(ROUTE_PAGES).map(([path, source]) => [path, filesOf(source)])),
        };
        const script =
          `(function(m){var p=location.pathname;if(p.length>1&&p.slice(-1)==='/')p=p.slice(0,-1);` +
          `m.all.concat(p.indexOf('/app')===0?m.shell:[],m.routes[p]||[]).forEach(function(f){` +
          `var l=document.createElement('link');l.rel='modulepreload';l.href='/'+f;document.head.appendChild(l)})})(${JSON.stringify(map)})`;
        return {
          html,
          tags: [
            { tag: 'link', attrs: { rel: 'preconnect', href: apiUrl, crossorigin: true }, injectTo: 'head' },
            { tag: 'script', children: script, injectTo: 'head' },
          ],
        };
      },
    },
  };
}

/**
 * Configuración de Vite. El plugin de React habilita JSX y Fast Refresh;
 * el de Tailwind compila las utilidades de `src/index.css`.
 * El alias `@` apunta a `src/` (convención de shadcn/ui).
 * `vite-plugin-pwa` genera el service worker y el manifest (íconos y colores en `public/icons`).
 * @see https://vitejs.dev/config/
 */
export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // Mismo valor por defecto que `src/lib/api.js` (RENDER_API_URL).
    routePreload(loadEnv(mode, process.cwd()).VITE_API_URL || 'https://api.rindecol.online'),
    VitePWA({
      // `prompt`: la versión nueva queda esperando y la app avisa "Hay una versión nueva · Actualizar"
      // (components/common/UpdatePrompt.jsx), que también se encarga de registrar el service worker.
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Rinde',
        short_name: 'Rinde',
        description:
          'Registra tus gastos, controla tu presupuesto y sincroniza tus finanzas, incluso sin conexión.',
        lang: 'es',
        start_url: '/app',
        scope: '/',
        display: 'standalone',
        // Sin bloquear la orientación: en tablet y computador la app también se usa horizontal.
        orientation: 'any',
        categories: ['finance', 'productivity'],
        // Android arma la pantalla de carga con este fondo, el nombre y el ícono de 512 px.
        theme_color: '#000000',
        background_color: '#000000',
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
        // Accesos directos al mantener presionado el ícono (Android) o con clic derecho (Windows/macOS).
        shortcuts: [
          {
            name: 'Anotar un gasto',
            short_name: 'Gasto',
            url: '/app/anotar?tipo=gasto',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Anotar un ingreso',
            short_name: 'Ingreso',
            url: '/app/anotar?tipo=ingreso',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Movimientos',
            url: '/app/movimientos',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
          {
            name: 'Presupuestos',
            url: '/app/presupuestos',
            icons: [{ src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' }],
          },
        ],
        // Capturas para la ventana de instalación más completa (Chrome en Android y escritorio).
        screenshots: [
          {
            src: '/screenshots/inicio-celular.png',
            sizes: '780x1688',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Inicio: cuánto te queda y hasta cuándo te alcanza',
          },
          {
            src: '/screenshots/inicio-escritorio.png',
            sizes: '1280x860',
            type: 'image/png',
            form_factor: 'wide',
            label: 'Inicio en el computador',
          },
        ],
      },
      workbox: {
        // Manejadores de notificaciones push (public/push-sw.js), importados por el service worker.
        importScripts: ['push-sw.js'],
        globPatterns: ['**/*.{js,css,html,svg,webp,png,woff2}'],
        // Las pantallas de carga de iOS las lee el sistema; no hace falta precachearlas.
        // Las capturas solo las usa la ventana de instalación: no van al precache.
        globIgnores: ['**/mockServiceWorker.js', 'splash/**', 'screenshots/**'],
        navigateFallback: '/index.html',
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  build: {
    // Cada ícono de lucide salía en su propio archivo de ~1 KB: van juntos en uno. Antes se usaba
    // `experimentalMinChunkSize`, pero pegaba módulos compartidos a páginas enteras y el login
    // terminaba bajando Notificaciones y Dexie (266 KB gzip de JS; auditoría H4).
    rollupOptions: { output: { manualChunks: (id) => (id.includes('lucide-react') ? 'icons' : undefined) } },
  },
}))
