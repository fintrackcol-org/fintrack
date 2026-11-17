import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import MoneyInput from '@/components/common/MoneyInput';
import { todayIso } from '@/components/vacas/vacaFormat';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { debtPaymentSchema } from '@/lib/validation/debt';

/**
 * Hoja "Registrar abono" (FT-0064): cuánto y cuándo. Propone la próxima cuota (o lo pendiente) y,
 * por defecto, también anota el ingreso o el gasto para que el saldo de hoy quede bien. Si el abono
 * cubre todo, la cuenta queda saldada.
 * @param {{ debt: object, money: (n: number) => string, disabled?: boolean, onSubmit: (v: { amount: number, date: string, createTransaction: boolean }) => Promise<void> }} props
 */
export default function PaymentForm({ debt, money, disabled = false, onSubmit }) {
  const receivable = debt.kind === 'receivable';
  const suggested = debt.nextInstallment?.amount ?? debt.pending;
  const [record, setRecord] = useState(true);
  const [serverError, setServerError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    setError,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(debtPaymentSchema),
    defaultValues: { amount: String(suggested), date: todayIso() },
  });

  const submit = handleSubmit(async (values) => {
    setServerError('');
    if (values.amount > debt.pending + 0.004) {
      setError('amount', { message: `No puede pasar de lo que falta (${money(debt.pending)})` });
      return;
    }
    try {
      await onSubmit({ ...values, createTransaction: record });
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field in values) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Registrar abono">
      <p className="text-sm text-ink/70">
        {receivable ? `${debt.person} te debe ` : `Le debes a ${debt.person} `}
        <span className="font-semibold tabular-nums text-ink">{money(debt.pending)}</span>
        {debt.nextInstallment && debt.installments && (
          <>
            {' '}
            · cuota {debt.nextInstallment.number} de {debt.installments}
          </>
        )}
        .
      </p>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <FormField id="payment-amount" label={receivable ? '¿Cuánto te pagó?' : '¿Cuánto pagaste?'} error={errors.amount?.message}>
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
      {suggested !== debt.pending && (
        <button
          type="button"
          className="min-h-11 text-sm font-medium text-brand underline-offset-4 hover:underline"
          onClick={() => setValue('amount', String(debt.pending), { shouldValidate: true })}
          disabled={disabled}
        >
          Todo lo que falta ({money(debt.pending)})
        </button>
      )}
      <FormField id="payment-date" label="¿Cuándo?" error={errors.date?.message}>
        <Input type="date" max={todayIso()} disabled={disabled} {...register('date')} />
      </FormField>
      <label className="flex items-start gap-3 rounded-xl bg-ink/5 p-3 text-sm">
        <Checkbox checked={record} onCheckedChange={(v) => setRecord(v === true)} disabled={disabled} className="mt-0.5" />
        <span>
          <span className="font-medium">{receivable ? 'Anotar el ingreso en Movimientos' : 'Anotar el gasto en Movimientos'}</span>
          <span className="block text-ink/60">Así tu saldo de hoy queda bien.</span>
        </span>
      </label>
      {disabled && <p className="text-sm text-ink/60">Necesitas conexión</p>}
      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={disabled || isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Guardando…' : 'Registrar abono'}
      </Button>
    </form>
  );
}
