import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import Logo from '@/components/common/Logo';
import { cn } from '@/lib/utils';

const SWITCH_OPTIONS = [
  { mode: 'login', to: '/login', label: 'Iniciar sesión' },
  { mode: 'register', to: '/registro', label: 'Crear cuenta' },
];

/**
 * Selector "Iniciar sesión | Crear cuenta" arriba del formulario: quien llega por primera vez ve
 * las dos opciones con el mismo peso antes de cualquier campo. Son enlaces a las rutas de siempre
 * (`/login`, `/registro`), así que el botón atrás y los enlaces de la landing siguen igual.
 * Conserva `from` para volver a la página pedida (invitaciones) después de entrar.
 * @param {{ mode: 'login'|'register', slide: boolean }} props `slide`: la pieza llega desde la otra opción.
 */
function AuthSwitch({ mode, slide }) {
  const from = useLocation().state?.from;
  // Descarga la otra pantalla de una vez: al cambiar no aparece el cargador de ruta.
  useEffect(() => {
    import('@/pages/auth/Login');
    import('@/pages/auth/Register');
  }, []);
  return (
    <nav aria-label="Entrar o crear cuenta" className="relative grid grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-1">
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-y-1 w-[calc(50%-0.25rem)] rounded-[9px] bg-white/15 ring-1 ring-inset ring-white/10',
          mode === 'login' ? 'left-1' : 'left-1/2',
          slide && 'motion-safe:animate-switch-in',
        )}
        style={{ '--switch-from': mode === 'login' ? '100%' : '-100%' }}
      />
      {SWITCH_OPTIONS.map((option) => (
        <Link
          key={option.mode}
          to={option.to}
          replace
          state={{ from, switched: true }}
          aria-current={option.mode === mode ? 'page' : undefined}
          className={cn(
            'relative grid h-11 place-items-center rounded-[9px] text-[15px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet',
            option.mode === mode ? 'text-white' : 'text-white/60 hover:text-white',
          )}
        >
          {option.label}
        </Link>
      ))}
    </nav>
  );
}

/**
 * Estructura común de login y registro: fondo negro, columna centrada de 400px
 * (como las pantallas de auth de la plantilla) y un brillo violeta de fondo.
 *
 * @param {object} props
 * @param {string} props.title
 * @param {string} props.subtitle
 * @param {React.ReactNode} props.children
 * @param {React.ReactNode} [props.footer] Texto bajo el formulario (p. ej. enlace a la otra pantalla).
 * @param {React.ComponentType<{ className?: string }>} [props.icon] Ícono de lucide sobre el título.
 * @param {'login'|'register'} [props.mode] Muestra el selector entre iniciar sesión y crear cuenta.
 */
export default function AuthLayout({ title, subtitle, children, footer, icon: Icon, mode }) {
  // Si se llegó desde el selector, no se repite la entrada de toda la columna: solo cambia el formulario.
  const switched = Boolean(useLocation().state?.switched) && Boolean(mode);
  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden bg-black text-white">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-violet/20 blur-[140px]"
      />

      {/* El margen superior deja libre la zona de la hora y la batería en el iPhone (viewport-fit=cover). */}
      <header className="container-page relative mt-[env(safe-area-inset-top)] flex h-20 items-center justify-between">
        <Logo />
        {/* Píldora con borde y 40px de alto: se distingue del fondo y es fácil de tocar. */}
        <Link
          to="/"
          className="inline-flex h-10 items-center gap-2 rounded-full border border-white/15 bg-white/5 px-4 text-sm font-medium text-white/90 hover:bg-white/10 hover:text-white motion-safe:transition-[color,background-color,transform] motion-safe:active:scale-[0.97]"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          <span>
            Volver<span className="hidden sm:inline"> al inicio</span>
          </span>
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center px-4 py-10">
        {/* Entrada con CSS (no framer-motion): login y registro no descargan la librería de animación. */}
        <div className={cn('w-full max-w-[400px] space-y-8', !switched && 'motion-safe:animate-fade-up')}>
          {mode && <AuthSwitch mode={mode} slide={switched} />}
          <div className={cn('space-y-8', switched && 'motion-safe:animate-page-in')}>
            <div className="space-y-2 text-center">
              {Icon && (
                <div className="mx-auto mb-5 grid size-14 place-items-center rounded-2xl bg-violet/15 text-violet-light ring-1 ring-inset ring-violet/30">
                  <Icon className="size-6" aria-hidden="true" />
                </div>
              )}
              <h1 className="text-balance text-4xl font-semibold tracking-tight">{title}</h1>
              <p className="text-sm text-white/55">{subtitle}</p>
            </div>
            {children}
            {footer && <div className="text-center text-sm">{footer}</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
