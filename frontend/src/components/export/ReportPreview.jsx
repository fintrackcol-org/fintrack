import { useState } from 'react';
import { LogoMark } from '@/components/common/Logo';
import Segmented from '@/components/common/Segmented';
import { formatMoney } from '@/components/transactions/format';
import { cn } from '@/lib/utils';

/*
 * Vista previa del reporte antes de descargarlo (FT-0012). Cada formato se muestra como lo que es:
 * el Excel como un tablero con pestañas, el PDF como una página y el CSV como una tabla de datos.
 * Todas las cifras vienen de `GET /reports/preview`, el mismo modelo que arma los archivos.
 *
 * Color: como en los archivos, ingresos en `positive` y gastos en `brand` (ver manual visual, 8).
 * Ningún dato depende solo del color: cada barra lleva su nombre y su monto al lado.
 */

const GRANULARITY = { day: 'día', week: 'semana', month: 'mes' };
const MAX_CATEGORIES = 5;

/**
 * Los cuatro indicadores del periodo.
 * @param {{ totals: object, compact?: boolean }} props
 */
function Kpis({ totals, compact = false }) {
  const items = [
    { label: 'Ingresos', value: formatMoney(totals.income), tone: 'bg-positive/10 text-positive' },
    { label: 'Gastos', value: formatMoney(totals.expense), tone: 'bg-brand-soft text-brand' },
    { label: 'Balance neto', value: formatMoney(totals.balance), tone: cn('bg-surface-muted', totals.balance < 0 ? 'text-negative' : 'text-ink') },
    { label: 'Movimientos', value: String(totals.count), tone: 'bg-surface-muted text-ink' },
  ];
  return (
    <dl className={cn('grid grid-cols-2 gap-2', !compact && 'sm:grid-cols-4')}>
      {items.map((item) => (
        <div key={item.label} className={cn('min-w-0 rounded-lg px-3 py-2', item.tone)}>
          <dt className="text-xs text-ink/60">{item.label}</dt>
          <dd className="truncate text-[15px] font-semibold tabular-nums">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Gastos por categoría en barras horizontales (las mayores), con nombre y monto visibles.
 * @param {{ categories: Array<{ name: string, amount: number, share: number }> }} props
 */
function CategoryBars({ categories }) {
  if (categories.length === 0) return <p className="text-xs text-ink/60">Sin gastos en el periodo.</p>;
  const shown = categories.slice(0, MAX_CATEGORIES);
  const max = shown[0].amount;
  return (
    <ul className="space-y-1.5">
      {shown.map((category) => (
        <li key={category.name} className="grid grid-cols-[minmax(0,5fr)_minmax(0,4fr)_auto] items-center gap-2 text-xs">
          <span className="truncate">{category.name}</span>
          <span aria-hidden="true" className="h-2 rounded-sm bg-surface-muted">
            <span className="block h-full rounded-sm bg-brand" style={{ width: `${Math.max(2, (category.amount / max) * 100)}%` }} />
          </span>
          <span className="text-right tabular-nums text-ink/60">{formatMoney(category.amount)}</span>
        </li>
      ))}
      {categories.length > MAX_CATEGORIES && (
        <li className="text-xs text-ink/60">y {categories.length - MAX_CATEGORIES} más en el archivo</li>
      )}
    </ul>
  );
}

/**
 * Ingresos y gastos por tramo, en columnas pequeñas. Es un resumen visual: los montos exactos
 * están en la hoja Evolución del archivo, y aquí se dicen el primer y el último tramo.
 * @param {{ series: { granularity: string, points: Array<{ label: string, income: number, expense: number }> } }} props
 */
function SeriesColumns({ series }) {
  const { points } = series;
  if (points.length === 0) return <p className="text-xs text-ink/60">El periodo todavía no empieza.</p>;
  const max = Math.max(1, ...points.flatMap((p) => [p.income, p.expense]));
  const height = (value) => (value > 0 ? `${Math.max(3, (value / max) * 100)}%` : '0%');
  return (
    <div>
      <div
        role="img"
        aria-label={`Ingresos y gastos por ${GRANULARITY[series.granularity]}, del ${points[0].label} al ${points.at(-1).label}`}
        className="flex h-16 items-end gap-px border-b border-ink/10"
      >
        {points.map((point) => (
          <span key={point.label} className="flex h-full min-w-0 flex-1 items-end justify-center gap-px">
            <span className="w-1/2 max-w-2 rounded-t-[1px] bg-positive" style={{ height: height(point.income) }} />
            <span className="w-1/2 max-w-2 rounded-t-[1px] bg-brand" style={{ height: height(point.expense) }} />
          </span>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-ink/60">
        <span>{points[0].label}</span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="size-2 rounded-[2px] bg-positive" /> Ingresos
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden="true" className="size-2 rounded-[2px] bg-brand" /> Gastos
          </span>
        </span>
        <span>{points.at(-1).label}</span>
      </div>
    </div>
  );
}

/**
 * Título pequeño de un bloque de la vista previa.
 * @param {{ children: React.ReactNode }} props
 */
function BlockTitle({ children }) {
  return <h3 className="mb-2 text-xs font-semibold text-brand">{children}</h3>;
}

/**
 * Excel: el tablero de la hoja Resumen, con las pestañas del libro abajo.
 * @param {{ data: object, periodTitle: string }} props
 */
function ExcelPreview({ data, periodTitle }) {
  const sheets = ['Resumen', 'Movimientos', 'Categorías', 'Evolución', ...(data.hasBudgets ? ['Presupuestos'] : [])];
  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-surface">
      <div className="flex items-center justify-between gap-3 border-b-2 border-brand bg-canvas px-3 py-2">
        <LogoMark className="size-6" />
        <p className="min-w-0 text-right text-xs">
          <span className="block font-semibold">Reporte financiero</span>
          <span className="block truncate text-ink/60">{periodTitle}</span>
        </p>
      </div>
      <div className="space-y-4 p-3">
        <Kpis totals={data.totals} />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <BlockTitle>Gastos por categoría</BlockTitle>
            <CategoryBars categories={data.expenseByCategory} />
          </div>
          <div className="min-w-0">
            <BlockTitle>Ingresos y gastos por {GRANULARITY[data.series.granularity]}</BlockTitle>
            <SeriesColumns series={data.series} />
          </div>
        </div>
      </div>
      <ul aria-label="Hojas del libro" className="flex gap-1 overflow-x-auto border-t border-ink/10 bg-surface-muted px-2 pt-1.5 text-xs">
        {sheets.map((sheet, i) => (
          <li
            key={sheet}
            className={cn('shrink-0 rounded-t-md px-2.5 py-1.5', i === 0 ? 'bg-surface font-semibold text-brand' : 'text-ink/60')}
          >
            {sheet}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * PDF: la primera página del reporte, en miniatura.
 * @param {{ data: object, periodTitle: string, detail: boolean }} props
 */
function PdfPreview({ data, periodTitle, detail }) {
  const { count } = data.totals;
  return (
    <div className="overflow-hidden rounded-xl border border-ink/10 bg-surface">
      <div className="border-b-2 border-brand bg-canvas px-4 py-3">
        <div className="flex items-center justify-between">
          <LogoMark className="size-6" />
          <span className="text-[10px] font-semibold tracking-wide text-ink/60">REPORTE FINANCIERO</span>
        </div>
        <p className="mt-2 text-lg font-semibold tracking-tight">Tu dinero, en perspectiva</p>
        <p className="text-xs font-semibold text-brand">{periodTitle}</p>
      </div>
      <div className="space-y-4 p-4">
        <Kpis totals={data.totals} />
        {data.insights.length > 0 && (
          <div>
            <BlockTitle>Lo que dicen tus números</BlockTitle>
            <ul className="grid gap-2 sm:grid-cols-2">
              {data.insights.map((insight) => (
                <li key={insight.kind} className="rounded-lg border-l-2 border-brand bg-surface-muted px-3 py-2">
                  <p className="text-xs font-semibold">{insight.title}</p>
                  <p className="mt-0.5 text-xs text-ink/60">{insight.detail}</p>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div>
          <BlockTitle>Gastos por categoría</BlockTitle>
          <CategoryBars categories={data.expenseByCategory} />
        </div>
      </div>
      <p className="border-t border-ink/10 px-4 py-2 text-xs text-ink/60">
        {detail
          ? `Después: movimiento del dinero, gastos destacados y el detalle de ${count === 1 ? 'tu movimiento' : `tus ${count} movimientos`}.`
          : 'Después: movimiento del dinero y gastos destacados. Sin el detalle de movimientos.'}
      </p>
    </div>
  );
}

const CSV_VIEWS = [
  { value: 'table', label: 'Tabla' },
  { value: 'text', label: 'Texto' },
];

/**
 * CSV: las primeras filas, como tabla o como el texto que queda en el archivo.
 * @param {{ data: object }} props
 */
function CsvPreview({ data }) {
  const [view, setView] = useState('table');
  const { columns, rows, text } = data.csv;
  const { count } = data.totals;
  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-2 text-center">
        {[
          [String(count), count === 1 ? 'registro' : 'registros'],
          [String(columns.length), 'columnas'],
          ['UTF-8', 'separado por ;'],
        ].map(([value, label]) => (
          <div key={label} className="rounded-lg bg-surface-muted px-2 py-2">
            <dd className="text-[15px] font-semibold tabular-nums">{value}</dd>
            <dt className="text-xs text-ink/60">{label}</dt>
          </div>
        ))}
      </dl>
      <Segmented label="Cómo ver los datos" options={CSV_VIEWS} value={view} onChange={setView} />
      {view === 'table' ? (
        <div className="overflow-x-auto rounded-xl border border-ink/10" tabIndex={0} role="region" aria-label="Primeras filas del archivo">
          <table className="w-full text-left text-xs">
            <thead className="bg-surface-muted text-ink/60">
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col" className={cn('whitespace-nowrap px-2.5 py-2 font-semibold', column === 'Monto' && 'text-right')}>
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => (
                <tr key={i} className="border-t border-ink/10">
                  {row.map((cell, j) => (
                    <td key={j} className={cn('max-w-40 truncate whitespace-nowrap px-2.5 py-2', j === 4 && 'text-right tabular-nums')}>
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <pre
          tabIndex={0}
          aria-label="Primeras líneas del archivo"
          className="overflow-x-auto rounded-xl border border-ink/10 bg-surface-muted p-3 font-mono text-xs leading-relaxed"
        >
          {text}
        </pre>
      )}
      <p className="text-xs text-ink/60">
        {count > rows.length ? `Se muestran ${rows.length} de ${count} filas. ` : ''}
        Fechas AAAA-MM-DD y montos sin símbolos: se abre en Excel, Google Sheets y Numbers, o se importa en otra herramienta.
      </p>
    </div>
  );
}

/**
 * Bloques grises mientras llega la vista previa.
 */
function PreviewSkeleton() {
  return (
    <div role="status" aria-label="Cargando la vista previa" className="animate-pulse space-y-3">
      <div className="h-12 rounded-xl bg-surface-muted" />
      <div className="grid grid-cols-2 gap-2">
        <div className="h-14 rounded-lg bg-surface-muted" />
        <div className="h-14 rounded-lg bg-surface-muted" />
      </div>
      <div className="h-28 rounded-xl bg-surface-muted" />
    </div>
  );
}

/**
 * Vista previa del formato elegido.
 * @param {object} props
 * @param {'xlsx'|'pdf'|'csv'} props.format
 * @param {object|null} props.data Respuesta de `GET /reports/preview`; `null` mientras carga.
 * @param {string} props.periodTitle P. ej. `Noviembre de 2026`.
 * @param {boolean} props.detail Si el PDF llevará la tabla de movimientos.
 */
export default function ReportPreview({ format, data, periodTitle, detail }) {
  if (!data) return <PreviewSkeleton />;
  if (format === 'xlsx') return <ExcelPreview data={data} periodTitle={periodTitle} />;
  if (format === 'pdf') return <PdfPreview data={data} periodTitle={periodTitle} detail={detail} />;
  return <CsvPreview data={data} />;
}
