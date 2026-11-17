import { useId, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Loader2, Pencil, Trash2 } from 'lucide-react';
import { cardMark } from '@/components/cards/cardFormat';
import Sheet from '@/components/common/Sheet';
import { MASK } from '@/components/dashboard/BalanceCard';
import Panel from '@/components/layout/Panel';
import AttachmentsPanel from '@/components/transactions/AttachmentsPanel';
import { EmotionPicker, KakeiboPicker } from '@/components/transactions/ReflectionPickers';
import { formatDate, formatMoney, formatRelativeDay } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import useCategoryNames from '@/hooks/useCategoryNames';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import usePageTitle from '@/hooks/usePageTitle';
import { canGoBack } from '@/lib/backPath';
import { formatIn } from '@/lib/region';
import { cn } from '@/lib/utils';
import { removeTransaction } from '@/offline/removeTransaction';
import { saveTransactionChanges } from '@/offline/saveTransactionChanges';
import { getTransaction } from '@/services/transactionService';
import { listBudgets } from '@/services/budgetService';

/** "Hoy, 4 nov 2026" o, si no es hoy ni ayer, solo la fecha. */
function longDay(iso) {
  const near = formatRelativeDay(iso);
  return near === 'Hoy' || near === 'Ayer' ? `${near}, ${formatDate(iso)}` : formatDate(iso);
}

/**
 * Página privada `/app/transacciones/:id`: un movimiento con su categoría, fecha, con qué se pagó y sus
 * recibos, para editarlo o eliminarlo. Desde una lista llega con el movimiento en la navegación, así
 * abre también sin conexión; con un enlace directo lo pide al servidor.
 */
