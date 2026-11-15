import { Link, NavLink, useLocation } from 'react-router-dom';
import { Flag, House, List, Plus, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Las 4 secciones de la app en el celular (Rinde v2). Lo demás vive dentro de ellas: Consejos,
 * Presupuestos, Calendario, Cuentas y Tarjetas en Mi plata; Vacas y Negocios en Metas; la cuenta en el
 * avatar del inicio. Cuatro pestañas caben con su nombre y se alcanzan con el pulgar.
 */
export const TABS = [
  { to: '/app', label: 'Inicio', icon: House, end: true },
  { to: '/app/movimientos', label: 'Movimientos', icon: List },
  { to: '/app/mi-plata', label: 'Mi plata', icon: Wallet },
  { to: '/app/metas', label: 'Metas', icon: Flag },
];

/**
 * Pantallas que llevan la barra: las 4 secciones y las que se abren desde ellas sin ser un formulario
 * ni un detalle. En un formulario la barra estorba (y el teclado la tapa); un detalle tiene "Volver".
 */
const WITH_TABS = [
  /^\/app$/,
  /^\/app\/movimientos$/,
  /^\/app\/mi-plata$/,
  /^\/app\/metas$/,
  /^\/app\/(presupuestos|calendario|cuentas|tarjetas|vacas|negocios|por-confirmar|renta|gastos|ingresos)$/,
];

/** Pantallas con el botón Anotar flotando sobre la barra. */
const WITH_ADD = [/^\/app$/, /^\/app\/movimientos$/];

/**
 * @param {string} pathname
 * @returns {boolean} Si la pantalla lleva la barra de pestañas en el celular.
 */
export function hasTabBar(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return WITH_TABS.some((pattern) => pattern.test(path));
}

/**
 * @param {string} pathname
 * @returns {boolean} Si la pantalla lleva el botón Anotar flotante.
 */
export function hasAddButton(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return WITH_ADD.some((pattern) => pattern.test(path));
}

/**
 * Barra de pestañas del celular: un rectángulo con esquinas redondeadas que flota sobre la pantalla,
 * separado de los bordes y por encima de la zona del gesto de inicio. La pestaña abierta lleva fondo.
 */
export default function MobileTabBar() {
  const { pathname } = useLocation();
  if (!hasTabBar(pathname)) return null;
  return (
    <>
      {hasAddButton(pathname) && (
        <Link
          to="/app/anotar"
          className="fixed right-4 z-30 inline-flex h-[52px] items-center gap-2 rounded-full bg-brand pl-4 pr-5 text-[15px] font-semibold text-white shadow-[0_8px_24px_rgba(20,20,20,0.22)] transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet motion-safe:active:scale-[0.97] bottom-[calc(max(env(safe-area-inset-bottom),12px)+80px)] md:hidden"
        >
          <Plus className="size-5" strokeWidth={2.25} aria-hidden="true" />
          Anotar
        </Link>
      )}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-3 z-30 grid h-16 grid-cols-4 gap-1 rounded-[22px] bg-surface p-1.5 shadow-[0_6px_20px_rgba(20,20,20,0.10)] ring-1 ring-ink/10 bottom-[max(env(safe-area-inset-bottom),12px)] md:hidden"
      >
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                isActive ? 'bg-brand-soft text-brand' : 'text-ink/60 hover:text-ink',
              )
            }
          >
            <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>
    </>
  );
}
