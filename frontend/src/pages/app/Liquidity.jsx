import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { CircleAlert, CircleCheck, Lightbulb, Loader2, TriangleAlert } from 'lucide-react';
import { liquidityMessage } from '@/components/dashboard/LiquidityCard';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { formatMoney } from '@/components/transactions/format';
import useAsync from '@/hooks/useAsync';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import usePageTitle from '@/hooks/usePageTitle';
import { avoidTips, chartPoints, hasData, shortDay } from '@/lib/liquidity';
import { cn } from '@/lib/utils';
import { getLiquidity } from '@/services/moneyProfileService';

const LiquidityChart = lazy(() => import('@/components/liquidity/LiquidityChart'));

const TONES = {
  ok: { icon: CircleCheck, box: 'bg-positive/10', text: 'text-positive' },
  riesgo: { icon: TriangleAlert, box: 'bg-caution/10', text: 'text-caution' },
  falta: { icon: CircleAlert, box: 'bg-negative/10', text: 'text-negative' },
};

/** Qué es cada pago, en palabras. */
const KIND_TEXT = {
  compromiso: 'Pago del mes',
  card: 'Tarjeta',
  vaca: 'Tu aporte a la vaca',
  deuda: 'Cuenta por pagar',
};

/**
 * Motor de liquidez (FT-0059): la plata día por día en una gráfica, por qué faltaría y cómo
 * evitarlo. Es conservador: no cuenta plata que todavía no ha entrado (lo dice abajo).
 */
export default function Liquidity() {
  usePageTitle('Tu plata en los próximos días');
  const [hidden] = useHiddenAmounts();
  const liquidity = useAsync(() => getLiquidity(), []);
  const data = liquidity.data;
  const money = (amount) => (hidden ? '$ •••' : formatMoney(Math.round(amount)));

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Tu plata en los próximos días" description="Lo que tienes, lo que gastas y lo que debes pagar, día por día." />

      {liquidity.error && !data && (
        <p role="alert" className="text-sm text-negative">
          {liquidity.error}{' '}
          <button type="button" className="underline" onClick={liquidity.reload}>
            Reintentar
          </button>
        </p>
      )}
      {!data && !liquidity.error && (
        <p className="flex justify-center py-10" role="status" aria-label="Calculando tu plata">
          <Loader2 className="animate-spin text-ink/50" aria-hidden="true" />
        </p>
      )}

      {data && (!data.ready || !hasData(data)) && (
        <Panel className="text-center">
          <p className="font-medium">Agrega tus pagos del mes para ver si te alcanza.</p>
          <p className="mt-1 text-sm text-ink/60">
            Con lo que tienes y tus pagos (arriendo, servicios, tarjetas) te decimos si te va a faltar plata y cuándo.
          </p>
          <Link
            to="/app/mi-plata"
            className="mt-3 inline-block font-medium text-violet-light underline-offset-4 hover:underline"
          >
            Ir a Mi plata
          </Link>
        </Panel>
      )}

      {data?.ready && hasData(data) && <LiquidityDetail data={data} money={money} hidden={hidden} />}
    </div>
  );
}

/**
 * @param {{ data: object, money: (amount: number) => string, hidden: boolean }} props
 */
function LiquidityDetail({ data, money, hidden }) {
  const tone = TONES[data.risk] ?? TONES.ok;
  const Icon = tone.icon;
  const { title, detail } = liquidityMessage(data, money);
  const shortfall = data.firstShortfall;
  const tips = avoidTips(data, money);

  return (
    <div className="flex flex-col gap-4">
      <section aria-label="Resumen" className={cn('rounded-2xl p-4', tone.box)}>
        <p className={cn('flex items-start gap-2 text-lg font-semibold leading-snug', tone.text)}>
          <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
          <span className="min-w-0">{title}</span>
        </p>
        {detail && <p className="mt-1 text-sm text-ink/70">{detail}</p>}
      </section>

      <div className="grid grid-cols-2 gap-3">
        <Panel className="p-4 md:p-4">
          <p className="text-xs text-ink/60">Tienes hoy</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{money(data.money)}</p>
        </Panel>
        <Panel className="p-4 md:p-4">
          <p className="text-xs text-ink/60">Gastas al día</p>
          <p className="mt-1 text-xl font-bold tabular-nums">{data.pace === null ? '—' : money(data.pace)}</p>
        </Panel>
      </div>

      <Panel className="p-4 md:p-5">
        <h2 className="text-sm font-semibold">Día por día, hasta el {shortDay(data.until)}</h2>
        <div className="mt-3 h-64 text-ink" aria-hidden="true">
          <Suspense fallback={<div className="h-full animate-pulse rounded-2xl bg-ink/6" />}>
            <LiquidityChart points={chartPoints(data.days, shortfall?.date ?? null)} hidden={hidden} />
          </Suspense>
        </div>
        <p className="sr-only">
          {shortfall
            ? `El ${shortDay(shortfall.date)} la plata queda en negativo.`
            : `La plata no baja de cero hasta el ${shortDay(data.until)}.`}
        </p>
      </Panel>

      {shortfall && (
        <Panel className="p-4 md:p-5">
          <h2 className="text-sm font-semibold">Por qué pasa</h2>
          <ul className="mt-3 flex flex-col gap-2">
            {shortfall.causes.map((c) => (
              <li key={`${c.kind}-${c.id ?? c.name}-${c.date}`} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{c.name}</p>
                  <p className="text-xs text-ink/60">
                    {KIND_TEXT[c.kind] ?? 'Pago'} · {shortDay(c.date < data.today ? data.today : c.date)}
                  </p>
                </div>
                <span className="font-semibold tabular-nums">-{money(c.amount)}</span>
              </li>
            ))}
          </ul>
          {data.pace !== null && (
            <p className="mt-3 text-xs text-ink/60">Y tu gasto normal de unos {money(data.pace)} al día.</p>
          )}
        </Panel>
      )}

      {tips.length > 0 && (
        <Panel className="p-4 md:p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Lightbulb className="size-4 text-caution" aria-hidden="true" />
            Cómo evitarlo
          </h2>
          <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-sm">
            {tips.map((tip) => (
              <li key={tip}>{tip}</li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-ink/50">Son sugerencias: FinTrack no mueve ni cambia tus pagos.</p>
        </Panel>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/app/calendario" className="text-sm font-medium text-violet-light underline-offset-4 hover:underline">
          Ver el calendario de pagos
        </Link>
        <Link to="/app/mi-plata" className="text-sm font-medium text-violet-light underline-offset-4 hover:underline">
          Editar mis pagos
        </Link>
      </div>

      {data.assumptions?.length > 0 && (
        <ul className="flex flex-col gap-1 text-xs text-ink/50">
          {data.assumptions.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
