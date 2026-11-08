import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatMoney } from '@/components/transactions/format';

/** Montos cortos para el eje Y: `$ 850 mil`, `$ 1,2 M`. */
const compact = new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 });
const formatAxis = (value) => (value === 0 ? '0' : `${value < 0 ? '-' : ''}$ ${compact.format(Math.abs(value))}`);

/** Cuadro al tocar un día: cuánto queda y qué se paga ese día. */
function DayTooltip({ active, payload, hidden }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  return (
    <div className="max-w-56 rounded-xl border border-ink/10 bg-surface px-3 py-2 text-sm shadow-lg">
      <p className="font-medium">{point.label}</p>
      <p className={point.end < 0 ? 'text-negative' : 'text-ink/70'}>
        {point.end < 0 ? 'Te faltan ' : 'Te quedan '}
        <span className="tabular-nums">{hidden ? '$ •••' : formatMoney(Math.abs(point.end))}</span>
      </p>
      {point.payments.map((p) => (
        <p key={p.name} className="truncate text-xs text-ink/60">
          {p.name}: -{hidden ? '$ •••' : formatMoney(p.amount)}
        </p>
      ))}
    </div>
  );
}

/** Punto en los días con pagos; rojo y más grande el día del hueco. */
function PaymentDot({ cx, cy, payload }) {
  if (!payload.payments.length && !payload.shortfall) return null;
  return payload.shortfall ? (
    <circle cx={cx} cy={cy} r={6} fill="var(--color-negative)" stroke="var(--color-surface)" strokeWidth={2} />
  ) : (
    <circle cx={cx} cy={cy} r={4} fill="var(--color-brand)" stroke="var(--color-surface)" strokeWidth={2} />
  );
}

/**
 * Plata día por día (FT-0059): línea del saldo, la del 0 marcada, un punto en cada pago y el día
 * del hueco en rojo. En su propio archivo para cargar Recharts aparte.
 * @param {{ points: ReturnType<typeof import('@/lib/liquidity').chartPoints>, hidden?: boolean }} props
 */
export default function LiquidityChart({ points, hidden = false }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={points} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.08} />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tick={{ fill: 'currentColor', fillOpacity: 0.55, fontSize: 12 }}
          interval="preserveStartEnd"
          minTickGap={24}
        />
        <YAxis
          tickFormatter={hidden ? () => '' : formatAxis}
          tickLine={false}
          axisLine={false}
          width={hidden ? 8 : 64}
          tick={{ fill: 'currentColor', fillOpacity: 0.55, fontSize: 12 }}
        />
        <Tooltip content={<DayTooltip hidden={hidden} />} cursor={{ stroke: 'currentColor', strokeOpacity: 0.15 }} />
        <ReferenceLine y={0} stroke="var(--color-negative)" strokeDasharray="4 4" ifOverflow="extendDomain" />
        <Area
          type="linear"
          dataKey="end"
          stroke="none"
          fill="var(--color-brand)"
          fillOpacity={0.1}
          isAnimationActive={false}
        />
        <Line
          type="linear"
          dataKey="end"
          stroke="var(--color-brand)"
          strokeWidth={2.5}
          dot={<PaymentDot />}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
