/**
 * Borrador de la bienvenida: en qué pantalla va la persona y lo que ya respondió, guardado en su
 * dispositivo hasta que termine. Así no pierde nada si la página se recarga (al cambiar de idioma),
 * si se queda sin conexión al guardar o si cierra la app a la mitad.
 *
 * Son respuestas aproximadas, nunca movimientos: solo llegan al servidor cuando la persona termina.
 */
const key = (userId) => `rinde.bienvenida.${userId}`;

/**
 * @param {string} userId
 * @returns {Record<string, any>} `{}` si no hay borrador, si está dañado o si no hay almacenamiento.
 */
export function loadDraft(userId) {
  try {
    const draft = JSON.parse(localStorage.getItem(key(userId)));
    return draft && typeof draft === 'object' && !Array.isArray(draft) ? draft : {};
  } catch {
    return {};
  }
}

/**
 * @param {string} userId
 * @param {Record<string, any>} draft
 */
export function saveDraft(userId, draft) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(draft));
  } catch {
    // Sin almacenamiento (modo privado): las respuestas duran mientras la página siga abierta.
  }
}

/** @param {string} userId */
export function clearDraft(userId) {
  try {
    localStorage.removeItem(key(userId));
  } catch {
    // Nada que borrar.
  }
}
