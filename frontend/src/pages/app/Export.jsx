import { useEffect, useId, useMemo, useState } from 'react';
import { CalendarRange, Check, CircleCheck, Download, FileSpreadsheet, FileText, Inbox, Loader2, RotateCw, Sheet, WifiOff } from 'lucide-react';
import { currentMonth, shiftMonth } from '@/components/budgets/month';
import ChipGroup from '@/components/common/ChipGroup';
import ReportPreview from '@/components/export/ReportPreview';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { downloadFile } from '@/lib/downloadFile';
import { cn } from '@/lib/utils';
import { today } from '@/lib/validation/transaction';
import { exportTransactions, previewReport } from '@/services/reportService';
import { monthRange } from '@/services/summaryService';

/** Formatos disponibles: para qué sirve cada uno y qué trae. */
const FORMATS = [
  {
    value: 'xlsx',
    label: 'Excel',
    extension: '.xlsx',
    icon: FileSpreadsheet,
    purpose: 'Analiza y personaliza',
    features: ['Tablero con gráficos que se actualizan', 'Fórmulas y tablas que puedes editar', 'Hojas por categoría y por día'],
  },
  {
    value: 'pdf',
    label: 'PDF',
    extension: '.pdf',
    icon: FileText,
    purpose: 'Entiende y comparte',
    features: ['Reporte con gráficos e indicadores', 'Lo que dicen tus números', 'Listo para imprimir o enviar'],
  },
  {
    value: 'csv',
    label: 'CSV',
    extension: '.csv',
    icon: Sheet,
    purpose: 'Lleva tus datos',
    features: ['Una fila por movimiento', 'Se abre en Excel y Google Sheets', 'Para importar en otra herramienta'],
  },
];

const PERIOD_OPTIONS = [
  { value: 'this-month', label: 'Este mes' },
  { value: 'last-month', label: 'Mes pasado' },
  { value: 'this-year', label: 'Este año' },
  { value: 'custom', label: 'Personalizado' },
];

/**
 * Rango de fechas de cada periodo con nombre. "Este año" va del 1 de enero a hoy.
 * @param {string} period
 * @returns {{ from: string, to: string }}
 */
function rangeOf(period) {
  if (period === 'this-month') return monthRange(currentMonth());
  if (period === 'last-month') return monthRange(shiftMonth(currentMonth(), -1));
  return { from: `${today().slice(0, 4)}-01-01`, to: today() };
}

/**
 * Fecha en español sin pasar por UTC (no se corre un día).
 * @param {string} iso AAAA-MM-DD
 * @param {Intl.DateTimeFormatOptions} [options]
 * @returns {string} Por defecto `1 de octubre de 2026`.
 */
function dateText(iso, options = { day: 'numeric', month: 'long', year: 'numeric' }) {
  const [year, month, day] = iso.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('es-CO', options);
}

/**
 * @param {{ from: string, to: string }} range
 * @returns {boolean} `true` si el rango es un mes completo.
 */
function isWholeMonth({ from, to }) {
  const whole = monthRange(from.slice(0, 7));
  return whole.from === from && whole.to === to;
}

/**
 * Nombre que tendrá el archivo, igual al que arma el servidor: `rinde_2026-10.xlsx` si es un mes
 * completo; si no, `rinde_<desde>_<hasta>.xlsx`.
 * @param {{ from: string, to: string }} range
 * @param {string} extension
 * @returns {string}
 */
function previewFilename(range, extension) {
  return `rinde_${isWholeMonth(range) ? range.from.slice(0, 7) : `${range.from}_${range.to}`}${extension}`;
}

/**
 * Título del periodo como sale en los archivos: `Noviembre de 2026` o `1 nov 2026 – 15 nov 2026`.
 * @param {{ from: string, to: string }} range
 * @returns {string}
 */
function periodTitle(range) {
  if (isWholeMonth(range)) {
    const month = dateText(range.from, { month: 'long', year: 'numeric' });
    return month.charAt(0).toUpperCase() + month.slice(1);
  }
  const short = { day: 'numeric', month: 'short', year: 'numeric' };
  return range.from === range.to ? dateText(range.from, short) : `${dateText(range.from, short)} – ${dateText(range.to, short)}`;
}

/**
 * Tarjetas para elegir el formato. Son radios nativos (flechas del teclado y lector de pantalla).
 * @param {{ value: string, onChange: (value: string) => void }} props
 */
