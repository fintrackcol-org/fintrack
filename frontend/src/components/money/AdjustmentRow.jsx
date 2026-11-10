import { Scale } from 'lucide-react';
import { formatMoney } from '@/components/transactions/format';

/**
 * Corrección de saldo dentro del historial (FT-0062). No es ingreso ni gasto, por eso va en gris:
 * el signo dice si la plata subió o bajó. Toca para ver el saldo de antes y el de después.
 * @param {{ adjustment: import('@/services/moneyProfileService').BalanceAdjustment, hidden?: boolean, onOpen: (adjustment: object) => void }} props
 */
export default function AdjustmentRow({ adjustment, hidden = false, onOpen }) {
  const diff = adjustment.after - adjustment.before;
  return (
    <li>
      <button
        type="button"
        aria-haspopup="dialog"
        onClick={() => onOpen(adjustment)}
        className="-mx-2 flex min-h-14 w-[calc(100%+1rem)] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-ink/5 active:bg-ink/5 focus-visible:outline-2 focus-visible:outline-violet"
      >
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-ink/5 text-ink/60">
          <Scale className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-medium">Ajuste de saldo</span>
          <span className="block truncate text-sm text-ink/60">Ajuste · {diff >= 0 ? 'no es un ingreso' : 'no es un gasto'}</span>
        </span>
        <span className="shrink-0 font-semibold tabular-nums text-ink/60">
          <span className="sr-only">{diff >= 0 ? 'El saldo subió ' : 'El saldo bajó '}</span>
          {hidden ? '••••' : `${diff >= 0 ? '+' : '−'}${formatMoney(Math.abs(diff))}`}
        </span>
      </button>
    </li>
  );
}
