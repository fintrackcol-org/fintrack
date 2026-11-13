import { cn } from '@/lib/utils';
import { EMOTIONS, KAKEIBO, kakeiboOf, toggle } from './reflection';

/**
 * Las 4 caras de "¿Cómo te sentiste?" (FT-0070). Tocar la elegida la quita.
 * `tone="light"` es para fondos violeta (la pantalla de "Gasto guardado").
 * @param {{ value: string|null, onChange: (next: string|null) => void, disabled?: boolean, tone?: 'default'|'light', labelledBy?: string }} props
 */
export function EmotionPicker({ value, onChange, disabled = false, tone = 'default', labelledBy }) {
  const light = tone === 'light';
  return (
    <div role="group" aria-labelledby={labelledBy} className="grid grid-cols-4 gap-2">
      {EMOTIONS.map(({ key, label, icon: Icon }) => {
        const on = value === key;
        return (
          <button
            key={key}
            type="button"
            aria-pressed={on}
            disabled={disabled}
            onClick={() => onChange(toggle(value, key))}
            className={cn(
              'flex min-h-[76px] flex-col items-center justify-center gap-1.5 rounded-2xl px-1 py-2 text-center text-[12px] font-medium leading-tight transition-[background-color,color,transform] motion-safe:active:scale-[0.96] disabled:opacity-60',
              'focus-visible:outline-2 focus-visible:outline-offset-2',
              light
                ? on
                  ? 'bg-white text-brand focus-visible:outline-white'
                  : 'bg-white/15 text-white hover:bg-white/25 focus-visible:outline-white'
                : on
                  ? 'bg-brand text-white focus-visible:outline-violet'
                  : 'bg-ink/5 text-ink/80 hover:bg-ink/10 focus-visible:outline-violet',
            )}
          >
            <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Los 4 grupos Kakeibo como chips, con la pista del elegido debajo. Tocar el elegido lo quita.
 * @param {{ value: string|null, onChange: (next: string|null) => void, disabled?: boolean, labelledBy?: string }} props
 */
export function KakeiboPicker({ value, onChange, disabled = false, labelledBy }) {
  const picked = kakeiboOf(value);
  return (
    <div>
      <div role="group" aria-labelledby={labelledBy} className="flex flex-wrap gap-2">
        {KAKEIBO.map(({ key, label }) => {
          const on = value === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={on}
              disabled={disabled}
              onClick={() => onChange(toggle(value, key))}
              className={cn(
                'min-h-11 rounded-full px-4 text-[15px] font-medium transition-[background-color,color,transform] motion-safe:active:scale-[0.96] disabled:opacity-60',
                'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet',
                on ? 'bg-brand text-white' : 'bg-ink/5 text-ink/80 hover:bg-ink/10',
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[13px] text-ink/60" aria-live="polite">
        {picked ? picked.hint : 'Elige el grupo que mejor lo describe. Es opcional.'}
      </p>
    </div>
  );
}
