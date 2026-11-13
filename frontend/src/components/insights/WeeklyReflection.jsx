import { Link } from 'react-router-dom';
import { HelpCircle, Loader2 } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { EMOTIONS, KAKEIBO, emotionOf } from '@/components/transactions/reflection';
import { formatMoney } from '@/components/transactions/format';
import useAsync from '@/hooks/useAsync';
import { cn } from '@/lib/utils';
import { getReflection } from '@/services/transactionService';

/** Color de cada grupo en la barra: los de categorías de los gráficos (validados para daltonismo). */
const GROUP_COLOR = {
  necesidad: 'var(--app-chart-cat-1)',
  deseo: 'var(--app-chart-cat-2)',
  cultura: 'var(--app-chart-cat-3)',
  imprevisto: 'var(--app-chart-cat-4)',
  sin_grupo: 'var(--app-chart-other)',
};

/**
 * "Del 9 al 15 de noviembre" (o "Del 30 de noviembre al 6 de diciembre" si cambia el mes).
 * @param {string} from AAAA-MM-DD
 * @param {string} to AAAA-MM-DD
 */
export function weekRange(from, to) {
  const day = (iso, withMonth) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString(
      'es-CO',
      withMonth ? { day: 'numeric', month: 'long' } : { day: 'numeric' },
    );
  const sameMonth = from.slice(0, 7) === to.slice(0, 7);
  return `Del ${day(from, !sameMonth)} al ${day(to, true)}`;
}

/**
 * Los segmentos de la barra Kakeibo, con su parte del total (0 a 100). Incluye "Sin grupo" si hay.
 * @param {import('@/services/transactionService').WeekReflection} data
 */
export function kakeiboSegments(data) {
  const total = data.expenses.total;
  const rows = [
    ...KAKEIBO.map((g) => ({
      key: g.key,
      label: g.label,
      ...(data.kakeibo.find((k) => k.key === g.key) ?? { count: 0, total: 0 }),
    })),
    { key: 'sin_grupo', label: 'Sin grupo', ...data.withoutKakeibo },
  ];
  return rows.map((r) => ({
    ...r,
    share: total > 0 ? (r.total / total) * 100 : 0,
  }));
}

/**
 * Reflexión de la semana en Consejos (FT-0070): en qué grupos Kakeibo se fue la plata, cómo se
 * sintió la persona con sus gastos, los que no la convencieron y hasta 3 preguntas para pensar.
 * Necesita conexión; sin gastos en la semana invita a anotar.
 * @param {{ className?: string }} props
 */
