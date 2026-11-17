import { Link } from 'react-router-dom';
import { ChevronRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { MASK } from '@/components/dashboard/BalanceCard';
import DashboardEmpty from '@/components/dashboard/DashboardEmpty';
import { MoneyCard } from '@/components/dashboard/MobileHome';
import MoneyInvite from '@/components/money/MoneyInvite';
import MoneySetupLink from '@/components/money/MoneySetupLink';
import NegativeBalanceNote from '@/components/money/NegativeBalanceNote';
import { kakeiboOf } from '@/components/transactions/reflection';
import { formatMoney, formatRelativeDay } from '@/components/transactions/format';
import { displayLevel } from '@/lib/budgetLevel';
import { getDisplayName } from '@/lib/displayName';
import { cn } from '@/lib/utils';

const RECENT = 6;
const BUDGETS = 3;
const UPCOMING = 5;
const BAR = { none: 'bg-brand', warning_80: 'bg-caution', exceeded_100: 'bg-negative' };
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];

/** "13 nov" sin pasar por UTC. */
const shortDay = (iso) => {
  const [, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]}`;
};

/** Tarjeta blanca del escritorio con título y enlace opcional a la derecha. */
function Card({ title, to, linkLabel, className, children, ...rest }) {
  return (
    <section className={cn('rounded-3xl bg-surface p-5 ring-1 ring-ink/10', className)} {...rest}>
      {title && (
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">{title}</h2>
          {to && (
            <Link to={to} className="text-sm font-semibold text-brand hover:underline">
              {linkLabel}
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}

/** Ingresos o gastos del mes, en grande; llevan a su detalle. */
function Total({ label, value, to, money, positive = false }) {
  return (
    <Link
      to={to}
      className="group flex flex-1 flex-col justify-center gap-1 rounded-3xl bg-surface px-5 py-4 ring-1 ring-ink/10 transition-colors hover:bg-ink/[0.02] focus-visible:outline-2 focus-visible:outline-violet"
    >
      <span className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-ink/60">
        {label}
        <span className="inline-flex items-center text-[13px] font-medium normal-case tracking-normal text-ink/60 group-hover:text-brand">
          ver detalle <ChevronRight className="size-4" aria-hidden="true" />
        </span>
      </span>
      <span className={cn('text-[28px] font-extrabold tracking-tight tabular-nums', positive && 'text-positive')}>
        {value === undefined ? (
          <span className="inline-block h-7 w-40 animate-pulse rounded-md bg-ink/10 align-middle" />
        ) : (
          `${positive ? '+ ' : '− '}${money(value)}`
        )}
      </span>
    </Link>
  );
}

/** Los presupuestos más usados del mes. */
function BudgetsCard({ budgets, names, money }) {
  const top = budgets ? [...budgets].sort((a, b) => b.percentage - a.percentage).slice(0, BUDGETS) : null;
  return (
    <Card title="Tus presupuestos" to="/app/presupuestos" linkLabel="Ver todos" data-tour="graficos">
      {top === null ? (
        <ul className="space-y-4" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <li key={i} className="h-8 animate-pulse rounded-lg bg-ink/5" />
          ))}
        </ul>
      ) : top.length === 0 ? (
        <p className="py-4 text-sm text-ink/60">
          Aún no tienes presupuestos.{' '}
          <Link to="/app/presupuestos" className="font-semibold text-brand">
            Crea el primero
          </Link>
        </p>
      ) : (
        <ul className="space-y-3.5">
          {top.map((b) => {
            const level = displayLevel(b.alert);
            return (
              <li key={b.id}>
                <Link to={`/app/presupuestos/${b.category}`} className="block rounded-lg focus-visible:outline-2 focus-visible:outline-violet">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <b className="truncate font-semibold">{names[b.category] ?? b.category}</b>
                    <span className="shrink-0 tabular-nums">
                      <b className={cn('font-semibold', level === 'exceeded_100' && 'text-negative')}>{money(b.consumed ?? 0)}</b>{' '}
                      <span className="text-ink/60">de {money(b.amount)}</span>
                    </span>
                  </span>
                  <span className="relative mt-1.5 block h-1 rounded-full bg-ink/10" aria-hidden="true">
                    <span className={cn('absolute inset-y-0 left-0 rounded-full', BAR[level])} style={{ width: `${Math.min(b.percentage, 100)}%` }} />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

/** Los últimos movimientos en tabla: fecha, en qué, categoría, tipo y monto. Cada fila abre el detalle. */
function RecentTable({ recent, error, names, money }) {
  return (
    <Card title="Últimos movimientos" to="/app/movimientos" linkLabel="Ver todos" className="min-w-0">
      {error ? (
        <p className="py-4 text-sm text-negative">{error}</p>
      ) : recent === undefined ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-ink/5" />
          ))}
        </div>
      ) : (
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-ink/10 text-xs uppercase tracking-[0.08em] text-ink/60">
              <th scope="col" className="py-2 pr-3 font-semibold">Fecha</th>
              <th scope="col" className="py-2 pr-3 font-semibold">En qué</th>
              <th scope="col" className="py-2 pr-3 font-semibold max-xl:hidden">Categoría</th>
              <th scope="col" className="py-2 pr-3 font-semibold">Tipo</th>
              <th scope="col" className="py-2 text-right font-semibold">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-ink/10">
            {recent.slice(0, RECENT).map((t) => {
              const income = t.type === 'ingreso';
              return (
                <tr key={t.id} className="group relative hover:bg-ink/[0.03]">
                  <td className="py-3 pr-3 text-ink/70">{formatRelativeDay(t.date)}</td>
                  <td className="max-w-0 py-3 pr-3 font-semibold">
                    {/* El enlace cubre toda la fila: así se abre con un clic en cualquier parte. */}
                    <Link
                      to={`/app/transacciones/${t.id}`}
                      state={{ transaction: t }}
                      className="block truncate after:absolute after:inset-0 focus-visible:outline-2 focus-visible:outline-violet"
                    >
                      {t.description}
                    </Link>
                  </td>
                  <td className="py-3 pr-3 max-xl:hidden">{t.category ? (names[t.category] ?? t.category) : 'Sin clasificar'}</td>
                  <td className="py-3 pr-3 text-ink/60">{income ? 'Ingreso' : (kakeiboOf(t.kakeibo)?.label ?? 'Gasto')}</td>
                  <td className={cn('py-3 text-right font-semibold tabular-nums', income && 'text-positive')}>
                    {income ? '+ ' : '− '}
                    {money(t.amount)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Card>
  );
}

/** Lo que viene: pagos fijos, cobros y cuentas desde hoy, del calendario de Mi plata. */
function UpcomingCard({ events, money, today }) {
  const next = events?.filter((e) => e.date >= today && e.status !== 'pagado').slice(0, UPCOMING);
  return (
    <Card title="Próximos pagos fijos" to="/app/calendario" linkLabel="Calendario">
      {next === undefined ? (
        <div className="space-y-2" aria-busy="true">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-lg bg-ink/5" />
          ))}
        </div>
      ) : next.length === 0 ? (
        <p className="py-4 text-sm text-ink/60">No tienes pagos pendientes este mes.</p>
      ) : (
        <ul className="divide-y divide-ink/10">
          {next.map((e) => {
            const incoming = e.kind === 'cobro';
            return (
              <li key={`${e.kind}-${e.id}-${e.date}`} className="flex items-center justify-between gap-3 py-3 text-sm">
                <span className="min-w-0 text-ink/70">
                  {shortDay(e.date)} · {incoming ? `Te paga ${e.name}` : e.name}
                </span>
                <span className={cn('shrink-0 font-semibold tabular-nums', incoming && 'text-positive')}>
                  {incoming ? '+ ' : ''}
                  {money(e.amount)}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

const longDate = (date) =>
  date.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).replace(/^./, (c) => c.toUpperCase());

/**
 * Inicio en el computador (Rinde v2, lienzo «Escritorio»): arriba la pregunta del día; la tarjeta de Mi
 * plata con hasta cuándo alcanza, ingresos y gastos del mes y los presupuestos más usados; abajo los
 * últimos movimientos en tabla y los próximos pagos. Mismos datos que el celular.
 * @param {object} props Igual que `MobileHome`, más `events` (calendario del mes) y `today`.
 */
export default function DesktopHome({
  balance,
  totals,
  budgets,
  recent,
  recentError,
  events,
  today,
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
  const name = getDisplayName(user);
  const money = (value) => (hidden ? MASK : formatMoney(value));
  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-ink/60">{longDate(new Date())}</p>
          <h1 className="text-[28px] font-extrabold tracking-tight">{name ? `¿Cuánto te queda, ${name}?` : '¿Cuánto te queda?'}</h1>
        </div>
        <button
          type="button"
          onClick={onToggleHidden}
          aria-pressed={hidden}
          className="inline-flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-medium text-ink/70 ring-1 ring-ink/10 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
        >
          {hidden ? <EyeOff className="size-4" aria-hidden="true" /> : <Eye className="size-4" aria-hidden="true" />}
          {hidden ? 'Mostrar montos' : 'Ocultar montos'}
        </button>
      </header>

      <NegativeBalanceNote money={balance} className="rounded-xl bg-negative/10 px-4 py-3 text-negative" />
      {welcomePending ? <MoneyInvite onDone={onWelcomeDone} /> : setupPending ? <MoneySetupLink /> : null}

      <div className="grid gap-4 xl:grid-cols-[1.15fr_1fr_1.15fr] lg:grid-cols-2">
        <MoneyCard balance={balance} monthExpense={totals?.expense} money={money} monthLabel={monthLabel} className="min-h-[180px] justify-between" />
        <div data-tour="totales" className="flex flex-col gap-4">
          <Total label="Ingresos" to="/app/ingresos" value={totals?.income} money={money} positive />
          <Total label="Gastos" to="/app/gastos" value={totals?.expense} money={money} />
        </div>
        <BudgetsCard budgets={budgets} names={names} money={money} />
      </div>

      {empty ? (
        <DashboardEmpty />
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.9fr)_minmax(280px,1fr)]">
          <RecentTable recent={recent} error={recentError} names={names} money={money} />
          <UpcomingCard events={events} money={money} today={today} />
        </div>
      )}

      <p className="text-[13px] text-ink/60">
        Anota desde la barra de abajo: escribe «almuerzo 15 mil» y presiona <kbd className="font-semibold">Enter</kbd>.{' '}
        <kbd className="font-semibold">Esc</kbd> cierra las hojas. Funciona también como app instalada en el computador.
      </p>
    </div>
  );
}
