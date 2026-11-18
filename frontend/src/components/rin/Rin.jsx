import { useId } from 'react';
import { cn } from '@/lib/utils';
import { STACK_STEPS } from '@/lib/rin';
import { DEFAULT_LOOK, rinColors } from '@/lib/rinLook';
import { t } from '@/lib/i18n';
import './rin.css';

/** Medidas en unidades del dibujo: alto de un billete de la pila y suelo. */
const BILL_H = 13;
const GROUND = 266;

/** Ningún billete cae derecho: cuánto llega torcido, hasta que Rin los acomoda. */
const CROOKED = [0, 5, -6, 4, -5, 6];

/** Tinta de ojos, cejas y accesorios; boca y lengua. Iguales para todos los colores. */
const INK = '#1c1630';
const MOUTH = '#3a1a4f';
const TONGUE = '#ff7aa8';
const BILL = { top: '#8ff0cf', side: '#3fcf9f', line: '#22b386' };

const LINE = { fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };
/** Silueta: ovalada, compacta y un poco más ancha abajo. */
const BODY = 'M0 -128C33 -128 49 -99 52 -60C55 -22 43 -6 0 -6C-43 -6 -55 -22 -52 -60C-49 -99 -33 -128 0 -128Z';
const ARM = 'M-8.5 0C-8.5 -6 8.5 -6 8.5 0L7.5 19C7.5 30 -7.5 30 -7.5 19Z';

/** Lo que lleva en la cabeza (la coronilla está en y = -128). */
function Hat({ hat }) {
  if (hat === 'gorra') {
    return (
      <g>
        <path d="M-36 -111C-37 -147 37 -147 36 -111Z" fill={BILL.side} />
        <path d="M14 -117Q50 -122 64 -107Q44 -110 14 -109Z" fill={BILL.line} />
        <circle cy="-138" r="3.4" fill={BILL.top} />
      </g>
    );
  }
  if (hat === 'vueltiao') {
    return (
      <g>
        <ellipse cy="-112" rx="60" ry="9.5" fill="#f3e6c4" />
        <ellipse cy="-112" rx="51" ry="6" fill="none" stroke={INK} strokeWidth="2.4" strokeDasharray="5 5" />
        <path d="M-32 -113C-33 -147 33 -147 32 -113Z" fill="#f3e6c4" />
        <path d="M-30 -121Q0 -127 30 -121M-26 -130Q0 -136 26 -130" stroke={INK} strokeWidth="2.6" {...LINE} />
      </g>
    );
  }
  if (hat === 'audifonos') {
    return (
      <g>
        <path d="M-50 -84C-58 -150 58 -150 50 -84" stroke={INK} strokeWidth="6" {...LINE} />
        <rect x="-61" y="-100" width="15" height="30" rx="7" fill={BILL.side} />
        <rect x="46" y="-100" width="15" height="30" rx="7" fill={BILL.side} />
      </g>
    );
  }
  return null;
}

/**
 * Rin, la mascota de Rinde: una criaturita ovalada y blandita, con la moneda del logo en la antena
 * y una franja alrededor del cuerpo, parada sobre su pila de billetes. Solo dibuja; la emoción, el
 * gesto y el nivel se los dicen (`hooks/useRin`, `lib/rin`). Cada parte se coloca con un
 * `<g transform>` y se mueve con CSS sobre su propio origen (`rin.css`), así un cambio de emoción
 * es una transición y no un cambio de imagen.
 *
 * Rin nunca se estira: sube o baja porque su pila gana o pierde billetes.
 *
 * @param {object} props
 * @param {string} [props.emotion] Una de `EMOTIONS`.
 * @param {string|null} [props.gesture] Una de `GESTURES`, o `null` en reposo.
 * @param {number} [props.level] Billetes en la pila, de 0 a 6.
 * @param {number} [props.tidy] Cuántos billetes ya están acomodados (desde abajo).
 * @param {{ name: string, color: string, hat: string, band: string, glasses: boolean }} [props.look] Apariencia elegida.
 * @param {{ x: number, y: number }|null} [props.gaze] Hacia dónde mira, de -1 a 1; `null` mira solo.
 * @param {boolean} [props.motion] `false` quita los movimientos y deja cambios breves.
 * @param {boolean} [props.paused] Detiene las animaciones (fuera de pantalla).
 * @param {boolean} [props.settled] `false` coloca todo sin animar (primera carga).
 * @param {boolean} [props.compact] Solo Rin, sin pila (tamaños pequeños).
 * @param {string} [props.label] Texto para lector de pantalla; sin él, el dibujo es decorativo.
 * @param {string} [props.className]
 */
