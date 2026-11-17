import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Configuración de Vite. El plugin de React habilita JSX y Fast Refresh;
 * el de Tailwind compila las utilidades de `src/index.css`.
 * El alias `@` apunta a `src/` (convención de shadcn/ui).
 * `vite-plugin-pwa` genera el service worker y el manifest (íconos y colores en `public/icons`).
 * @see https://vitejs.dev/config/
 */
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
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
    // Junta los chunks diminutos (cada ícono de lucide salía en su propio archivo de ~1 KB):
    // menos peticiones antes del primer pintado. Valor en bytes sin comprimir.
    rollupOptions: { output: { experimentalMinChunkSize: 20_000 } },
  },
})
