import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import MoneyInput from '@/components/common/MoneyInput';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { contributionSchema } from '@/lib/validation/vaca';
import { formatPesos, todayIso } from './vacaFormat';
import { t } from '@/lib/i18n';

/** Categoría del gasto que deja el aporte si no se elige otra (la misma que usa el servidor). */
export const DEFAULT_CATEGORY = 'ahorro_inversion';

/**
 * @returns {{ amount: string, date: string, note: string, category: string }}
 */
function emptyValues() {
  return { amount: '', date: todayIso(), note: '', category: DEFAULT_CATEGORY };
}

/**
 * Formulario para aportar a una vaca. Funciona sin conexión: el aporte queda en el dispositivo y
 * se envía al volver la red (lo decide quien lo usa en `onSubmit`).
 *
 * @param {object} props
 * @param {import('@/services/transactionService').Category[]} props.categories Categorías de gasto.
 * @param {number} props.myRemaining Lo que le falta al usuario para su cuota (botón de atajo).
 * @param {(values: { amount: number, date: string, note: string|null, category: string }) => Promise<void>} props.onSubmit
 */
export default function ContributionForm({ categories, myRemaining, onSubmit }) {
  const [serverError, setServerError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(contributionSchema), defaultValues: emptyValues() });

  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await onSubmit({ ...values, note: values.note || null });
      reset(emptyValues());
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field in emptyValues()) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  // Si la lista aún no carga (o no incluye la categoría por defecto), igual se puede aportar.
  const options = categories.some((c) => c.key === DEFAULT_CATEGORY)
    ? categories
    : [{ key: DEFAULT_CATEGORY, name: t('Ahorro/Inversión') }, ...categories];

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label={t('Registrar aporte')}>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <FormField id="contribution-amount" label={t('Monto del aporte (COP)')} error={errors.amount?.message}>
            <MoneyInput
              name={field.name}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              ref={field.ref}
              placeholder="0"
            />
          </FormField>
        )}
      />
      {myRemaining > 0 && (
        <button
          type="button"
          className="-mt-2 text-sm font-medium text-brand underline-offset-4 hover:underline"
          onClick={() => setValue('amount', String(Math.round(myRemaining)), { shouldValidate: true })}
        >
          {t('Poner lo que me falta (')}{formatPesos(myRemaining)})
        </button>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <FormField id="contribution-date" label={t('Fecha')} error={errors.date?.message}>
          <Input type="date" max={todayIso()} {...register('date')} />
        </FormField>
        <FormField id="contribution-category" label={t('Queda en mis gastos como')} error={errors.category?.message}>
          <Select {...register('category')}>
            {options.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </Select>
        </FormField>
      </div>

      <FormField id="contribution-note" label={t('Nota (opcional)')} error={errors.note?.message}>
        <Input placeholder={t('Ej. Mi parte de octubre')} maxLength={120} {...register('note')} />
      </FormField>

      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? t('Guardando…') : t('Aportar')}
      </Button>
    </form>
  );
}
