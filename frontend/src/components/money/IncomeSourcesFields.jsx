import { Check } from 'lucide-react';
import MoneyInput from '@/components/common/MoneyInput';
import Segmented from '@/components/common/Segmented';
import { PayDaysField } from '@/components/money/IncomeFields';
import { Label } from '@/components/ui/label';
import { SOURCE_KINDS, toggleKind } from '@/lib/incomeSources';
import { cn } from '@/lib/utils';

const PERIODS = [
  { value: 'mensual', label: 'Al mes' },
  { value: 'quincenal', label: 'Quincena' },
  { value: 'semanal', label: 'Semana' },
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
          <Amount id={id('amount')} label="¿Cuánto te pagan al mes?" value={form.amount} onChange={(amount) => set({ amount })} />
          <PayDaysField legend="¿Qué días te pagan? (opcional)" payDays={form.payDays} onChange={(payDays) => set({ payDays })} />
        </>
      );
    case 'comisiones':
      return (
        <>
          <Amount id={id('amount')} label="Tu base fija al mes" value={form.amount} onChange={(amount) => set({ amount })} />
          <div className="grid grid-cols-2 gap-3">
            <Amount id={id('low')} label="Comisión en un mes malo" value={form.low} onChange={(low) => set({ low })} />
            <Amount id={id('high')} label="En un mes bueno" value={form.high} onChange={(high) => set({ high })} />
          </div>
          <PayDaysField legend="¿Qué días te pagan? (opcional)" payDays={form.payDays} onChange={(payDays) => set({ payDays })} />
        </>
      );
    case 'proyectos':
      return (
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium text-ink/80">¿Cuánto te entró los últimos 3 meses? Más o menos.</legend>
          <div className="grid grid-cols-3 gap-2">
            {['Este mes', 'Hace 1 mes', 'Hace 2'].map((label, i) => (
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
            <p className="text-sm font-medium">¿Cuántos días trabajas a la semana?</p>
            <Segmented
              label="Días que trabajas a la semana"
              options={['3', '4', '5', '6', '7'].map((d) => ({ value: d, label: d }))}
              value={form.workDays}
              onChange={(workDays) => set({ workDays })}
            />
          </div>
          <Amount id={id('amount')} label="¿Cuánto haces en un día normal?" value={form.amount} onChange={(amount) => set({ amount })} />
        </>
      );
    default:
      return (
        <>
          <Amount id={id('amount')} label="¿Cuánto te dan cada vez?" value={form.amount} onChange={(amount) => set({ amount })} />
          <Segmented label="Cada cuánto" options={PERIODS} value={form.frequency} onChange={(frequency) => set({ frequency })} />
        </>
      );
  }
}

/**
 * "¿Cómo te entra la plata?" (FT-0060): tarjetas grandes, se puede elegir más de una, y debajo de
 * cada una sus preguntas. Todo es opcional y aproximado: nunca bloquea al usuario.
 * @param {{ forms: Record<string, object>, onChange: (forms: Record<string, object>) => void }} props
 */
export default function IncomeSourcesFields({ forms, onChange }) {
  return (
    <div className="space-y-3" role="group" aria-label="Cómo te entra la plata (puedes elegir varias)">
      {SOURCE_KINDS.map(({ kind, title, text, icon: Icon }) => {
        const form = forms[kind];
        const checked = Boolean(form);
        return (
          <div key={kind} className={cn('rounded-2xl border transition-colors', checked ? 'border-brand bg-brand-soft/40' : 'border-ink/12')}>
            <button
              type="button"
              aria-pressed={checked}
              onClick={() => onChange(toggleKind(forms, kind))}
              className="flex w-full items-center gap-3 rounded-2xl p-4 text-left focus-visible:outline-2 focus-visible:outline-violet"
            >
              <Icon className={cn('size-5 shrink-0', checked ? 'text-brand' : 'text-ink/60')} aria-hidden="true" />
              <span className="min-w-0 flex-1">
                <span className={cn('block font-medium', checked && 'text-brand')}>{title}</span>
                <span className="block text-sm text-ink/60">{text}</span>
              </span>
              <span
                aria-hidden="true"
                className={cn('grid size-6 shrink-0 place-items-center rounded-full border', checked ? 'border-brand bg-brand text-white' : 'border-ink/20')}
              >
                {checked && <Check className="size-4" />}
              </span>
            </button>
            {checked && (
              <div className="space-y-4 px-4 pb-4">
                <KindQuestions form={form} onChange={(next) => onChange({ ...forms, [kind]: next })} />
              </div>
            )}
          </div>
        );
      })}
      <p className="text-sm text-ink/60">Elige todas las que apliquen. Los montos son aproximados: más o menos está bien.</p>
    </div>
  );
}
