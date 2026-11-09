import { useEffect, useState } from 'react';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { ChevronLeft, Mic, Pause, Play, Users, Wallet } from 'lucide-react';
import { LogoMark } from '@/components/common/Logo';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/** Cuánto dura cada paso cuando avanza solo. */
export const STEP_MS = 7000;
/** Deslizar más de esto (px) cambia de paso. */
const SWIPE = 60;
const EASE = [0.32, 0.72, 0, 1];

/** Monto en pesos sin decimales, como en el resto de la app. */
const pesos = (n) => `$ ${n.toLocaleString('es-CO')}`;

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
    <div className="w-full rounded-3xl bg-violet p-5 text-white shadow-[0_20px_40px_-20px_rgb(97_66_255/0.7)]">
      <p className="text-sm text-white/80">Saldo disponible</p>
      <motion.p
        key={money}
        initial={{ opacity: 0.4, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        className="mt-1 text-4xl font-semibold tabular-nums"
      >
        {pesos(money)}
      </motion.p>
      <p className="mt-3 rounded-full bg-white/15 px-3 py-1 text-sm">Banco + Nequi + efectivo</p>
      {money < 100000 && (
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-sm text-white/90">
          − {pesos(20000)} · almuerzo
        </motion.p>
      )}
    </div>
  );
}

/** Lo que dice el usuario y cómo queda anotado. */
function VoiceIllustration() {
  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex items-center gap-3 self-end rounded-3xl rounded-br-md bg-violet px-4 py-3 text-white">
        <Mic className="size-4" aria-hidden="true" />
        <span>“gasolina 40 mil”</span>
      </div>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.4, ease: EASE }}
        className="rounded-2xl border border-ink/10 bg-surface p-4"
      >
        <p className="text-sm text-ink/60">Anotado</p>
        <p className="mt-1 flex justify-between font-medium">
          <span>Transporte · gasolina</span>
          <span className="tabular-nums text-negative">− {pesos(40000)}</span>
        </p>
      </motion.div>
    </div>
  );
}

/** Lo que Mi plata responde cada día. */
function PlanIllustration() {
  return (
    <div className="w-full rounded-3xl border border-ink/10 bg-surface p-5">
      <p className="flex items-center gap-2 text-sm text-ink/60">
        <Wallet className="size-4 text-brand" aria-hidden="true" />
        Hoy puedes gastar
      </p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{pesos(32000)}</p>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-ink/10">
        <motion.div
          className="h-full rounded-full bg-brand"
          initial={{ width: '0%' }}
          animate={{ width: '45%' }}
          transition={{ delay: 0.4, duration: 1, ease: EASE }}
        />
      </div>
      <p className="mt-3 text-sm text-ink/70">Faltan 12 días para tu sueldo y ya apartamos el arriendo.</p>
    </div>
  );
}

/** Una vaca con su barra de aportes. */
function VacaIllustration() {
  return (
    <div className="w-full rounded-3xl border border-ink/10 bg-surface p-5">
      <p className="flex items-center gap-2 font-medium">
        <Users className="size-4 text-brand" aria-hidden="true" />
        Paseo a Villa de Leyva
      </p>
      <p className="mt-1 text-sm text-ink/60">
        {pesos(450000)} de {pesos(600000)} · 4 amigos
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
    <div className="flex w-full flex-col gap-2 rounded-3xl bg-ink/5 p-4">
      <p className="self-end rounded-2xl rounded-br-md bg-[#d9fdd3] px-3 py-2 text-sm text-[#111b21]">hice 38 mil</p>
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.9, duration: 0.4, ease: EASE }}
        className="self-start rounded-2xl rounded-bl-md bg-white px-3 py-2 text-sm text-[#111b21]"
      >
        Listo, anoté un ingreso de {pesos(38000)}. Hoy llevas {pesos(38000)}.
      </motion.p>
    </div>
  );
}

/** Pasos del recorrido. El primero viene de FT-0057: sin la plata inicial, el saldo no es el real. */
export const TOUR_STEPS = [
  {
    title: 'Empieza con tu plata de hoy',
    text: 'Dinos cuánta plata tienes hoy (banco, Nequi y efectivo). Desde ahí sumamos y restamos lo que anotes.',
    Illustration: BalanceIllustration,
  },
  {
    title: 'Anota hablando',
    text: 'Di “gasolina 40 mil” o “corte 25 mil” y Rinde lo anota con su categoría. También puedes escribirlo.',
    Illustration: VoiceIllustration,
  },
  {
    title: 'Mi plata te dice cuánto puedes gastar',
    text: 'Con tus pagos del mes y el día en que te pagan, te decimos cuánto te alcanza hoy sin quedarte corto.',
    Illustration: PlanIllustration,
  },
  {
    title: 'Vacas con tus amigos',
    text: 'Junten plata para un plan, vean quién ya aportó y recuérdenle al que falta.',
    Illustration: VacaIllustration,
  },
  {
    title: 'También por WhatsApp',
    text: 'Escríbele a Rinde desde WhatsApp para anotar o preguntar cómo vas, sin abrir la app.',
    Illustration: WhatsappIllustration,
  },
];

