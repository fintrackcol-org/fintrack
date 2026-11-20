import { useId, useState } from 'react';
import { Pencil, Plus, Sparkles } from 'lucide-react';
import NewCategoryDialog, { deletedMessage } from '@/components/categories/NewCategoryDialog';
import { getCategoryStyle } from '@/lib/categoryStyles';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

/** Valor de la opción "que la IA la sugiera" (la API recibe `category: null`). */
export const AUTO_CATEGORY = '';

/**
 * Cuadrícula de categorías con ícono y color, en lugar de una lista desplegable.
 * Son radios nativos ocultos (flechas del teclado, lector de pantalla, envío del formulario).
 *
 * @param {object} props
 * @param {string} props.legend
 * @param {import('@/services/transactionService').Category[]} props.categories
 * @param {string} props.value Clave elegida; `AUTO_CATEGORY` para la opción de IA.
 * @param {(value: string) => void} props.onChange
 * @param {boolean} [props.allowAuto] Muestra primero la opción "Sugerir con IA".
 * @param {string} [props.error] Mensaje de validación.
 * @param {boolean} [props.disabled]
 * @param {(el: HTMLInputElement|null) => void} [props.inputRef] Ref al primer radio (para enfocar al fallar la validación).
 * @param {'gasto'|'ingreso'} [props.createType] Muestra al final "Nueva" para crear una categoría propia
 *   de ese tipo (al crearla queda elegida) y un lápiz en las propias para editarlas o eliminarlas.
 * @param {boolean} [props.chips] Pastillas de texto como las de Anotar, en vez de cuadros con ícono.
 */
export default function CategoryPicker({
  legend,
  categories,
  value,
  onChange,
  allowAuto = false,
  error,
  disabled,
  inputRef,
  createType,
  chips = false,
}) {
  const name = useId();
  const [dialog, setDialog] = useState(null); // { category? } con la ventana abierta
  const [status, setStatus] = useState('');
  const errorId = `${name}-error`;
  const options = [...(allowAuto ? [{ key: AUTO_CATEGORY, name: chips ? t('Que la elija la IA') : t('Sugerir con IA'), auto: true }] : []), ...categories];

  return (
    <fieldset disabled={disabled} aria-describedby={error ? errorId : undefined} className="min-w-0">
      <legend className={chips ? 'mb-1.5 text-xs font-semibold uppercase tracking-[0.08em] text-ink/60' : 'mb-2 text-sm font-medium text-ink/80'}>
        {legend}
      </legend>
      <div className={chips ? 'flex flex-wrap gap-1.5' : 'grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3'}>
        {options.map((c, index) => {
          const checked = value === c.key;
          const { icon: Icon, className: tone } = c.auto
            ? { icon: Sparkles, className: 'bg-brand-soft text-brand' }
            : getCategoryStyle(c.key);
          const editable = Boolean(createType && c.custom);
          const tile = (
            <label
              key={c.key || 'auto'}
              className={cn(
                'cursor-pointer transition-colors',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-violet',
                'has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-50',
                chips
                  ? cn(
                      'flex h-11 items-center gap-1 rounded-lg px-3 text-[13px] font-semibold',
                      editable && 'rounded-r-none pr-1.5',
                      checked ? 'bg-brand text-white' : 'bg-brand-soft text-ink',
                      error && !checked && 'ring-1 ring-inset ring-negative/50',
                    )
                  : cn(
                      'flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-center text-xs font-medium leading-tight',
                      checked
                        ? 'border-brand bg-brand-soft/60 text-ink ring-1 ring-brand'
                        : error
                          ? 'border-negative/50 text-ink/75 hover:text-ink'
                          : 'border-ink/10 text-ink/75 hover:border-ink/25 hover:text-ink',
                    ),
              )}
            >
              <input
                ref={index === 0 ? inputRef : undefined}
                type="radio"
                name={name}
                value={c.key}
                checked={checked}
                onChange={() => onChange(c.key)}
                className="sr-only"
              />
              {chips ? (
                <>
                  {c.auto && <Sparkles className="size-3.5" aria-hidden="true" />}
                  {c.name}
                </>
              ) : (
                <>
                  <span aria-hidden="true" className={cn('grid size-9 place-items-center rounded-lg', tone)}>
                    <Icon className="size-[18px]" />
                  </span>
                  <span className="line-clamp-2">{c.name}</span>
                </>
              )}
            </label>
          );
          if (!editable) return tile;
          // Las propias llevan un lápiz en la esquina; va junto a la etiqueta y no dentro, porque
          // un botón dentro de la etiqueta también elegiría la categoría.
          return (
            <div key={c.key} className={chips ? 'flex' : 'relative grid'}>
              {tile}
              <button
                type="button"
                onClick={() => {
                  setStatus('');
                  setDialog({ category: c });
                }}
                aria-label={t('Editar {name}', { name: c.name })}
                className={cn(
                  'grid place-items-center transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                  chips
                    ? cn('h-11 w-9 rounded-r-lg', checked ? 'bg-brand text-white/80 hover:text-white' : 'bg-brand-soft text-ink/60 hover:text-ink')
                    : 'absolute right-0 top-0 size-7 rounded-lg text-ink/50 hover:bg-ink/5 hover:text-ink',
                )}
              >
                <Pencil className="size-3.5" aria-hidden="true" />
              </button>
            </div>
          );
        })}
        {/*
          Mientras llegan las categorías (11 de gasto en el catálogo) se reserva su espacio: sin saltos
          de layout. Sin animación de carga: si la petición falla, la página ya muestra el error.
        */}
        {createType && categories.length > 0 && (
          <button
            type="button"
            onClick={() => {
              setStatus('');
              setDialog({});
            }}
            className={
              chips
                ? 'flex h-11 items-center gap-1 rounded-lg bg-surface px-3 text-[13px] font-semibold text-brand ring-1 ring-ink/10 focus-visible:outline-2 focus-visible:outline-violet'
                : 'flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-ink/25 px-1.5 py-2.5 text-center text-xs font-medium leading-tight text-ink/70 transition-colors hover:border-brand/50 hover:text-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet'
            }
          >
            {chips ? (
              <Plus className="size-3.5" aria-hidden="true" />
            ) : (
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-lg bg-ink/5">
                <Plus className="size-[18px]" />
              </span>
            )}
            {t('Nueva')}
          </button>
        )}
        {categories.length === 0 &&
          Array.from({ length: chips ? 6 : 11 }, (_, i) => (
            <div key={i} aria-hidden="true" className={chips ? 'h-11 w-24 rounded-lg bg-ink/5' : 'min-h-[84px] rounded-xl bg-ink/5'} />
          ))}
      </div>
      {error && (
        <p id={errorId} className="mt-2 text-sm text-negative">
          {error}
        </p>
      )}
      {createType && (
        <>
          <p role="status" className="mt-2 text-sm text-positive empty:hidden">
            {status}
          </p>
          <NewCategoryDialog
            open={Boolean(dialog)}
            type={createType}
            category={dialog?.category && { ...dialog.category, type: createType }}
            onClose={() => setDialog(null)}
            onCreated={(category) => {
              // Una nueva queda elegida; al editar se conserva la que estaba elegida.
              if (dialog?.category) setStatus(t('Cambios guardados.'));
              else onChange(category.key);
            }}
            onDeleted={(category, moved) => {
              // Si era la elegida, se vuelve a la opción por defecto.
              if (value === category.key) onChange(allowAuto ? AUTO_CATEGORY : '');
              setStatus(deletedMessage(moved, category.type));
            }}
          />
        </>
      )}
    </fieldset>
  );
}
