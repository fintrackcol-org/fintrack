import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { formatMoney } from '@/components/transactions/format';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { hasData } from '@/lib/liquidity';
import { cn } from '@/lib/utils';
import { getLiquidity } from '@/services/moneyProfileService';
import { t } from '@/lib/i18n';
import { dateLocale } from '@/lib/region';

const dayMonth = new Intl.DateTimeFormat(dateLocale(), { day: 'numeric', month: 'long', timeZone: 'UTC' });

/**
 * "20 de noviembre" a partir de AAAA-MM-DD, sin corrimientos por zona horaria.
 * @param {string} iso
 * @returns {string}
 */
export function longDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return dayMonth.format(new Date(Date.UTC(y, m - 1, d)));
}

const TONES = {
  ok: { icon: CircleCheck, box: 'bg-positive/10', text: 'text-positive' },
  riesgo: { icon: TriangleAlert, box: 'bg-caution/10', text: 'text-caution' },
  falta: { icon: CircleAlert, box: 'bg-negative/10', text: 'text-negative' },
};

/**
 * La frase de la tarjeta según el resultado del motor.
 * @param {object} liquidity Respuesta de `GET /liquidity` (con `ready: true`).
 * @param {(amount: number) => string} money Formatea montos (o los oculta).
 * @returns {{ title: string, detail: string|null }}
 */
export function liquidityMessage(liquidity, money) {
  const { risk, firstShortfall, lowest, until, safeDailySpend, pace } = liquidity;
  if (risk === 'falta') {
    // Con $0 al día tampoco llega: decir "gasta máximo $0 y llegas" sería mentirle.
    const reach = safeDailySpend > 0 && pace !== null && safeDailySpend < pace
      ? t('Si gastas máximo {safeDailySpend} al día, llegas.', { safeDailySpend: money(safeDailySpend) })
      : null;
    return { title: t('El {date} te faltan {missing}', { date: longDay(firstShortfall.date), missing: money(firstShortfall.missing) }), detail: reach };
  }
  if (risk === 'riesgo') {
    return { title: t('Justo: el {date} te quedan {amount}', { date: longDay(lowest.date), amount: money(lowest.amount) }), detail: t('Cuida el gasto de estos días.') };
  }
  return { title: t('Vas bien hasta el {until}', { until: longDay(until) }), detail: t('Con lo que tienes y lo que debes pagar, te alcanza.') };
}

/**
 * Tarjeta del Inicio "Tu plata en los próximos días" (FT-0059): una sola frase en verde, amarillo
 * o rojo según el motor de liquidez, y un enlace al detalle (`/app/liquidez`). Solo con conexión y
 * con Mi plata configurada (si no, el Inicio ya muestra cómo configurarla). Sin pagos ni gasto
 * normal, invita a agregar los pagos del mes.
 * @param {{ hidden?: boolean, className?: string }} props `hidden`: montos ocultos.
 */
export default function LiquidityCard({ hidden = false, className }) {
  const online = useOnlineStatus();
  const [liquidity, setLiquidity] = useState(null);

  useEffect(() => {
    if (!online) return undefined;
    let cancelled = false;
    getLiquidity()
      .then((data) => !cancelled && setLiquidity(data))
      .catch(() => !cancelled && setLiquidity(null));
    return () => {
      cancelled = true;
    };
  }, [online]);

  if (!online || !liquidity?.ready) return null;

  if (!hasData(liquidity)) {
    return (
      <section aria-label={t('Tu plata en los próximos días')} className={cn('rounded-2xl bg-ink/5 p-4', className)}>
        <p className="text-[13px] font-medium text-ink/70">{t('Tu plata en los próximos días')}</p>
        <p className="mt-1 font-semibold leading-snug">{t('Agrega tus pagos del mes para ver si te alcanza.')}</p>
        <Link
          to="/app/mi-plata"
          className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline"
        >
          {t('Ir a Mi plata')} <ChevronRight className="size-4" aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const money = (amount) => (hidden ? '$ •••' : formatMoney(Math.round(amount)));
  const tone = TONES[liquidity.risk] ?? TONES.ok;
  const Icon = tone.icon;
  const { title, detail } = liquidityMessage(liquidity, money);

  return (
    <section aria-label={t('Tu plata en los próximos días')} className={cn('rounded-2xl p-4', tone.box, className)}>
      <p className="text-[13px] font-medium text-ink/70">{t('Tu plata en los próximos días')}</p>
      <p className={cn('mt-1 flex items-start gap-2 text-lg font-semibold leading-snug', tone.text)}>
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0">{title}</span>
      </p>
      {detail && <p className="mt-1 text-sm text-ink/70">{detail}</p>}
      <Link
        to="/app/liquidez"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline"
      >
        {t('Ver qué pasa')} <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
