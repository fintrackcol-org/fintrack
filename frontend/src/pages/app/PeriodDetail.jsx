import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MASK } from '@/components/dashboard/BalanceCard';
import ExpenseByCategory from '@/components/dashboard/ExpenseByCategory';
import PeriodSelector from '@/components/dashboard/PeriodSelector';
import Panel from '@/components/layout/Panel';
import FilteredMovements from '@/components/money/FilteredMovements';
import KakeiboSplit from '@/components/money/KakeiboSplit';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import useCategoryNames from '@/hooks/useCategoryNames';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { periodLabel, todayIso } from '@/lib/period';
import { cn } from '@/lib/utils';
import { getSummary } from '@/services/summaryService';
import { t } from '@/lib/i18n';

const CONFIG = {
  ingreso: {
    title: t('Ingresos'),
    question: t('¿De dónde entró tu plata?'),
    tone: 'text-positive',
    sign: '+ ',
    listTitle: t('Todos los ingresos'),
    byCategory: t('De dónde entró'),
    empty: t('No hay ingresos en este periodo.'),
  },
  gasto: {
    title: t('Gastos'),
    question: t('¿En qué se fue tu plata?'),
    tone: '',
    sign: '− ',
    listTitle: t('Todos los gastos'),
    byCategory: t('Por categoría'),
    empty: t('No hay gastos en este periodo.'),
  },
};

/**
 * Cuántos días van del periodo (hasta hoy si es el actual), para el promedio diario.
 * @param {{ from: string, to: string }} range AAAA-MM-DD
 */
export function elapsedDays({ from, to }, today = new Date()) {
  const start = new Date(`${from}T12:00:00`);
  const end = new Date(`${to}T12:00:00`);
  const now = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 12);
  const last = now < end ? now : end;
  return Math.max(1, Math.round((last - start) / 86_400_000) + 1);
}

/**
 * Páginas `/app/ingresos` y `/app/gastos` (Rinde v2): la pregunta que responden, el total del periodo en
 * grande con su promedio diario, lo otro y el balance, por categoría, el Kakeibo (gastos) y la lista
 * filtrable por categoría.
 * @param {{ type: 'ingreso'|'gasto' }} props
 */
export default function PeriodDetail({ type }) {
  const { title, question, tone, sign, listTitle, byCategory, empty } = CONFIG[type];
  usePageTitle(title);
  const online = useOnlineStatus();
  const [hidden] = useHiddenAmounts();
  const { names } = useCategoryNames();
  const { state } = useLocation();
  const [selected, setSelected] = useState(state?.selected ?? { period: 'month', date: todayIso() });
  const [category, setCategory] = useState('');
  const summary = useAsync(() => getSummary(selected.period, selected.date), [selected.period, selected.date, online]);
  const current = summary.loading || summary.error ? undefined : summary.data;
  const money = (value) => (current === undefined ? '…' : hidden ? MASK : formatMoney(value));
  const income = type === 'ingreso';
  const totals = income ? current?.income : current?.expense;
  const total = totals?.total;
  const days = current ? elapsedDays(current) : null;
  // Chips para filtrar la lista: las categorías que tienen movimientos en el periodo.
  const chips = (totals?.byCategory ?? []).filter((r) => r.total > 0).map((r) => r.category ?? 'sin_clasificar');

  const rows = [
    income ? [t('Gastos'), current?.expense.total, 'text-negative'] : [t('Ingresos'), current?.income.total, 'text-positive'],
    ...(current?.savings.total > 0 ? [[t('Ahorro'), current.savings.total, '']] : []),
    [t('Balance'), current?.balance, ''],
  ];

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      {/* Rinde v2: el periodo arriba en pequeño y la pregunta que responde la pantalla. */}
      <header>
        <p className="text-[13px] text-ink/60 first-letter:uppercase">
          {title} · {periodLabel(selected.period, selected.date)}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{question}</h1>
      </header>
      <PeriodSelector stacked period={selected.period} date={selected.date} onChange={(next) => (setSelected(next), setCategory(''))} />

      {summary.error ? (
        <p role="alert" className="text-sm text-negative">
          {online ? summary.error : t('Sin conexión: se actualiza al volver internet.')}{' '}
          <button type="button" className="underline" onClick={summary.reload}>
            {t('Reintentar')}
          </button>
        </p>
      ) : (
        <>
          <div aria-busy={current === undefined}>
            <p className={cn('text-[40px] font-extrabold leading-[44px] tracking-[-0.02em] tabular-nums', tone)}>
              {current === undefined ? '…' : `${total > 0 ? sign : ''}${money(total)}`}
            </p>
            {days && total > 0 && (
              <p className="mt-1 text-[13px] text-ink/60">
                {t('En')} {days === 1 ? t('1 día') : t('{days} días', { days })} {t('· promedio')} {money(Math.round(total / days))} {t('al día')}
              </p>
            )}
          </div>
          <Panel className="py-0 md:py-0">
            <dl className="divide-y divide-ink/10">
              {rows.map(([label, value, rowTone]) => (
                <div key={label} className="flex min-h-[52px] items-center justify-between gap-4 text-[15px]">
                  <dt className="text-ink/70">{label}</dt>
                  <dd className={cn('font-semibold tabular-nums', rowTone)}>{money(value)}</dd>
                </div>
              ))}
            </dl>
          </Panel>
        </>
      )}

      <ExpenseByCategory expense={totals} names={names} hidden={hidden} title={byCategory} emptyText={empty} />

      {/* FT-0070: los gastos del periodo por grupo Kakeibo. */}
      {!income && current && <KakeiboSplit from={current.from} to={current.to} hidden={hidden} />}

      <section aria-labelledby="movimientos-periodo">
        <h2 id="movimientos-periodo" className="mb-2 text-lg font-semibold tracking-tight">
          {listTitle}
        </h2>
        {chips.length > 1 && (
          <div role="group" aria-label={t('Filtrar por categoría')} className="-mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {['', ...chips].map((key) => (
              <button
                key={key || 'todas'}
                type="button"
                aria-pressed={category === key}
                onClick={() => setCategory(key)}
                className={cn(
                  'h-11 shrink-0 rounded-lg px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                  category === key ? 'bg-brand text-white' : 'bg-brand-soft text-ink',
                )}
              >
                {key === '' ? t('Todas') : key === 'sin_clasificar' ? t('Sin clasificar') : (names[key] ?? key)}
              </button>
            ))}
          </div>
        )}
        {current ? (
          <FilteredMovements
            key={category}
            filters={{ type, from: current.from, to: current.to, ...(category && category !== 'sin_clasificar' && { category }) }}
            names={names}
            hidden={hidden}
            empty={empty}
          />
        ) : (
          <div className="h-24 animate-pulse rounded-2xl bg-ink/5" aria-hidden="true" />
        )}
      </section>

      <Button asChild variant="soft" size="lg">
        <Link to="/app/movimientos">{t('Ver todos los movimientos')}</Link>
      </Button>
    </div>
  );
}