function FormatPicker({ value, onChange }) {
  const name = useId();
  return (
    <fieldset>
      <legend className="sr-only">Formato del archivo</legend>
      <div className="grid gap-3 sm:grid-cols-3">
        {FORMATS.map(({ value: option, label, extension, icon: Icon, purpose, features }) => {
          const checked = value === option;
          return (
            <label
              key={option}
              className={cn(
                'relative flex cursor-pointer flex-col gap-3 rounded-2xl border p-4 transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet',
                checked ? 'border-brand bg-brand-soft/50 ring-1 ring-brand' : 'border-ink/10 hover:border-ink/25 hover:bg-surface-muted/50',
              )}
            >
              <input type="radio" name={name} value={option} checked={checked} onChange={() => onChange(option)} className="sr-only" />
              <span className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className={cn('grid size-11 shrink-0 place-items-center rounded-xl transition-colors', checked ? 'bg-brand text-white' : 'bg-brand-soft text-brand')}
                >
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-2">
                    <span className="text-lg font-semibold tracking-tight">{label}</span>
                    <span className="text-xs text-ink/60">{extension}</span>
                  </span>
                  <span className="block text-sm text-ink/70">{purpose}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border transition-colors',
                    checked ? 'border-brand bg-brand text-white' : 'border-ink/25',
                  )}
                >
                  {checked && <Check className="size-3" strokeWidth={3} />}
                </span>
              </span>
              <ul className="space-y-1.5 text-sm text-ink/70 max-sm:hidden">
                {features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                    {feature}
                  </li>
                ))}
              </ul>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/**
 * Título numerado de cada paso.
 * @param {{ number: number, title: string, id: string }} props
 */
function StepTitle({ number, title, id }) {
  return (
    <h2 id={id} className="mb-4 flex items-center gap-2.5 text-base font-semibold tracking-tight">
      <span aria-hidden="true" className="grid size-6 place-items-center rounded-full bg-brand text-xs font-bold text-white">
        {number}
      </span>
      {title}
    </h2>
  );
}

/**
 * Mensaje que ocupa el lugar de la vista previa cuando no hay nada que mostrar.
 * @param {{ icon: import('lucide-react').LucideIcon, title: string, children: React.ReactNode, action?: React.ReactNode }} props
 */
function PreviewMessage({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink/15 px-4 py-8 text-center">
      <span aria-hidden="true" className="grid size-11 place-items-center rounded-xl bg-brand-soft text-brand">
        <Icon className="size-5" />
      </span>
      <p className="font-semibold">{title}</p>
      <p className="max-w-xs text-sm text-ink/60">{children}</p>
      {action}
    </div>
  );
}

/**
 * Página privada `/app/transacciones/exportar`: descarga el reporte del periodo en Excel, PDF o CSV
 * (FT-0012). Se elige el formato y el periodo, y la vista previa muestra con datos reales lo que
 * traerá el archivo. Vista previa y archivo los arma el servidor con el mismo modelo, así que
 * necesitan conexión. Si no hay movimientos en el periodo, lo dice en lugar de descargar un archivo
 * vacío (REQ-033).
 */
export default function Export() {
  usePageTitle('Exportar movimientos');
  const online = useOnlineStatus();
  const [format, setFormat] = useState('xlsx');
  const [period, setPeriod] = useState('this-month');
  const [custom, setCustom] = useState(() => ({ from: `${currentMonth()}-01`, to: today() }));
  const [detail, setDetail] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState('');
  /** Vista previa: `data` con las cifras, `empty` si el periodo no tiene movimientos, o `error`. */
  const [preview, setPreview] = useState({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const selected = FORMATS.find((f) => f.value === format);
  const range = useMemo(() => (period === 'custom' ? custom : rangeOf(period)), [period, custom]);
  const rangeError =
    period !== 'custom'
      ? ''
      : !custom.from || !custom.to
        ? 'Elige las dos fechas.'
        : custom.from > custom.to
          ? 'La fecha "Desde" debe ser anterior o igual a "Hasta".'
          : '';
  const rangeText = rangeError ? '' : range.from === range.to ? `el ${dateText(range.from)}` : `del ${dateText(range.from)} al ${dateText(range.to)}`;
  const filename = rangeError ? `rinde${selected.extension}` : previewFilename(range, selected.extension);

  // La vista previa se vuelve a pedir al cambiar el periodo (no el formato: las cifras son las mismas).
  useEffect(() => {
    if (rangeError || !online) return undefined;
    let current = true;
    setPreview({ status: 'loading' });
    previewReport(range)
      .then((data) => current && setPreview({ status: 'ready', data }))
      .catch((err) => current && setPreview(err.code === 'NO_DATA' ? { status: 'empty' } : { status: 'error', message: err.message }));
    return () => {
      current = false;
    };
  }, [range, rangeError, online, attempt]);

  /** Al cambiar cualquier opción se borra el resultado anterior, para no mostrar uno que ya no aplica. */
  const reset = () => {
    setError('');
    setDone('');
  };

  const handleDownload = async () => {
    reset();
    setBusy(true);
    try {
      const result = await exportTransactions({ format, ...range, detail });
      downloadFile(result.blob, result.filename);
      setDone(`Descargado ${result.filename}`);
    } catch (err) {
      setError(err.code === 'NO_DATA' ? `No tienes movimientos ${rangeText}. Prueba con otro periodo.` : err.message);
    } finally {
      setBusy(false);
    }
  };

  const SelectedIcon = selected.icon;
  const canDownload = online && !rangeError && !busy && preview.status !== 'empty' && preview.status !== 'loading';

  return (
    <>
      <header className="mb-6 md:mb-8">
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Exportar movimientos</h1>
        <p className="mt-1 text-ink/60">Tus números, más claros que nunca: elige cómo llevártelos y mira el reporte antes de descargarlo.</p>
      </header>

      <div className="flex flex-col gap-6">
        <Panel aria-labelledby="step-format">
          <StepTitle number={1} title="Elige el formato" id="step-format" />
          <FormatPicker value={format} onChange={(value) => (setFormat(value), reset())} />
        </Panel>

        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[340px_minmax(0,1fr)]">
          <Panel aria-labelledby="step-period">
            <StepTitle number={2} title="Elige el periodo" id="step-period" />
            <ChipGroup legend="Periodo" hideLegend options={PERIOD_OPTIONS} value={period} onChange={(value) => (setPeriod(value), reset())} />
            {period === 'custom' && (
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="export-from">Desde</Label>
                  <Input
                    id="export-from"
                    type="date"
                    value={custom.from}
                    max={custom.to || undefined}
                    onChange={(e) => (setCustom((c) => ({ ...c, from: e.target.value })), reset())}
                    aria-invalid={rangeError ? true : undefined}
                  />
                </div>
                <div className="min-w-0 space-y-2">
                  <Label htmlFor="export-to">Hasta</Label>
                  <Input
                    id="export-to"
                    type="date"
                    value={custom.to}
                    min={custom.from || undefined}
                    onChange={(e) => (setCustom((c) => ({ ...c, to: e.target.value })), reset())}
                    aria-invalid={rangeError ? true : undefined}
                  />
                </div>
              </div>
            )}
            <p className={cn('mt-4 flex items-start gap-2 text-sm', rangeError ? 'text-negative' : 'text-ink/60')}>
              <CalendarRange className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {rangeError || <span>Incluye tus movimientos {rangeText}.</span>}
            </p>

            {format === 'pdf' && (
              <div className="mt-5 flex items-start gap-3 border-t border-ink/10 pt-5">
                <Checkbox id="export-detail" className="mt-0.5" checked={detail} onCheckedChange={(v) => (setDetail(v === true), reset())} />
                <div>
                  <Label htmlFor="export-detail">Incluir el detalle de movimientos</Label>
                  <p className="mt-1 text-sm text-ink/60">Quítalo para compartir solo el resumen, sin mostrar cada compra.</p>
                </div>
              </div>
            )}
          </Panel>

          <Panel aria-labelledby="preview-title" className="flex flex-col gap-5">
            <div className="flex items-center gap-3">
              <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
                <SelectedIcon className="size-5" />
              </span>
              <div className="min-w-0">
                <h2 id="preview-title" className="text-sm font-medium text-ink/60">
                  Vista previa · {selected.label}
                </h2>
                <p className="truncate font-semibold" title={filename}>
                  {filename}
                </p>
              </div>
            </div>

            {!online ? (
              <PreviewMessage icon={WifiOff} title="Sin conexión">
                El reporte se arma en el servidor. Cuando vuelvas a tener conexión verás aquí la vista previa.
              </PreviewMessage>
            ) : rangeError ? (
              <PreviewMessage icon={CalendarRange} title="Falta el periodo">
                {rangeError}
              </PreviewMessage>
            ) : preview.status === 'empty' ? (
              <PreviewMessage icon={Inbox} title="No hay movimientos en este periodo">
                No tienes movimientos {rangeText}. Prueba con otro periodo.
              </PreviewMessage>
            ) : preview.status === 'error' ? (
              <PreviewMessage
                icon={RotateCw}
                title="No pudimos armar la vista previa"
                action={
                  <Button variant="soft" className="mt-2" onClick={() => setAttempt((n) => n + 1)}>
                    Reintentar
                  </Button>
                }
              >
                {preview.message} Igual puedes intentar descargar el archivo.
              </PreviewMessage>
            ) : (
              <ReportPreview format={format} data={preview.data ?? null} periodTitle={periodTitle(range)} detail={detail} />
            )}

            <div className="flex flex-col gap-3 border-t border-ink/10 pt-5 sm:flex-row sm:items-center">
              <Button size="lg" className="w-full sm:w-auto" onClick={handleDownload} disabled={!canDownload}>
                {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Download aria-hidden="true" />}
                {busy ? 'Preparando archivo…' : `Descargar ${selected.label}`}
              </Button>
              <p role="status" className="text-sm text-positive">
                {done && (
                  <span className="flex items-start gap-2">
                    <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                    {done}
                  </span>
                )}
              </p>
              {error && (
                <p role="alert" className="text-sm text-negative">
                  {error}
                </p>
              )}
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
}
