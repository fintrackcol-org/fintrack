import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CircleDollarSign, Loader2, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import BankSyncForm from '@/components/cards/BankSyncForm';
import CardForm from '@/components/cards/CardForm';
import CreditCardArt from '@/components/cards/CreditCardArt';
import PayCardForm from '@/components/cards/PayCardForm';
import { dueText, paymentText, shortDate } from '@/components/cards/cardFormat';
import ExpiryBadge from '@/components/cards/ExpiryBadge';
import { NETWORK_LABELS } from '@/lib/cardStyles';
import useMediaQuery from '@/hooks/useMediaQuery';
import CircleActions from '@/components/common/CircleActions';
import ConfirmButton from '@/components/common/ConfirmButton';
import Sheet from '@/components/common/Sheet';
import { MASK } from '@/components/dashboard/BalanceCard';
import Panel from '@/components/layout/Panel';
import { formatDate, formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { deleteCard, deleteCardPayment, getCard, getCardMovements, payCard, syncCardWithBank, updateCard } from '@/services/cardService';
import { t } from '@/lib/i18n';

const INTEREST_NOTE = t('Los intereses los calcula tu banco a la fecha de corte.');

/** Una fila del historial: compra, pago (que se puede eliminar) o ajuste con el banco. */
function MovementRow({ m, money, online, onDeletePayment }) {
  const isAdjustment = m.kind === 'adjustment';
  const title =
    m.kind === 'purchase'
      ? m.description
      : m.kind === 'payment'
        ? t('Pago')
        : t('Ajuste con el banco {v1}{money}', { v1: m.amount < 0 ? '−' : '+', money: money(Math.abs(m.amount)) });
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="break-words font-medium">{title}</p>
        <p className="text-sm text-ink/60">
          {formatDate(m.date)}
          {m.installments > 1 && (
            <>
              {' · '}{t('a')} {m.installments} {t('cuotas')}
              <span title={INTEREST_NOTE} aria-hidden="true">*</span>
            </>
          )}
        </p>
        {m.installments > 1 && <p className="text-xs text-ink/60">* {INTEREST_NOTE}</p>}
      </div>
      {!isAdjustment && (
        <div className="flex shrink-0 flex-col items-end">
          <p className={`tabular-nums ${m.kind === 'payment' ? 'text-positive' : ''}`}>
            {m.kind === 'payment' ? '−' : ''}
            {money(m.amount)}
          </p>
          {m.kind === 'payment' && (
            <ConfirmButton
              label={t('Eliminar pago')}
              question={t('¿Eliminar este pago? Lo usado vuelve a subir.')}
              confirmLabel={t('Sí, eliminar')}
              icon={Trash2}
              disabled={!online}
              onConfirm={() => onDeletePayment(m.id)}
            />
          )}
        </div>
      )}
    </li>
  );
}

/**
 * Contenido del detalle, sin red ni hojas (se puede probar con `renderToStaticMarkup`).
 * @param {{ card: object, movements: object[], online: boolean, hidden: boolean, onAction: (a: 'pay'|'sync'|'edit') => void, onDelete: () => Promise<void>, onDeletePayment: (paymentId: string) => Promise<void>, actions?: import('react').ReactNode }} props
 *   `actions`: los círculos del celular; con ellos, la vista es la compacta del diseño.
 */
