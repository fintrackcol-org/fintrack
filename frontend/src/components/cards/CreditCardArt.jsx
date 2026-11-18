import { CARD_STYLES, cardLabel } from '@/lib/cardStyles';
import { t } from '@/lib/i18n';

const SIZES = { sm: 'w-48 p-3 text-[10px]', lg: 'w-full max-w-sm p-5 text-xs' };

/**
 * Tarjeta de crédito dibujada (sin logos reales). Solo muestra los últimos 4 dígitos.
 * Entrada con opacity + scale y press scale; ambas solo si el usuario no pidió menos movimiento.
 * `expiry` ("03/27") se muestra abajo a la derecha, como en el plástico (FT-0065).
 * @param {{ network: string, tier: string, last4: string, name?: string, expiry?: string, size?: 'sm'|'lg' }} props
 */
export default function CreditCardArt({ network, tier, last4, name, expiry, size = 'lg' }) {
  const style = CARD_STYLES[network]?.[tier] ?? CARD_STYLES.otra.clasica;
  return (
    <div
      role="img"
      aria-label={t('{network} terminada en {last4}{v3}', { network: cardLabel(network, tier), last4, v3: expiry ? `, vence ${expiry}` : '' })}
      style={{ background: style.background, color: style.foreground, aspectRatio: '1.586 / 1' }}
      className={`${SIZES[size] ?? SIZES.lg} flex flex-col justify-between rounded-2xl shadow-md motion-safe:animate-[card-in_250ms_cubic-bezier(0.23,1,0.32,1)] motion-safe:transition-transform motion-safe:active:scale-[0.98]`}
    >
      <div className="flex items-start justify-between gap-2 font-semibold">
        <span className="truncate">{name}</span>
        <span>{cardLabel(network, tier)}</span>
      </div>
      <svg aria-hidden="true" viewBox="0 0 40 30" className="h-7 w-9">
        <rect x="1" y="1" width="38" height="28" rx="5" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d={'M1 10h38M1 20h38M15 1v28M25 1v28'} stroke="currentColor" strokeWidth="1.5" opacity="0.6" />
      </svg>
      <div className="flex items-end justify-between gap-2">
        <span className="font-mono text-base tracking-widest" aria-hidden="true">
          •••• {last4}
        </span>
        {expiry && (
          <span className="text-right font-mono leading-tight">
            <span className="block text-[0.7em] uppercase opacity-80">{t('Vence')}</span>
            {expiry}
          </span>
        )}
      </div>
    </div>
  );
}
