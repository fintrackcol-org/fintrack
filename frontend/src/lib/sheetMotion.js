import useMediaQuery from '@/hooks/useMediaQuery';

/** Curva tipo iOS para hojas y ventanas: arranca rápido y frena suave. */
const EASE_DRAWER = [0.32, 0.72, 0, 1];

const PHONE = {
  initial: { y: '100%' },
  animate: { y: 0 },
  // Sale hacia abajo desde donde esté y con la velocidad del dedo (FT-0050): un resorte la hereda,
  // así que no hay un "corte" entre arrastrar y cerrarse.
  exit: { y: '100%', transition: { type: 'spring', bounce: 0, duration: 0.3 } },
  transition: { type: 'spring', bounce: 0, duration: 0.4 },
};

const WIDE = {
  initial: { opacity: 0, y: 24, scale: 0.98 },
  animate: { opacity: 1, y: 0, scale: 1 },
  exit: { opacity: 0, y: 12, scale: 0.98, transition: { duration: 0.16 } },
  transition: { duration: 0.26, ease: EASE_DRAWER },
};

/** Movimiento de una ventana: hoja que sube en el celular, aparece centrada desde tablet. */
export default function useSheetMotion() {
  return useMediaQuery('(width < 48rem)') ? PHONE : WIDE;
}
