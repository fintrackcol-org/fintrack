import { cn } from '@/lib/utils';

const EASE = 'motion-safe:transition-transform motion-safe:duration-300 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)]';

/**
 * Línea que rinde: la barra con la moneda verde al final (manual de marca Rinde). Decorativa: quien
 * la usa dice el avance en texto. `tone="brand"` va sobre fondo violeta; `"surface"`, sobre blanco.
 * El avance se mueve con transform (scaleX y translateX), no con width: así no recalcula el layout.
 * No recibe toques: el riel de la moneda se desplaza hacia la derecha y taparía lo que tenga al lado.
 * @param {{ value: number, tone?: 'brand'|'surface', className?: string }} props `value` de 0 a 1.
 */
export default function RindeLine({ value, tone = 'brand', className }) {
  const v = Math.min(Math.max(value, 0), 1);
  return (
    <span aria-hidden="true" className={cn('pointer-events-none relative block h-1 rounded-full', tone === 'brand' ? 'bg-white/30' : 'bg-ink/10', className)}>
      <span
        className={cn('absolute inset-0 origin-left rounded-full', tone === 'brand' ? 'bg-white' : 'bg-brand', EASE)}
        style={{ transform: `scaleX(${v})` }}
      />
      {/* El riel de la moneda mide lo mismo que la barra: el % de translateX es el avance. */}
      <span className={cn('absolute inset-0', EASE)} style={{ transform: `translateX(${v * 100}%)` }}>
        <span className="absolute left-0 top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success" />
      </span>
    </span>
  );
}
