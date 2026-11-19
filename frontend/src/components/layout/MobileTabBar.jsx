import { Link, NavLink, useLocation } from 'react-router-dom';
import { CalendarRange, House, List, Plus, UserRound } from 'lucide-react';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

/**
 * Las 4 zonas de la app en el celular (Rinde v5), con una regla: Inicio es hoy, Movimientos es lo que ya
 * pasó, Planear es lo que viene y Yo es tu cuenta. En el centro, el botón para anotar.
 */
export const TABS = [
  { to: '/app', label: t('Inicio'), icon: House, end: true, inside: ['/app/gastos', '/app/ingresos', '/app/mi-plata', '/app/insights', '/app/renta'] },
  { to: '/app/movimientos', label: t('Movimientos'), icon: List, inside: ['/app/por-confirmar'] },
  {
    to: '/app/planear',
    label: t('Planear'),
    icon: CalendarRange,
    inside: ['/app/mi-plata/pagos', '/app/calendario', '/app/presupuestos', '/app/metas', '/app/vacas', '/app/negocios', '/app/cuentas', '/app/tarjetas'],
  },
  { to: '/app/cuenta', label: t('Yo'), icon: UserRound, inside: ['/app/notificaciones', '/app/invitar', '/app/planes', '/app/lo-que-viene'] },
];

/**
 * Pantallas que llevan la barra: las 4 secciones y las que se abren desde ellas sin ser un formulario
 * ni un detalle. En un formulario la barra estorba (y el teclado la tapa); un detalle tiene "Volver".
 */
const WITH_TABS = [
  /^\/app$/,
  /^\/app\/movimientos$/,
  /^\/app\/(mi-plata|planear|metas|cuenta)$/,
  /^\/app\/(presupuestos|calendario|cuentas|tarjetas|vacas|negocios|por-confirmar|renta|gastos|ingresos)$/,
];

/**
 * @param {string} pathname
 * @returns {boolean} Si la pantalla lleva la barra de pestañas en el celular.
 */
export function hasTabBar(pathname) {
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return WITH_TABS.some((pattern) => pattern.test(path));
}

/** Pestañas que el tutorial resalta (FT-0071). */
const TOUR_ANCHORS = { '/app/planear': 'planear' };

const tabClass = (on) =>
  cn(
    'flex flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold leading-tight transition-colors focus-visible:outline-2 focus-visible:outline-violet',
    on ? 'bg-brand-soft text-brand' : 'text-ink/60 hover:text-ink',
  );

/**
 * Barra de pestañas del celular: un rectángulo con esquinas redondeadas que flota sobre la pantalla,
 * separado de los bordes y por encima de la zona del gesto de inicio. La pestaña abierta lleva fondo.
 * Anotar va en el centro, siempre al alcance del pulgar.
 */
export default function MobileTabBar() {
  const { pathname } = useLocation();
  if (!hasTabBar(pathname)) return null;
  const tab = ({ to, label, icon: Icon, end, inside }) => (
    <NavLink
      key={to}
      to={to}
      end={end}
      data-tour={TOUR_ANCHORS[to]}
      // Lo que se abre desde una pestaña la deja marcada: así se sabe dónde se está.
      aria-current={inside.includes(pathname) ? 'page' : undefined}
      className={({ isActive }) => tabClass(isActive || inside.includes(pathname))}
    >
      <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
      {label}
    </NavLink>
  );
  return (
    <nav
      aria-label={t('Secciones')}
      className="fixed inset-x-3 z-30 grid h-16 grid-cols-5 gap-1 rounded-[22px] bg-surface p-1.5 shadow-[0_6px_20px_rgba(20,20,20,0.10)] ring-1 ring-ink/10 bottom-[max(env(safe-area-inset-bottom),12px)] md:hidden"
    >
      {TABS.slice(0, 2).map(tab)}
      <Link
        to="/app/anotar"
        data-tour="anotar"
        className="flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold leading-tight text-ink focus-visible:outline-2 focus-visible:outline-violet"
      >
        <span className="-mt-6 grid size-12 place-items-center rounded-full bg-brand text-white shadow-[0_6px_16px_rgba(20,20,20,0.22)] ring-4 ring-surface transition-transform motion-safe:active:scale-[0.94]">
          <Plus className="size-6" strokeWidth={2.25} aria-hidden="true" />
        </span>
        {t('Anotar')}
      </Link>
      {TABS.slice(2).map(tab)}
    </nav>
  );
}
