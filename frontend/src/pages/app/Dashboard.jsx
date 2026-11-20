import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import DesktopHome from '@/components/dashboard/DesktopHome';
import MobileHome from '@/components/dashboard/MobileHome';
import { currentMonth } from '@/components/budgets/month';
import LoadErrorToast from '@/components/common/LoadErrorToast';
import CoachTour from '@/components/onboarding/CoachTour';
import useAsync from '@/hooks/useAsync';
import useFirstTimeTour from '@/hooks/useFirstTimeTour';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useMediaQuery from '@/hooks/useMediaQuery';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { SYNC_EVENT, listCached, listPending } from '@/offline/lazySync';
import { TRANSACTION_SAVED_EVENT } from '@/offline/saveNewTransaction';
import { todayIso } from '@/lib/period';
import { listBudgets } from '@/services/budgetService';
import { listCards } from '@/services/cardService';
import { getMoneyPlan, getMoneyProfile, getPaymentCalendar } from '@/services/moneyProfileService';
import { listPendingPayments } from '@/services/pendingPaymentService';
import { getSummary } from '@/services/summaryService';
import { getCategories, listTransactions } from '@/services/transactionService';
import { t } from '@/lib/i18n';
import { dateLocale } from '@/lib/region';

const RECENT_COUNT = 6;

/** `octubre` a partir de `2026-10`. */
function monthName(month) {
  const [year, m] = month.split('-').map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString(dateLocale(), { month: 'long' });
}

/**
 * Página privada `/app` (Rinde v2): en el celular `MobileHome` y en el computador `DesktopHome`, con los
 * mismos datos del mes: Mi plata y hasta cuándo alcanza, ingresos y gastos, presupuestos y últimos
 * movimientos. Cada bloque carga por separado: si uno falla, los demás se ven, y un aviso abajo ofrece
 * reintentar. Sin ningún movimiento, el gráfico y los movimientos se reemplazan por un estado vacío (FT-0004).
 * Después de la bienvenida sale una vez el tutorial de primera vez (FT-0071).
 * Sin conexión, los últimos movimientos salen de la copia del dispositivo (FT-0009) y el balance y los
 * presupuestos avisan que se actualizan al volver internet; al reconectar, todo se recarga.
 * Quien no ha visto la bienvenida (FT-0036) va a ella si no tiene movimientos; si ya tiene, se le invita.
 * Con la bienvenida respondida, lo primero es la tarjeta de Mi plata (FT-0037); si la omitió, un acceso para configurarla.
 */
