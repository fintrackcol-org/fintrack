/** Backend publicado en Render. */
const RENDER_API_URL = 'https://fintrack-api-2z1p.onrender.com';

/**
 * URL base del backend, sin barra final: la de `VITE_API_URL` y, si falta, la de Render en la
 * versión publicada o `http://localhost:3000` en local. Sin esto, un build de Vercel sin la
 * variable dejaba la web pidiendo todo a localhost (pasó el 16-nov-2026: Google lo rechazó).
 * @type {string}
 */
export const API_URL = (
  import.meta.env.VITE_API_URL || (import.meta.env.PROD ? RENDER_API_URL : 'http://localhost:3000')
).replace(/\/$/, '');

/**
 * Base de los endpoints versionados (`/api/v1`). `/health` queda fuera de este prefijo.
 * @type {string}
 */
export const API_V1 = `${API_URL}/api/v1`;
