import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import ConfirmButton from '@/components/common/ConfirmButton';
import RindeLine from '@/components/common/RindeLine';
import Sheet from '@/components/common/Sheet';
import DebtForm from '@/components/debts/DebtForm';
import PaymentForm from '@/components/debts/PaymentForm';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { MASK } from '@/components/dashboard/BalanceCard';
import { formatMoney } from '@/components/transactions/format';
import { todayIso } from '@/components/vacas/vacaFormat';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import useHiddenAmounts from '@/hooks/useHiddenAmounts';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { DEBT_WORDS, dueText, initials, progressText, shortDate } from '@/lib/debts';
import { cn } from '@/lib/utils';
import { uncacheTransaction } from '@/offline/sync';
import {
  addDebtPayment,
  createDebt,
  deleteDebt,
  deleteDebtPayment,
  listDebts,
  settleDebt,
  updateDebt,
} from '@/services/debtService';

/**
 * Hoja "Ya me pagó todo / Ya pagué todo": salda lo que falta y, por defecto, registra el movimiento.
 * @param {{ debt: object, money: (n: number) => string, disabled: boolean, onConfirm: (createTransaction: boolean) => Promise<void> }} props
 */
function SettleForm({ debt, money, disabled, onConfirm }) {
  const words = DEBT_WORDS[debt.kind];
  const [record, setRecord] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const confirm = async () => {
    setBusy(true);
    setError('');
    try {
      await onConfirm(record);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };
  return (
    <div className="space-y-4">
      <p>
        {debt.kind === 'receivable' ? `${debt.person} te pagó lo que faltaba: ` : `Le pagaste a ${debt.person} lo que faltaba: `}
        <span className="font-semibold tabular-nums">{money(debt.pending)}</span>.
      </p>
      <label className="flex items-start gap-3 rounded-xl bg-ink/5 p-3 text-sm">
        <Checkbox
          checked={record}
          onCheckedChange={(v) => setRecord(v === true)}
          disabled={disabled || busy}
          className="mt-0.5"
        />
        <span>
          <span className="font-medium">{words.movement}</span>
          <span className="block text-ink/60">
            Así tu saldo de hoy queda bien. Va en {debt.kind === 'receivable' ? 'Otros ingresos' : 'Otros'}; puedes cambiar la
            categoría después.
          </span>
        </span>
      </label>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <Button size="lg" className="w-full" onClick={confirm} disabled={disabled || busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        {words.settleAll}
      </Button>
    </div>
  );
}

/** El avatar con las iniciales de la persona. */
function Avatar({ name, kind }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold',
        kind === 'receivable' ? 'bg-brand-soft text-brand' : 'bg-caution/15 text-ink',
      )}
    >
      {initials(name)}
    </span>
  );
}

/**
 * Una cuenta pendiente (Rinde v2): cuánto falta, la línea de avance, cómo va y la próxima cuota; el
 * botón principal es "Registrar abono" y, debajo, "Ya me pagó todo".
 * @param {{ debt: object, today: string, money: (n: number) => string, online: boolean, onPay: () => void, onSettle: () => void, onEdit: () => void }} props
 */
function DebtCard({ debt, today, money, online, onPay, onSettle, onEdit }) {
  const words = DEBT_WORDS[debt.kind];
  const next = debt.nextInstallment;
  const due = next && dueText(next.date, today);
  const lastPayment = debt.payments?.[0];
  return (
    <li className="rounded-3xl bg-surface p-4 ring-1 ring-ink/10">
      <div className="flex items-start gap-3">
        <Avatar name={debt.person} kind={debt.kind} />
        <div className="min-w-0 flex-1">
          <p className="break-words font-semibold">{debt.person}</p>
          {debt.note && <p className="break-words text-sm text-ink/60">{debt.note}</p>}
        </div>
        <Button size="icon" variant="ghost" className="size-11" onClick={onEdit} disabled={!online} aria-label={`Editar la cuenta de ${debt.person}`}>
          <Pencil aria-hidden="true" />
        </Button>
      </div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.08em] text-ink/60">{words.left}</p>
      <p className="mt-1 text-3xl font-semibold tabular-nums">{money(debt.pending)}</p>
      <RindeLine tone="surface" value={debt.amount > 0 ? debt.paid / debt.amount : 0} className="mt-3" />
      <p className="mt-2 text-sm tabular-nums text-ink/70">{progressText(debt, money)}</p>
      {next && (
        <p
          className={cn(
            'mt-3 rounded-xl p-3 text-sm',
            due?.late ? 'bg-negative/10 font-medium text-negative' : 'bg-ink/5 text-ink/80',
          )}
        >
          {debt.installments ? `Cuota ${next.number}: ` : ''}
          <span className="font-semibold tabular-nums">{money(next.amount)}</span> · {due.text.toLowerCase()}
        </p>
      )}
      {lastPayment && (
        <p className="mt-2 text-xs text-ink/60">
          Último abono: <span className="tabular-nums">{money(lastPayment.amount)}</span> el {shortDate(lastPayment.date, today)}
        </p>
      )}
      <div className="mt-4 flex flex-col gap-1">
        <Button size="lg" className="w-full" onClick={onPay} disabled={!online}>
          Registrar abono
        </Button>
        <Button variant="ghost" className="w-full text-brand" onClick={onSettle} disabled={!online}>
          {words.settleAll}
        </Button>
      </div>
    </li>
  );
}

