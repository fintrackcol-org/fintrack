import { Link } from 'react-router-dom';
import { Bell, ChevronRight, Eye, EyeOff, Inbox } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import { MASK } from '@/components/dashboard/BalanceCard';
import { totalLinkLabel } from '@/lib/totalLink';
import { Wordmark } from '@/components/common/Logo';
import DashboardEmpty from '@/components/dashboard/DashboardEmpty';
import { useNotifications } from '@/components/layout/NotificationsProvider';
import MoneyInvite from '@/components/money/MoneyInvite';
import NegativeBalanceNote from '@/components/money/NegativeBalanceNote';
import MoneySetupLink from '@/components/money/MoneySetupLink';
import { formatMoney } from '@/components/transactions/format';
import { daysLabel, runway, untilText } from '@/lib/runway';
import { getDisplayName, getInitial } from '@/lib/displayName';
import { pickHomeNotice } from '@/lib/homeNotice';
import { cn } from '@/lib/utils';
import RindeLine from '@/components/common/RindeLine';
import { t } from '@/lib/i18n';
import { dayAndMonth } from '@/lib/moneyPlan';

const NEXT = 2;

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
        <span className="text-xs font-semibold uppercase tracking-[0.08em] text-white/85 first-letter:uppercase">{t('Mi plata ·')} {monthLabel}</span>
        <ChevronRight className="size-5" aria-hidden="true" />
      </span>
      <span className="relative truncate text-[40px] font-extrabold leading-[44px] tracking-[-0.02em] tabular-nums">
        {balance === undefined ? <Skeleton className="h-[0.9em] w-52" /> : money(balance ?? 0)}
      </span>
      {r ? (
        <>
          <RindeLine value={r.coverage} />
          <span className="flex items-center justify-between gap-3 text-[13px] leading-[18px]">
            <b className="font-semibold">{r.lasts ? t('Te alcanza para todo el mes') : t('Te alcanza {days} más', { days: daysLabel(r.days) })}</b>
            <span className="text-white/85">{untilText(r)}</span>
          </span>
        </>
      ) : balance === undefined ? (
        <>
          <span aria-hidden="true" className="relative block h-1 overflow-hidden rounded-full bg-white/30">
            <span className="absolute inset-y-0 left-0 w-1/2 rounded-full bg-white/80 motion-safe:animate-pulse" />
          </span>
          <span className="text-[13px] leading-[18px] text-white/85">{t('Calculando hasta cuándo te alcanza…')}</span>
        </>
      ) : (
        <>
          <RindeLine value={0} />
          <span className="text-[13px] leading-[18px] text-white/85">{t('Anota tu primer ingreso para saber hasta cuándo te alcanza.')}</span>
        </>
      )}
      <span className="sr-only">{t(', ver Mi plata')}</span>
    </Link>
  );
}

/**
 * La cifra de Rinde v5: cuánto puedes gastar sin tocar lo apartado para pagos (`free` de Mi plata,
 * FT-0037). Es un estimado y lo dice; tocarla lleva a Mi plata, donde está la cuenta completa.
 */
function FreeCard({ plan, money }) {
  const short = plan.free < 0;
  return (
    <Link
      to="/app/mi-plata"
      data-tour="saldo"
      className={cn(
        'relative flex flex-col gap-2 overflow-hidden rounded-3xl p-5 transition-transform focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet motion-safe:active:scale-[0.99]',
        short ? 'bg-negative/10 text-ink' : 'bg-brand text-white',
      )}
    >
      {!short && <span aria-hidden="true" className="absolute -right-16 -top-16 size-40 rounded-full border-[32px] border-white/15" />}
      <span className="relative flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] opacity-85">
        {short ? t('Te faltan · estimado') : t('Libre para gastar · estimado')}
        <ChevronRight className="size-5" aria-hidden="true" />
      </span>
      <span className={cn('relative truncate text-[40px] font-extrabold leading-[44px] tracking-[-0.02em] tabular-nums', short && 'text-negative')}>
        {money(short ? plan.shortfall : plan.free)}
      </span>
      {plan.mode === 'daily' && !short && (
        <span className="relative text-[15px] font-semibold">
          {t('Más o menos {amount} al día hasta el {date}', { amount: money(plan.perDay), date: dayAndMonth(plan.nextPay) })}
        </span>
      )}
      <span className="relative text-[13px] leading-[18px] opacity-85">
        {short
          ? t('para tus pagos. Tienes {money} y vencen {pending}.', { money: money(plan.money), pending: money(plan.pendingTotal) })
          : t('De {money} que tienes, {pending} ya están apartados para pagos.', { money: money(plan.money), pending: money(plan.pendingTotal) })}
      </span>
      <span className={cn('relative self-start rounded-full px-3 py-1 text-[13px] font-semibold', short ? 'bg-ink/5' : 'bg-white/15')}>{t('¿De dónde sale?')}</span>
    </Link>
  );
}

