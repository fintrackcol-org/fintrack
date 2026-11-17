import { Suspense, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import {
  ChevronLeft,
  Crown,
  House,
  Lightbulb,
  Loader2,
  UserPlus,
  Wallet,
  Flag,
  List,
  Plus,
} from 'lucide-react';
import { LogoMark, Wordmark } from '@/components/common/Logo';
import NotificationBell from '@/components/layout/NotificationBell';
import { NotificationsProvider } from '@/components/layout/NotificationsProvider';
import SyncStatus from '@/components/layout/SyncStatus';
import QuickEntryBar from '@/components/transactions/QuickEntryBar';
import MobileTabBar, { TABS, hasAddButton, hasTabBar } from '@/components/layout/MobileTabBar';
import SplitIncomeSheet from '@/components/money/SplitIncomeSheet';
import { useAuth } from '@/auth/AuthContext';
import useOfflineSync from '@/hooks/useOfflineSync';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { backPath, canGoBack } from '@/lib/backPath';
import { getDisplayName, getInitial } from '@/lib/displayName';
import { cn } from '@/lib/utils';
import { getProfile } from '@/services/userService';
import { setRegion } from '@/lib/region';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';

/**
 * Menú lateral (Rinde v2): las mismas 4 secciones de la barra del celular, con lo que vive dentro de
 * Mi plata y de Metas como subsecciones. `end` evita que "Inicio" quede activo en las subrutas.
 */
const NAV = [
  { to: '/app', label: 'Inicio', icon: House, end: true },
  { to: '/app/movimientos', label: 'Movimientos', icon: List },
  {
    to: '/app/mi-plata',
    label: 'Mi plata',
    icon: Wallet,
    tour: 'mi-plata',
    children: [
      { to: '/app/presupuestos', label: 'Presupuestos' },
      { to: '/app/calendario', label: 'Calendario' },
      { to: '/app/cuentas', label: 'Cuentas' },
      { to: '/app/tarjetas', label: 'Tarjetas' },
      { to: '/app/por-confirmar', label: 'Por confirmar' },
      { to: '/app/insights', label: 'Consejos' },
      { to: '/app/renta', label: 'Renta y DIAN' },
    ],
  },
  {
    to: '/app/metas',
    label: 'Metas',
    icon: Flag,
    tour: 'metas',
    children: [
      { to: '/app/vacas', label: 'Vacas' },
      { to: '/app/negocios', label: 'Negocios' },
    ],
  },
];

/** Lo de la app, en pequeño al final del menú. */
const EXTRA = [
  { to: '/app/invitar', label: 'Invitar amigos', icon: UserPlus },
  { to: '/app/planes', label: 'Planes', icon: Crown },
  { to: '/app/lo-que-viene', label: 'Lo que viene', icon: Lightbulb },
];

/** Círculo con la inicial del usuario. */
function Avatar({ user, className }) {
  return (
    <span
      aria-hidden="true"
      className={cn('grid size-9 shrink-0 place-items-center rounded-full bg-orchid text-sm font-bold text-obsidian', className)}
    >
      {getInitial(user)}
    </span>
  );
}

const itemClass = (active) =>
  cn(
    'flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-medium transition-colors max-lg:justify-center focus-visible:outline-2 focus-visible:outline-violet',
    active ? 'bg-brand-soft text-brand' : 'text-ink/70 hover:bg-ink/5 hover:text-ink',
  );

/**
 * Menú lateral para tablet y computador. En tablet (md) muestra solo íconos; desde lg, íconos con
 * nombre, las subsecciones y el usuario abajo. Arriba, el botón Anotar.
 */
function Sidebar({ user }) {
  const { pathname } = useLocation();
  return (
    <aside className="sticky top-0 hidden h-dvh w-[76px] shrink-0 flex-col overflow-y-auto border-r border-ink/10 bg-surface px-3 py-5 md:flex lg:w-60 lg:px-4">
      <Link
        to="/app"
        className="flex items-center gap-2.5 rounded-xl px-2 text-xl font-semibold tracking-tight max-lg:justify-center"
        aria-label="Rinde, ir al inicio"
      >
        <LogoMark className="lg:hidden" />
        <Wordmark className="h-7 w-auto max-lg:hidden" />
      </Link>

      <Link
        to="/app/anotar"
        data-tour="anotar"
        title="Anotar"
        className="mt-6 flex h-12 shrink-0 items-center justify-center gap-2 rounded-full bg-brand font-semibold text-white shadow-[0_8px_20px_-8px_rgb(97_66_255/0.7)] transition-transform hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet motion-safe:active:scale-[0.98]"
      >
        <Plus className="size-5" aria-hidden="true" />
        <span className="max-lg:sr-only">Anotar</span>
      </Link>

      <nav aria-label="Principal" className="mt-6">
        <ul className="flex flex-col gap-1">
          {NAV.map(({ to, label, icon: Icon, end, tour, children = [] }) => {
            const inside = children.some((c) => pathname.startsWith(c.to));
            return (
              <li key={to}>
                <NavLink
                  to={to}
                  end={end}
                  title={label}
                  data-tour={tour}
                  className={({ isActive }) => itemClass(isActive && !inside)}
                >
                  <Icon className="size-5 shrink-0" aria-hidden="true" />
                  <span className="max-lg:sr-only">{label}</span>
                </NavLink>
                {children.length > 0 && (
                  <ul className="mb-1 mt-0.5 flex flex-col max-lg:hidden">
                    {children.map((c) => (
                      <li key={c.to}>
                        <NavLink
                          to={c.to}
                          className={({ isActive }) =>
                            cn(
                              'flex h-9 items-center rounded-lg pl-11 pr-3 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                              isActive ? 'font-semibold text-brand' : 'text-ink/60 hover:bg-ink/5 hover:text-ink',
                            )
                          }
                        >
                          {c.label}
                        </NavLink>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="mt-auto flex flex-col gap-1 pt-6">
        <NotificationBell label labelClassName="max-lg:sr-only" className="w-full pr-3 max-lg:justify-center max-lg:pr-0" />
        <ul className="flex flex-col">
          {EXTRA.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <NavLink
                to={to}
                title={label}
                className={({ isActive }) =>
                  cn(
                    'flex h-9 items-center gap-3 rounded-lg px-3 text-sm transition-colors max-lg:justify-center',
                    isActive ? 'font-semibold text-brand' : 'text-ink/60 hover:bg-ink/5 hover:text-ink',
                  )
                }
              >
                <Icon className="size-4 shrink-0" aria-hidden="true" />
                <span className="max-lg:sr-only">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
        <NavLink
          to="/app/cuenta"
          title="Tu cuenta"
          data-tour="cuenta"
          className={({ isActive }) =>
            cn(
              'mt-2 flex items-center gap-3 rounded-xl p-2 transition-colors max-lg:justify-center',
              isActive ? 'bg-brand-soft' : 'hover:bg-ink/5',
            )
          }
        >
          <Avatar user={user} />
          <span className="min-w-0 max-lg:sr-only">
            <span className="block truncate text-sm font-semibold">{getDisplayName(user) || 'Tú'}</span>
            <span className="block truncate text-xs text-ink/70">Tu cuenta</span>
          </span>
        </NavLink>
      </div>
    </aside>
  );
}

/**
 * Encabezado del celular. En el inicio, el avatar a la izquierda, con un punto si hay avisos sin leer (la
 * lista está en Cuenta). En las otras pestañas, nada: la barra de abajo lleva a las demás. En las demás pantallas, el botón para volver: atrás en el historial o, si la
 * pantalla se abrió directo (un enlace, un aviso), a la pantalla de la que cuelga.
 */
function MobileHeader() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const parent = backPath(pathname);

  // El inicio lleva el avatar dentro de su franja morada, y las pestañas no tienen a dónde volver.
  if (!parent || TABS.some((tab) => tab.to === pathname)) return null;

  return (
    <header className="flex items-center px-2 pb-1 pt-[max(0.5rem,env(safe-area-inset-top))] md:hidden">
      <button
        type="button"
        aria-label="Volver"
        onClick={() => (canGoBack(window.history.state) ? navigate(-1) : navigate(parent, { replace: true }))}
        className="grid size-11 place-items-center rounded-full transition-colors hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
      >
        <ChevronLeft className="size-6" aria-hidden="true" />
      </button>
    </header>
  );
}

/** Pantallas con la barra rápida para anotar desde tablet (FT-0013): donde se registran los movimientos. */
const QUICK_ENTRY_PATHS = ['/app'];

/** Pantallas con una barra fija abajo en el celular: la de anotar o la caja del asistente (Consejos). */
const BOTTOM_BAR_PATHS = [...QUICK_ENTRY_PATHS, '/app/insights'];

/** Se trae el perfil una vez por carga de la app (el marco se vuelve a montar al cambiar de ruta). */
let profileSynced = false;

/**
 * Actualiza el nombre guardado en la sesión con el del servidor, por si se cambió en otro
 * dispositivo, y el país, la moneda y el idioma con los que se da formato. Sin conexión o si falla,
 * se queda con lo que ya tenía.
 */
function useSyncProfile() {
  const { updateUser } = useAuth();
  useEffect(() => {
    if (profileSynced) return;
    profileSynced = true;
    getProfile()
      .then((profile) => {
        if ('name' in profile) updateUser({ name: profile.name });
        // shortcut: recargar redibuja todo con la moneda nueva; pasa una vez por dispositivo o por
        // cambio hecho en otro lado. Si algún día molesta, pasar la región por un contexto de React.
        if (profile.currency && setRegion(profile)) window.location.reload();
      })
      .catch(() => {
        profileSynced = false; // se reintenta en la próxima navegación
      });
  }, [updateUser]);
}

/** Mientras descarga el código de una sección, el menú sigue visible. */
function SectionFallback() {
  return (
    <div className="grid min-h-[40vh] place-items-center text-ink/60" aria-busy="true">
      <Loader2 className="size-6 animate-spin" aria-hidden="true" />
      <span className="sr-only">Cargando…</span>
    </div>
  );
}

function Shell() {
  const { theme } = useTheme();
  const { user } = useAuth();
  const online = useOnlineStatus();
  const { pending, rejected, conflicts, conflictsLost, syncing } = useOfflineSync();
  const { pathname } = useLocation();
  const quickEntry = QUICK_ENTRY_PATHS.includes(pathname);
  const bottomBar = BOTTOM_BAR_PATHS.includes(pathname);
  // Rinde v2: en el celular, la barra de pestañas flotante (y el botón Anotar encima, donde va).
  const tabBar = hasTabBar(pathname);
  const addButton = hasAddButton(pathname);
  useSyncProfile();

  return (
    <div data-theme={theme} className="min-h-dvh bg-canvas text-ink antialiased md:flex">
      <a
        href="#contenido"
        className="sr-only z-50 rounded-lg bg-brand px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Saltar al contenido
      </a>

      {/*
        iOS 26 difumina el borde superior de las apps instaladas, salvo que encuentre ahí una caja fija de
        un solo color. Debe poder recibir toques: iOS la busca tocando ese punto, no sirve con pointer-events-none.
      */}
      <div
        aria-hidden="true"
        data-status-edge
        className="fixed inset-x-0 top-0 z-40 h-[max(env(safe-area-inset-top),0.75rem)] bg-canvas md:hidden"
      />

      <Sidebar user={user} />

      <div className="flex min-w-0 flex-1 flex-col">
        <MobileHeader />

        <SyncStatus
          online={online}
          pending={pending}
          rejected={rejected}
          conflicts={conflicts}
          conflictsLost={conflictsLost}
          syncing={syncing}
        />

        {/* Abajo va la barra rápida donde se puede anotar: que no tape el final. */}
        <main
          id="contenido"
          className={cn(
            'flex-1 px-4 pt-2 md:px-8 md:pt-8',
            // Que la barra flotante (y el botón Anotar) no tapen el final de la pantalla.
            addButton
              ? 'max-md:pb-[calc(10rem+env(safe-area-inset-bottom))]'
              : tabBar || bottomBar
                ? 'max-md:pb-[calc(6.5rem+env(safe-area-inset-bottom))]'
                : 'max-md:pb-[calc(2rem+env(safe-area-inset-bottom))]',
            quickEntry ? 'md:pb-28' : 'md:pb-12',
          )}
        >
          <div className="mx-auto w-full max-w-6xl">
            <Suspense fallback={<SectionFallback />}>
              <PageEnter key={pathname}>
                <Outlet />
              </PageEnter>
            </Suspense>
          </div>
        </main>
      </div>

      {/* En el celular se anota con el botón Anotar de la barra; la barra rápida queda para tablet y computador. */}
      {quickEntry && (
        <div className="max-md:hidden">
          <QuickEntryBar />
        </div>
      )}
      <MobileTabBar />
      {/* FT-0060: al registrar un ingreso grande, cómo repartirlo. */}
      <SplitIncomeSheet />
    </div>
  );
}

let firstPage = true;

/** Las 4 pestañas: cambiar entre ellas es ir al lado, no avanzar, y pasa decenas de veces al día. */
const TAB_ROOTS = new Set(['/app', '/app/movimientos', '/app/mi-plata', '/app/metas']);

/**
 * Entrada de cada pantalla: llega desde la derecha al avanzar y desde la izquierda al volver. No se
 * anima lo primero que se ve al abrir la app, ni Anotar, que es a pantalla completa y sube por su cuenta,
 * ni el cambio de pestaña (es frecuente: la animación solo estorbaría).
 */
function PageEnter({ children }) {
  const type = useNavigationType();
  const { pathname } = useLocation();
  const [enter] = useState(() => {
    const first = firstPage;
    firstPage = false;
    if (first || pathname === '/app/anotar' || (type !== 'POP' && TAB_ROOTS.has(pathname))) return undefined;
    return type === 'POP' ? 'motion-safe:animate-page-back' : 'motion-safe:animate-page-in';
  });
  return <div className={enter}>{children}</div>;
}

/**
 * Marco de la zona privada: menú lateral en tablet y computador, botón de volver en celular,
 * aviso de conexión y el tema claro u oscuro elegido en Cuenta.
 */
export default function AppShell() {
  return (
    <ThemeProvider>
      <NotificationsProvider>
        <Shell />
      </NotificationsProvider>
    </ThemeProvider>
  );
}
