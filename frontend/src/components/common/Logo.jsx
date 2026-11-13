import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

/** Color del cuadro: el de la marca y uno más claro para fondos violeta. */
const TILE = { brand: '#6142ff', light: '#a58bff' };

/**
 * Isotipo de Rinde: una "r" blanca que suelta una moneda verde, sobre un cuadro violeta.
 * `tone="light"` aclara el cuadro para que el logo resalte sobre un fondo violeta.
 * La misma geometría (cuadrícula de 32) está en `home/FlyingLogo` y `scripts/generate-icons.mjs`.
 * @param {{ className?: string, tone?: 'brand' | 'light' }} props
 */
export function LogoMark({ className, tone = 'brand' }) {
  return (
    <svg viewBox="0 0 32 32" aria-hidden="true" className={cn('size-8', className)}>
      <rect width="32" height="32" rx="8" fill={TILE[tone] ?? TILE.brand} />
      <path d="M9.75 21.5V16.25A5.75 5.75 0 0 1 15.5 10.5" fill="none" stroke="#fff" strokeWidth="4.25" strokeLinecap="round" />
      <circle cx="22" cy="10.5" r="2.375" fill="#2fd6a3" />
    </svg>
  );
}

/**
 * El nombre "rinde" dibujado (no es una fuente): la "e" se estira y el punto de la i es la moneda.
 * Toma el color del texto (`currentColor`); el alto lo pone `className`.
 * @param {{ className?: string }} props
 */
export function Wordmark({ className }) {
  return (
    <svg viewBox="16 34 608 188" aria-hidden="true" fill="currentColor" className={cn('h-[0.9em] w-auto', className)}>
      <g transform="translate(-5 3)">
        <path d="M26 110V200A14 14 0 0 0 54 200V110A14 14 0 0 0 26 110Z" />
        <path d="M26 152A56 56 0 0 1 82 96A14 14 0 0 1 82 124A28 28 0 0 0 54 152A14 14 0 0 1 26 152Z" />
        <path d="M116 110V200A14 14 0 0 0 144 200V110A14 14 0 0 0 116 110Z" />
        <path d="M166 110V200A14 14 0 0 0 194 200V110A14 14 0 0 0 166 110Z" />
        <path d="M166 155A59 59 0 0 1 284 155A14 14 0 0 1 256 155A31 31 0 0 0 194 155A14 14 0 0 1 166 155Z" />
        <path d="M256 155V200A14 14 0 0 0 284 200V155A14 14 0 0 0 256 155Z" />
        <path d="M391 50V200A14 14 0 0 0 419 200V50A14 14 0 0 0 391 50Z" />
        <path d="M455 141H545A14 14 0 0 1 545 169H455A14 14 0 0 1 455 141Z" />
        <path d="M500 214A59 59 0 1 1 559 155A14 14 0 0 1 531 155A31 31 0 1 0 500 186A14 14 0 0 1 500 214Z" />
        <path d="M500 186H610A14 14 0 0 1 610 214H500A14 14 0 0 1 500 186Z" />
        <path
          fillRule="evenodd"
          d="M301 155a59 59 0 1 0 118 0a59 59 0 1 0 -118 0ZM329 155a31 31 0 1 0 62 0a31 31 0 1 0 -62 0Z"
        />
        <circle cx="130" cy="62" r="18" fill="#2fd6a3" />
      </g>
    </svg>
  );
}

/**
 * Logo completo (isotipo + nombre) enlazado al inicio.
 * @param {{ className?: string, dark?: boolean }} props `dark` pinta el nombre negro (fondos claros).
 */
export default function Logo({ className, dark = false }) {
  return (
    <Link
      to="/"
      aria-label="Rinde, ir al inicio"
      className={cn('inline-flex items-center gap-2 text-2xl', dark ? 'text-obsidian' : 'text-white', className)}
    >
      <LogoMark />
      <Wordmark />
    </Link>
  );
}
