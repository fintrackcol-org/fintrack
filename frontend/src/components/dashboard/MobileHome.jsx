import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { MASK } from '@/components/dashboard/BalanceCard';
import { totalLinkLabel } from '@/lib/totalLink';
import { Wordmark } from '@/components/common/Logo';
import DashboardEmpty from '@/components/dashboard/DashboardEmpty';
import { useNotifications } from '@/components/layout/NotificationsProvider';
import Panel from '@/components/layout/Panel';
import MoneyInvite from '@/components/money/MoneyInvite';
import MoneySetupLink from '@/components/money/MoneySetupLink';
import MovementRow from '@/components/transactions/MovementRow';
import { formatMoney } from '@/components/transactions/format';
import useFreshIds from '@/hooks/useFreshIds';
import { displayLevel } from '@/lib/budgetLevel';
import { expenseSlices } from '@/lib/expenseSlices';
import { daysLabel, runway, untilText } from '@/lib/runway';
import { getDisplayName, getInitial } from '@/lib/displayName';
import { pickHomeNotice } from '@/lib/homeNotice';
import { cn } from '@/lib/utils';
import RindeLine from '@/components/common/RindeLine';

const RECENT = 3;
const BUDGETS = 3;
const BAR = { none: 'bg-positive', warning_80: 'bg-caution', exceeded_100: 'bg-negative' };
const PERCENT_TEXT = { none: 'text-ink/60', warning_80: 'font-semibold text-caution', exceeded_100: 'font-semibold text-negative' };
const percent = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** Bloque gris mientras carga un monto. */
const Skeleton = ({ className }) => (
  <span className={cn('inline-block animate-pulse rounded-md bg-current opacity-20', className)} />
);

/**
 * Ingresos o gastos del mes en una tarjeta pequeña que lleva a su detalle; la flecha dice que se puede
 * tocar (FT-0068).
 */
export function Total({ label, value, money, to, positive = false, period }) {
  return (
    <Link
      to={to}
      className="flex min-w-0 flex-col gap-1.5 rounded-2xl bg-surface px-4 py-3.5 ring-1 ring-ink/10 transition-[background-color,transform] hover:bg-ink/[0.03] focus-visible:outline-2 focus-visible:outline-violet motion-safe:active:scale-[0.98]"
    >
      <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-ink/60">
        {label}
        <ChevronRight className="size-4" aria-hidden="true" />
      </span>
      <span className={cn('truncate text-[22px] font-extrabold leading-7 tracking-tight tabular-nums', positive && 'text-positive')}>
        {value === undefined ? <Skeleton className="h-[1em] w-24" /> : `${positive ? '+ ' : ''}${money(value)}`}
      </span>
      <span className="sr-only">, {totalLinkLabel(label.toLowerCase(), period).toLowerCase()}</span>
    </Link>
  );
}

/**
 * La tarjeta violeta de Mi plata: el saldo y hasta cuándo alcanza al ritmo del mes. Lleva a Mi plata.
 */