/**
 * Recorrido "Cómo funciona" (FT-0048): primero un saludo con dos caminos y luego los pasos, que
 * avanzan solos o deslizando, con barra de progreso, pausa y Saltar. Las ilustraciones son
 * pantallas de Rinde animadas: pesan poco y funcionan sin internet.
 *
 * @param {{ name?: string, onDone: () => void }} props `onDone`: terminó o saltó; sigue la bienvenida.
 */
export default function HowItWorksTour({ name, onDone }) {
  const reduced = useReducedMotion();
  const [step, setStep] = useState(-1); // -1: el saludo
  const [direction, setDirection] = useState(1);
  const [paused, setPaused] = useState(false);
  const last = TOUR_STEPS.length - 1;
  // Con movimiento reducido no avanza solo: cada quien va a su ritmo.
  const auto = step >= 0 && !paused && !reduced;

  const go = (to) => {
    if (to > last) return onDone();
    if (to < 0) return undefined;
    setDirection(to > step ? 1 : -1);
    setStep(to);
    return undefined;
  };

  useEffect(() => {
    if (!auto) return undefined;
    const id = setTimeout(() => (step === last ? setPaused(true) : go(step + 1)), STEP_MS);
    return () => clearTimeout(id);
    // `go` cambia en cada render; el paso es lo que importa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, step]);

  if (step === -1) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-6 text-center">
        <LogoMark className="size-16" />
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">{name ? `Hola, ${name}` : 'Hola'}</h1>
          <p className="mt-2 text-ink/70">Te mostramos en un minuto qué puedes hacer con Rinde.</p>
        </div>
        <div className="flex w-full flex-col gap-2">
          <Button size="lg" onClick={() => go(0)}>
            Ver cómo funciona (1 min)
          </Button>
          <Button variant="ghost" onClick={onDone}>
            Saltar, ya me ubico
          </Button>
        </div>
      </div>
    );
  }

  const { title, text, Illustration } = TOUR_STEPS[step];

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex flex-1 flex-col">
        <div className="flex items-center gap-2">
          {/* Una barra por paso: la actual se llena mientras avanza sola. */}
          <div
            className="flex flex-1 gap-1"
            role="progressbar"
            aria-label="Avance del recorrido"
            aria-valuemin={1}
            aria-valuemax={TOUR_STEPS.length}
            aria-valuenow={step + 1}
          >
            {TOUR_STEPS.map((s, i) => (
              <span key={s.title} className="h-1 flex-1 overflow-hidden rounded-full bg-ink/10">
                {i < step && <span className="block h-full bg-brand" />}
                {i === step && (
                  <motion.span
                    key={`${step}-${paused}`}
                    className="block h-full bg-brand"
                    initial={{ width: auto ? '0%' : '100%' }}
                    animate={{ width: '100%' }}
                    transition={{
                      duration: auto ? STEP_MS / 1000 : 0,
                      ease: 'linear',
                    }}
                  />
                )}
              </span>
            ))}
          </div>
          {!reduced && (
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              aria-label={paused ? 'Seguir avanzando solo' : 'Pausar'}
              className="grid size-10 place-items-center rounded-full text-ink/60 hover:text-ink focus-visible:outline-2 focus-visible:outline-violet"
            >
              {paused ? <Play className="size-4" aria-hidden="true" /> : <Pause className="size-4" aria-hidden="true" />}
            </button>
          )}
          <Button variant="ghost" size="sm" onClick={onDone}>
            Saltar
          </Button>
        </div>

        <AnimatePresence mode="wait" initial={false} custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            initial={{ opacity: 0, x: 40 * direction }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -40 * direction }}
            transition={{ duration: 0.3, ease: EASE }}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, { offset }) => {
              setPaused(true);
              if (offset.x < -SWIPE) go(step + 1);
              else if (offset.x > SWIPE) go(step - 1);
            }}
            className="flex flex-1 touch-pan-y flex-col justify-center gap-8 py-6"
          >
            <div className="mx-auto flex min-h-56 w-full max-w-sm items-center">
              <Illustration />
            </div>
            <div aria-live="polite">
              <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
              <p className="mt-2 text-ink/70">{text}</p>
            </div>
          </motion.div>
        </AnimatePresence>

        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Paso anterior"
            disabled={step === 0}
            className={cn(step === 0 && 'invisible')}
            onClick={() => {
              setPaused(true);
              go(step - 1);
            }}
          >
            <ChevronLeft aria-hidden="true" />
          </Button>
          <Button
            className="flex-1"
            onClick={() => {
              setPaused(true);
              go(step + 1);
            }}
          >
            {step === last ? 'Empezar' : 'Siguiente'}
          </Button>
        </div>
      </div>
    </MotionConfig>
  );
}