/** Una cuenta ya saldada: compacta, con el enlace al movimiento si se creó. */
function SettledRow({ debt, money }) {
  return (
    <li className="flex items-center gap-3 rounded-2xl bg-surface p-3 opacity-80 ring-1 ring-ink/10">
      <Avatar name={debt.person} kind={debt.kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{debt.person}</p>
        <p className="text-sm text-ink/60">
          Saldada
          {debt.transactionId && (
            <>
              {' · '}
              <Link to={`/app/transacciones/${debt.transactionId}`} className="underline">
                ver el movimiento
              </Link>
            </>
          )}
        </p>
      </div>
      <span className="font-semibold tabular-nums text-ink/60 line-through decoration-ink/40">{money(debt.amount)}</span>
    </li>
  );
}

/**
 * Lista de un lado (me deben o debo): las pendientes y, debajo, las saldadas.
 * @param {{ items: object[], kind: 'receivable'|'payable', today: string, money: (n: number) => string, online: boolean, onAdd: () => void, onPay: (d: object) => void, onSettle: (d: object) => void, onEdit: (d: object) => void }} props
 */
export function DebtList({ items, kind, today, money, online, onAdd, onPay, onSettle, onEdit }) {
  const pending = items.filter((d) => !d.settledAt);
  const settled = items.filter((d) => d.settledAt);
  if (items.length === 0) {
    return (
      <Panel className="text-center">
        <p className="mx-auto max-w-md text-ink/60">{DEBT_WORDS[kind].empty}</p>
        <Button className="mt-4" onClick={onAdd} disabled={!online}>
          <Plus aria-hidden="true" /> Agregar
        </Button>
      </Panel>
    );
  }
  return (
    <div className="space-y-6">
      {pending.length > 0 ? (
        <ul aria-label={`${DEBT_WORDS[kind].tab}: pendientes`} className="space-y-3">
          {pending.map((d) => (
            <DebtCard
              key={d.id}
              debt={d}
              today={today}
              money={money}
              online={online}
              onPay={() => onPay(d)}
              onSettle={() => onSettle(d)}
              onEdit={() => onEdit(d)}
            />
          ))}
        </ul>
      ) : (
        <p className="text-ink/60">Todo está saldado.</p>
      )}
      {settled.length > 0 && (
        <section>
          <h2 className="mb-2 text-sm font-medium text-ink/60">Saldadas</h2>
          <ul aria-label={`${DEBT_WORDS[kind].tab}: saldadas`} className="space-y-2">
            {settled.map((d) => (
              <SettledRow key={d.id} debt={d} money={money} />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/**
 * Los dos lados como pestañas grandes con su total: "Me deben $X" | "Debo $Y".
 * @param {{ value: string, totals: { receivable: number, payable: number }, counts: Record<string, number>, money: (n: number) => string, onChange: (kind: string) => void }} props
 */
function SideSwitch({ value, totals, counts, money, onChange }) {
  return (
    <div role="tablist" aria-label="Cuentas" className="grid grid-cols-2 gap-1 rounded-2xl bg-surface p-1 ring-1 ring-ink/10">
      {['receivable', 'payable'].map((kind) => {
        const selected = value === kind;
        return (
          <button
            key={kind}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onChange(kind)}
            className={cn(
              'min-h-16 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet',
              selected ? 'bg-canvas ring-1 ring-inset ring-ink/15' : 'text-ink/70 hover:bg-ink/5',
            )}
          >
            <span className="block text-sm font-medium">
              {DEBT_WORDS[kind].tab}
              {counts[kind] > 0 && <span className="text-ink/70"> · {counts[kind]}</span>}
            </span>
            <span
              className={cn(
                'block text-lg font-semibold tabular-nums',
                totals[kind] > 0 ? (kind === 'receivable' ? 'text-positive' : 'text-negative') : 'text-ink/70',
              )}
            >
              {money(totals[kind])}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Los abonos de una cuenta en la hoja de editar, con la opción de borrar uno mal anotado. */
function PaymentHistory({ debt, money, today, online, onDelete }) {
  if (!debt.payments?.length) return null;
  return (
    <section className="space-y-2 border-t border-ink/10 pt-4">
      <h3 className="text-sm font-medium text-ink/70">Abonos</h3>
      <ul className="space-y-2">
        {debt.payments.map((p) => (
          <li key={p.id} className="rounded-xl bg-ink/5 p-3">
            <p className="flex justify-between text-sm">
              <span>{shortDate(p.date, today)}</span>
              <span className="font-semibold tabular-nums">{money(p.amount)}</span>
            </p>
            <ConfirmButton
              label="Borrar abono"
              question={`¿Borrar el abono de ${money(p.amount)}?${p.transactionId ? ' También se borra el movimiento que se anotó con él.' : ''}`}
              confirmLabel="Sí, borrar"
              icon={Trash2}
              disabled={!online}
              onConfirm={() => onDelete(p.id)}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Página privada `/app/cuentas`: lo que te deben y lo que debes, con abonos y cuotas (FT-0046, FT-0064). */
export default function Debts() {
  usePageTitle('Cuentas');
  const online = useOnlineStatus();
  const [hidden] = useHiddenAmounts();
  const money = (n) => (hidden ? MASK : formatMoney(n));
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('receivable');
  /** @type {[null | { mode: 'new' } | { mode: 'edit' | 'settle' | 'pay', debt: object }, Function]} */
  const [sheet, setSheet] = useState(null);
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  const today = todayIso();

  useEffect(() => {
    let cancelled = false;
    listDebts()
      .then((res) => !cancelled && (setData(res), setError('')))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [version]);

  const done = () => {
    setSheet(null);
    reload();
  };
  const handleCreate = async (values) => {
    await createDebt(values);
    setTab(values.kind);
    done();
  };
  const handleEdit = async (values) => {
    await updateDebt(sheet.debt.id, values);
    done();
  };
  const handlePay = async (values) => {
    await addDebtPayment(sheet.debt.id, values);
    done();
  };
  const handleSettle = async (createTransaction) => {
    await settleDebt(sheet.debt.id, { createTransaction });
    done();
  };
  const handleDelete = async () => {
    await deleteDebt(sheet.debt.id);
    done();
  };
  const handleDeletePayment = async (paymentId) => {
    const txId = sheet.debt.payments.find((p) => p.id === paymentId)?.transactionId;
    const debt = await deleteDebtPayment(sheet.debt.id, paymentId);
    // El servidor también borró el movimiento del abono: que deje de verse en este dispositivo.
    if (txId) await uncacheTransaction(txId);
    setSheet({ mode: 'edit', debt });
    reload();
  };

  const counts = {
    receivable: data?.items.filter((d) => d.kind === 'receivable' && !d.settledAt).length ?? 0,
    payable: data?.items.filter((d) => d.kind === 'payable' && !d.settledAt).length ?? 0,
  };
  const titles = {
    new: 'Nueva cuenta',
    edit: 'Editar cuenta',
    pay: 'Registrar abono',
    settle: sheet?.debt && DEBT_WORDS[sheet.debt.kind].settleAll,
  };

  return (
    <>
      <PageHeader
        title="Cuentas"
        description="Quién te debe y a quién le debes."
        actions={
          <Button onClick={() => setSheet({ mode: 'new' })} disabled={!online}>
            <Plus aria-hidden="true" /> Agregar
          </Button>
        }
      />
      {!online && <p className="mb-3 text-sm text-ink/60">Necesitas conexión para ver o cambiar tus cuentas.</p>}
      {error && (
        <p role="alert" className="mb-3 text-sm text-negative">
          {error}{' '}
          <button type="button" className="underline" onClick={reload}>
            Reintentar
          </button>
        </p>
      )}
      {data === null && !error && (
        <p className="flex items-center gap-2 py-10 text-ink/60">
          <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
        </p>
      )}
      {data && (
        <div className="mx-auto max-w-2xl space-y-5">
          <SideSwitch value={tab} totals={data.totals} counts={counts} money={money} onChange={setTab} />
          <div role="tabpanel" aria-label={DEBT_WORDS[tab].tab}>
            <DebtList
              items={data.items.filter((d) => d.kind === tab)}
              kind={tab}
              today={today}
              money={money}
              online={online}
              onAdd={() => setSheet({ mode: 'new' })}
              onPay={(debt) => setSheet({ mode: 'pay', debt })}
              onSettle={(debt) => setSheet({ mode: 'settle', debt })}
              onEdit={(debt) => setSheet({ mode: 'edit', debt })}
            />
          </div>
        </div>
      )}
      <Sheet open={sheet !== null} title={sheet ? titles[sheet.mode] : ''} onClose={() => setSheet(null)}>
        {sheet?.mode === 'new' && <DebtForm kind={tab} disabled={!online} onSubmit={handleCreate} />}
        {sheet?.mode === 'edit' && (
          <div className="space-y-4">
            <DebtForm key={sheet.debt.id} debt={sheet.debt} disabled={!online} onSubmit={handleEdit} />
            <PaymentHistory debt={sheet.debt} money={money} today={today} online={online} onDelete={handleDeletePayment} />
            <ConfirmButton
              label="Borrar cuenta"
              question={`¿Borrar la cuenta de ${sheet.debt.person}? No se puede deshacer.`}
              confirmLabel="Sí, borrar"
              icon={Trash2}
              disabled={!online}
              onConfirm={handleDelete}
            />
          </div>
        )}
        {sheet?.mode === 'pay' && <PaymentForm debt={sheet.debt} money={money} disabled={!online} onSubmit={handlePay} />}
        {sheet?.mode === 'settle' && <SettleForm debt={sheet.debt} money={money} disabled={!online} onConfirm={handleSettle} />}
      </Sheet>
    </>
  );
}
