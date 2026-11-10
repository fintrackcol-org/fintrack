import Panel from '@/components/layout/Panel';
import { cn } from '@/lib/utils';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/**
 * Cuadrícula de un mes, de lunes a domingo, con hoy resaltado. Cada calendario decide qué marca
 * va debajo de cada día (pagos en FT-0025, aportes y fecha límite en las vacas FT-0043).
 * @template {{ day: number, date: string, isToday: boolean, isPast: boolean }} C
 * @param {{
 *   label: string,
 *   cells: Array<C|null>,
 *   renderMark: (cell: C) => ({ text: string, className: string, title?: string }|null),
 *   className?: string,
 *   onSelect?: (cell: C) => void,
 *   cellLabel?: (cell: C) => string,
 *   footer?: React.ReactNode,
 * }} props `cells`: las de `monthCells` (o con datos extra); `null` antes del día 1. Con `onSelect`
 *   cada día es un botón y `cellLabel` es lo que anuncia el lector de pantalla. `footer`: la leyenda.
 */
export default function MonthGrid({ label, cells, renderMark, className, onSelect, cellLabel, footer }) {
  return (
    <Panel aria-label={label} className={cn('p-3 md:p-4', className)}>
      <div className="mb-2 grid grid-cols-7 text-center text-xs font-semibold text-ink/50" aria-hidden="true">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>
      <ol className="grid grid-cols-7 gap-y-1">
        {cells.map((cell, i) => {
          if (!cell) return <li key={`vacio-${i}`} aria-hidden="true" />;
          const mark = renderMark(cell);
          const content = (
            <>
              <span
                className={cn(
                  'grid size-7 place-items-center rounded-full text-sm tabular-nums',
                  cell.isToday && 'bg-violet font-bold text-white',
                  cell.isPast && !cell.isToday && 'text-ink/40',
                )}
              >
                {cell.day}
              </span>
              {mark && (
                <span className={cn('whitespace-nowrap text-[10px] font-semibold', mark.className)}>{mark.text}</span>
              )}
            </>
          );
          return (
            <li key={cell.date} className="h-12" title={mark?.title}>
              {onSelect ? (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-label={cellLabel?.(cell)}
                  onClick={() => onSelect(cell)}
                  className="flex size-full flex-col items-center gap-0.5 rounded-xl transition-colors hover:bg-ink/5 active:bg-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
                >
                  {content}
                </button>
              ) : (
                <div className="flex size-full flex-col items-center gap-0.5">{content}</div>
              )}
            </li>
          );
        })}
      </ol>
      {footer}
    </Panel>
  );
}
