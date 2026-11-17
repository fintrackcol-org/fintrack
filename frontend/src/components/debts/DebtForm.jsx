import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import ChipGroup from '@/components/common/ChipGroup';
import MoneyInput from '@/components/common/MoneyInput';
import ReminderBlock from '@/components/common/ReminderBlock';
import Segmented from '@/components/common/Segmented';
import { formatMoney } from '@/components/transactions/format';
import { todayIso } from '@/components/vacas/vacaFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { schedule } from '@/lib/debtSchedule';
import { FREQUENCY_LABELS, shortDate } from '@/lib/debts';
import { DEFAULT_REMINDER } from '@/lib/reminder';
import { cn } from '@/lib/utils';
import { debtSchema } from '@/lib/validation/debt';

const KIND_OPTIONS = [
  { value: 'receivable', label: 'Me deben' },
  { value: 'payable', label: 'Debo' },
];
const PLAN_OPTIONS = [
  { value: 'once', label: 'De una vez' },
  { value: 'installments', label: 'En cuotas' },
];
const FREQUENCY_OPTIONS = Object.entries(FREQUENCY_LABELS).map(([value, label]) => ({ value, label }));

/** Los tres pasos y los campos que revisa cada uno antes de seguir. */
const STEPS = [
  { title: 'Quién y cuánto', fields: ['person', 'amount', 'loanDate', 'note'] },
  { title: 'Cómo se paga', fields: ['plan', 'installments', 'frequency', 'dueDate'] },
  { title: 'Cuándo avisar', fields: [] },
];

/** @param {object|undefined} debt @param {string} dueDate */
function toDefaults(debt, dueDate) {
  return {
    person: debt?.person ?? '',
    amount: debt ? String(debt.amount) : '',
    loanDate: debt ? (debt.loanDate ?? '') : todayIso(),
    plan: debt?.installments ? 'installments' : 'once',
    installments: debt?.installments ? String(debt.installments) : '4',
    frequency: debt?.frequency ?? 'monthly',
    // Con cuotas, `dueDate` del formulario es la primera cuota (la API devuelve la próxima).
    dueDate: (debt?.installments ? debt.firstDueDate : debt?.dueDate) ?? dueDate,
    note: debt?.note ?? '',
  };
}

/**
 * Lo que se va a cobrar o pagar en cuotas, antes de guardar: "4 cuotas de $50.000 · la última el 12 feb".
 * @param {{ amount: string, installments: string, frequency: string, dueDate: string }} v
 * @returns {string|null}
 */
function planPreview({ amount, installments, frequency, dueDate }) {
  const total = Number(amount);
  const n = Number(installments);
  if (!(total > 0) || !Number.isInteger(n) || n < 2 || n > 60 || !dueDate) return null;
  const cuotas = schedule({ amount: total, installments: n, frequency, firstDueDate: dueDate });
  return `${n} cuotas de ${formatMoney(cuotas[0].amount)} · la última el ${shortDate(cuotas.at(-1).date, todayIso())}`;
}

/**
 * Formulario de una cuenta por cobrar o por pagar, en tres pasos: quién y cuánto (con la fecha del
 * préstamo), cómo se paga (de una vez o en cuotas, FT-0064) y cuándo avisar. Al crear se elige el
 * lado; al editar no cambia. `dueDate` deja puesta la fecha al crear (p. ej. desde un día del calendario).
 * @param {{ debt?: object, kind?: 'receivable'|'payable', dueDate?: string, disabled?: boolean, onSubmit: (v: object) => Promise<void> }} props
 */