/** Los próximos pagos fijos: qué viene, cuándo y cuánto. */
function NextPayments({ pending, money }) {
  return (
    <section aria-labelledby="lo-proximo" className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h2 id="lo-proximo" className="text-lg font-semibold tracking-tight">
          {t('Lo próximo')}
        </h2>
        <Link to="/app/mi-plata/pagos" className="py-3 text-sm font-medium text-brand">
          {t('Ver pagos')}
        </Link>
      </div>
      <ul className="divide-y divide-ink/10 rounded-2xl bg-surface px-4 ring-1 ring-ink/10">
        {pending.slice(0, NEXT).map((p) => (
          <li key={`${p.id}-${p.date}`} className="flex min-h-14 items-center justify-between gap-3 py-2.5">
            <span className="min-w-0">
              <b className="block truncate text-[15px] font-semibold">{p.name}</b>
              <span className="text-[13px] text-ink/60">{dayAndMonth(p.date)}</span>
            </span>
            <span className="shrink-0 font-semibold tabular-nums">{money(p.amount)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Inicio en el celular (Rinde v5): la cifra de lo que puedes gastar, lo próximo que hay que pagar y cómo
 * va el mes (ingresos, gastos y lo que espera confirmación). Lo demás está en las pestañas: Movimientos
 * es lo que ya pasó y Planear lo que viene.
 *
 * @param {object} props
 * @param {number|null|undefined} props.balance Saldo; `undefined` mientras carga.
 * @param {boolean} [props.balanceSet] El usuario ya dijo cuánta plata tiene (FT-0057).
 * @param {{ income: number, expense: number }|undefined} props.totals Del mes actual.
 * @param {object[]|undefined} props.budgets
 * @param {object[]|undefined} props.cards
 * @param {object|null} [props.plan] Plan de Mi plata (FT-0037); `null` si no está listo o sin conexión.
 * @param {number} [props.toConfirm] Pagos que llegaron solos y esperan confirmación (FT-0047).
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
  budgets,
  cards,
  plan = null,
  toConfirm = 0,
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
  const money = (value) => (hidden ? MASK : formatMoney(value));
  const name = getDisplayName(user);
  const pending = plan?.pending ?? [];
  // Los pagos que vienen ya están en «Lo próximo»: el aviso no los repite.
  const notice = pickHomeNotice({ cards, budgets, names, money });

  return (
    <div className="flex flex-col gap-4 pt-[max(0.5rem,env(safe-area-inset-top))]">
      {/* Rinde v2: el logo a la izquierda; avisos, ocultar montos y la cuenta a la derecha. */}
      <header className="flex items-center justify-between">
        <span role="img" aria-label={t('Rinde')} className="text-ink">
          <Wordmark className="h-7 w-auto" />
        </span>
        <div className="flex items-center gap-1">
          <Link
            to="/app/notificaciones"
            aria-label={unread === 0 ? t('Notificaciones') : t('Notificaciones, {unread} sin leer', { unread })}
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
            aria-label={hidden ? t('Mostrar montos') : t('Ocultar montos')}
            className="grid size-11 place-items-center rounded-full text-ink/70 hover:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
          >
            {hidden ? <EyeOff className="size-[22px]" aria-hidden="true" /> : <Eye className="size-[22px]" aria-hidden="true" />}
          </button>
          <Link
            to="/app/cuenta"
            data-tour="cuenta"
            aria-label={name ? t('Tu cuenta, {name}', { name }) : t('Tu cuenta')}
            className="ml-1 grid size-11 place-items-center rounded-full bg-orchid font-bold text-obsidian focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
          >
            <span aria-hidden="true">{getInitial(user)}</span>
          </Link>
        </div>
      </header>

      <div className="flex flex-col gap-1.5">
        {plan ? (
          <FreeCard plan={plan} money={money} />
        ) : (
          <MoneyCard balance={balance} monthExpense={totals?.expense} money={money} monthLabel={monthLabel} />
        )}
        <NegativeBalanceNote money={balance} className="rounded-xl bg-negative/10 px-3 py-2.5 text-negative" />
        {/* FT-0057: quien no anotó la plata que ya tenía ve un saldo que no es el real. */}
        {balance !== undefined && (
          <Link
            to="/app/mi-plata/corregir"
            className="inline-flex min-h-11 items-center self-start text-[13px] font-medium text-ink/70 underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-violet"
          >
            {balanceSet ? t('¿No es tu plata real? Corrígela') : t('¿Ya tenías plata cuando empezaste? Dinos cuánta tienes hoy')}
          </Link>
        )}
      </div>

      {pending.length > 0 && <NextPayments pending={pending} money={money} />}

      <section aria-labelledby="este-mes" data-tour="totales" className="flex flex-col gap-3">
        <h2 id="este-mes" className="text-lg font-semibold tracking-tight">
          {t('Este mes')}
        </h2>
        <div className="grid grid-cols-2 gap-3">
          <Total label={t('Ingresos')} to="/app/ingresos" value={totals?.income} money={money} positive period={monthLabel} />
          <Total label={t('Gastos')} to="/app/gastos" value={totals?.expense} money={money} period={monthLabel} />
        </div>
        {toConfirm > 0 && (
          <Link
            to="/app/por-confirmar"
            className="flex min-h-14 items-center gap-3 rounded-2xl bg-surface px-4 py-3 ring-1 ring-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
          >
            <Inbox className="size-5 shrink-0 text-brand" aria-hidden="true" />
            <span className="min-w-0 flex-1 text-[15px]">
              <b className="block font-semibold">{t('Por confirmar')}</b>
              <span className="text-[13px] text-ink/60">
                {toConfirm === 1 ? t('1 pago que llegó solo') : t('{count} pagos que llegaron solos', { count: toConfirm })}
              </span>
            </span>
            <span className="text-sm font-semibold text-brand">{t('Revisar')}</span>
          </Link>
        )}
      </section>

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

      {empty && <DashboardEmpty />}
    </div>
  );
}
