import { inAppBrowser } from '@/lib/google';

/**
 * Cómo se instala Rinde en el dispositivo de quien visita la landing. Rinde es una app web
 * (PWA): no está en App Store ni en Google Play, y cada navegador la instala distinto.
 *
 * - `ios`: Safari, Chrome o Firefox en iPhone/iPad. No hay botón posible: se agrega desde Compartir.
 * - `ios-inapp` / `android-inapp`: el navegador interno de WhatsApp, Instagram, TikTok…, que no
 *   instala; primero hay que abrir la página en Safari o en Chrome.
 * - `android`: navegador de Android que aún no ofreció su botón (o no lo ofrece): desde su menú.
 * - `mac-safari`: Safari en Mac (desde macOS Sonoma): Archivo → Agregar al Dock.
 * - `other`: el resto (p. ej. Firefox en computador, que no instala apps web).
 * El caso con botón propio (`beforeinstallprompt`) lo decide `useInstallPrompt`, no esta función.
 *
 * @param {string} [ua] User agent.
 * @param {number} [touchPoints] `navigator.maxTouchPoints`: el iPad se presenta como Mac.
 * @returns {'ios'|'ios-inapp'|'android'|'android-inapp'|'mac-safari'|'other'}
 */
export function installPlatform(ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints ?? 0) {
  const inApp = inAppBrowser(ua);
  if (inApp) return `${inApp}-inapp`;
  const mac = /Macintosh/i.test(ua);
  if (/iPhone|iPad|iPod/i.test(ua) || (mac && touchPoints > 1)) return 'ios';
  if (/Android/i.test(ua)) return 'android';
  if (mac && /Safari\//.test(ua) && !/Chrome\/|Chromium\/|Edg\/|Firefox\//.test(ua)) return 'mac-safari';
  return 'other';
}

/** Título y pasos para cada caso. Los nombres de los botones son los de cada sistema en español. */
export const INSTALL_GUIDES = {
  prompt: {
    title: 'En este dispositivo',
    steps: ['Toca «Instalar app».', 'Confirma en la ventana del navegador.', 'Ábrela desde tu pantalla de inicio, incluso sin internet.'],
  },
  ios: {
    title: 'En tu iPhone o iPad',
    steps: [
      'Toca el botón Compartir del navegador (en Safari puede estar dentro del menú «···»).',
      'Elige «Agregar a Inicio». Si no aparece, baja hasta «Editar acciones» y actívalo.',
      'Deja activo «Abrir como app web», si aparece, y toca «Agregar».',
    ],
  },
  'ios-inapp': {
    title: 'En tu iPhone o iPad',
    steps: [
      'Estás en el navegador de otra app, que no instala apps: toca «···» y elige «Abrir en Safari».',
      'En Safari, toca Compartir y elige «Agregar a Inicio».',
      'Ábrela desde tu pantalla de inicio, incluso sin internet.',
    ],
  },
  android: {
    title: 'En tu Android',
    steps: [
      'Abre el menú del navegador (los tres puntos ⋮).',
      'Toca «Instalar app» o «Agregar a la pantalla principal».',
      'Ábrela desde tu pantalla de inicio, incluso sin internet.',
    ],
  },
  'android-inapp': {
    title: 'En tu Android',
    steps: [
      'Estás en el navegador de otra app, que no instala apps: ábrela en Chrome con el botón de abajo.',
      'En Chrome, toca «Instalar app» o búscalo en el menú (⋮).',
      'Ábrela desde tu pantalla de inicio, incluso sin internet.',
    ],
  },
  'mac-safari': {
    title: 'En tu Mac, con Safari',
    steps: ['En la barra de menús, abre «Archivo».', 'Elige «Agregar al Dock».', 'Ábrela desde el Dock como cualquier otra app.'],
  },
  other: {
    title: 'En cualquier dispositivo',
    steps: [
      'Úsala aquí mismo en el navegador, sin descargar nada.',
      'En el celular, agrégala a tu pantalla de inicio desde el navegador.',
      'Funciona incluso sin internet.',
    ],
  },
};
