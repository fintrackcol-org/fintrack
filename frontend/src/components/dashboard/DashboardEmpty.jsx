import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** La "r" de Rinde con la moneda, en suave: la ilustración del estado vacío (sin imágenes). */
function EmptyMark() {
  return (
    <svg viewBox="0 0 96 96" aria-hidden="true" className="mx-auto size-24">
      <path d="M28 76V48a20 20 0 0 1 20-20" fill="none" className="stroke-brand-soft" strokeWidth="16" strokeLinecap="round" />
      <path d="M28 76h40" fill="none" className="stroke-ink/10" strokeWidth="4" strokeLinecap="round" />
      <circle cx="70" cy="26" r="8" className="fill-success" />
    </svg>
  );
}

/**
 * Estado vacío del inicio (FT-0004, Rinde v2): quien aún no anota nada este mes ve una sola acción
 * clara, empezar por lo de hoy, y la opción de anotar por WhatsApp. Se muestra en lugar del gráfico y
 * los últimos movimientos.
 */
export default function DashboardEmpty() {
  return (
    <section
      aria-labelledby="empty-title"
      className="rounded-3xl bg-surface px-6 py-10 text-center ring-1 ring-ink/10 md:py-12"
    >
      <EmptyMark />
      <h2 id="empty-title" className="mx-auto mt-5 max-w-xs text-lg font-semibold tracking-tight">
        Todavía no has anotado nada este mes
      </h2>
      <p className="mx-auto mt-2 max-w-sm text-[15px] text-ink/70">
        Empieza con lo que gastaste hoy, aunque sea un tinto. Pon cuánto fue y en qué, y Rinde lo organiza.
      </p>
      <Button asChild size="lg" className="mt-6 rounded-full">
        <Link to="/app/anotar?tipo=gasto">
          <Plus aria-hidden="true" />
          Anotar mi primer gasto
        </Link>
      </Button>
      <div className="mt-2 flex flex-col items-center">
        <Link to="/app/anotar?tipo=ingreso" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">
          O anota lo que te entró
        </Link>
        <Link to="/app/cuenta#whatsapp" className="inline-flex min-h-11 items-center text-sm font-semibold text-brand">
          O conecta WhatsApp y anota desde el chat
        </Link>
      </div>
    </section>
  );
}
