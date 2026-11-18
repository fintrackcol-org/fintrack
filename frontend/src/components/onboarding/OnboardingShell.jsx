import { useEffect, useRef } from 'react';
import { ChevronLeft } from 'lucide-react';
import RindeLine from '@/components/common/RindeLine';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

/**
 * Marco de todas las pantallas de la bienvenida después del saludo: arriba, Atrás, el avance y
 * Omitir, siempre en el mismo sitio; abajo, una sola acción principal al alcance del pulgar.
 * El avance es uno solo para todo el recorrido (la «línea que rinde» de la marca), no uno por tramo.
 *
 * Al cambiar de pantalla el contenido entra desde el lado hacia el que se avanza y el foco pasa al
 * título, para que quien usa teclado o lector de pantalla sepa que cambió.
 *
 * @param {object} props
 * @param {number} props.step Pantalla actual, desde 1.
 * @param {number} props.total Cuántas pantallas son.
 * @param {1|-1} props.direction Hacia dónde se llegó: 1 avanzando, -1 volviendo.
 * @param {() => void} props.onBack
 * @param {() => void} props.onSkip Omite esta pantalla (o este tramo), nunca lo ya respondido.
 * @param {boolean} [props.busy] Guardando: no se puede volver ni omitir.
 * @param {string} [props.error]
 * @param {React.ReactNode} props.action El botón principal.
 * @param {React.ReactNode} props.children
 */
export default function OnboardingShell({ step, total, direction, onBack, onSkip, busy = false, error, action, children }) {
  const content = useRef(null);

  useEffect(() => {
    window.scrollTo(0, 0);
    // Un campo con `autoFocus` ya tomó el foco: no se le quita.
    if (content.current?.contains(document.activeElement)) return;
    content.current?.querySelector('h1')?.focus({ preventScroll: true });
  }, [step]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-4 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <header className="flex items-center gap-1">
        <button
          type="button"
          onClick={onBack}
          disabled={busy}
          aria-label={t('Atrás')}
          className="-ml-2.5 grid size-11 shrink-0 place-items-center rounded-full text-ink/70 transition-colors hover:text-ink focus-visible:outline-2 focus-visible:outline-violet disabled:opacity-50"
        >
          <ChevronLeft className="size-5" aria-hidden="true" />
        </button>
        <div
          role="progressbar"
          aria-label={t('Avance de la bienvenida')}
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={step}
          aria-valuetext={t('Paso {step} de {total}', { step, total })}
          className="flex-1 px-2"
        >
          <RindeLine value={step / total} tone="surface" className="h-1.5" />
        </div>
        <Button variant="ghost" disabled={busy} onClick={onSkip} className="-mr-3 px-3 text-[15px]">
          {t('Omitir')}
        </Button>
      </header>

      <div
        key={step}
        ref={content}
        className={cn(
          'flex flex-1 flex-col pt-6 [&_h1]:outline-none',
          direction > 0 ? 'motion-safe:animate-page-in' : 'motion-safe:animate-page-back',
        )}
      >
        {children}
      </div>

      <div className="sticky bottom-0 -mx-4 mt-6 flex flex-col gap-2 bg-canvas px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}
        {action}
      </div>
    </main>
  );
}

/** Título de una pantalla de la bienvenida. Recibe el foco al llegar (ver `OnboardingShell`). */
export function StepTitle({ children, className }) {
  return (
    <h1 tabIndex={-1} className={cn('text-[1.75rem] font-semibold leading-tight tracking-tight', className)}>
      {children}
    </h1>
  );
}

/** Botón principal de la bienvenida: alto, de todo el ancho y que responde al toque. */
export function StepAction({ className, ...props }) {
  return (
    <Button
      size="lg"
      className={cn('w-full motion-safe:transition-[background-color,transform] motion-safe:active:scale-[0.98]', className)}
      {...props}
    />
  );
}
