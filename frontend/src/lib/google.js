import { API_V1 } from "@/lib/api";

/**
 * Carga de Google Identity Services (GIS), la librería de Google que muestra el botón
 * "Continuar con Google" y entrega un `credential` (id_token) firmado. El backend lo verifica
 * en `POST /auth/google`; aquí no se maneja ningún secreto.
 */

/** ID de cliente OAuth de Google (`VITE_GOOGLE_CLIENT_ID`); vacío si no está configurado. */
export const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "";

/**
 * A dónde vuelve Google en modo redirección (app instalada). Debe estar en los "URI de
 * redireccionamiento autorizados" del cliente OAuth en Google Cloud Console.
 */
export const GOOGLE_REDIRECT_URI = `${API_V1}/auth/google/redirect`;

const SCRIPT_SRC = "https://accounts.google.com/gsi/client";

/** @type {Promise<any>|null} */
let loading = null;

/**
 * Carga el script de Google una sola vez.
 * @returns {Promise<any>} `window.google` (con `accounts.id`).
 * @throws {Error} Si el script no se pudo cargar (sin conexión o bloqueado por el navegador).
 */
export function loadGoogleIdentity() {
  if (window.google?.accounts?.id) return Promise.resolve(window.google);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = SCRIPT_SRC;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.google);
      script.onerror = () => {
        loading = null; // permite reintentar
        script.remove();
        reject(new Error("No pudimos cargar Google. Revisa tu conexión."));
      };
      document.head.appendChild(script);
    });
  }
  return loading;
}

/**
 * ¿La página está abierta en el navegador interno de una app (WhatsApp, Instagram, Facebook,
 * TikTok…)? Ahí la ventana de Google no puede devolver el `credential` a la página y queda en
 * blanco, aunque Google ya registró el acceso.
 * @param {string} [ua] User agent; por defecto el del navegador.
 * @returns {'android'|'ios'|null} El sistema si es un navegador interno; `null` si es uno normal.
 */
export function inAppBrowser(ua = navigator.userAgent) {
  const named = /WhatsApp|Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|musical_ly|BytedanceWebview|Snapchat/i.test(ua);
  if (/Android/i.test(ua)) return named || /; wv\)/.test(ua) ? "android" : null;
  // En iOS los navegadores de verdad dicen "Safari/" (Chrome y Firefox también); las vistas web de las apps no.
  if (/iPhone|iPad|iPod/i.test(ua)) return named || !/Safari\//.test(ua) ? "ios" : null;
  return named ? "android" : null;
}

/**
 * Enlace que abre la dirección actual en Chrome desde un navegador interno de Android.
 * @param {Location} [loc]
 * @returns {string}
 */
export function chromeIntentUrl(loc = window.location) {
  const fallback = encodeURIComponent(loc.href);
  return `intent://${loc.host}${loc.pathname}${loc.search}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${fallback};end`;
}

/**
 * ¿Rinde está abierta como app instalada (agregada a inicio)? Ahí la ventana emergente de Google
 * no puede devolver el `credential` y queda en blanco, así que se entra en modo redirección.
 * @returns {boolean}
 */
export function isInstalledApp() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

const NONCE_KEY = "rinde:googleNonce";

/**
 * Crea y guarda el `nonce` que Google firma dentro del token en modo redirección. Al volver se
 * compara: así nadie puede meter a otra persona en su cuenta mandándole su propio token.
 * @returns {string}
 */
export function newGoogleNonce() {
  const nonce = crypto.randomUUID();
  try {
    localStorage.setItem(NONCE_KEY, nonce);
  } catch {
    // Sin almacenamiento la vuelta fallará con un mensaje claro.
  }
  return nonce;
}

/**
 * Devuelve el `nonce` guardado y lo borra (sirve una sola vez).
 * @returns {string|null}
 */
export function takeGoogleNonce() {
  try {
    const nonce = localStorage.getItem(NONCE_KEY);
    localStorage.removeItem(NONCE_KEY);
    return nonce;
  } catch {
    return null;
  }
}

/**
 * Lee el `nonce` de un id_token sin verificarlo (la firma la verifica el backend).
 * @param {string} credential
 * @returns {string|null}
 */
export function credentialNonce(credential) {
  try {
    const payload = credential.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload)).nonce ?? null;
  } catch {
    return null;
  }
}
