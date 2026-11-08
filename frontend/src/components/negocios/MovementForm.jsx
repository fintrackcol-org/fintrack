import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, X } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import ChipGroup from '@/components/common/ChipGroup';
import MoneyInput from '@/components/common/MoneyInput';
import { CATEGORY_OPTIONS, KIND_OPTIONS, MOVEMENT_KINDS } from '@/components/negocios/movementFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { businessMovementSchema } from '@/lib/validation/businessMovement';

/**
 * "Nueva categoría" y "Quitar" de las categorías propias del negocio (FT-0058).
 * @param {{ categories: Array<{ key: string, name: string }>, disabled: boolean, onCreate: (name: string) => Promise<void>, onDelete: (key: string) => Promise<void> }} props
 */
function CustomCategories({ categories, disabled, onCreate, onDelete }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const run = async (action) => {
    setBusy(true);
    setError('');
    try {
      await action();
    } catch (err) {
      setError(Object.values(err.fields ?? {})[0] ?? err.message);
    } finally {
      setBusy(false);
    }
  };
  const create = () =>
    run(async () => {
      await onCreate(name.trim());
      setName('');
    });
  if (!open) {
    return (
      <button
        type="button"
        className="mt-2 text-sm font-medium text-violet-light underline-offset-4 hover:underline disabled:opacity-50"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        {categories.length ? 'Editar mis categorías' : '+ Crear una categoría'}
      </button>
    );
  }
  return (
    <div className="mt-3 space-y-3 rounded-2xl bg-ink/5 p-3">
      <div className="flex gap-2">
        <Input
          aria-label="Nombre de la categoría"
          maxLength={30}
          placeholder="Ej.: Empaques"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            // Enter crea la categoría, no envía el movimiento.
            if (e.key !== 'Enter') return;
            e.preventDefault();
            if (name.trim() && !busy) create();
          }}
          disabled={disabled || busy}
        />
        <Button type="button" variant="soft" disabled={disabled || busy || !name.trim()} onClick={create}>
          {busy ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Plus aria-hidden="true" />} Crear
        </Button>
      </div>
      {categories.length > 0 && (
        <ul className="flex flex-wrap gap-2" aria-label="Mis categorías">
          {categories.map((c) => (
            <li key={c.key} className="flex items-center gap-1 rounded-full bg-surface py-1 pl-3 pr-1 text-sm">
              <span className="max-w-40 truncate">{c.name}</span>
              <button
                type="button"
                className="grid size-6 place-items-center rounded-full text-ink/60 hover:bg-ink/10 hover:text-ink"
                aria-label={`Quitar la categoría ${c.name}`}
                disabled={disabled || busy}
                onClick={() => run(() => onDelete(c.key))}
              >
                <X className="size-3.5" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <p className="text-xs text-ink/60">Al quitar una, sus movimientos pasan a «Otros».</p>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}

/**
 * Formulario para registrar un movimiento del negocio (FT-0017). Al cambiar el tipo se propone su
 * categoría (venta → Ventas, costo → Insumos…), que se puede cambiar. Con `onCreateCategory`, también
 * se crean y quitan categorías propias del negocio (FT-0058).
 * @param {{ today: string, disabled?: boolean, onSubmit: (data: object) => Promise<void>, customCategories?: Array<{ key: string, name: string }>, onCreateCategory?: (name: string) => Promise<{ key: string, name: string }>, onDeleteCategory?: (key: string) => Promise<void> }} props
 */
export default function MovementForm({
  today,
  disabled = false,
  onSubmit,
  customCategories = [],
  onCreateCategory,
  onDeleteCategory,
}) {
  const [kind, setKind] = useState('sale');
  const [category, setCategory] = useState(MOVEMENT_KINDS.sale.category);
  const [serverError, setServerError] = useState('');
  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(businessMovementSchema(today)),
    defaultValues: { amount: '', description: '', date: today },
  });

  const pickKind = (value) => {
    setKind(value);
    setCategory(MOVEMENT_KINDS[value].category);
  };

  const submit = handleSubmit(async (values) => {
    setServerError('');
    try {
      await onSubmit({ kind, category, ...values, localId: crypto.randomUUID() });
    } catch (err) {
      for (const [field, problem] of Object.entries(err.fields ?? {})) {
        if (field in values) setError(field, { message: problem });
      }
      setServerError(err.message);
    }
  });

  return (
    <form onSubmit={submit} noValidate className="space-y-4" aria-label="Registrar movimiento del negocio">
      <div>
        <ChipGroup legend="¿Qué fue?" options={KIND_OPTIONS} value={kind} onChange={pickKind} disabled={disabled} scroll />
        <p className="mt-1.5 text-sm text-ink/60">{MOVEMENT_KINDS[kind].hint}.</p>
      </div>
      <Controller
        control={control}
        name="amount"
        render={({ field }) => (
          <FormField id="mov-amount" label="Monto (COP)" error={errors.amount?.message}>
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
      <FormField id="mov-description" label="Descripción" error={errors.description?.message}>
        <Input
          autoComplete="off"
          maxLength={120}
          placeholder={MOVEMENT_KINDS[kind].income ? 'Ej.: 20 arepas de queso' : 'Ej.: harina y queso'}
          disabled={disabled}
          {...register('description')}
        />
      </FormField>
      <div>
        <ChipGroup
          legend="Categoría"
          options={[...CATEGORY_OPTIONS, ...customCategories.map(({ key, name }) => ({ value: key, label: name }))]}
          value={category}
          onChange={setCategory}
          disabled={disabled}
          scroll
        />
        {onCreateCategory && (
          <CustomCategories
            categories={customCategories}
            disabled={disabled}
            onCreate={async (name) => setCategory((await onCreateCategory(name)).key)}
            onDelete={async (key) => {
              await onDeleteCategory(key);
              if (category === key) setCategory(MOVEMENT_KINDS[kind].category);
            }}
          />
        )}
      </div>
      <FormField id="mov-date" label="Fecha" error={errors.date?.message}>
        <Input type="date" max={today} disabled={disabled} {...register('date')} />
      </FormField>
      {disabled && <p className="text-sm text-ink/60">Necesitas conexión</p>}
      {serverError && (
        <p role="alert" className="text-sm text-negative">
          {serverError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={disabled || isSubmitting}>
        {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
        {isSubmitting ? 'Guardando…' : `Registrar ${MOVEMENT_KINDS[kind].label.toLowerCase()}`}
      </Button>
    </form>
  );
}