export default function Rin({
  emotion = 'tranquilo',
  gesture = null,
  level = 0,
  tidy = 0,
  look = DEFAULT_LOOK,
  gaze = null,
  motion = true,
  paused = false,
  settled = true,
  compact = false,
  label,
  className,
}) {
  const id = useId();
  const colors = rinColors(look.color);
  const bills = compact ? 0 : level;
  const tallHat = look.hat === 'gorra' || look.hat === 'vueltiao';

  return (
    <svg
      viewBox={compact ? '14 84 172 194' : '0 -14 200 290'}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      data-emotion={emotion}
      data-gesture={gesture ?? undefined}
      data-motion={motion ? 'on' : 'off'}
      data-paused={paused}
      data-settled={settled}
      className={cn('rin', className)}
    >
      <defs>
        <radialGradient id={`${id}-cuerpo`} cx="0.34" cy="0.24" r="0.95">
          <stop offset="0" stopColor={colors.light} />
          <stop offset="0.5" stopColor={colors.body} />
          <stop offset="1" stopColor={colors.dark} />
        </radialGradient>
        <clipPath id={`${id}-silueta`}>
          <path d={BODY} />
        </clipPath>
      </defs>

      <ellipse cx="100" cy={GROUND + 3} rx="64" ry="6" className="rin-shadow fill-ink/15" />

      {/* Pila de billetes: el progreso. */}
      <g transform={`translate(100 ${GROUND})`}>
        <g className="rin-pile">
          {STACK_STEPS.map((_, index) => (
            <g key={index} transform={`translate(0 ${-(index + 1) * BILL_H})`}>
              <g className="rin-bill" data-on={index < bills} style={{ '--x': `${index < tidy ? 0 : CROOKED[index]}px` }}>
                <rect x="-66" y="1" width="132" height={BILL_H} rx="5.5" fill={BILL.side} />
                <rect x="-66" width="132" height={BILL_H - 3.5} rx="5" fill={BILL.top} />
                <rect x="-22" y="2.6" width="44" height="3" rx="1.5" fill={BILL.line} opacity="0.55" />
              </g>
            </g>
          ))}
        </g>
      </g>

      <g className="rin-rise" style={{ transform: `translate(100px, ${GROUND - bills * BILL_H}px)` }}>
        <g className="rin-act">
          <g className="rin-breath">
            <g className="rin-tilt">
              {/* Pies redondos. */}
              <ellipse cx="-22" cy="-3.5" rx="16" ry="9.5" fill={colors.dark} />
              <ellipse cx="22" cy="-3.5" rx="16" ry="9.5" fill={colors.dark} />

              {/* Antena corta con la moneda. Las rayitas salen cuando algo sale bien. */}
              <g transform={`translate(4 ${tallHat ? -142 : -126})`}>
                <g className="rin-antenna">
                  <g className="rin-sway">
                    <path d="M0 2C-1 -8 6 -14 13 -17" stroke="#1f7a5c" strokeWidth="3.6" {...LINE} />
                    <g transform="translate(20 -27)">
                      <g className="rin-coin">
                        <circle r="14" fill={BILL.line} />
                        <circle r="11.4" fill={BILL.top} />
                        <text y="6" textAnchor="middle" fontSize="17" fontWeight="800" fill="#17805c">
                          $
                        </text>
                      </g>
                    </g>
                  </g>
                </g>
              </g>
              <g className="fill-none stroke-amber-400" strokeWidth="4" strokeLinecap="round" transform="translate(62 -112)">
                {['M0 0L10 -9', 'M5 9L19 5', 'M4 20L16 24'].map((dash, n) => (
                  <path key={dash} d={dash} className="rin-spark" style={{ '--n': n }} />
                ))}
              </g>

              {/* Cuerpo blandito: luz arriba a la izquierda, sombra abajo, y la franja. */}
              <path d={BODY} fill={`url(#${id}-cuerpo)`} />
              <g clipPath={`url(#${id}-silueta)`}>
                <path d="M-60 -50Q0 -38 60 -50V-37Q0 -25 -60 -37Z" fill={colors.band} />
                {look.band === 'rayas' &&
                  Array.from({ length: 10 }, (_, n) => (
                    <path key={n} d={`M${-58 + n * 13} -30L${-50 + n * 13} -52`} stroke="#fff" strokeOpacity="0.5" strokeWidth="3.4" />
                  ))}
                {look.band === 'puntos' &&
                  Array.from({ length: 9 }, (_, n) => <circle key={n} cx={-48 + n * 12} cy={-38 - Math.abs(4 - n) * 1.1} r="2.6" fill="#fff" fillOpacity="0.65" />)}
                <ellipse cx="-22" cy="-102" rx="17" ry="24" fill="#fff" opacity="0.14" transform="rotate(24 -22 -102)" />
              </g>

              <Hat hat={look.hat} />

              <g className="rin-zzz" transform="translate(50 -124)" fill="#fff" fontWeight="800" aria-hidden="true">
                <text fontSize="16">{t('z')}</text>
                <text x="12" y="-13" fontSize="12">{t('z')}</text>
              </g>

              {/* Cara: ojos negros con un brillo, mejillas menta, cejas discretas y una boca flexible. */}
              <ellipse cx="-37" cy="-71" rx="8.5" ry="5.2" fill={colors.cheek} className="rin-blush" />
              <ellipse cx="37" cy="-71" rx="8.5" ry="5.2" fill={colors.cheek} className="rin-blush" />
              <g className="rin-pupil" style={gaze ? { '--lx': `${gaze.x * 3.5}px`, '--ly': `${gaze.y * 3}px` } : undefined}>
                <g className={gaze ? undefined : 'rin-glance'}>
                  {[-19, 19].map((x) => (
                    <g key={x} transform={`translate(${x} -88)`}>
                      <g className={`rin-eye rin-eye-${x < 0 ? 'l' : 'r'}`}>
                        <g className="rin-eye-open">
                          <g className="rin-blink">
                            <ellipse rx="9.2" ry="10.6" fill={INK} />
                            <circle cx="3.2" cy="-3.8" r="3.3" fill="#fff" />
                            <circle cx="-3" cy="4.2" r="1.5" fill="#fff" className="rin-eye-wet" />
                          </g>
                        </g>
                        <path d="M-8.5 3Q0 -8.5 8.5 3" stroke={INK} strokeWidth="3.6" className="rin-eye-joy" {...LINE} />
                        <path d="M-8.5 -1Q0 6 8.5 -1" stroke={INK} strokeWidth="3.6" className="rin-eye-shut" {...LINE} />
                      </g>
                    </g>
                  ))}
                </g>
              </g>
              {look.glasses && (
                <g stroke={INK} strokeWidth="2.8" {...LINE}>
                  <circle cx="-19" cy="-88" r="14.5" fill="#fff" fillOpacity="0.16" />
                  <circle cx="19" cy="-88" r="14.5" fill="#fff" fillOpacity="0.16" />
                  <path d="M-4.5 -90Q0 -93 4.5 -90M-33.5 -90L-49 -93M33.5 -90L49 -93" />
                </g>
              )}
              {['l', 'r'].map((side) => (
                <g key={side} transform={`translate(${side === 'l' ? -19 : 19} -105)`}>
                  <path d="M-6 0Q0 -2.6 6 0" stroke={INK} strokeWidth="3" className={`rin-brow rin-brow-${side}`} {...LINE} />
                </g>
              ))}
              <g transform="translate(0 -70)" stroke={MOUTH} strokeWidth="3.4" className="rin-mouth" {...LINE}>
                <path data-m="smile" d="M-8 -2Q0 6 8 -2" />
                <g data-m="grin">
                  <path d="M-12 -5Q0 -8 12 -5Q10 12 0 12Q-10 12 -12 -5Z" fill={MOUTH} strokeWidth="1.6" />
                  <path d="M-6.5 7.5Q0 2.5 6.5 7.5Q4 11.4 0 11.4Q-4 11.4 -6.5 7.5Z" fill={TONGUE} stroke="none" />
                </g>
                <ellipse data-m="o" cy="1" rx="4.6" ry="5.8" stroke="none" fill={MOUTH} />
                <path data-m="flat" d="M-5 1L6 0" />
                <path data-m="soft" d="M-6 1.5Q0 -0.6 6 1.5" />
                <path data-m="wobble" d="M-10 -1Q-5 5 0 1Q5 5 10 -1" />
              </g>

              {/* Brazos cortos: giran desde el hombro. */}
              {['l', 'r'].map((side) => (
                <g key={side} transform={`translate(${side === 'l' ? -48 : 48} -64)`}>
                  <g className={`rin-arm rin-arm-${side}`}>
                    <g className="rin-arm-act">
                      <path d={ARM} fill={colors.body} />
                      <path d="M-7.5 17C-7.5 30 7.5 30 7.5 17C5 24 -5 24 -7.5 17Z" fill={colors.dark} opacity="0.45" />
                    </g>
                  </g>
                </g>
              ))}
            </g>
          </g>
        </g>
      </g>
    </svg>
  );
}
