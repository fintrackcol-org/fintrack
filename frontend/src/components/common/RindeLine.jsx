import { cn } from '@/lib/utils';

/**
 * Línea que rinde: la barra con la moneda verde al final (manual de marca Rinde). Decorativa: quien
 * la usa dice el avance en texto. `tone="brand"` va sobre fondo violeta; `"surface"`, sobre blanco.
 * @param {{ value: number, tone?: 'brand'|'surface', className?: string }} props `value` de 0 a 1.
 */
export default function RindeLine({ value, tone = 'brand', className }) {
  const width = `${Math.round(Math.min(Math.max(value, 0), 1) * 100)}%`;
  return (
    <span aria-hidden="true" className={cn('relative block h-1 rounded-full', tone === 'brand' ? 'bg-white/30' : 'bg-ink/10', className)}>
      <span
        className={cn(
          'absolute inset-y-0 left-0 rounded-full motion-safe:transition-[width] motion-safe:duration-500',
          tone === 'brand' ? 'bg-white' : 'bg-brand',
        )}
        style={{ width }}
      />
      <span
        className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-success"
        style={{ left: width }}
      />
    </span>
  );
}