export function MoneyCard({ balance, monthExpense, money, monthLabel, className }) {
  const r = typeof balance === 'number' ? runway({ balance, monthExpense }) : null;
  return (
    <Link
      to="/app/mi-plata"
      data-tour="saldo"
      aria-busy={balance === undefined || undefined}
      className={cn(
        'relative flex flex-col gap-3 overflow-hidden rounded-3xl bg-brand p-5 text-white transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet motion-safe:active:scale-[0.99]',
        className,
      )}
    >
      <span aria-hidden="true" className="absolute -right-16 -top-16 size-40 rounded-full border-[32px] border-white/15" />
      <span className="relative flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white/85 first-letter:uppercase">Mi plata · {monthLabel}</span>
        <ChevronRight className="size-5" aria-hidden="true" />
      </span>
      <span className="relative truncate text-[40px] font-extrabold leading-[44px] tracking-[-0.02em] tabular-nums">
        {balance === undefined ? <Skeleton className="h-[0.9em] w-52" /> : money(balance ?? 0)}
      </span>
      {r ? (
        <>
          <RindeLine value={r.coverage} />
          <span className="flex items-center justify-between gap-3 text-[13px] leading-[18px]">
            <b className="font-semibold">{r.lasts ? 'Te alcanza para todo el mes' : `Te alcanza ${daysLabel(r.days)} más`}</b>
            <span className="text-white/85">{untilText(r)}</span>
          </span>
        </>
      ) : balance === undefined ? (
        <>
          <span aria-hidden="true" className="relative block h-1 overflow-hidden rounded-full bg-white/30">
            <span className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-white/80 motion-safe:animate-pulse" />
          </span>
          <span className="text-[13px] leading-[18px] text-white/85">Calculando hasta cuándo te alcanza…</span>
        </>
      ) : (
        <>
          <RindeLine value={0} />
          <span className="text-[13px] leading-[18px] text-white/85">Anota tu primer ingreso para saber hasta cuándo te alcanza.</span>
        </>
      )}
      <span className="sr-only">, ver Mi plata</span>
    </Link>
  );
}

/**
 * Una tarjeta, dos pestañas: en qué se va la plata (las 3 categorías más altas) y cómo van los
 * presupuestos (los 3 más usados). Cambiar de pestaña no cambia el alto de la tarjeta.
 */
