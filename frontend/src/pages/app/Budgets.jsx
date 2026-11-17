import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Loader2, Plus } from 'lucide-react';
import Sheet from '@/components/common/Sheet';
import { BudgetAlert } from '@/components/dashboard/BudgetOverview';
import BudgetForm from '@/components/budgets/BudgetForm';
import BudgetList from '@/components/budgets/BudgetList';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { currentMonth, formatMonth, shiftMonth } from '@/components/budgets/month';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useMediaQuery from '@/hooks/useMediaQuery';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { createBudget, deleteBudget, listBudgets, updateBudget } from '@/services/budgetService';
import { CATEGORIES_CHANGED_EVENT, applyCategoryChange, getCategories } from '@/services/transactionService';

/**
 * Suma de los topes del mes y cuánto va gastado en ellos, con la línea de avance.
 * @param {{ budgets: Array<{ amount: number, consumed: number }> }} props
 */
function BudgetsTotal({ budgets }) {
  const limit = budgets.reduce((sum, b) => sum + b.amount, 0);
  const spent = budgets.reduce((sum, b) => sum + b.consumed, 0);
  const share = limit > 0 ? Math.min(spent / limit, 1) : 0;
  return (
    <div className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 ring-1 ring-ink/10">
      <p className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/60">Topes del mes</p>
      <p className="flex items-baseline justify-between gap-3">
        <span className="text-[22px] font-extrabold tracking-tight tabular-nums">{formatMoney(limit)}</span>
        <span className="text-[13px] text-ink/60 tabular-nums">
          llevas {formatMoney(spent)} · {Math.round(share * 100)} %
        </span>
      </p>
      <span
        role="meter"
        aria-label="Gastado de todos los topes"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(share * 100)}
        className="relative block h-1 rounded-full bg-ink/10"
      >
        <span className="absolute inset-y-0 left-0 rounded-full bg-brand" style={{ width: `${share * 100}%` }} />
      </span>
    </div>
  );
}

/**
 * Página privada `/app/presupuestos`: crear, editar y eliminar presupuestos por categoría y
 * mes, con lo gastado y la alerta de cada uno (FT-0005, REQ-016 a REQ-019).
 * Necesita conexión: sin ella desactiva los cambios (el aviso lo muestra el marco de la app).
 */