export default function WeeklyReflection({ className }) {
  const reflection = useAsync(() => getReflection(), []);
  const data = reflection.data;

  return (
    <Panel aria-labelledby="reflexion-title" className={cn('flex flex-col gap-5', className)}>
      <div>
        <h2 id="reflexion-title" className="text-lg font-semibold tracking-tight">
          Tu semana en Kakeibo
        </h2>
        <p className="text-[13px] text-ink/60">
          {data ? weekRange(data.from, data.to) : 'De lunes a domingo'} · cómo gastaste y cómo te sentiste
        </p>
      </div>

      {!data ? (
        reflection.error ? (
          <p role="alert" className="text-sm text-negative">
            {reflection.error}{' '}
            <button type="button" className="underline" onClick={reflection.reload}>
              Reintentar
            </button>
          </p>
        ) : (
          <p className="flex items-center gap-2 text-ink/60" aria-busy="true">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Cargando tu semana…
          </p>
        )
      ) : data.expenses.count === 0 ? (
        <p className="text-[15px] text-ink/70">
          Aún no tienes gastos esta semana. Cuando anotes uno, elige cómo te sentiste y aquí verás tu reflexión.
        </p>
      ) : (
        <>
          <KakeiboBar data={data} />
          <Feelings data={data} />
          {data.regrets.length > 0 && <Regrets regrets={data.regrets} />}
          {data.questions.length > 0 && (
            <div>
              <h3 className="text-[15px] font-semibold">Para pensar</h3>
              <ul className="mt-2 flex flex-col gap-2">
                {data.questions.map((q) => (
                  <li key={q} className="flex gap-2.5 rounded-xl bg-brand-soft px-3 py-2.5 text-[15px] leading-snug">
                    <HelpCircle className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden="true" />
                    {q}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </Panel>
  );
}

/** Barra apilada de los grupos Kakeibo, con la lista de montos al lado (no depende del color). */
function KakeiboBar({ data }) {
  const segments = kakeiboSegments(data);
  const visible = segments.filter((s) => s.total > 0);
  return (
    <div>
      <div
        role="img"
        aria-label={`Gastos de la semana por grupo: ${visible.map((s) => `${s.label} ${Math.round(s.share)} %`).join(', ')}`}
        className="flex h-3 gap-0.5 overflow-hidden rounded-full"
      >
        {visible.map((s) => (
          <span
            key={s.key}
            className="h-full first:rounded-l-full last:rounded-r-full"
            style={{ width: `${s.share}%`, background: GROUP_COLOR[s.key] }}
          />
        ))}
      </div>
      <ul className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
        {segments
          .filter((s) => s.key !== 'sin_grupo' || s.count > 0)
          .map((s) => (
            <li key={s.key} className={cn('flex items-center gap-2 text-[15px]', s.total === 0 && 'text-ink/50')}>
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: GROUP_COLOR[s.key] }}
                aria-hidden="true"
              />
              <span className="flex-1">{s.label}</span>
              <span className="font-medium tabular-nums">{formatMoney(s.total)}</span>
              <span className="w-10 text-right text-[13px] text-ink/60 tabular-nums">{Math.round(s.share)} %</span>
            </li>
          ))}
      </ul>
    </div>
  );
}

/** Cuántos gastos hubo con cada emoción, y qué parte de la semana tiene emoción. */
function Feelings({ data }) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold">Cómo te sentiste</h3>
      <ul className="mt-2 grid grid-cols-4 gap-2">
        {EMOTIONS.map(({ key, label, icon: Icon }) => {
          const count = data.emotions.find((e) => e.key === key)?.count ?? 0;
          return (
            <li
              key={key}
              className={cn(
                'flex flex-col items-center gap-1 rounded-2xl bg-ink/5 px-1 py-2.5 text-center',
                count === 0 && 'text-ink/45',
              )}
            >
              <Icon className="size-6" strokeWidth={1.75} aria-hidden="true" />
              <span className="text-lg font-semibold tabular-nums leading-none">{count}</span>
              <span className="text-[11px] leading-tight">{label}</span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[13px] text-ink/60">
        {data.withEmotion} de {data.expenses.count} {data.expenses.count === 1 ? 'gasto tiene' : 'gastos tienen'}{' '}
        emoción.
        {data.withEmotion < data.expenses.count && ' Puedes ponerla desde el detalle de cada gasto.'}
      </p>
    </div>
  );
}

/** Hasta 3 gastos que no la convencieron, del más grande; cada uno abre su detalle. */
function Regrets({ regrets }) {
  return (
    <div>
      <h3 className="text-[15px] font-semibold">Lo que no te convenció</h3>
      <ul className="mt-2 divide-y divide-ink/10 rounded-xl border border-ink/10">
        {regrets.map((r) => {
          const emotion = emotionOf(r.emotion);
          const Icon = emotion?.icon;
          return (
            <li key={r.id}>
              <Link
                to={`/app/transacciones/${r.id}`}
                className="flex min-h-14 items-center gap-3 px-3 py-2 focus-visible:outline-2 focus-visible:outline-violet"
              >
                {Icon && <Icon className="size-5 shrink-0 text-ink/60" aria-hidden="true" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-medium">{r.description}</span>
                  <span className="block text-[13px] text-ink/60">{emotion?.label}</span>
                </span>
                <span className="font-medium tabular-nums">−{formatMoney(r.amount)}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