export default function Dashboard() {
  usePageTitle(t('Inicio'));
  const [hidden, toggleHidden] = useHiddenAmounts();
  const mobile = useMediaQuery('(width < 48rem)');
  const online = useOnlineStatus();
  const month = currentMonth();
  const label = monthName(month);

  const summary = useAsync(() => getSummary('month', todayIso()), [online]);
  // Mientras carga otro periodo se muestra el "cargando", no los números del periodo anterior.
  const current = summary.loading ? undefined : summary.data;
  const totals = current && {
    income: current.income.total,
    expense: current.expense.total,
    savings: current.savings.total,
    balance: current.balance,
  };

  const budgets = useAsync(() => listBudgets(month), [month, online]);
  const recent = useAsync(
    () =>
      listTransactions({ page: 1, pageSize: RECENT_COUNT }).catch((err) => {
        if (err.code !== 'NETWORK_ERROR') throw err;
        return listCached({ page: 1, pageSize: RECENT_COUNT });
      }),
    [online],
  );
  const categories = useAsync(getCategories, []);
  const moneyProfile = useAsync(getMoneyProfile, [online]);
  const moneyPlan = useAsync(getMoneyPlan, [online]);
  // Próximos pagos del escritorio: el calendario del mes de Mi plata.
  const calendar = useAsync(getPaymentCalendar, [online]);
  const { touring, closeTour } = useFirstTimeTour({ profile: moneyProfile.data, online, onSaved: moneyProfile.reload });
  // Si falla la carga no hay datos y el resumen simplemente no aparece.
  const cards = useAsync(listCards, [online]);
  // Pagos que llegaron solos (FT-0047). Si falla o no hay, el Inicio simplemente no muestra la fila.
  const toConfirm = useAsync(() => listPendingPayments().then((res) => res.items.length).catch(() => 0), [online]);

  const names = useMemo(() => {
    const all = categories.data ? [...categories.data.expense, ...categories.data.income] : [];
    return Object.fromEntries(all.map((c) => [c.key, c.name]));
  }, [categories.data]);

  // Movimientos guardados sin conexión que aún no llegan al servidor (FT-0009).
  const [pending, setPending] = useState(0);
  const { reload: reloadRecent } = recent;
  const { reload: reloadSummary } = summary;
  const { reload: reloadBudgets } = budgets;
  const { reload: reloadPlan } = moneyPlan;
  const { reload: reloadCards } = cards;
  // El saldo de la tarjeta grande sale del perfil y «Próximos pagos» del calendario: también cambian.
  const { reload: reloadProfile } = moneyProfile;
  const { reload: reloadCalendar } = calendar;

  // Un movimiento nuevo desde la barra rápida (FT-0013): se recargan balance, últimos y presupuestos.
  useEffect(() => {
    const onSaved = () => {
      reloadRecent();
      reloadSummary();
      reloadBudgets();
      reloadPlan();
      reloadCards();
      reloadProfile();
      reloadCalendar();
    };
    window.addEventListener(TRANSACTION_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(TRANSACTION_SAVED_EVENT, onSaved);
  }, [reloadRecent, reloadSummary, reloadBudgets, reloadPlan, reloadCards, reloadProfile, reloadCalendar]);

  useEffect(() => {
    const onSync = ({ detail }) => {
      setPending(detail.pending);
      // Lo sincronizado ya está en el servidor: se recargan el balance y los últimos movimientos.
      if (detail.synced?.length) {
        reloadRecent();
        reloadSummary();
        reloadPlan();
        reloadCards();
        reloadProfile();
        reloadCalendar();
      }
    };
    listPending().then((ops) => setPending(ops.length));
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [reloadRecent, reloadSummary, reloadPlan, reloadCards, reloadProfile, reloadCalendar]);

  // `total` cuenta todos los movimientos del usuario, no solo los de la página pedida.
  // Si hay pendientes offline el usuario ya registró algo: no se le dice que no tiene movimientos.
  // Sin conexión la copia local puede estar vacía aunque el servidor tenga datos: no se afirma que no hay.
  const empty = online && recent.data?.total === 0 && pending === 0;
  const welcomePending = online && moneyProfile.data?.welcomeDone === false;

  // Sin conexión el plan estaría viejo: no se muestra un monto que quizá ya no es cierto.
  const plan = online && moneyPlan.data?.ready ? moneyPlan.data : null;
  const setupPending = online && moneyProfile.data?.welcomeDone === true && moneyPlan.data?.ready === false;

  if (empty && welcomePending) return <Navigate to="/app/bienvenida" replace />;

  const loadingBalance = online && moneyProfile.loading && !moneyProfile.data;
  const balance = loadingBalance ? undefined : (moneyProfile.data?.money ?? totals?.balance ?? null);
  const loadError = online ? recent.error || summary.error : '';
  const retry = () => {
    reloadRecent();
    reloadSummary();
    moneyProfile.reload();
  };

  return (
    <>
      {/* Sin red: un aviso neutral, no de error; lo que se ve es la copia del dispositivo. */}
      {!online && (
        <p role="status" className="mb-3 rounded-xl bg-ink/5 px-3 py-2 text-sm text-ink/70 md:mb-4">
          {t('Sin conexión: se actualiza al volver internet.')}
        </p>
      )}
      {mobile ? (
        <MobileHome
          balance={balance}
          balanceSet={typeof moneyProfile.data?.balance === 'number'}
          totals={totals}
          budgets={budgets.data}
          cards={cards.data}
          plan={plan}
          toConfirm={toConfirm.data ?? 0}
          names={names}
          monthLabel={label}
          empty={empty}
          welcomePending={welcomePending}
          setupPending={setupPending}
          onWelcomeDone={moneyProfile.reload}
          hidden={hidden}
          onToggleHidden={toggleHidden}
        />
      ) : (
        <DesktopHome
          balance={balance}
          totals={totals}
          budgets={budgets.data}
          recent={recent.data?.data}
          recentError={recent.error}
          events={calendar.data?.events}
          today={todayIso()}
          names={names}
          monthLabel={label}
          empty={empty}
          welcomePending={welcomePending}
          setupPending={setupPending}
          onWelcomeDone={moneyProfile.reload}
          hidden={hidden}
          onToggleHidden={toggleHidden}
        />
      )}
      {loadError && <LoadErrorToast message={t('No pudimos traer tus movimientos.')} onRetry={retry} />}
      {touring && <CoachTour onClose={closeTour} />}
    </>
  );
}
