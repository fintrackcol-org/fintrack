import { cn } from '@/lib/utils';

/**
 * Control de opciones excluyentes, en una sola franja (Gasto | Ingreso, Semana | Mes | Año). La pieza
 * blanca se desliza hasta la opción elegida.
 * @param {{ label: string, options: Array<{ value: string, label: string }>, value: string, onChange: (value: string) => void, className?: string }} props
 */
export default function Segmented({ label, options, value, onChange, className }) {
  const count = options.length;
  const index = options.findIndex((option) => option.value === value);
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('relative grid gap-1 rounded-xl bg-ink/5 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0, 1fr))` }}
    >
      {index >= 0 && (
        <span
          aria-hidden="true"
          // Se mueve con transform (no con left): cada paso es su propio ancho más el espacio entre opciones.
          className="absolute inset-y-1 left-1 rounded-[9px] bg-surface shadow-sm motion-safe:transition-transform motion-safe:duration-200 motion-safe:ease-[cubic-bezier(0.23,1,0.32,1)]"
          style={{
            width: `calc((100% - 0.5rem - ${(count - 1) * 0.25}rem) / ${count})`,
            transform: `translateX(calc(${index} * (100% + 0.25rem)))`,
          }}
        />
      )}
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'relative h-11 rounded-[9px] text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet',
            value === option.value ? 'text-ink' : 'text-ink/70',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
