import { Annoyed, Frown, Laugh, Meh } from 'lucide-react';
import { t } from '@/lib/i18n';

/**
 * Emociones y Kakeibo de un gasto (FT-0070). Las claves son las mismas de la API
 * (`emotion` y `kakeibo` en `docs/api/openapi.yaml`); aquí van el texto y el ícono de cada una.
 */

/** Las 4 caras de "¿Cómo te sentiste?", de la mejor a la peor. */
export const EMOTIONS = [
  { key: 'valio_la_pena', label: t('Valió la pena'), icon: Laugh },
  { key: 'normal', label: t('Normal'), icon: Meh },
  { key: 'no_lo_necesitaba', label: t('No lo necesitaba'), icon: Annoyed },
  { key: 'me_arrepiento', label: t('Me arrepiento'), icon: Frown },
];

/** Los 4 grupos del método Kakeibo, con una pista corta para elegir. */
export const KAKEIBO = [
  {
    key: 'necesidad',
    label: t('Necesidad'),
    hint: t('Lo que no puedes dejar: comida, arriendo, transporte.'),
  },
  {
    key: 'deseo',
    label: t('Deseo'),
    hint: t('Gustos que podrías recortar: domicilios, ropa, salidas.'),
  },
  {
    key: 'cultura',
    label: t('Cultura'),
    hint: t('Lo que te hace crecer: libros, cursos, museos.'),
  },
  {
    key: 'imprevisto',
    label: t('Imprevisto'),
    hint: t('Lo que no estaba en los planes: un arreglo, una multa.'),
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
