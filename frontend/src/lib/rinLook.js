
import { t } from '@/lib/i18n';/**
 * Cómo se ve el Rin de cada persona: nombre, color, sombrero, franja y gafas. Es solo apariencia:
 * no cambia lo que Rin dice ni lo que calcula Mi plata. Se guarda en el dispositivo (`useRinLook`).
 */

/**
 * Colores para elegir. Cada uno trae el cuerpo, su luz, su sombra, la franja y las mejillas. El
 * violeta con franja menta es el de la marca y el inicial.
 */
export const COLORS = [
  { id: 'violeta', name: t('Violeta'), body: '#7b5cff', light: '#ab95ff', dark: '#5a3ee6', band: '#5fe3b6', cheek: '#5fe3b6' },
  { id: 'lavanda', name: t('Lavanda'), body: '#8ea2ff', light: '#bfcaff', dark: '#6276e0', band: '#5fe3b6', cheek: '#7ff0cb' },
  { id: 'menta', name: t('Menta'), body: '#45d3a6', light: '#93f2d3', dark: '#1fa97f', band: '#6142ff', cheek: '#ff9db5' },
  { id: 'coral', name: t('Coral'), body: '#ff8573', light: '#ffb7ab', dark: '#e05a48', band: '#5fe3b6', cheek: '#ffd0a6' },
  { id: 'sol', name: t('Sol'), body: '#ffbe3d', light: '#ffdf94', dark: '#e09410', band: '#6142ff', cheek: '#ff8f6b' },
  { id: 'cielo', name: t('Cielo'), body: '#52b4ff', light: '#a0d8ff', dark: '#2b8adb', band: '#5fe3b6', cheek: '#8ff0cf' },
];

/** Lo que Rin puede llevar en la cabeza. */
export const HATS = [
  { id: 'ninguno', name: t('Nada') },
  { id: 'gorra', name: t('Gorra') },
  { id: 'vueltiao', name: t('Vueltiao') },
  { id: 'audifonos', name: t('Audífonos') },
];

/** Dibujo de la franja del cuerpo. */
export const BANDS = [
  { id: 'lisa', name: t('Lisa') },
  { id: 'rayas', name: t('Rayas') },
  { id: 'puntos', name: t('Puntos') },
];

export const NAME_MAX = 12;

export const DEFAULT_LOOK = { name: t('Rin'), color: 'violeta', hat: 'ninguno', band: 'lisa', glasses: false };

const pick = (list, id, fallback) => (list.some((item) => item.id === id) ? id : fallback);

/**
 * Deja una apariencia válida a partir de lo que haya guardado (puede venir dañado o de otra versión).
 * @param {unknown} raw
 * @returns {{ name: string, color: string, hat: string, band: string, glasses: boolean }}
 */
export function cleanLook(raw) {
  const look = raw && typeof raw === 'object' ? raw : {};
  const name = typeof look.name === 'string' ? look.name.trim().slice(0, NAME_MAX) : '';
  return {
    name: name || DEFAULT_LOOK.name,
    color: pick(COLORS, look.color, DEFAULT_LOOK.color),
    hat: pick(HATS, look.hat, DEFAULT_LOOK.hat),
    band: pick(BANDS, look.band, DEFAULT_LOOK.band),
    glasses: look.glasses === true,
  };
}

/** Colores del Rin elegido. */
export const rinColors = (id) => COLORS.find((color) => color.id === id) ?? COLORS[0];
