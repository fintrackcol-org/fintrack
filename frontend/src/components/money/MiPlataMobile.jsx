import { Link } from 'react-router-dom';
import { MASK } from '@/components/dashboard/BalanceCard';
import { currentMonth } from '@/components/budgets/month';
import { formatMoney } from '@/components/transactions/format';
import useAsync from '@/hooks/useAsync';
import useCategoryNames from '@/hooks/useCategoryNames';
import { displayLevel } from '@/lib/budgetLevel';
import { todayIso } from '@/lib/period';
import { runway, untilText } from '@/lib/runway';
import { cn } from '@/lib/utils';
import { listBudgets } from '@/services/budgetService';
import { getSummary } from '@/services/summaryService';
import RindeLine from '@/components/common/RindeLine';
import NegativeBalanceNote from '@/components/money/NegativeBalanceNote';
import { t } from '@/lib/i18n';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTH_NAMES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const BAR = { none: 'bg-brand', warning_80: 'bg-caution', exceeded_100: 'bg-negative' };

/**
 * El primer pago fijo del mes que, a este ritmo, ya no alcanza a cubrirse: vence después del día en
 * que se acaba la plata. `null` si la plata llega a fin de mes o no hay pagos después de ese día.
 * @param {Array<{ name: string, amount: number, dayOfMonth: number, frequency?: string }>} commitments
 * @param {{ until: Date, lasts: boolean }|null} r De `runway`.
 * @param {Date} [today]
 */
export function firstUncovered(commitments, r, today = new Date()) {
  if (!r || r.lasts) return null;
  const sameMonth = r.until.getMonth() === today.getMonth();
  const limit = sameMonth ? r.until.getDate() : 0;
  return (
    monthly(commitments)
      .filter((c) => c.dayOfMonth > today.getDate() && c.dayOfMonth > limit)
      .sort((a, b) => a.dayOfMonth - b.dayOfMonth)[0] ?? null
  );
}

/** Los pagos de cada mes (los anuales solo cuentan en su mes). */
function monthly(commitments, today = new Date()) {
  return commitments.filter((c) => c.frequency !== 'yearly' || c.month === today.getMonth() + 1);
}

/**
 * Mi plata en el celular (Rinde v2): ¿hasta cuándo te alcanza?, el aviso del primer pago que no
 * alcanza, los presupuestos que más se están usando y los pagos fijos del mes. Todo se calcula con lo
 * que ya llega del servidor; los accesos a lo demás van debajo, en «Más de tu plata».
 * @param {{ money: number|null|undefined, commitments: object[], hidden: boolean, children?: import('react').ReactNode }} props
 */
