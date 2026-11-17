import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

/**
 * Accesos a las pantallas que viven dentro de una pestaña (Rinde v2): una cuadrícula de tarjetas con
 * ícono, nombre y una línea de ayuda. Así la barra de abajo se queda en 4 pestañas y nada queda escondido.
 * @param {{ id: string, title: string, items: Array<{ to: string, label: string, hint: string, icon: import('react').ComponentType }> }} props
 */
export default function ShortcutGrid({ id, title, items }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      <ul className="mt-3 grid grid-cols-2 gap-2.5">
        {items.map(({ to, label, hint, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="group relative flex h-full min-h-[104px] flex-col gap-1 rounded-2xl bg-surface p-4 ring-1 ring-ink/10 transition-[background-color,transform] hover:bg-ink/[0.03] focus-visible:outline-2 focus-visible:outline-violet motion-safe:active:scale-[0.98]"
            >
              <Icon className="mb-1 size-5 text-brand" strokeWidth={1.9} aria-hidden="true" />
              <span className="text-[15px] font-semibold leading-tight">{label}</span>
              <span className="text-[13px] leading-snug text-ink/60">{hint}</span>
              <ChevronRight
                className="absolute right-3 top-4 size-4 text-ink/30 transition-transform group-hover:translate-x-0.5"
                aria-hidden="true"
              />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
