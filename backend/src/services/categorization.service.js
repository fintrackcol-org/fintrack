import { listCategories } from '../repositories/categories.repository.js';
import { AppError } from '../errors/app-error.js';
import { completeText } from './ai-client.service.js';

/** Instrucciones fijas del modelo: solo puede responder con una clave del catálogo. */
const SYSTEM_PROMPT =
  'Eres un clasificador de transacciones financieras personales. ' +
  'Responde ÚNICAMENTE con la clave de una categoría de la lista, sin explicación, ' +
  'sin comillas y sin puntuación.';

/**
 * Palabras inequívocas por categoría (sin tildes, en singular). Se usan solo cuando la IA no
 * responde a tiempo o responde algo fuera del catálogo: así "bus" o "desayuno" no quedan sin
 * clasificar por un 503 o un tiempo agotado del proveedor.
 */
const KEYWORDS = {
  alimentacion: [
    'almuerzo',
    'desayuno',
    'cena',
    'comida',
    'onces',
    'empanada',
    'arroz',
    'pizza',
    'hamburguesa',
    'restaurante',
    'mercado',
    'cafe',
    'pan',
    'fruta',
    'perro',
    'arepa',
    'pollo',
  ],
  transporte: [
    'bus',
    'buseta',
    'taxi',
    'uber',
    'didi',
    'pasaje',
    'transmilenio',
    'gasolina',
    'parqueadero',
    'peaje',
    'mototaxi',
    'colectivo',
  ],
  vivienda: ['arriendo'],
  servicios_publicos: ['luz', 'agua', 'gas', 'internet'],
  salud: ['farmacia', 'drogueria', 'medicamento', 'medico', 'eps', 'odontologo'],
  educacion: ['matricula', 'fotocopia', 'libro', 'curso', 'semestre'],
  entretenimiento: ['cine', 'netflix', 'spotify', 'fiesta', 'cerveza'],
  ropa_accesorios: ['ropa', 'zapato', 'tenis', 'camisa', 'pantalon', 'camiseta'],
  salario: ['salario', 'sueldo', 'quincena', 'nomina'],
  freelance: ['freelance'],
};
const WORD_TO_KEY = new Map(
  Object.entries(KEYWORDS).flatMap(([key, words]) => words.map((word) => [word, key])),
);

/**
 * Adivina la categoría por palabras clave. Solo responde si todas las palabras reconocidas
 * apuntan a una misma categoría del catálogo del usuario; si hay dudas, devuelve null.
 * @param {string} description
 * @param {Set<string>} keys Claves válidas para el tipo del movimiento.
 * @returns {string|null}
 */
export function guessByKeyword(description, keys) {
  const words =
    description
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .match(/[a-z]+/g) ?? [];
  const found = new Set();
  for (const word of words) {
    const key =
      WORD_TO_KEY.get(word) ??
      WORD_TO_KEY.get(word.slice(0, -1)) ??
      WORD_TO_KEY.get(word.slice(0, -2));
    if (key && keys.has(key)) found.add(key);
  }
  return found.size === 1 ? [...found][0] : null;
}

/**
 * Normaliza la respuesta del modelo para compararla con el catálogo.
 * @param {string} text
 * @returns {string}
 */
function normalizeKey(text) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[\s"'`.]+/g, '');
}

/**
 * Crea el categorizador. Las dependencias se inyectan para poder probarlo sin red ni BD.
 *
 * @param {{ listCategories?: typeof listCategories, completeText?: typeof completeText }} [deps]
 * @returns {{
 *   suggestCategory: (input: { description: string, type: 'ingreso'|'gasto', userId?: string }) => Promise<{ category: string|null, source: 'ia'|'sin_clasificar' }>,
 *   resolveCategory: (input: { category?: string|null, description: string, type: 'ingreso'|'gasto', userId?: string }) => Promise<{ category: string|null, source: 'manual'|'ia'|'sin_clasificar' }>
 * }}
 */
export function createCategorizer(deps = {}) {
  const getCategories = deps.listCategories ?? listCategories;
  const ask = deps.completeText ?? completeText;

  /**
   * Pide a la IA una categoría de las que puede usar el usuario (REQ-010): las de todos y las
   * suyas. Solo se envían la descripción y las claves y nombres de las categorías: nunca monto,
   * fecha ni datos del usuario.
   * La respuesta se valida contra el catálogo (RN-02); si no es válida, o la IA no
   * está disponible, devuelve `sin_clasificar` en vez de fallar (REQ-011).
   *
   * @param {{ description: string, type: 'ingreso'|'gasto', userId?: string }} input
   * @returns {Promise<{ category: string|null, source: 'ia'|'sin_clasificar' }>}
   */
  async function suggestCategory({ description, type, userId }) {
    const catalog = (await getCategories(userId)).filter((c) => c.type === type);
    const keys = new Set(catalog.map((c) => c.key));
    const list = catalog.map((c) => `- ${c.key}: ${c.name}`).join('\n');

    // Respaldo cuando la IA falla. Cuenta como 'ia' (categoría automática): origen solo admite
    // manual, ia o sin_clasificar.
    const fallback = () => {
      const guess = guessByKeyword(description, keys);
      return guess
        ? { category: guess, source: 'ia' }
        : { category: null, source: 'sin_clasificar' };
    };

    let answer;
    try {
      answer = await ask({
        system: SYSTEM_PROMPT,
        prompt: `Categorías disponibles:\n${list}\n\nDescripción: ${description}`,
      });
    } catch (err) {
      if (err instanceof AppError && err.code === 'AI_UNAVAILABLE') {
        return fallback();
      }
      throw err;
    }

    const key = normalizeKey(answer);
    if (!keys.has(key)) {
      // Ayuda a diagnosticar: la IA respondió, pero no con una clave del catálogo.
      console.warn(
        `La IA respondió "${answer.trim().slice(0, 60)}", que no es una categoría de tipo ${type}`,
      );
      return fallback();
    }
    return { category: key, source: 'ia' };
  }

  /**
   * Punto de integración para el guardado de una transacción (REQ-010/011):
   * si el usuario eligió categoría se respeta (`manual`); si no, se pide a la IA.
   * Nunca lanza por fallos de la IA: la transacción siempre se puede guardar.
   *
   * @param {{ category?: string|null, description: string, type: 'ingreso'|'gasto', userId?: string }} input
   * @returns {Promise<{ category: string|null, source: 'manual'|'ia'|'sin_clasificar' }>}
   */
  async function resolveCategory({ category, description, type, userId }) {
    if (category) {
      return { category, source: 'manual' };
    }
    return suggestCategory({ description, type, userId });
  }

  return { suggestCategory, resolveCategory };
}

const categorizer = createCategorizer();

/** Categorizador con las dependencias reales (BD y proveedor de IA). */
export const { suggestCategory, resolveCategory } = categorizer;
