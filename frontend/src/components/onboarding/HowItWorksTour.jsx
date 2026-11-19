import { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, Check, Mic, RotateCcw, Users, Wallet } from 'lucide-react';
import { StepTitle } from '@/components/onboarding/OnboardingShell';
import { formatMoney } from '@/components/transactions/format';
import { getRegion } from '@/lib/region';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

/** Deslizar más de esto (px) cambia de paso. */
const SWIPE = 60;
const EASE = [0.32, 0.72, 0, 1];

/** En pesos colombianos se habla en miles («40 mil»); en las demás monedas, el número solo («40»). */
const inThousands = () => getRegion().currency === 'COP';

/** Monto de los ejemplos, en la moneda de la persona: `$ 40.000` en Colombia, `$40` en Estados Unidos. */
const demoMoney = (pesos) => formatMoney(inThousands() ? pesos : pesos / 1000);

/** Lo que se dice en el ejemplo de voz, a la escala de la moneda. */
const said = () => (inThousands() ? t('“gasolina 40 mil”') : t('“gasolina 40”'));

/** Ficha violeta como la del inicio, con el saldo que va bajando a medida que se anota. */
function BalanceIllustration() {
  const reduced = useReducedMotion();
  const [money, setMoney] = useState(100000);
  useEffect(() => {
    if (reduced) return undefined;
    const id = setTimeout(() => setMoney(80000), 1600);
    return () => clearTimeout(id);
  }, [reduced]);
  return (
    <div className="w-full rounded-3xl bg-violet p-5 text-white">
      <p className="text-sm text-white/80">{t('Saldo disponible')}</p>
      <motion.p
        key={money}
        initial={{ opacity: 0.4, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-1 text-4xl font-semibold tabular-nums"
      >
        {demoMoney(money)}
      </motion.p>
      <p className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-sm">{t('Banco + Nequi + efectivo')}</p>
      {money < 100000 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-sm text-white/90">
          − {demoMoney(20000)} {t('· almuerzo')}
        </motion.p>
      )}
    </div>
  );
}

/** Cuándo aparece cada parte del ejemplo de voz (ms): lo dicho, lo que Rinde entendió, lo anotado. */
const VOICE_STEPS = [1300, 2100, 2900];

/**
 * «Anota hablando», contado sin sonido: primero la onda (escucha), luego lo que la persona dijo,
 * después cómo lo entendió Rinde (palabra → categoría, número → monto) y al final el movimiento.
 * Todo ocupa su sitio desde el principio: nada empuja a lo demás al aparecer. Con movimiento
 * reducido se ve el resultado completo de una vez.
 */
function VoiceIllustration() {
  const reduced = useReducedMotion();
  const [phase, setPhase] = useState(reduced ? VOICE_STEPS.length : 0);
  useEffect(() => {
    if (reduced) return undefined;
    const timers = VOICE_STEPS.map((ms, i) => setTimeout(() => setPhase(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [reduced]);

  const phrase = said();
  // «gasolina 40 mil» → lo que nombra el gasto y lo que dice el monto.
  const [word, ...amountWords] = phrase.replace(/[“”]/g, '').split(' ');
  const shown = (from) =>
    cn(
      'transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
      phase >= from ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0',
    );
  const token = 'flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-sm ring-1 ring-ink/10';

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3 self-end rounded-3xl rounded-br-md bg-violet px-4 py-3 text-white">
        <Mic className="size-4 shrink-0" aria-hidden="true" />
        {/* La onda y la frase comparten casilla: el globo no cambia de tamaño al pasar de una a otra. */}
        <span className="grid items-center [&>*]:col-start-1 [&>*]:row-start-1">
          <span aria-hidden="true" className={cn('flex items-center justify-center gap-1 transition-opacity duration-200', phase >= 1 && 'opacity-0')}>
            {[0, 1, 2, 3, 4, 5, 6].map((bar) => (
              <span
                key={bar}
                className="h-4 w-1 rounded-full bg-white motion-safe:animate-voice-wave"
                style={{ animationDelay: `${(bar % 4) * 120}ms` }}
              />
            ))}
          </span>
          <span className={cn('transition-opacity duration-200', phase >= 1 ? 'opacity-100' : 'opacity-0')}>{phrase}</span>
        </span>
      </div>

      <div className={cn('flex flex-wrap justify-end gap-2', shown(2))}>
        <span className={token}>
          <span className="text-ink/60">{word}</span>
          <ArrowRight className="size-3.5 text-ink/40" aria-hidden="true" />
          <span className="font-medium">{t('Transporte')}</span>
        </span>
        <span className={token}>
          <span className="text-ink/60">{amountWords.join(' ')}</span>
          <ArrowRight className="size-3.5 text-ink/40" aria-hidden="true" />
          <span className="font-medium tabular-nums">{demoMoney(40000)}</span>
        </span>
      </div>

      <div className={cn('rounded-2xl bg-surface p-4 ring-1 ring-ink/10', shown(3))}>
        <p className="flex items-center gap-1.5 text-sm text-positive">
          <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />
          {t('Anotado')}
        </p>
        <p className="mt-1 flex justify-between gap-3 font-medium">
          <span>{t('Transporte · gasolina')}</span>
          <span className="tabular-nums text-negative">− {demoMoney(40000)}</span>
        </p>
      </div>
    </div>
  );
}

/** Lo que Mi plata responde cada día. */
function PlanIllustration() {
  return (
    <div className="w-full rounded-3xl bg-surface p-5 ring-1 ring-ink/10">
      <p className="flex items-center gap-2 text-sm text-ink/60">
        <Wallet className="size-4 text-brand" aria-hidden="true" />
        {t('Hoy puedes gastar')}
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{demoMoney(32000)}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
        <motion.div
          className="h-full rounded-full bg-brand"
          initial={{ width: '0%' }}
          animate={{ width: '45%' }}
          transition={{ delay: 0.4, duration: 1, ease: EASE }}
        />
      </div>
      <p className="mt-3 text-sm text-ink/70">{t('Faltan 12 días para tu sueldo y ya apartamos el arriendo.')}</p>
    </div>
  );
}

/** Una vaca con su barra de aportes. */
function VacaIllustration() {
  return (
    <div className="w-full rounded-3xl bg-surface p-5 ring-1 ring-ink/10">
      <p className="flex items-center gap-2 font-medium">
        <Users className="size-4 text-brand" aria-hidden="true" />
        {t('Paseo a Villa de Leyva')}
      </p>
      <p className="mt-1 text-sm text-ink/60">
        {demoMoney(450000)} {t('de')} {demoMoney(600000)} {t('· 4 amigos')}
      </p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
        <motion.div
          className="h-full rounded-full bg-positive"
          initial={{ width: '0%' }}
          animate={{ width: '75%' }}
          transition={{ delay: 0.4, duration: 1, ease: EASE }}
        />
      </div>
    </div>
  );
}

/** Un chat de WhatsApp con Rinde. */
function WhatsappIllustration() {
  return (
    <div className="flex w-full flex-col gap-2 rounded-3xl bg-surface p-4 ring-1 ring-ink/10">
      <p className="self-end rounded-2xl rounded-br-md bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21]">
        {inThousands() ? t('hice 38 mil') : t('hice 38')}
      </p>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.4, ease: EASE }}
        className="self-start rounded-2xl rounded-bl-md bg-surface-muted px-3 py-2 text-sm"
      >
        {t('Listo, anoté un ingreso de')} {demoMoney(38000)}{t('. Hoy llevas')} {demoMoney(38000)}.
      </motion.p>
    </div>
  );
}

/**
 * Pasos del recorrido. El primero viene de FT-0057: sin la plata inicial, el saldo no es el real.
 * Es una función porque los ejemplos dependen de la moneda, que se elige una pantalla antes.
 */
export const tourSteps = () => [
  {
    title: t('Empieza con tu plata de hoy'),
    text: t('Dinos cuánta plata tienes hoy (banco, Nequi y efectivo). Desde ahí sumamos y restamos lo que anotes.'),
    Illustration: BalanceIllustration,
  },
  {
    title: t('Anota hablando'),
    text: inThousands()
      ? t('Di “gasolina 40 mil” o “corte 25 mil” y Rinde lo anota con su categoría. También puedes escribirlo.')
      : t('Di “gasolina 40” o “corte 25” y Rinde lo anota con su categoría. También puedes escribirlo.'),
    Illustration: VoiceIllustration,
  },
  {
    title: t('Mi plata te dice cuánto puedes gastar'),
    text: t('Con tus pagos del mes y el día en que te pagan, te decimos cuánto te alcanza hoy sin quedarte corto.'),
    Illustration: PlanIllustration,
  },
  {
    title: t('Vacas con tus amigos'),
    text: t('Junten plata para un plan, vean quién ya aportó y recuérdenle al que falta.'),
    Illustration: VacaIllustration,
  },
  {
    title: t('También por WhatsApp'),
    text: t('Escríbele a Rinde desde WhatsApp para anotar o preguntar cómo vas, sin abrir la app.'),
    Illustration: WhatsappIllustration,
  },
];

/** Cuántos pasos tiene el recorrido (para el avance de la bienvenida). */
export const TOUR_LENGTH = 5;

/**
 * Un paso del recorrido «Cómo funciona» (FT-0048): arriba, un escenario con una pantalla de Rinde
 * animada y rotulada como ejemplo (no anota nada en la cuenta); abajo, qué es y para qué sirve.
 * Se avanza con el botón de la bienvenida o deslizando; nunca avanza solo ni hace esperar: cada
 * quien lee a su ritmo. El ejemplo se puede repetir.
 *
 * Las ilustraciones son HTML: pesan poco, funcionan sin internet y se entienden sin sonido.
 *
 * @param {{ index: number, onNext: () => void, onBack: () => void }} props
 */
export default function HowItWorksTour({ index, onNext, onBack }) {
  const reduced = useReducedMotion();
  const [run, setRun] = useState(0);
  const steps = tourSteps();
  const { title, text, Illustration } = steps[index];

  return (
    <motion.div
      drag={reduced ? false : 'x'}
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.2}
      onDragEnd={(_, { offset }) => {
        if (offset.x < -SWIPE) onNext();
        else if (offset.x > SWIPE) onBack();
      }}
      className="flex flex-1 touch-pan-y flex-col gap-6"
    >
      <div className="relative flex max-h-80 min-h-72 flex-1 items-center rounded-3xl bg-brand-soft px-4 pb-6 pt-14">
        <p className="absolute left-4 top-4 rounded-full bg-surface px-2.5 py-1 text-xs font-medium text-brand">{t('Ejemplo')}</p>
        {!reduced && (
          <button
            type="button"
            onClick={() => setRun((n) => n + 1)}
            aria-label={t('Repetir el ejemplo')}
            className="absolute right-1.5 top-1.5 grid size-11 place-items-center rounded-full text-brand transition-transform focus-visible:outline-2 focus-visible:outline-violet motion-safe:active:scale-90"
          >
            <RotateCcw className="size-4" aria-hidden="true" />
          </button>
        )}
        <Illustration key={run} />
      </div>
      <div>
        <p className="text-sm font-medium text-brand">
          {t('Cómo funciona · {step} de {total}', { step: index + 1, total: steps.length })}
        </p>
        <StepTitle className="mt-1">{title}</StepTitle>
        <p className="mt-2 text-base text-ink/60">{text}</p>
      </div>
    </motion.div>
  );
}