export default function DebtForm({ debt, kind: initialKind = 'receivable', dueDate: initialDueDate = '', disabled = false, onSubmit }) {
  const editing = Boolean(debt);
  const [kind, setKind] = useState(debt?.kind ?? initialKind);
  const [step, setStep] = useState(0);
  const [serverError, setServerError] = useState('');
  const [reminder, setReminder] = useState(debt?.reminder ?? DEFAULT_REMINDER);
  const {
    control,
    register,
    handleSubmit,
    watch,
    trigger,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(debtSchema), defaultValues: toDefaults(debt, initialDueDate) });

  const submit = handleSubmit(async (values) => {
    setServerError('');
    const inInstallments = values.plan === 'installments';
    const body = {
      person: values.person,
      amount: values.amount,
      loanDate: values.loanDate || null,
      dueDate: values.dueDate || null,
      installments: inInstallments ? Number(values.installments) : null,
      frequency: inInstallments ? values.frequency : null,
      note: values.note || null,
      // Sin fecha no hay de qué avisar.
      ...(values.dueDate && { reminder }),
    };
    try {
      await onSubmit(editing ? body : { kind, ...body });
    } catch (err) {
      const fields = Object.keys(err.fields ?? {});
      for (const field of fields) {
        if (field in values) setError(field, { message: err.fields[field] });
      }
      // Vuelve al paso del primer campo con error, para que se vea.
      const back = STEPS.findIndex((s) => s.fields.some((f) => fields.includes(f)));
      if (back >= 0) setStep(back);
      setServerError(err.message);
    }
  });

  const next = async () => {
    if (await trigger(STEPS[step].fields)) setStep((s) => s + 1);
  };
  const onFormSubmit = (event) => {
    if (step < STEPS.length - 1) {
      event.preventDefault();
      next();
    } else submit(event);
  };

  const receivable = kind === 'receivable';
  const values = watch();
  const inInstallments = values.plan === 'installments';
  const preview = inInstallments ? planPreview(values) : null;
  const last = step === STEPS.length - 1;

  return (
    <form onSubmit={onFormSubmit} noValidate className="space-y-5" aria-label={editing ? 'Editar cuenta' : 'Nueva cuenta'}>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/60" aria-live="polite">
          Paso {step + 1} de {STEPS.length} · {STEPS[step].title}
        </p>
        <div aria-hidden="true" className="mt-2 grid grid-cols-3 gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s.title} className={cn('h-1 rounded-full transition-colors', i <= step ? 'bg-brand' : 'bg-ink/10')} />
          ))}
        </div>
      </div>

      {step === 0 && (
        <div className="space-y-4">
          {!editing && <ChipGroup legend="¿Quién debe?" options={KIND_OPTIONS} value={kind} onChange={setKind} disabled={disabled} />}
          <FormField id="debt-person" label={receivable ? '¿Quién te debe?' : '¿A quién le debes?'} error={errors.person?.message}>
            <Input autoComplete="off" placeholder="Nombre" maxLength={60} disabled={disabled} {...register('person')} />
          </FormField>
          <Controller
            control={control}
            name="amount"
            render={({ field }) => (
              <FormField id="debt-amount" label="¿Cuánto? (COP)" error={errors.amount?.message}>
                <MoneyInput
                  name={field.name}
                  value={field.value}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  ref={field.ref}
                  placeholder="0"
                  disabled={disabled}
                />
              </FormField>
            )}
          />
          <FormField
            id="debt-loan"
            label={receivable ? '¿Cuándo le prestaste?' : '¿Cuándo te prestaron?'}
            error={errors.loanDate?.message}
          >
            <Input type="date" max={todayIso()} disabled={disabled} {...register('loanDate')} />
          </FormField>
          <FormField id="debt-note" label="Nota (opcional)" error={errors.note?.message}>
            <Input
              autoComplete="off"
              placeholder={receivable ? 'Ej.: le presté para el bus' : 'Ej.: el almuerzo del viernes'}
              maxLength={200}
              disabled={disabled}
              {...register('note')}
            />
          </FormField>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <Controller
            control={control}
            name="plan"
            render={({ field }) => (
              <Segmented label="¿Cómo se paga?" options={PLAN_OPTIONS} value={field.value} onChange={field.onChange} />
            )}
          />
          {inInstallments ? (
            <>
              <FormField id="debt-installments" label="¿Cuántas cuotas?" error={errors.installments?.message}>
                <Input inputMode="numeric" autoComplete="off" maxLength={2} disabled={disabled} {...register('installments')} />
              </FormField>
              <Controller
                control={control}
                name="frequency"
                render={({ field }) => (
                  <ChipGroup legend="¿Cada cuánto?" options={FREQUENCY_OPTIONS} value={field.value} onChange={field.onChange} disabled={disabled} />
                )}
              />
              <FormField id="debt-due" label="¿Cuándo es la primera cuota?" error={errors.dueDate?.message}>
                <Input type="date" disabled={disabled} {...register('dueDate')} />
              </FormField>
              {preview && <p className="rounded-xl bg-brand-soft p-3 text-sm font-medium text-brand">{preview}</p>}
            </>
          ) : (
            <FormField id="debt-due" label="¿Para cuándo? (opcional)" error={errors.dueDate?.message}>
              <Input type="date" disabled={disabled} {...register('dueDate')} />
            </FormField>
          )}
        </div>
      )}

      {step === 2 &&
        (values.dueDate ? (
          <ReminderBlock value={reminder} onChange={setReminder} disabled={disabled} />
        ) : (
          <p className="text-sm text-ink/60">Si le pones fecha, puedes elegir cuándo y por dónde te avisamos.</p>
        ))}

      {last && <p className="text-sm text-ink/60">Esto no cambia lo que tienes en Mi plata hasta que registres un abono.</p>}
      {disabled && <p className="text-sm text-ink/60">Necesitas conexión</p>}
      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}
      <div className="flex gap-3">
        {step > 0 && (
          <Button type="button" variant="outline" size="lg" onClick={() => setStep((s) => s - 1)} disabled={isSubmitting}>
            Atrás
          </Button>
        )}
        <Button type="submit" size="lg" className="flex-1" disabled={disabled || isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {!last ? 'Siguiente' : isSubmitting ? 'Guardando…' : editing ? 'Guardar cambios' : 'Guardar cuenta'}
        </Button>
      </div>
    </form>
  );
}