export function CardDetailView({ card, movements, online, hidden, onAction, onDelete, onDeletePayment, actions }) {
  const money = (n) => (hidden ? MASK : formatMoney(n));
  const pct = card.limit > 0 ? Math.min(100, Math.round((card.used / card.limit) * 100)) : 0;
  if (actions) {
    return (
      <>
        <p className="text-[15px] text-ink/70">{NETWORK_LABELS[card.network] ?? card.name} ••{card.last4} {t('· Lo que debes')}</p>
        <p className="mt-1 text-[42px] font-semibold leading-tight tracking-tight tabular-nums">{money(card.used)}</p>
        <p className="mt-2 text-[15px] font-medium text-caution">{dueText(card)}</p>
        <ExpiryBadge card={card} />
        {card.statementTotal != null && (
          <p className="mt-1 text-sm tabular-nums text-ink/70">
            {t('Total del extracto')} {money(card.statementTotal)}
            {card.statementDueDate && t(' · vence el {statementDueDate}', { statementDueDate: shortDate(card.statementDueDate) })}
          </p>
        )}
        <div role="progressbar" aria-label={t('Uso de {name}', { name: card.name })} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="mt-4 h-2 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm tabular-nums text-ink/70">
          {t('Disponible')} {money(card.available)} {t('de')} {money(card.limit)}
        </p>
        {!online && <p className="mt-2 text-sm text-ink/60">{t('Necesitas conexión')}</p>}
        <div className="mt-5">{actions}</div>
        <h2 className="mb-1 mt-6 text-lg font-semibold tracking-tight">{t('Compras y pagos')}</h2>
        {movements.length === 0 ? (
          <p className="text-ink/60">{t('Aún no hay movimientos.')}</p>
        ) : (
          <ul aria-label={t('Historial de la tarjeta')} className="divide-y divide-ink/10 rounded-2xl border border-ink/10 bg-surface px-3.5">
            {movements.map((m) => (
              <MovementRow key={`${m.kind}-${m.id}`} m={m} money={money} online={online} onDeletePayment={onDeletePayment} />
            ))}
          </ul>
        )}
        <div className="mt-6">
          <ConfirmButton
            label={t('Eliminar tarjeta')}
            question={t('¿Eliminar esta tarjeta? Las compras se quedan en tu historial.')}
            confirmLabel={t('Sí, eliminar')}
            icon={Trash2}
            disabled={!online}
            onConfirm={onDelete}
          />
        </div>
      </>
    );
  }

  return (
    <>
      <div className="flex justify-center">
        <CreditCardArt network={card.network} tier={card.tier} last4={card.last4} name={card.name} expiry={card.expiry?.label} size="lg" />
      </div>
      <Panel className="mt-4">
        <div role="progressbar" aria-label={t('Uso de {name}', { name: card.name })} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} className="h-2 overflow-hidden rounded-full bg-ink/10">
          <div className="h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 tabular-nums text-ink/70">
          {t('Usado')} {money(card.used)} {t('· Disponible')} {money(card.available)} {t('· Cupo')} {money(card.limit)}
        </p>
        <p className="mt-1 font-medium">{paymentText(card)}</p>
        <ExpiryBadge card={card} />
        {card.statementTotal != null && (
          <p className="mt-1 text-sm tabular-nums text-ink/70">
            {t('Total del extracto')} {money(card.statementTotal)}
            {card.statementDueDate && t(' · vence el {statementDueDate}', { statementDueDate: shortDate(card.statementDueDate) })}
          </p>
        )}
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Button size="lg" disabled={!online} onClick={() => onAction('pay')} className="max-md:hidden">
            {t('Ya pagué')}
          </Button>
          <Button size="lg" variant="outline" disabled={!online} onClick={() => onAction('sync')} className="max-md:hidden">
            {t('Actualizar con el banco')}
          </Button>
          <Button variant="ghost" className="min-h-11 justify-start max-md:hidden" disabled={!online} onClick={() => onAction('edit')}>
            <Pencil aria-hidden="true" /> {t('Editar')}
          </Button>
          <ConfirmButton
            label={t('Eliminar')}
            question={t('¿Eliminar esta tarjeta? Las compras se quedan en tu historial.')}
            confirmLabel={t('Sí, eliminar')}
            icon={Trash2}
            disabled={!online}
            onConfirm={onDelete}
          />
        </div>
        {!online && <p className="mt-2 text-sm text-ink/60">{t('Necesitas conexión')}</p>}
      </Panel>
      <h2 className="mb-1 mt-6 text-lg font-semibold">{t('Historial')}</h2>
      {movements.length === 0 ? (
        <p className="text-ink/60">{t('Aún no hay movimientos.')}</p>
      ) : (
        <ul aria-label={t('Historial de la tarjeta')} className="divide-y divide-ink/10">
          {movements.map((m) => (
            <MovementRow key={`${m.kind}-${m.id}`} m={m} money={money} online={online} onDeletePayment={onDeletePayment} />
          ))}
        </ul>
      )}
    </>
  );
}