export default function TransactionDetail() {
  const { id } = useParams();
  const { state } = useLocation();
  const navigate = useNavigate();
  const passed = state?.transaction?.id === id ? state.transaction : null;
  // Con conexión siempre pide la versión del servidor, por si se acaba de editar.
  const fetched = useAsync(
    () =>
      getTransaction(id).catch((err) => {
        if (passed) return passed;
        throw err;
      }),
    [id],
  );
  // Lo que se cambia aquí mismo (emoción y Kakeibo) se ve al instante, sin volver a pedirlo.
  const [local, setLocal] = useState(null);
  const loaded = fetched.data ?? passed;
  const t = loaded && local?.id === loaded.id ? { ...loaded, ...local } : loaded;
  const feelingId = useId();
  // El presupuesto del mes del gasto, si su categoría tiene uno.
  const budgetMonth = loaded?.date?.slice(0, 7);
  const budgets = useAsync(
    () => (budgetMonth && loaded?.type === 'gasto' && loaded?.category ? listBudgets(budgetMonth) : Promise.resolve([])),
    [budgetMonth, loaded?.category],
  );
  const kakeiboId = useId();
  const [reflecting, setReflecting] = useState(false);
  const [notice, setNotice] = useState('');
  const { names } = useCategoryNames();
  const [hidden] = useHiddenAmounts();
  const [error, setError] = useState('');
  // Eliminar pide confirmación en la misma hoja que la lista de Movimientos.
  const [deleting, setDeleting] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  usePageTitle(t ? t.description : 'Movimiento');

  if (!t) {
    return fetched.error ? (
      <p role="alert" className="text-sm text-negative">
        {fetched.error}{' '}
        <button type="button" className="underline" onClick={fetched.reload}>
          Reintentar
        </button>
      </p>
    ) : (
      <p className="flex items-center gap-2 py-10 text-ink/60" aria-busy="true">
        <Loader2 className="size-5 animate-spin" aria-hidden="true" /> Cargando…
      </p>
    );
  }

  const income = t.type === 'ingreso';
  const categoryName = t.category ? (names[t.category] ?? t.category) : 'Sin clasificar';
  const budget = budgets.data?.find((b) => b.category === t.category);
  const rows = [
    ['Cuándo', longDay(t.date)],
    ...(income
      ? []
      : [['Pagado con', t.card ? (t.card.deleted ? 'Tarjeta eliminada' : cardMark(t.card)) : 'Efectivo o débito']]),
    ...(t.card && t.installments > 1 ? [['Cuotas', String(t.installments)]] : []),
    // Anotado de viaje: lo que se pagó allá y la tasa con que se convirtió.
    ...(t.original
      ? [[income ? 'Recibido allá' : 'Pagado allá', `${hidden ? MASK : formatIn(t.original.amount, t.original.currency)} · 1 ${t.original.currency} = ${formatMoney(t.original.rate)}`]]
      : []),
    // Rinde v2: en qué presupuesto cuenta el gasto, y cómo va, con enlace al presupuesto.
    ...(!income && budget
      ? [
          [
            'Cuenta en el presupuesto',
            <Link key="presupuesto" to={`/app/presupuestos/${budget.category}`} className="font-semibold text-brand underline-offset-2 hover:underline">
              {categoryName} · {Math.round(budget.percentage)} %
            </Link>,
          ],
        ]
      : []),
  ];

  /** Guarda la emoción o el grupo Kakeibo (FT-0070); si falla, vuelve a como estaba. */
  const reflect = async (changes) => {
    const before = local;
    setError('');
    setNotice('');
    setReflecting(true);
    setLocal({ ...(local ?? {}), id: t.id, ...changes });
    try {
      const { offline } = await saveTransactionChanges(t, changes);
      setNotice(offline ? 'Guardado sin conexión. Se sincronizará cuando vuelva internet.' : 'Guardado.');
    } catch (err) {
      setLocal(before);
      setError(err.message);
    } finally {
      setReflecting(false);
    }
  };

  const remove = async () => {
    setDeleteError('');
    setRemoving(true);
    try {
      await removeTransaction(t);
      if (canGoBack(window.history.state)) navigate(-1);
      else navigate('/app/movimientos', { replace: true });
    } catch (err) {
      setDeleteError(err.message);
      setRemoving(false);
    }
  };

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      {/* Rinde v2: el tipo y la categoría arriba en pequeño, la descripción como título y el monto grande. */}
      <div className="flex flex-col gap-2">
        <p className="text-[13px] text-ink/60">
          {income ? 'Ingreso' : 'Gasto'} · {categoryName}
        </p>
        <h1 className="text-2xl font-bold tracking-tight">{t.description}</h1>
        <p className={cn('text-[40px] font-extrabold leading-[44px] tracking-[-0.02em] tabular-nums', income && 'text-positive')}>
          <span className="sr-only">{income ? 'Ingreso de ' : 'Gasto de '}</span>
          {hidden ? MASK : `${income ? '+ ' : '− '}${formatMoney(t.amount)}`}
        </p>
        {t.category && (
          <span className="inline-flex min-h-9 items-center gap-1 self-start rounded-lg bg-brand px-3 text-[13px] font-semibold text-white">
            {categoryName}
            {t.source === 'ia' && <small className="font-normal opacity-85">· sugerida por la IA</small>}
          </span>
        )}
      </div>

      <Panel className="py-0 md:py-0">
        <dl className="divide-y divide-ink/10">
          {rows.map(([label, value]) => (
            <div key={label} className="flex min-h-14 items-center justify-between gap-4 text-[15px]">
              <dt className="text-ink/60">{label}</dt>
              <dd className="text-right font-medium">{value}</dd>
            </div>
          ))}
        </dl>
      </Panel>

      {/* FT-0070: cómo se sintió con el gasto y en qué grupo Kakeibo va. Ambos opcionales. */}
      {!income && (
        <Panel aria-label="Reflexión del gasto" className="flex flex-col gap-5">
          <div>
            <h2 id={feelingId} className="mb-3 text-[15px] font-semibold">
              ¿Cómo te sentiste?
            </h2>
            <EmotionPicker
              value={t.emotion ?? null}
              onChange={(emotion) => reflect({ emotion })}
              disabled={reflecting}
              labelledBy={feelingId}
            />
          </div>
          <div>
            <h2 id={kakeiboId} className="text-[15px] font-semibold">
              ¿Podías evitarlo?
            </h2>
            <p className="mb-3 text-[13px] text-ink/60">El grupo Kakeibo del gasto. Cámbialo cuando quieras.</p>
            <KakeiboPicker
              variant="cards"
              value={t.kakeibo ?? null}
              onChange={(kakeibo) => reflect({ kakeibo })}
              disabled={reflecting}
              labelledBy={kakeiboId}
            />
          </div>
          <p role="status" className="-mt-2 min-h-5 text-[13px] text-ink/60">
            {notice}
          </p>
        </Panel>
      )}

      {/* Recibos (FT-0044): solo de movimientos que ya están en el servidor. */}
      <Panel>
        <AttachmentsPanel bare transactionId={t.id} />
      </Panel>

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-2">
        <Button size="lg" onClick={() => navigate(`/app/transacciones/${t.id}/editar`, { state: { transaction: t } })}>
          <Pencil aria-hidden="true" />
          {income ? 'Editar ingreso' : 'Editar gasto'}
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="border-negative/30 text-negative hover:bg-negative/5"
          onClick={() => (setDeleteError(''), setDeleting(true))}
        >
          <Trash2 aria-hidden="true" />
          {income ? 'Eliminar ingreso' : 'Eliminar gasto'}
        </Button>
      </div>

      <Sheet
        open={deleting}
        title="¿Eliminar este movimiento?"
        description={`${t.description} · ${hidden ? MASK : formatMoney(t.amount)}. Se quita de tus totales.`}
        onClose={() => !removing && setDeleting(false)}
      >
        {deleteError && (
          <p role="alert" className="mb-3 text-sm text-negative">
            {deleteError}
          </p>
        )}
        <div className="flex flex-col gap-2">
          <Button size="lg" className="bg-negative text-white hover:bg-negative/90" disabled={removing} onClick={remove}>
            {removing && <Loader2 className="animate-spin" aria-hidden="true" />}
            Sí, eliminar
          </Button>
          <Button size="lg" variant="ghost" disabled={removing} onClick={() => setDeleting(false)}>
            Cancelar
          </Button>
        </div>
      </Sheet>
    </div>
  );
}
