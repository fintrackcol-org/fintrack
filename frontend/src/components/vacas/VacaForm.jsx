import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import ChipGroup from '@/components/common/ChipGroup';
import MoneyInput from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { vacaSchema } from '@/lib/validation/vaca';
import { isTooMuch, weeklyPlan } from '@/lib/goalPlan';
import { formatPesos, todayIso } from './vacaFormat';

const SPLIT_OPTIONS = [
  { value: 'igual', label: 'Partes iguales' },
  { value: 'personalizado', label: 'Cuotas a medida' },
];

/**
 * @param {import('@/services/vacaService').Vaca|null} initial
 * @returns {{ name: string, goal: string, description: string, deadline: string, split: 'igual'|'personalizado' }}
 */
function toDefaults(initial, prefill) {
  return {
    name: initial?.name ?? prefill?.name ?? '',
    goal: initial ? String(initial.goal) : prefill?.goal ? String(prefill.goal) : '',
    description: initial?.description ?? '',
    deadline: initial?.deadline ?? '',
    split: initial?.split ?? 'igual',
  };
}

/**
 * Formulario para crear una vaca o editar la existente (FT-0014): nombre, meta, fecha límite
 * opcional, para qué es y cómo se reparte entre los miembros.
 *
 * @param {object} props
 * @param {import('@/services/vacaService').Vaca|null} [props.initial] Vaca a editar.
 * @param {boolean} [props.disabled] Sin conexión.
 * @param {boolean} [props.personal] Meta personal: sin reparto entre miembros.
 * @param {(values: { name: string, goal: number, description: string|null, deadline: string|null, split: string }) => Promise<void>} props.onSubmit
 *   Debe lanzar un `Error` si falla; con `err.fields` se marcan los campos del servidor.
 * @param {() => void} [props.onCancel]
 * @param {{ name?: string, goal?: number }} [props.prefill] Valores de arranque de una meta nueva (p. ej. el colchón).
 * @param {number|null} [props.weeklyIncome] Lo que entra por semana: avisa si el plan se come más del 30 %.
 */
export default function VacaForm({ initial = null, disabled = false, personal = false, onSubmit, onCancel, prefill, weeklyIncome }) {
  const [serverError, setServerError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    reset,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(vacaSchema), defaultValues: toDefaults(initial, prefill) });

  useEffect(() => {
    reset(toDefaults(initial, prefill));
    setServerError('');
  }, [initial, prefill, reset]);

  // Meta personal (Rinde v2): el plan por semana y si es mucho para lo que entra.
  const [goalText, deadline] = watch(['goal', 'deadline']);
  const plan = personal
    ? weeklyPlan({ goal: Number(goalText), saved: initial?.total ?? 0, deadline, today: todayIso() })
    : null;

  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await onSubmit({
        name: values.name,
        goal: values.goal,
        description: values.description || null,
        deadline: values.deadline || null,
        split: values.split,
      });
      if (!initial) reset(toDefaults(null));
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field in toDefaults(null)) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  return (
    <form
      onSubmit={submit}
      noValidate
      className="space-y-5"
      aria-label={personal ? (initial ? 'Editar meta' : 'Nueva meta') : initial ? 'Editar vaca' : 'Nueva vaca'}
    >
      <FormField id="vaca-name" label={personal ? 'Ponle nombre *' : 'Nombre'} error={errors.name?.message}>
        <Input
          placeholder={personal ? 'Ej. Moto, semestre, viaje' : 'Ej. Paseo de fin de año'}
          maxLength={60}
          disabled={disabled}
          {...register('name')}
        />
      </FormField>

      <Controller
        control={control}
        name="goal"
        render={({ field }) => (
          <FormField id="vaca-goal" label={personal ? '¿Cuánto necesitas? *' : 'Meta (COP)'} error={errors.goal?.message}>
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

      <FormField id="vaca-deadline" label={personal ? '¿Para cuándo?' : 'Fecha límite (opcional)'} error={errors.deadline?.message}>
        <Input type="date" min={todayIso()} disabled={disabled} {...register('deadline')} />
      </FormField>

      {plan && (
        <div aria-live="polite" className="space-y-2">
          <p className="rounded-2xl bg-brand-soft p-4">
            <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-brand">Tu plan</span>
            <span className="mt-1 block">
              <b className="text-xl font-extrabold tabular-nums">{formatPesos(plan.perWeek)}</b> por semana
            </span>
            <span className="block text-sm text-ink/60">
              {plan.weeks === 1 ? 'Durante 1 semana' : `Durante ${plan.weeks} semanas`}, y llegas a tiempo.
            </span>
          </p>
          {isTooMuch(plan.perWeek, weeklyIncome) && (
            <p className="flex gap-2.5 rounded-2xl bg-brand-soft/60 p-4 text-sm">
              <span aria-hidden="true" className="mt-1.5 size-2 shrink-0 rounded-full bg-brand" />
              <span>
                <b className="font-semibold">Es mucho para tus ingresos.</b> Pasa del 30 % de lo que te entra por semana (
                {formatPesos(weeklyIncome)}). Prueba con más tiempo.
              </span>
            </p>
          )}
        </div>
      )}

      <FormField id="vaca-description" label="¿Para qué es? (opcional)" error={errors.description?.message}>
        <Input
          placeholder={personal ? 'Ej. La cuota inicial de la moto' : 'Ej. Hotel y transporte'}
          maxLength={200}
          disabled={disabled}
          {...register('description')}
        />
      </FormField>

      {!personal && (
        <>
          <Controller
            control={control}
            name="split"
            render={({ field }) => (
              <ChipGroup
                legend="Cómo se reparte"
                options={SPLIT_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                disabled={disabled}
              />
            )}
          />
          <p className="-mt-3 text-sm text-ink/60">
            Con partes iguales, a cada miembro le toca la meta dividida entre todos. Con cuotas a medida, un
            administrador pone la de cada uno y lo demás se reparte.
          </p>
        </>
      )}

      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={disabled || isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? 'Guardando…' : initial ? 'Guardar cambios' : personal ? 'Crear meta' : 'Crear vaca'}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
            Cancelar
          </Button>
        )}
      </div>
    </form>
  );
}
