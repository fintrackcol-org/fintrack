import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Bell,
  ChevronRight,
  Coins,
  Crown,
  Download,
  GraduationCap,
  Lightbulb,
  Loader2,
  LogOut,
  MessageCircle,
  Palette,
  Smartphone,
  Tags,
  UserPlus,
} from 'lucide-react';
import CustomCategories from '@/components/account/CustomCategories';
import DeleteAccount from '@/components/account/DeleteAccount';
import ProfileCard from '@/components/account/ProfileCard';
import ShortcutLink from '@/components/account/ShortcutLink';
import ThemeSelector from '@/components/account/ThemeSelector';
import WhatsappLink from '@/components/account/WhatsappLink';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import NotificationSettings from '@/components/notifications/NotificationSettings';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/auth/AuthContext';
import useAsync from '@/hooks/useAsync';
import useMediaQuery from '@/hooks/useMediaQuery';
import usePageTitle from '@/hooks/usePageTitle';
import { getDisplayName, getInitial } from '@/lib/displayName';
import Segmented from '@/components/common/Segmented';
import Sheet from '@/components/common/Sheet';
import { cn } from '@/lib/utils';
import { getWhatsappLink } from '@/services/whatsappService';
import { useTheme } from '@/theme/ThemeProvider';
import { getShortcutToken } from '@/services/pendingPaymentService';

/** Lo que se abre desde Cuenta porque no se usa todos los días. */
export const LINKS = [
  { to: '/app/transacciones/exportar', label: 'Exportar reportes', detail: 'Excel, PDF o CSV', icon: Download },
  { to: '/app/invitar', label: 'Invitar amigos', detail: 'Compárteles la app', icon: UserPlus },
  { to: '/app/planes', label: 'Planes', detail: 'Beta: aún no se cobra', icon: Crown },
  { to: '/app/lo-que-viene', label: 'Lo que viene', detail: 'Vota y pide funciones', icon: Lightbulb },
];

/** Bloque con título de una sección de ajustes. */
function Section({ id, title, description, children }) {
  return (
    <Panel aria-labelledby={id}>
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {title}
      </h2>
      {description && <p className="mt-1 text-sm text-ink/60">{description}</p>}
      <div className="mt-5">{children}</div>
    </Panel>
  );
}

