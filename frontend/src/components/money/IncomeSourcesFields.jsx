import { Check } from 'lucide-react';
import MoneyInput from '@/components/common/MoneyInput';
import Segmented from '@/components/common/Segmented';
import { PayDaysField } from '@/components/money/IncomeFields';
import { Label } from '@/components/ui/label';
import { SOURCE_KINDS, toggleKind } from '@/lib/incomeSources';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

const PERIODS = [
  { value: 'mensual', label: t('Al mes') },
  { value: 'quincenal', label: t('Quincena') },
  { value: 'semanal', label: t('Semana') },
];

/** Un monto con su etiqueta. `MoneyInput` ya guarda el texto crudo. */
function Amount({ id, label, value, onChange, hint }) {
  return (
    <div className="min-w-0 space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <MoneyInput id={id} value={value} onChange={onChange} placeholder="0" showHint={false} />
      {hint && <p className="text-xs text-ink/60">{hint}</p>}
    </div>
  );
}

/** Las preguntas de cada tipo, todas opcionales. */
function KindQuestions({ form, onChange }) {
  const set = (changes) => onChange({ ...form, ...changes });
  const id = (field) => `income-${form.kind}-${field}`;
  switch (form.kind) {
    case 'sueldo':
      return (
        <>
          <Amount id={id('amount')} label={t('¿Cuánto te pagan al mes?')} value={form.amount} onChange={(amount) => set({ amount })} />
          <PayDaysField legend={t('¿Qué días te pagan? (opcional)')} payDays={form.payDays} onChange={(payDays) => set({ payDays })} />
        </>
      );
    case 'comisiones':
      return (
        <>
          <Amount id={id('amount')} label={t('Tu base fija al mes')} value={form.amount} onChange={(amount) => set({ amount })} />
          <div className="grid grid-cols-2 gap-3">
            <Amount id={id('low')} label={t('Comisión en un mes malo')} value={form.low} onChange={(low) => set({ low })} />
            <Amount id={id('high')} label={t('En un mes bueno')} value={form.high} onChange={(high) => set({ high })} />
          </div>
          <PayDaysField legend={t('¿Qué días te pagan? (opcional)')} payDays={form.payDays} onChange={(payDays) => set({ payDays })} />
        </>
      );
    case 'proyectos':
      return (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink/80">{t('¿Cuánto te entró los últimos 3 meses? Más o menos.')}</legend>
          <div className="grid grid-cols-3 gap-2">
            {[t('Este mes'), t('Hace 1 mes'), t('Hace 2')].map((label, i) => (
              <Amount
                key={label}
                id={id(`month-${i}`)}
                label={label}
                value={form.lastMonths[i]}
                onChange={(value) => set({ lastMonths: form.lastMonths.map((m, j) => (j === i ? value : m)) })}
              />
            ))}
          </div>
        </fieldset>
      );
    case 'diario':
      return (
        <>
          <div className="space-y-1.5">
            <p className="text-sm font-medium">{t('¿Cuántos días trabajas a la semana?')}</p>
            <Segmented
              label={t('Días que trabajas a la semana')}
              options={['3', '4', '5', '6', '7'].map((d) => ({ value: d, label: d }))}
              value={form.workDays}
              onChange={(workDays) => set({ workDays })}
            />
          </div>
          <Amount id={id('amount')} label={t('¿Cuánto haces en un día normal?')} value={form.amount} onChange={(amount) => set({ amount })} />
        </>
      );
    default:
      return (
        <>
          <Amount id={id('amount')} label={t('¿Cuánto te dan cada vez?')} value={form.amount} onChange={(amount) => set({ amount })} />
          <Segmented label={t('Cada cuánto')} options={PERIODS} value={form.frequency} onChange={(frequency) => set({ frequency })} />
        </>
      );
  }
}

/** Lo que tardan en abrirse las preguntas de una fuente (igual a `duration-300`). */
const OPEN_MS = 300;

/**
 * "¿Cómo te entra la plata?" (FT-0060): una lista de fuentes en un solo bloque, con casilla
 * cuadrada (se pueden marcar varias; una redonda diría «solo una») y un ícono de color propio para
 * distinguirlas de un vistazo. Al marcar una, se abren debajo sus preguntas. Todo es opcional y
 * aproximado: son datos para planear, nunca movimientos, y nunca bloquean al usuario.
 *
 * La elegida se nota por tres cosas, no solo por el color: la casilla llena, el visto y el fondo.
 *
 * @param {{ forms: Record<string, object>, onChange: (forms: Record<string, object>) => void }} props
 */
export default function IncomeSourcesFields({ forms, onChange }) {
  return (
    <div className="space-y-3" role="group" aria-label={t('Cómo te entra la plata (puedes elegir varias)')}>
      <p className="text-base text-ink/60">{t('Elige todas las que apliquen. Los montos son aproximados: más o menos está bien.')}</p>
      <div className="divide-y divide-ink/8 overflow-hidden rounded-3xl bg-surface ring-1 ring-ink/10">
        {SOURCE_KINDS.map(({ kind, title, text, icon: Icon, tone }) => {
          const form = forms[kind];
          const checked = Boolean(form);
          return (
            <div key={kind} className={cn('scroll-mb-28 transition-colors duration-200', checked && 'bg-brand-soft/50')}>
              <button
                type="button"
                role="checkbox"
                aria-checked={checked}
                onClick={(event) => {
                  onChange(toggleKind(forms, kind));
                  // Al marcarla, sus preguntas pueden quedar bajo el borde: se acercan cuando terminan de abrirse.
                  const row = event.currentTarget.parentElement;
                  if (!checked) setTimeout(() => row.scrollIntoView({ block: 'nearest' }), OPEN_MS);
                }}
                className="flex w-full items-center gap-3.5 p-4 text-left transition-transform duration-150 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-violet motion-safe:active:scale-[0.985]"
              >
                <span aria-hidden="true" className={cn('grid size-11 shrink-0 place-items-center rounded-2xl', tone)}>
                  <Icon className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{title}</span>
                  <span className="block text-sm text-ink/60">{text}</span>
                </span>
                <span
                  aria-hidden="true"
                  className={cn(
                    'grid size-6 shrink-0 place-items-center rounded-lg border-2 transition-colors duration-150',
                    checked ? 'border-brand bg-brand text-white' : 'border-ink/25',
                  )}
                >
                  <Check
                    strokeWidth={3}
                    className={cn('size-4 transition-[opacity,transform] duration-150', checked ? 'scale-100 opacity-100' : 'scale-75 opacity-0')}
                  />
                </span>
              </button>
              {/* Se abre de 0 a su alto sin medir nada: la fila de la cuadrícula pasa de 0fr a 1fr. */}
              <div
                className={cn(
                  'grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                  checked ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
                )}
              >
                <div className="overflow-hidden">
                  {checked && (
                    <div className="space-y-4 px-4 pb-4 pt-1">
                      <KindQuestions form={form} onChange={(next) => onChange({ ...forms, [kind]: next })} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
