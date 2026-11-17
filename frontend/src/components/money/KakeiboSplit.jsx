import { KAKEIBO } from '@/components/transactions/reflection';
import { formatMoney } from '@/components/transactions/format';
import useAsync from '@/hooks/useAsync';
import { listTransactions } from '@/services/transactionService';

/** Colores de cada grupo: los de categorías de los gráficos (validados para daltonismo). */
const COLOR = {
  necesidad: 'var(--app-chart-cat-1)',
  deseo: 'var(--app-chart-cat-2)',
  cultura: 'var(--app-chart-cat-3)',
  imprevisto: 'var(--app-chart-cat-4)',
};
const MASK = '$ ••••••';

/**
 * Reparte los gastos entre los 4 grupos Kakeibo. Lo que no tiene grupo no cuenta en los porcentajes.
 * @param {Array<{ amount: number, kakeibo?: string|null }>} expenses
 * @returns {{ groups: Array<{ key: string, label: string, total: number, share: number }>, grouped: number, ungrouped: number }}
 */
export function splitByKakeibo(expenses) {
  const sums = Object.fromEntries(KAKEIBO.map((g) => [g.key, 0]));
  let ungrouped = 0;
  for (const t of expenses) {
    if (t.kakeibo && t.kakeibo in sums) sums[t.kakeibo] += t.amount;
    else ungrouped += 1;
  }
  const grouped = Object.values(sums).reduce((a, b) => a + b, 0);
  return {
    groups: KAKEIBO.map((g) => ({ key: g.key, label: g.label, total: sums[g.key], share: grouped ? (sums[g.key] / grouped) * 100 : 0 })),
    grouped,
    ungrouped,
  };
}

/**
 * "¿Podías evitarlo? · Kakeibo" en Gastos (Rinde v2): la barra de los 4 grupos del periodo, con sus
 * porcentajes en texto, y una idea concreta sobre los deseos. Se calcula en el dispositivo con los gastos
 * del periodo; si ninguno tiene grupo todavía, invita a ponerlo desde el detalle de cada gasto.
 * @param {{ from: string, to: string, hidden?: boolean }} props
 */
export default function KakeiboSplit({ from, to, hidden = false }) {
  const list = useAsync(() => listTransactions({ type: 'gasto', from, to, pageSize: 200 }), [from, to]);
  const money = (value) => (hidden ? MASK : formatMoney(value));
  if (list.error || !list.data) return null;
  const { groups, grouped, ungrouped } = splitByKakeibo(list.data.data ?? []);
  const wish = groups.find((g) => g.key === 'deseo');

  return (
    <section aria-labelledby="kakeibo-periodo" className="flex flex-col gap-3 rounded-2xl border border-ink/10 bg-surface p-4">
      <h2 id="kakeibo-periodo" className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/60">
        ¿Podías evitarlo? · Kakeibo
      </h2>
      {grouped === 0 ? (
        <p className="text-sm text-ink/70">
          Aún no tienes gastos con grupo Kakeibo. Ábrelos y elige si fueron necesidad, deseo, cultura o un imprevisto.
        </p>
      ) : (
        <>
          <div
            role="img"
            aria-label={groups.map((g) => `${g.label} ${Math.round(g.share)} %`).join(', ')}
            className="flex h-3.5 gap-0.5 overflow-hidden rounded-full"
          >
            {groups
              .filter((g) => g.total > 0)
              .map((g) => (
                <span key={g.key} className="h-full" style={{ width: `${g.share}%`, background: COLOR[g.key] }} />
              ))}
          </div>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-[13px]">
            {groups.map((g) => (
              <li key={g.key} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 shrink-0 rounded-[3px]" style={{ background: COLOR[g.key] }} />
                <b className="font-semibold">{g.label}</b> {Math.round(g.share)} %
              </li>
            ))}
          </ul>
          <p className="text-[13px] text-ink/60">
            {wish.total > 0
              ? `En deseos llevas ${money(wish.total)}. Bajarlos un 10 % te deja ${money(Math.round(wish.total * 0.1))} más.`
              : 'Este periodo no tienes gastos marcados como deseo.'}
            {ungrouped > 0 && ` ${ungrouped === 1 ? '1 gasto no tiene' : `${ungrouped} gastos no tienen`} grupo.`}
          </p>
        </>
      )}
    </section>
  );
}