/** Página privada `/app/tarjetas/:id`: uso, pagos, ajuste con el banco e historial. */
export default function CardDetail() {
  const mobile = useMediaQuery('(width < 48rem)');
  const { id } = useParams();
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const [hidden] = useHiddenAmounts();
  const [card, setCard] = useState(null);
  const [movements, setMovements] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [sheet, setSheet] = useState(null); // 'pay' | 'sync' | 'edit'
  usePageTitle(card?.name ?? t('Tarjeta'));

  const load = useCallback(async () => {
    try {
      const [c, m] = await Promise.all([getCard(id), getCardMovements(id)]);
      setCard(c);
      setMovements(m);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  const close = () => setSheet(null);
  /** Corre la acción, cierra la hoja y recarga el historial. */
  const apply = async (action, message) => {
    const result = await action();
    close();
    setNotice(typeof message === 'function' ? message(result) : message);
    await load();
  };

  if (!card) {
    return error ? (
      <p role="alert" className="text-negative">
        {error}{' '}
        <button type="button" className="underline" onClick={load}>{t('Reintentar')}</button>
      </p>
    ) : (
      <p className="flex items-center gap-2 py-10 text-ink/60"><Loader2 className="animate-spin" aria-hidden="true" /> {t('Cargando…')}</p>
    );
  }

  return (
    <>
      {/* En el celular ya está el botón de volver arriba. */}
      <Link to="/app/tarjetas" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm text-ink/70 max-md:hidden">
        <ArrowLeft className="size-4" aria-hidden="true" /> {t('Tarjetas')}
      </Link>
      {notice && <p role="status" className="mb-3 rounded-xl bg-positive/10 p-3 text-sm">{notice}</p>}
      {error && <p role="alert" className="mb-3 text-sm text-negative">{error}</p>}
      {/* En el celular, las acciones en círculos como en el diseño; desde tablet, los botones de la tarjeta. */}
      <CardDetailView
        card={card}
        movements={movements}
        online={online}
        hidden={hidden}
        onAction={setSheet}
        actions={
          mobile ? (
            <CircleActions
              label={t('Acciones de la tarjeta')}
              actions={[
                { to: `/app/anotar?tarjeta=${id}`, label: t('Anotar'), icon: Plus, primary: true },
                { onClick: () => setSheet('pay'), label: t('Abonar'), icon: CircleDollarSign, disabled: !online },
                { onClick: () => setSheet('sync'), label: t('Actualizar saldo'), icon: RefreshCw, disabled: !online },
                { onClick: () => setSheet('edit'), label: t('Editar'), icon: Pencil, disabled: !online },
              ]}
            />
          ) : undefined
        }
        onDelete={async () => {
          await deleteCard(id);
          navigate('/app/tarjetas');
        }}
        onDeletePayment={async (paymentId) => {
          await deleteCardPayment(id, paymentId);
          setNotice(t('Pago eliminado.'));
          await load();
        }}
      />
      <Sheet open={sheet === 'pay'} title={t('Ya pagué')} onClose={close}>
        <PayCardForm
          suggested={card.statementTotal ?? card.used}
          disabled={!online}
          onSubmit={(v) => apply(() => payCard(id, v), t('Pago registrado.'))}
        />
      </Sheet>
      <Sheet open={sheet === 'sync'} title={t('Actualizar con el banco')} onClose={close}>
        <BankSyncForm
          card={card}
          hidden={hidden}
          disabled={!online}
          onSubmit={(v) =>
            apply(
              () => syncCardWithBank(id, v),
              (r) =>
                r.chargeTransaction
                  ? t('Se registró un gasto de {v1} en Cargos del banco.', { v1: hidden ? MASK : formatMoney(r.chargeTransaction.amount) })
                  : t('Tarjeta actualizada con el banco.'),
            )
          }
        />
      </Sheet>
      <Sheet open={sheet === 'edit'} title={t('Editar tarjeta')} onClose={close}>
        <CardForm initial={card} disabled={!online} onSubmit={(v) => apply(() => updateCard(id, v), t('Cambios guardados.'))} onCancel={close} />
      </Sheet>
    </>
  );
}
