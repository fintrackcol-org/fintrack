import { TriangleAlert } from 'lucide-react';
import { formatMoney } from '@/components/transactions/format';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

/**
 * Desde este monto se pide confirmar antes de guardar. Para un universitario es raro, y un cero de
 * más ("50 mil" que queda en 50 millones) deja el saldo en negativo por meses.
 */
export const BIG_AMOUNT = 5_000_000;

/**
 * ¿Hay que confirmar este monto? Al editar, solo si cambió: no se vuelve a preguntar por uno ya guardado.
 * @param {number} amount
 * @param {number} [before] Monto guardado antes, al editar.
 * @returns {boolean}
 */
export function isBigAmount(amount, before) {
  return Number(amount) >= BIG_AMOUNT && Number(amount) !== Number(before);
}

/**
 * Se muestra tras el primer toque en Guardar con un monto grande; el segundo toque guarda.
 * @param {{ amount: number, className?: string }} props
 */
export default function BigAmountWarning({ amount, className }) {
  return (
    <div role="alert" className={cn('flex items-start gap-3 rounded-lg border border-caution/40 bg-caution/10 p-3 text-left text-sm', className)}>
      <TriangleAlert className="mt-0.5 size-5 shrink-0 text-caution" aria-hidden="true" />
      <p>
        <strong className="font-semibold">{t('¿Seguro que son')} {formatMoney(amount)}?</strong> {t('Es un monto muy alto: revisa que no sobre un cero. Si está bien, toca de nuevo para guardar.')}
      </p>
    </div>
  );
}
