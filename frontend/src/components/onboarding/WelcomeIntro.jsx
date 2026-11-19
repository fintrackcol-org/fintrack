import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { LogoMark, Wordmark } from '@/components/common/Logo';
import { StepAction } from '@/components/onboarding/OnboardingShell';
import Rin from '@/components/rin/Rin';
import { Button } from '@/components/ui/button';
import { t } from '@/lib/i18n';

/** Cada bloque llega un poco después del anterior (50 ms): se lee de arriba abajo. */
const after = (n) => ({ animationDelay: `${n * 50}ms` });

/**
 * Primera pantalla de Rinde: la marca, Rin que saluda y la promesa en una frase. Sin barra de avance
 * (todavía no empezó nada) y con dos caminos: empezar, o entrar ya a la app y responder después.
 *
 * Rin saluda una vez al llegar y se queda quieto; no pide nada ni se repite.
 *
 * @param {{ name?: string, busy?: boolean, error?: string, onStart: () => void, onLater: () => void }} props
 */
export default function WelcomeIntro({ name, busy = false, error, onStart, onLater }) {
  const [waving, setWaving] = useState(false);
  useEffect(() => {
    const start = setTimeout(() => setWaving(true), 450);
    const stop = setTimeout(() => setWaving(false), 2100);
    return () => {
      clearTimeout(start);
      clearTimeout(stop);
    };
  }, []);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))]">
      <p style={after(0)} className="flex items-center gap-2 motion-safe:animate-rise">
        <LogoMark className="size-8" />
        <Wordmark className="h-[1.125rem] text-ink" />
        <span className="sr-only">Rinde</span>
      </p>

      {/* Rin y su disco miden según el alto de la pantalla: en un celular bajito se encogen, no se montan sobre el texto. */}
      <div style={after(1)} className="relative flex min-h-[clamp(10rem,30dvh,16rem)] flex-1 items-center justify-center motion-safe:animate-rise">
        {/* El piso de Rin: un disco suave de la marca, sin degradados ni brillo. */}
        <span aria-hidden="true" className="absolute size-[clamp(9.5rem,28dvh,15rem)] rounded-full bg-brand-soft" />
        <Rin
          emotion={waving ? 'feliz' : 'tranquilo'}
          gesture={waving ? 'saludar' : null}
          level={1}
          tidy={1}
          label={t('Rin, la mascota de Rinde, te saluda')}
          className="relative h-[clamp(9rem,26dvh,14rem)] w-auto"
        />
      </div>

      <div>
        {name && (
          <p style={after(2)} className="text-[15px] font-medium text-brand motion-safe:animate-rise">
            {t('Hola, {name}', { name })}
          </p>
        )}
        <h1 style={after(3)} className="mt-1 text-[2rem] font-semibold leading-[1.1] tracking-tight motion-safe:animate-rise">
          {t('Tu plata tiene una historia.')} <span className="text-ink/50">{t('Entendámosla juntos.')}</span>
        </h1>
        <p style={after(4)} className="mt-3 text-base text-ink/60 motion-safe:animate-rise">
          {t('Descubre cómo organizar tu dinero y tomar mejores decisiones.')}
        </p>
      </div>

      <div style={after(5)} className="mt-7 flex flex-col gap-1 motion-safe:animate-rise">
        {error && (
          <p role="alert" className="mb-1 text-sm text-negative">
            {error}
          </p>
        )}
        <StepAction onClick={onStart} disabled={busy}>
          {t('Empezar')}
        </StepAction>
        <Button variant="ghost" onClick={onLater} disabled={busy}>
          {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
          {t('Ahora no')}
        </Button>
      </div>
    </main>
  );
}
