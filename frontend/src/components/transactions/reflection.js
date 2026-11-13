import { Annoyed, Frown, Laugh, Meh } from 'lucide-react';

/**
 * Emociones y Kakeibo de un gasto (FT-0070). Las claves son las mismas de la API
 * (`emotion` y `kakeibo` en `docs/api/openapi.yaml`); aquí van el texto y el ícono de cada una.
 */

/** Las 4 caras de "¿Cómo te sentiste?", de la mejor a la peor. */
export const EMOTIONS = [
  { key: 'valio_la_pena', label: 'Valió la pena', icon: Laugh },
  { key: 'normal', label: 'Normal', icon: Meh },
  { key: 'no_lo_necesitaba', label: 'No lo necesitaba', icon: Annoyed },
  { key: 'me_arrepiento', label: 'Me arrepiento', icon: Frown },
];

/** Los 4 grupos del método Kakeibo, con una pista corta para elegir. */
export const KAKEIBO = [
  {
    key: 'necesidad',
    label: 'Necesidad',
    hint: 'Lo que no puedes dejar: comida, arriendo, transporte.',
  },
  {
    key: 'deseo',
    label: 'Deseo',
    hint: 'Gustos que podrías recortar: domicilios, ropa, salidas.',
  },
  {
    key: 'cultura',
    label: 'Cultura',
    hint: 'Lo que te hace crecer: libros, cursos, museos.',
  },
  {
    key: 'imprevisto',
    label: 'Imprevisto',
    hint: 'Lo que no estaba en los planes: un arreglo, una multa.',
  },
];

/** @param {string|null|undefined} key */
export const emotionOf = (key) => EMOTIONS.find((e) => e.key === key) ?? null;

/** @param {string|null|undefined} key */
export const kakeiboOf = (key) => KAKEIBO.find((k) => k.key === key) ?? null;

/**
 * El cambio que se envía al tocar una opción: tocar la que ya está elegida la quita (`null`).
 * @param {string|null|undefined} current
 * @param {string} picked
 * @returns {string|null}
 */
export const toggle = (current, picked) => (current === picked ? null : picked);
