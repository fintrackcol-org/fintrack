import { useEffect, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import MoneyInput from '@/components/common/MoneyInput';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { NETWORK_LABELS, TIERS, cardLabel } from '@/lib/cardStyles';
import { cardEditSchema, cardSchema } from '@/lib/validation/card';
import CreditCardArt from './CreditCardArt';
import { t } from '@/lib/i18n';

/** @param {object|null} initial */
function toDefaults(initial) {
  return {
    network: initial?.network ?? 'visa',
    tier: initial?.tier ?? 'clasica',
    last4: initial?.last4 ?? '',
    name: initial?.name ?? '',
    limit: initial ? String(initial.limit) : '',
    available: '',
    paymentDay: initial ? String(initial.paymentDay) : '',
    cutoffDay: initial?.cutoffDay ? String(initial.cutoffDay) : '',
    expiry: initial?.expiryMonth ? `${String(initial.expiryMonth).padStart(2, '0')}/${String(initial.expiryYear).slice(2)}` : '',
  };
}

/**
 * Pone la barra sola mientras se escribe: "032" → "03/2". Solo dígitos, máximo MM/AA.
 * @param {string} raw
 */
export function formatExpiry(raw) {
  const digits = raw.replace(/\D/g, '').slice(0, 4);
  return digits.length > 2 ? `${digits.slice(0, 2)}/${digits.slice(2)}` : digits;
}

/** "03/27" → { expiryMonth: 3, expiryYear: 2027 }; vacío → ambos `null`. */
function parseExpiry(value) {
  if (!value) return { expiryMonth: null, expiryYear: null };
  const [mm, yy] = value.split('/');
  return { expiryMonth: Number(mm), expiryYear: 2000 + Number(yy) };
}

/**
 * Galería de tarjetas dibujadas agrupadas por franquicia; tocar una elige el tipo.
 * @param {{ network: string, tier: string, last4: string, disabled?: boolean, onPick: (network: string, tier: string) => void }} props
 */
function CardGallery({ network, tier, last4, disabled, onPick }) {
  return (
    <fieldset className="min-w-0 space-y-3" disabled={disabled}>
      <legend className="mb-2 text-sm font-medium text-ink/80">{t('Tipo de tarjeta')}</legend>
      {Object.entries(TIERS).map(([net, tiers]) => (
        <div key={net}>
          <p className="mb-1 text-xs font-medium text-ink/60">{NETWORK_LABELS[net]}</p>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
            {tiers.map((t) => {
              const selected = net === network && t === tier;
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={selected}
                  aria-label={cardLabel(net, t)}
                  onClick={() => onPick(net, t)}
                  className={`min-h-11 shrink-0 rounded-2xl p-0.5 focus-visible:outline-2 focus-visible:outline-violet ${selected ? 'ring-2 ring-brand' : 'opacity-70'}`}
                >
                  <CreditCardArt network={net} tier={t} last4={last4 || '0000'} size="sm" />
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

/**
 * Formulario de tarjeta de crédito: una sola pantalla con 5 campos; nombre y día de corte
 * quedan en "Más detalles". En edición no pide "Cupo disponible hoy".
 *
 * @param {object} props
 * @param {object|null} [props.initial] Tarjeta a editar.
 * @param {boolean} [props.disabled] Sin conexión.
 * @param {(values: object) => Promise<void>} props.onSubmit Debe lanzar un `Error` si falla.
 * @param {() => void} [props.onCancel]
 * @param {Record<string, string>} [props.initialErrors] Errores por campo ya conocidos (p. ej. del servidor).
 */
export default function CardForm({ initial = null, disabled = false, onSubmit, onCancel, initialErrors }) {
  const [serverError, setServerError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ resolver: zodResolver(initial ? cardEditSchema : cardSchema), defaultValues: toDefaults(initial),
    errors: initialErrors && Object.fromEntries(Object.entries(initialErrors).map(([k, message]) => [k, { message }])),
  });

  useEffect(() => {
    reset(toDefaults(initial));
    setServerError('');
  }, [initial, reset]);

  const [network, tier, last4, name, expiry] = watch(['network', 'tier', 'last4', 'name', 'expiry']);
  const digits = /^\d{4}$/.test(last4) ? last4 : '····';

  const submit = handleSubmit(async (v) => {
    setServerError('');
    const data = {
      network: v.network,
      tier: v.tier,
      last4: v.last4,
      limit: v.limit,
      paymentDay: v.paymentDay,
      ...(v.name && { name: v.name }),
    };
    const exp = parseExpiry(v.expiry);
    // Al crear, sin fecha no se manda nada; al editar, vacío la borra.
    if (initial || exp.expiryMonth) Object.assign(data, exp);
    if (initial) data.cutoffDay = v.cutoffDay === '' ? null : v.cutoffDay;
    else {
      data.available = v.available;
      if (v.cutoffDay !== '') data.cutoffDay = v.cutoffDay;
    }
    try {
      await onSubmit(data);
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        const key = field === 'expiryMonth' || field === 'expiryYear' ? 'expiry' : field;
        if (key in toDefaults(null)) setError(key, { message: problem });
      }
      setServerError(err.message);
    }
  });

  const money = (nameKey, id, label, hint) => (
    <Controller
      control={control}
      name={nameKey}
      render={({ field }) => (
        <FormField id={id} label={label} error={errors[nameKey]?.message}>
          <MoneyInput name={field.name} value={field.value} onChange={field.onChange} onBlur={field.onBlur} ref={field.ref} placeholder="0" disabled={disabled} />
        </FormField>
      )}
    />
  );

  return (
    <form onSubmit={submit} noValidate className="space-y-5" aria-label={initial ? t('Editar tarjeta') : t('Nueva tarjeta')}>
      <div className="flex justify-center">
        <CreditCardArt network={network} tier={tier} last4={digits} name={name || `${cardLabel(network, tier)} ••${digits}`}
          expiry={/^\d{2}\/\d{2}$/.test(expiry) ? expiry : undefined}
          size="lg"
        />
      </div>
      <CardGallery
        network={network}
        tier={tier}
        last4={/^\d{4}$/.test(last4) ? last4 : ''}
        disabled={disabled}
        onPick={(n, t) => {
          setValue('network', n);
          setValue('tier', t, { shouldValidate: true });
        }}
      />
      {errors.tier && <p className="text-sm text-negative">{errors.tier.message}</p>}

      <FormField id="card-last4" label={t('Últimos 4 dígitos')} error={errors.last4?.message}>
        <Input inputMode="numeric" autoComplete="off" maxLength={4} placeholder="1234" disabled={disabled} {...register('last4')} />
      </FormField>
      <Controller
        control={control}
        name="expiry"
        render={({ field }) => (
          <FormField id="card-expiry" label={t('Vence (MM/AA, opcional)')} error={errors.expiry?.message}>
            <Input
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="03/27"
              maxLength={5}
              disabled={disabled}
              name={field.name}
              value={field.value}
              onChange={(e) => field.onChange(formatExpiry(e.target.value))}
              onBlur={field.onBlur}
              ref={field.ref}
            />
          </FormField>
        )}
      />
      <p className="-mt-3 text-sm text-ink/60">{t('Te avisamos 2 meses antes para que pidas la nueva.')}</p>
      {money('limit', 'card-limit', t('Cupo total'))}
      {!initial && (
        <>
          {money('available', 'card-available', t('Cupo disponible hoy'))}
          <p className="-mt-3 text-sm text-ink/60">{t('Los ves en la app de tu banco')}</p>
        </>
      )}
      <FormField id="card-payment-day" label={t('Día de pago')} error={errors.paymentDay?.message}>
        <Input inputMode="numeric" autoComplete="off" maxLength={2} placeholder="15" disabled={disabled} {...register('paymentDay')} />
      </FormField>

      <details open={Boolean(errors.name || errors.cutoffDay) || undefined} className="rounded-xl border border-ink/10 p-3">
        <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">{t('Más detalles')}</summary>
        <div className="mt-3 space-y-5">
          <FormField id="card-name" label={t('Nombre (opcional)')} error={errors.name?.message}>
            <Input maxLength={40} placeholder={`${cardLabel(network, tier)} ••${digits}`} disabled={disabled} {...register('name')} />
          </FormField>
          <FormField id="card-cutoff-day" label={t('Día de corte (opcional)')} error={errors.cutoffDay?.message}>
            <Input inputMode="numeric" autoComplete="off" maxLength={2} placeholder="1" disabled={disabled} {...register('cutoffDay')} />
          </FormField>
        </div>
      </details>

      {disabled && <p className="text-sm text-ink/60">{t('Necesitas conexión')}</p>}
      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="submit" size="lg" className="flex-1" disabled={disabled || isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? t('Guardando…') : initial ? t('Guardar cambios') : t('Agregar tarjeta')}
        </Button>
        {onCancel && (
          <Button type="button" variant="outline" size="lg" onClick={onCancel} disabled={isSubmitting}>
            {t('Cancelar')}
          </Button>
        )}
      </div>
    </form>
  );
}
