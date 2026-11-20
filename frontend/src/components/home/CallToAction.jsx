import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useInView, useReducedMotion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import Reveal from '@/components/common/Reveal';
import { Button } from '@/components/ui/button';
import Rin from '@/components/rin/Rin';

/**
 * Cierre violeta a todo el ancho: Rin saluda (una vez, al llegar) e invita a crear la cuenta.
 * Es el único sitio de la landing donde aparece: presenta al compañero que se encuentra dentro de la app.
 */
export default function CallToAction() {
  const ref = useRef(null);
  const seen = useInView(ref, { once: true, amount: 0.6 });
  const reduced = useReducedMotion() ?? false;

  return (
    <section id="empieza" className="scroll-mt-20 bg-violet py-16 text-white sm:py-24 md:py-32">
      <Reveal className="container-page flex flex-col items-center text-center">
        <div ref={ref} className="relative grid place-items-center">
          {/* El piso de Rin: el mismo disco suave de la bienvenida de la app. */}
          <span aria-hidden="true" className="absolute size-24 rounded-full bg-white/15 md:size-28" />
          <Rin
            emotion="feliz"
            gesture={seen && !reduced ? 'saludar' : null}
            level={1}
            tidy={1}
            motion={!reduced}
            paused={!seen}
            label="Rin, la mascota de Rinde, te saluda"
            className="relative h-28 w-auto md:h-32"
          />
        </div>
        <h2 className="mt-6 max-w-3xl text-balance text-[clamp(2.5rem,12vw,3rem)] font-semibold leading-[0.98] tracking-[-0.04em] md:text-7xl">
          Empieza a controlar tus gastos hoy.
        </h2>
        <p className="mt-5 text-base text-white/80 sm:text-lg md:mt-6 md:text-xl">Crea tu cuenta en menos de un minuto. Sin tarjeta, sin letra pequeña.</p>
        <div className="mt-8 flex w-full max-w-sm flex-col sm:max-w-none md:mt-10 justify-center gap-3 sm:w-auto sm:flex-row">
          <Button
            asChild
            size="lg"
            className="h-12 rounded-full bg-white px-8 text-base text-violet sm:h-14 sm:text-lg hover:bg-white/90 motion-safe:transition-[background-color,transform] motion-safe:active:scale-[0.98]"
          >
            <Link to="/registro">
              Crear cuenta gratis <ArrowRight />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg" className="h-12 rounded-full border-white/40 px-8 text-base text-white sm:h-14 sm:text-lg hover:bg-white/10">
            <Link to="/login">Ya tengo cuenta</Link>
          </Button>
        </div>
      </Reveal>
    </section>
  );
}