/** Grupo de ajustes con su nombre, para ubicar rápido lo que se busca. */
function Group({ label, children }) {
  return (
    <section aria-label={label}>
      <p aria-hidden="true" className="mb-2 px-1 text-sm font-medium text-ink/60">
        {label}
      </p>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

const ROW =
  'flex min-h-[52px] w-full items-center gap-3 text-left text-[15px] font-medium transition-opacity active:opacity-60 focus-visible:outline-2 focus-visible:outline-violet disabled:opacity-50';

/** Grupo de filas del perfil en el celular, en una tarjeta. */
function RowGroup({ label, children }) {
  return (
    <section aria-label={label}>
      <h2 className="mb-2 px-1 text-sm font-medium text-ink/60">{label}</h2>
      <div className="divide-y divide-ink/10 rounded-2xl bg-surface px-4 ring-1 ring-ink/10">{children}</div>
    </section>
  );
}

/** Contenido de una fila: ícono, texto, algo a la derecha (estado o valor) y la flecha. */
function RowBody({ icon: Icon, label, end, chevron = true }) {
  return (
    <>
      <Icon className="size-5 shrink-0 text-ink/70" aria-hidden="true" />
      <span className="min-w-0 flex-1">{label}</span>
      {end}
      {chevron && <ChevronRight className="size-[18px] shrink-0 text-ink/40" aria-hidden="true" />}
    </>
  );
}

const THEME_OPTIONS = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
  { value: 'system', label: 'Auto' },
];

/**
 * Perfil en el celular (Rinde v2, lienzo «Tu cuenta»): quién eres, lo que más se cambia a la vista
 * (WhatsApp con su estado y el tema, que se cambia aquí mismo) y lo demás en hojas. Cerrar sesión pide
 * confirmación porque lo anotado sin conexión se queda en el celular.
 */
function MobileAccount({ onSignOut, leaving }) {
  const { user } = useAuth();
  const { hash } = useLocation();
  const navigate = useNavigate();
  const { preference, setPreference } = useTheme();
  const [open, setOpen] = useState(hash === '#whatsapp' ? 'whatsapp' : null);
  // La fila de Apple Pay solo sale si la función está activa para el usuario (FT-0047).
  const shortcut = useAsync(getShortcutToken, []);
  const whatsapp = useAsync(getWhatsappLink, []);
  const row = (key, icon, label, end) => (
    <button type="button" className={ROW} onClick={() => setOpen(key)}>
      <RowBody icon={icon} label={label} end={end} />
    </button>
  );
  const close = () => setOpen(null);
  const linked = whatsapp.data?.linked;
  return (
    <div className="flex flex-col gap-6">
      <h1 className="sr-only">Tu cuenta</h1>
      <button
        type="button"
        onClick={() => setOpen('perfil')}
        className="flex items-center gap-3.5 rounded-2xl text-left focus-visible:outline-2 focus-visible:outline-violet"
      >
        <span aria-hidden="true" className="grid size-14 shrink-0 place-items-center rounded-full bg-orchid text-[22px] font-bold text-obsidian">
          {getInitial(user)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-xl font-semibold tracking-tight">{getDisplayName(user) || 'Tu cuenta'}</span>
          <span className="block truncate text-sm text-ink/60">{user?.email}</span>
        </span>
        <span className="ml-auto text-sm font-semibold text-brand">Editar</span>
      </button>

      <RowGroup label="Tu app">
        {row(
          'whatsapp',
          MessageCircle,
          'Anotar por WhatsApp',
          whatsapp.data && (
            <span
              className={cn(
                'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
                linked ? 'bg-success/15 text-positive' : 'bg-ink/5 text-ink/70',
              )}
            >
              {linked && <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />}
              {linked ? 'Conectado' : 'Conectar'}
            </span>
          ),
        )}
        <div className="flex min-h-[60px] items-center gap-3">
          <Palette className="size-5 shrink-0 text-ink/70" aria-hidden="true" />
          <span className="flex-1 text-[15px] font-medium">Apariencia</span>
          <Segmented label="Apariencia" options={THEME_OPTIONS} value={preference} onChange={setPreference} className="w-[188px]" />
        </div>
        {row('alertas', Bell, 'Avisos y recordatorios')}
        {row('categorias', Tags, 'Mis categorías')}
        <Link to={LINKS[0].to} className={ROW}>
          <RowBody icon={Download} label={LINKS[0].label} />
        </Link>
        <div className={cn(ROW, 'active:opacity-100')}>
          <RowBody icon={Coins} label="Moneda" end={<span className="text-sm text-ink/60">Peso colombiano (COP)</span>} chevron={false} />
        </div>
        {shortcut.data?.enabled && row('applepay', Smartphone, 'Pagos con Apple Pay')}
      </RowGroup>

      <RowGroup label="Ayuda">
        <button type="button" className={ROW} onClick={() => navigate('/app?tutorial=1')}>
          <RowBody icon={GraduationCap} label="Ver el tutorial otra vez" />
        </button>
        {LINKS.slice(1).map(({ to, label, icon }) => (
          <Link key={to} to={to} className={ROW}>
            <RowBody icon={icon} label={label} />
          </Link>
        ))}
      </RowGroup>

      <div className="flex flex-col items-center gap-1">
        <Button variant="dark" size="lg" className="w-full rounded-full ring-1 ring-white/10" onClick={() => setOpen('salir')} disabled={leaving}>
          {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
          {leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </Button>
        <button type="button" className="min-h-11 text-sm font-medium text-negative" onClick={() => setOpen('eliminar')}>
          Eliminar cuenta
        </button>
        <p className="text-xs text-ink/60">Rinde v2.0 · USCO · INNOVASOFT IX</p>
      </div>

      <Sheet open={open === 'perfil'} title="Tu perfil" onClose={close}>
        <ProfileCard />
      </Sheet>
      <Sheet open={open === 'alertas'} title="Avisos y recordatorios" onClose={close}>
        <NotificationSettings />
      </Sheet>
      <Sheet open={open === 'categorias'} title="Mis categorías" onClose={close}>
        <CustomCategories />
      </Sheet>
      <Sheet
        open={open === 'whatsapp'}
        title="Anotar por WhatsApp"
        onClose={() => {
          close();
          whatsapp.reload();
        }}
      >
        <WhatsappLink />
      </Sheet>
      <Sheet open={open === 'applepay'} title="Pagos con Apple Pay" onClose={close}>
        <ShortcutLink />
      </Sheet>
      <Sheet open={open === 'eliminar'} title="Eliminar cuenta" onClose={close}>
        <DeleteAccount />
      </Sheet>
      <Sheet open={open === 'salir'} title="¿Cerrar sesión?" onClose={close}>
        <p className="text-[15px] text-ink/70">
          Lo que anotaste sin conexión se queda en este celular y se sube cuando vuelvas a entrar.
        </p>
        <div className="mt-5 flex gap-3">
          <Button variant="outline" size="lg" className="flex-1" onClick={close}>
            Cancelar
          </Button>
          <Button variant="dark" size="lg" className="flex-1" onClick={onSignOut} disabled={leaving}>
            {leaving && <Loader2 className="animate-spin" aria-hidden="true" />}
            Cerrar sesión
          </Button>
        </div>
      </Sheet>
    </div>
  );
}

/**
 * Página privada `/app/cuenta`, por grupos: perfil (nombre editable), preferencias
 * (tema de la app y categorías propias), alertas (REQ-029 y REQ-030), cierre de sesión y eliminar la
 * cuenta (FT-0017), y repetir el tutorial (FT-0071).
 */
export default function Account() {
  usePageTitle('Cuenta');
  const mobile = useMediaQuery('(width < 48rem)');
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [leaving, setLeaving] = useState(false);

  const handleSignOut = async () => {
    setLeaving(true);
    await signOut();
    navigate('/login', { replace: true });
  };

  if (mobile) return <MobileAccount onSignOut={handleSignOut} leaving={leaving} />;

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Cuenta" />

      <div className="flex flex-col gap-8">
        <ProfileCard />
        <Group label="Preferencias">
          <Section id="apariencia" title="Apariencia" description="Elige cómo se ve Rinde.">
            <ThemeSelector />
          </Section>
          <CustomCategories />
          <div id="whatsapp">
            <WhatsappLink />
          </div>
          <ShortcutLink />
          <Panel className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Tutorial</h2>
              <p className="mt-1 text-sm text-ink/60">Repasa qué hace cada parte del inicio.</p>
            </div>
            <Button variant="outline" asChild>
              <Link to="/app?tutorial=1">
                <GraduationCap aria-hidden="true" /> Ver el tutorial otra vez
              </Link>
            </Button>
          </Panel>
        </Group>

        <Group label="Alertas">
          <NotificationSettings />
        </Group>

        <Group label="Sesión">
          <Panel className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold tracking-tight">Cerrar sesión</h2>
              <p className="mt-1 text-sm text-ink/60">Sales de tu cuenta en este dispositivo.</p>
            </div>
            <Button variant="outline" onClick={handleSignOut} disabled={leaving}>
              {leaving ? <Loader2 className="animate-spin" aria-hidden="true" /> : <LogOut aria-hidden="true" />}
              {leaving ? 'Cerrando sesión…' : 'Cerrar sesión'}
            </Button>
          </Panel>
          <DeleteAccount />
        </Group>
      </div>
    </div>
  );
}
