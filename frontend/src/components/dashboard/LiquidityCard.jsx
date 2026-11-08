import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, CircleAlert, CircleCheck, TriangleAlert } from 'lucide-react';
import { formatMoney } from '@/components/transactions/format';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { getLiquidity } from '@/services/moneyProfileService';

const dayMonth = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'long', timeZone: 'UTC' });

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
    const reach = pace !== null && safeDailySpend < pace
      ? `Si gastas máximo ${money(safeDailySpend)} al día, llegas.`
      : null;
    return { title: `El ${longDay(firstShortfall.date)} te faltan ${money(firstShortfall.missing)}`, detail: reach };
  }
  if (risk === 'riesgo') {
    return { title: `Justo: el ${longDay(lowest.date)} te quedan ${money(lowest.amount)}`, detail: 'Cuida el gasto de estos días.' };
  }
  return { title: `Vas bien hasta el ${longDay(until)}`, detail: 'Con lo que tienes y lo que debes pagar, te alcanza.' };
}

/**
 * Tarjeta del Inicio "Tu plata en los próximos días" (FT-0059): una sola frase en verde, amarillo
 * o rojo según el motor de liquidez, y un enlace al calendario de pagos. Solo con conexión y con
 * Mi plata configurada (si no, el Inicio ya muestra cómo configurarla).
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

  const money = (amount) => (hidden ? '$ •••' : formatMoney(Math.round(amount)));
  const tone = TONES[liquidity.risk] ?? TONES.ok;
  const Icon = tone.icon;
  const { title, detail } = liquidityMessage(liquidity, money);

  return (
    <section aria-label="Tu plata en los próximos días" className={cn('rounded-2xl p-4', tone.box, className)}>
      <p className="text-[13px] font-medium text-ink/70">Tu plata en los próximos días</p>
      <p className={cn('mt-1 flex items-start gap-2 text-lg font-semibold leading-snug', tone.text)}>
        <Icon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
        <span className="min-w-0">{title}</span>
      </p>
      {detail && <p className="mt-1 text-sm text-ink/70">{detail}</p>}
      <Link
        to="/app/calendario"
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-brand underline-offset-4 hover:underline"
      >
        Ver qué pasa <ChevronRight className="size-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