export default function MiPlataMobile({ money: balance, commitments = [], hidden, children }) {
  const { names } = useCategoryNames();
  const summary = useAsync(() => getSummary('month', todayIso()), []);
  const budgets = useAsync(() => listBudgets(currentMonth()), []);
  const money = (value) => (hidden ? MASK : formatMoney(value));
  const today = new Date();
  const expense = summary.data?.expense.total;
  const income = summary.data?.income.total;
  const r = typeof balance === 'number' && expense !== undefined ? runway({ balance, monthExpense: expense, today }) : null;
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
  const warn = firstUncovered(commitments, r, today);
  const top = budgets.data ? [...budgets.data].sort((a, b) => b.percentage - a.percentage) : [];
  const fixed = monthly(commitments).sort((a, b) => a.dayOfMonth - b.dayOfMonth);
  const month = MONTHS[today.getMonth()];

  return (
    <div className="flex flex-col gap-5">
      <h1 className="text-2xl font-bold tracking-tight">{t('¿Hasta cuándo te alcanza?')}</h1>

      <div className="relative flex flex-col gap-3 overflow-hidden rounded-3xl bg-brand p-5 text-white">
        <span aria-hidden="true" className="absolute -right-16 -top-16 size-40 rounded-full border-[32px] border-white/15" />
        <span className="relative text-xs font-semibold uppercase tracking-[0.08em] text-white/85">
          {t('Lo que te queda ·')} {MONTH_NAMES[today.getMonth()]}
        </span>
        <span className="relative text-[40px] font-extrabold leading-[44px] tracking-[-0.02em] tabular-nums">
          {balance === undefined ? '…' : money(balance ?? 0)}
        </span>
        <NegativeBalanceNote money={balance} className="relative rounded-xl bg-white/15 px-3 py-2.5 text-white" />
        {r && (
          <>
            <RindeLine value={(today.getDate() + Math.min(r.days, lastDay - today.getDate())) / lastDay} />
            <span className="flex items-center justify-between gap-2 text-[13px]">
              <span className="text-white/85">1 {month}</span>
              <b className="font-semibold">{r.lasts ? t('Alcanza todo el mes') : t('Alcanza {r}', { r: untilText(r) })}</b>
              <span className="text-white/85">
                {lastDay} {month}
              </span>
            </span>
          </>
        )}
        {summary.data && (
          <span className="relative text-[13px] text-white/85">
            {r ? t('Gastas en promedio {pace} al día. ', { pace: money(r.pace) }) : ''}{t('Ingresos')} {money(income)} {t('· Gastos')} {money(expense)}.
          </span>
        )}
      </div>

      <Link
        to="/app/mi-plata/corregir"
        className="-mt-3 inline-flex min-h-11 items-center self-start text-[13px] font-medium text-ink/70 underline underline-offset-2"
      >
        {t('¿No es tu plata real? Corrígela')}
      </Link>

      {warn && (
        <p className="-mt-2 flex gap-2.5 rounded-2xl bg-brand-soft p-3.5 text-sm">
          <span aria-hidden="true" className="mt-1.5 size-2.5 shrink-0 rounded-full bg-brand" />
          <span>
            <b className="font-semibold">
              {t('Ojo con el')} {warn.dayOfMonth} {t('de')} {MONTH_NAMES[today.getMonth()]}.
            </b>{' '}
            {t('Vence')} {warn.name} ({money(warn.amount)}{t(') y a este ritmo no alcanza. Anota los ingresos que esperas o baja algún presupuesto.')}
          </span>
        </p>
      )}

      {children}

      <section aria-labelledby="mp-presupuestos" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="mp-presupuestos" className="text-lg font-semibold tracking-tight">
            {t('Presupuestos')}
          </h2>
          <Link to="/app/presupuestos" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-brand">
            {t('Ver y editar')}
          </Link>
        </div>
        <div className="flex flex-col gap-3.5 rounded-2xl bg-surface p-4 ring-1 ring-ink/10">
          {top.length === 0 ? (
            <p className="text-sm text-ink/60">
              {budgets.data ? t('Aún no tienes presupuestos. Ponle un tope a lo que más gastas.') : t('Cargando…')}
            </p>
          ) : (
            top.slice(0, 3).map((b) => {
              const level = displayLevel(b.alert);
              const label = names[b.category] ?? b.category;
              return (
                <Link key={b.id} to={`/app/presupuestos/${b.category}`} className="flex min-h-11 flex-col justify-center gap-2 focus-visible:outline-2 focus-visible:outline-violet">
                  <span className="flex items-baseline justify-between gap-3 text-[15px]">
                    <b className="truncate font-semibold">{label}</b>
                    <span className="shrink-0 text-[13px] tabular-nums">
                      <b className={cn('font-semibold', level === 'exceeded_100' && 'text-negative')}>{money(b.consumed)}</b>{' '}
                      <span className="text-ink/60">
                        {t('de')} {money(b.amount)} · {Math.round(b.percentage)} %
                      </span>
                    </span>
                  </span>
                  <span
                    role="meter"
                    aria-label={t('Consumo de {label}', { label })}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={Math.min(Math.round(b.percentage), 100)}
                    className="relative block h-1 rounded-full bg-ink/10"
                  >
                    <span className={cn('absolute inset-y-0 left-0 rounded-full', BAR[level])} style={{ width: `${Math.min(b.percentage, 100)}%` }} />
                  </span>
                </Link>
              );
            })
          )}
          {top.length > 3 && (
            <Link to="/app/presupuestos" className="inline-flex min-h-11 items-center text-[13px] font-medium text-brand">
              + {top.length - 3} {top.length - 3 === 1 ? t('presupuesto más') : t('presupuestos más')}
            </Link>
          )}
        </div>
      </section>

      <section aria-labelledby="mp-pagos" className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 id="mp-pagos" className="text-lg font-semibold tracking-tight">
            {t('Pagos fijos del mes')}
          </h2>
          <Link to="/app/calendario" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-brand">
            {t('Ver calendario')}
          </Link>
        </div>
        {fixed.length === 0 ? (
          <Link to="/app/mi-plata/pagos" className="rounded-2xl bg-surface p-4 text-sm text-ink/70 ring-1 ring-ink/10">
            {t('Agrega lo que pagas cada mes (arriendo, internet, PILA) y te avisamos antes.')} <b className="text-brand">{t('Agregar')}</b>
          </Link>
        ) : (
          <ul className="rounded-2xl bg-surface px-4 ring-1 ring-ink/10">
            {fixed.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3 border-b border-ink/10 py-3 text-sm last:border-0">
                <span className={cn('min-w-0 truncate', c.dayOfMonth < today.getDate() ? 'text-ink/60 line-through decoration-ink/30' : 'text-ink/80')}>
                  {c.dayOfMonth} {month} · {c.name}
                </span>
                <b className="shrink-0 font-semibold tabular-nums">{money(c.amount)}</b>
              </li>
            ))}
            <li className="py-1">
              <Link to="/app/mi-plata/pagos" className="inline-flex min-h-11 items-center text-[13px] font-semibold text-brand">
                {t('Editar pagos fijos')}
              </Link>
            </li>
          </ul>
        )}
      </section>
    </div>
  );
}