export default function Budgets() {
  usePageTitle('Presupuestos');
  const online = useOnlineStatus();
  const mobile = useMediaQuery('(width < 48rem)');
  const [formOpen, setFormOpen] = useState(false);
  const navigate = useNavigate();
  const [month, setMonth] = useState(currentMonth);
  const [categories, setCategories] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState(null);
  const [version, setVersion] = useState(0); // se incrementa para forzar la recarga

  const monthLabel = formatMonth(month);
  const categoryNames = useMemo(
    () => Object.fromEntries(categories.map((c) => [c.key, c.name])),
    [categories],
  );

  useEffect(() => {
    getCategories()
      .then((all) => setCategories(all.expense))
      .catch((err) => setError(err.message));
  }, []);

  // Una categoría creada, editada o eliminada desde el formulario se refleja sin volver a pedirlas.
  useEffect(() => {
    const apply = ({ detail }) => setCategories((current) => applyCategoryChange(current, detail, 'gasto'));
    window.addEventListener(CATEGORIES_CHANGED_EVENT, apply);
    return () => window.removeEventListener(CATEGORIES_CHANGED_EVENT, apply);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listBudgets(month)
      .then((data) => {
        if (cancelled) return;
        setBudgets(data);
        setError('');
      })
      .catch((err) => !cancelled && setError(err.message))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [month, version]);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  // Al eliminar una categoría también se borran sus presupuestos: se vuelven a pedir.
  useEffect(() => {
    const onCategoryChange = ({ detail }) => detail.kind === 'deleted' && reload();
    window.addEventListener(CATEGORIES_CHANGED_EVENT, onCategoryChange);
    return () => window.removeEventListener(CATEGORIES_CHANGED_EVENT, onCategoryChange);
  }, [reload]);

  const changeMonth = (delta) => {
    setMonth((m) => shiftMonth(m, delta));
    setEditing(null);
    setNotice('');
  };

  const handleSubmit = async ({ category, amount }) => {
    if (editing) {
      await updateBudget(editing.id, amount);
      setNotice(`Límite de ${categoryNames[editing.category] ?? editing.category} actualizado.`);
      setEditing(null);
    } else {
      await createBudget({ category, month, amount });
      setNotice(`Presupuesto de ${categoryNames[category] ?? category} creado.`);
    }
    reload();
  };

  const handleDelete = async (budget) => {
    try {
      await deleteBudget(budget.id);
      if (editing?.id === budget.id) setEditing(null);
      setNotice(`Presupuesto de ${categoryNames[budget.category] ?? budget.category} eliminado.`);
      reload();
    } catch (err) {
      setError(err.message);
    }
  };

  /** Lleva al formulario: arriba en computador, al final de la lista en el celular. */
  const showForm = () => {
    if (mobile) setFormOpen(true);
    else document.getElementById('form-title')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditing(null);
  };

  return (
    <>
      <div className="max-md:hidden">
        <PageHeader
          title="Presupuestos"
          description="Un límite por categoría para cada mes. Te avisamos al 80 % y al pasarte."
        />
      </div>
      <div className="mb-5 md:hidden">
        <h1 className="text-2xl font-bold tracking-tight">Tus presupuestos</h1>
        <div className="-ml-2 flex items-center gap-1 text-[15px] text-ink/70">
          <button type="button" className="grid size-11 place-items-center" onClick={() => changeMonth(-1)} aria-label="Mes anterior">
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <span className="first-letter:uppercase">{monthLabel}</span>
          <button type="button" className="grid size-11 place-items-center" onClick={() => changeMonth(1)} aria-label="Mes siguiente">
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Rinde v2, celular: cuánto suman los topes y cuánto va, el aviso más importante y el botón de crear. */}
      <div className="mb-5 flex flex-col gap-4 md:hidden">
        {budgets.length > 0 && <BudgetsTotal budgets={budgets} />}
        <BudgetAlert budgets={budgets} names={categoryNames} linked={false} />
        <Button size="lg" onClick={() => (setEditing(null), showForm())} disabled={!online}>
          <Plus aria-hidden="true" />
          Nuevo presupuesto
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {mobile ? (
          <Sheet open={formOpen} title={editing ? 'Cambiar límite' : 'Nuevo presupuesto'} onClose={closeForm}>
            <BudgetForm
              categories={categories}
              usedCategories={budgets.map((b) => b.category)}
              monthLabel={monthLabel}
              initial={editing}
              disabled={!online}
              onSubmit={async (values) => {
                await handleSubmit(values);
                closeForm();
              }}
              onCancel={closeForm}
            />
          </Sheet>
        ) : (
          <Panel aria-labelledby="form-title" className="h-fit scroll-mt-4 lg:sticky lg:top-8">
            <h2 id="form-title" className="mb-5 text-lg font-semibold tracking-tight">
              {editing ? 'Cambiar límite' : 'Nuevo presupuesto'}
            </h2>
            <BudgetForm
              categories={categories}
              usedCategories={budgets.map((b) => b.category)}
              monthLabel={monthLabel}
              initial={editing}
              disabled={!online}
              onSubmit={handleSubmit}
              onCancel={editing ? () => setEditing(null) : undefined}
            />
          </Panel>
        )}

        <Panel aria-labelledby="list-title" className="max-md:p-3.5 max-md:py-0">
          <div className="flex items-center justify-between gap-2 max-md:hidden">
            <Button size="icon" variant="ghost" onClick={() => changeMonth(-1)} aria-label="Mes anterior">
              <ChevronLeft aria-hidden="true" />
            </Button>
            <h2 id="list-title" className="text-center text-lg font-semibold tracking-tight first-letter:uppercase">
              {monthLabel}
            </h2>
            <Button size="icon" variant="ghost" onClick={() => changeMonth(1)} aria-label="Mes siguiente">
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>

          <p role="status" className="mt-4 min-h-5 text-sm text-positive empty:max-md:hidden">
            {notice}
          </p>
          {error && (
            <p role="alert" className="mt-2 text-sm text-negative">
              {error}{' '}
              <button type="button" className="underline" onClick={reload}>
                Reintentar
              </button>
            </p>
          )}

          <div className="mt-2 max-md:mt-0" aria-busy={loading}>
            {loading && budgets.length === 0 ? (
              <p className="flex items-center gap-2 py-10 text-ink/60">
                <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
              </p>
            ) : budgets.length === 0 ? (
              // Si la carga falló (p. ej. sin conexión) no se sabe si hay presupuestos: solo queda el error.
              !error && <p className="py-10 text-center text-ink/60">
                No tienes presupuestos en {monthLabel}. Crea uno para ver cuánto llevas gastado en
                esa categoría.
              </p>
            ) : (
              <BudgetList
                budgets={budgets}
                categoryNames={categoryNames}
                disabled={!online}
                onEdit={(b) => (mobile ? navigate(`/app/presupuestos/${encodeURIComponent(b.category)}?mes=${month}`) : (setEditing(b), setNotice(''), showForm()))}
                onDelete={handleDelete}
                compact={mobile}
              />
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