function ChartCard({ expense, budgets, names, money }) {
  const [tab, setTab] = useState('categorias');
  const slices = expense?.byCategory ? expenseSlices(expense.byCategory, names).filter((s) => s.key !== 'otras').slice(0, 3) : [];
  const top = budgets ? [...budgets].sort((a, b) => b.percentage - a.percentage).slice(0, BUDGETS) : [];
  const rows =
    tab === 'categorias'
      ? slices.map((s) => ({ key: s.key, name: s.name, value: money(s.total), extra: `${percent.format(s.share)} %`, width: s.share, tone: 'bg-brand', level: 'none' }))
      : top.map((b) => {
          const level = displayLevel(b.alert);
          return {
            key: b.id,
            name: names[b.category] ?? b.category,
            value: money(b.consumed ?? 0),
            extra: `de ${money(b.amount)} · ${percent.format(b.percentage)} %`,
            width: Math.min(b.percentage, 100),
            tone: BAR[level],
            level,
          };
        });
  const tabs = [
    { key: 'categorias', label: 'En qué gastas' },
    { key: 'presupuestos', label: 'Tus presupuestos' },
  ];
  return (
    <section data-tour="graficos" aria-label="Resumen en gráficos" className="flex flex-col gap-3 rounded-2xl bg-surface px-4 pb-3.5 pt-3 ring-1 ring-ink/10">
      <div role="tablist" aria-label="Qué gráfico ver" className="grid grid-cols-2 gap-1 rounded-full bg-canvas p-1">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={cn(
              'h-9 rounded-full text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-violet',
              tab === key ? 'bg-surface text-ink shadow-sm' : 'text-ink/60',
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <ul role="tabpanel" className="flex min-h-[132px] flex-col gap-3.5">
        {rows.length === 0 ? (
          <li className="py-6 text-center text-[13px] text-ink/60">
            {tab === 'categorias' ? 'Aún no hay gastos este mes.' : 'Aún no tienes presupuestos.'}
          </li>
        ) : (
          rows.map((row) => (
            <li key={row.key} className="flex flex-col gap-1.5">
              <span className="flex items-baseline justify-between gap-3 text-[13px] leading-[18px]">
                <b className="truncate font-semibold">{row.name}</b>
                <span className="shrink-0 tabular-nums">
                  <b className={cn('font-semibold', row.level === 'exceeded_100' && 'text-negative')}>{row.value}</b>{' '}
                  <span className="text-ink/60">{row.extra}</span>
                </span>
              </span>
              <span className="relative block h-1 rounded-full bg-ink/10" aria-hidden="true">
                <span
                  className={cn('absolute inset-y-0 left-0 origin-left rounded-full motion-safe:animate-bar-in', row.tone)}
                  style={{ width: `${row.width}%` }}
                />
              </span>
            </li>
          ))
        )}
      </ul>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-ink/60">
          {tab === 'categorias' ? 'Tus 3 categorías más altas del mes' : 'Los 3 presupuestos más usados'}
        </span>
        <Link
          to={tab === 'categorias' ? '/app/gastos' : '/app/presupuestos'}
          className="inline-flex min-h-11 items-center text-[13px] font-semibold text-brand"
        >
          Ver todo
        </Link>
      </div>
    </section>
  );
}

/** Título de una sección con su enlace a la derecha. */
function SectionTitle({ id, to, children }) {
  return (
    <div className="flex items-center justify-between">
      <h2 id={id} className="text-lg font-semibold tracking-tight">
        {children}
      </h2>
      <Link to={to} className="py-3 text-sm font-medium text-brand">
        Ver todos
      </Link>
    </div>
  );
}

/**
 * Inicio en el celular (Rinde v2): el logo, la tarjeta de Mi plata con hasta cuándo alcanza, los ingresos
 * y gastos del mes, un solo aviso, el gráfico de dos pestañas y los últimos movimientos. Anotar va en el
 * botón flotante y lo demás en las pestañas de abajo. Antes: lo esencial y nada más. El saldo, los ingresos y gastos del mes, los accesos,
 * un solo aviso, los últimos movimientos, los gastos por categoría y cómo van los presupuestos. Lo demás está a un toque.
 *
 * @param {object} props
 * @param {number|null|undefined} props.balance Saldo; `undefined` mientras carga.
 * @param {boolean} [props.balanceSet] El usuario ya dijo cuánta plata tiene (FT-0057).
 * @param {{ income: number, expense: number }|undefined} props.totals Del mes actual.
 * @param {object[]|undefined} props.budgets
 * @param {object|null|undefined} props.expense Gastos del mes por categoría; `undefined` mientras carga, `null` si no se pudieron traer.
 * @param {object[]|undefined} props.cards
 * @param {object[]|undefined} props.recent
 * @param {object[]} [props.pending] Pagos pendientes de Mi plata.
 * @param {string} [props.recentError]
 * @param {Record<string, string>} props.names
 * @param {string} props.monthLabel Mes actual, p. ej. `noviembre`.
 * @param {boolean} props.empty Aún no tiene movimientos.
 * @param {boolean} props.welcomePending
 * @param {boolean} props.setupPending
 * @param {() => void} props.onWelcomeDone
 * @param {boolean} props.hidden
 * @param {() => void} props.onToggleHidden
 */
export default function MobileHome({
  balance,
  balanceSet = false,
  totals,
  expense,
  budgets,
  cards,
  recent,
  pending = [],
  recentError,
  names,
  monthLabel,
  empty,
  welcomePending,
  setupPending,
  onWelcomeDone,
  hidden,
  onToggleHidden,
}) {
  const { user } = useAuth();
  const { unread } = useNotifications();
  const fresh = useFreshIds(recent);
  const money = (value) => (hidden ? MASK : formatMoney(value));
  const name = getDisplayName(user);
  const notice = pickHomeNotice({ cards, budgets, pending, names, money });
  // Al anotar algo se recalcula sin borrar el gráfico, para que la pantalla no salte.
  const lastExpense = useRef();
  if (expense) lastExpense.current = expense;
  const shownExpense = expense === undefined ? lastExpense.current : expense;

  return (
    <div className="flex flex-col gap-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      {/* Rinde v2: el logo a la izquierda; avisos, ocultar montos y la cuenta a la derecha. */}
      <header className="flex items-center justify-between">
        <span role="img" aria-label="Rinde" className="text-ink">
          <Wordmark className="h-7 w-auto" />
        </span>
        <div className="flex items-center gap-1">
          <Link
            to="/app/notificaciones"
            aria-label={unread === 0 ? 'Notificaciones' : `Notificaciones, ${unread} sin leer`}
            className="relative grid size-11 place-items-center rounded-full text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
          >
            <Bell className="size-[22px]" aria-hidden="true" />
            {unread > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 grid min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[11px] font-bold leading-[18px] text-white"
              >
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </Link>
          <button
            type="button"
            onClick={onToggleHidden}
            aria-pressed={hidden}
            aria-label={hidden ? 'Mostrar montos' : 'Ocultar montos'}
            className="grid size-11 place-items-center rounded-full text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
          >
            {hidden ? <EyeOff className="size-[22px]" aria-hidden="true" /> : <Eye className="size-[22px]" aria-hidden="true" />}
          </button>
          <Link
            to="/app/cuenta"
            data-tour="cuenta"
            aria-label={name ? `Tu cuenta, ${name}` : 'Tu cuenta'}
            className="ml-1 grid size-10 place-items-center rounded-full bg-orchid font-bold text-obsidian focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
          >
            <span aria-hidden="true">{getInitial(user)}</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-1.5">
        <MoneyCard balance={balance} monthExpense={totals?.expense} money={money} monthLabel={monthLabel} />
        {/* FT-0057: quien no anotó la plata que ya tenía ve un saldo que no es el real. */}
        {balance !== undefined && (
          <Link
            to="/app/mi-plata/corregir"
            className="inline-flex min-h-11 items-center self-start text-[13px] font-medium text-ink/70 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-violet"
          >
            {balanceSet ? '¿No es tu plata real? Corrígela' : '¿Ya tenías plata cuando empezaste? Dinos cuánta tienes hoy'}
          </Link>
        )}
      </div>

      <div data-tour="totales" className="-mt-2 grid grid-cols-2 gap-3">
        <Total label="Ingresos" to="/app/ingresos" value={totals?.income} money={money} positive period={monthLabel} />
        <Total label="Gastos" to="/app/gastos" value={totals?.expense} money={money} period={monthLabel} />
      </div>

      {notice ? (
        <Link
          to={notice.to}
          className="flex items-center gap-3 rounded-2xl bg-brand-soft p-3.5 focus-visible:outline-2 focus-visible:outline-violet"
        >
          <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-brand" />
          <span className="min-w-0 flex-1 text-sm">
            <span className="block font-semibold">{notice.title}</span>
            {notice.detail}
          </span>
          <ChevronRight className="size-[18px] shrink-0 text-ink/60" aria-hidden="true" />
        </Link>
      ) : welcomePending ? (
        <MoneyInvite onDone={onWelcomeDone} />
      ) : setupPending ? (
        <MoneySetupLink />
      ) : null}

      {empty ? (
        <DashboardEmpty />
      ) : (
        <>
          {shownExpense !== null && <ChartCard expense={shownExpense} budgets={budgets} names={names} money={money} />}

          <section aria-labelledby="ultimos">
            <SectionTitle id="ultimos" to="/app/movimientos">
              Últimos movimientos
            </SectionTitle>
            <Panel className="mt-1 px-3.5 py-0 md:p-0">
              {recentError ? (
                <p className="py-4 text-sm text-negative">{recentError}</p>
              ) : recent === undefined ? (
                <ul className="space-y-3 py-3" aria-busy="true">
                  {[0, 1, 2].map((i) => (
                    <li key={i} className="h-11 animate-pulse rounded-xl bg-ink/5" />
                  ))}
                </ul>
              ) : (
                <ul className="divide-y divide-ink/10">
                  {recent.slice(0, RECENT).map((transaction) => (
                    <MovementRow key={transaction.id} transaction={transaction} names={names} hidden={hidden} withDay fresh={fresh.has(transaction.id)} />
                  ))}
                </ul>
              )}
            </Panel>
          </section>
        </>
      )}
    </div>
  );
}
