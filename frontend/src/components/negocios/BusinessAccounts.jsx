import { useEffect, useState } from 'react';
import { ChevronRight, Loader2, Plus, Trash2, Undo2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import ChipGroup from '@/components/common/ChipGroup';
import ConfirmButton from '@/components/common/ConfirmButton';
import MoneyInput from '@/components/common/MoneyInput';
import Sheet from '@/components/common/Sheet';
import Panel from '@/components/layout/Panel';
import { ACCOUNT_TABS, PAYMENT_KIND_OPTIONS, dueText, paidPercent } from '@/components/negocios/accountFormat';
import { formatMoney, formatRelativeDay } from '@/components/transactions/format';
import { todayIso } from '@/components/vacas/vacaFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
  createAccount,
  deleteAccount,
  deleteAccountPayment,
  listAccounts,
  payAccount,
} from '@/services/negocioService';

/** Mensaje de error de un envío, con el detalle del campo si lo hay. */
const errorText = (err) => Object.values(err.fields ?? {})[0] ?? err.message;

/**
 * Hoja "Nueva cuenta": quién debe (o a quién se le debe), cuánto y para cuándo.
 * @param {{ kind: 'receivable'|'payable', disabled: boolean, onSubmit: (data: object) => Promise<void> }} props
 */
function AccountForm({ kind: initialKind, disabled, onSubmit }) {
  const [kind, setKind] = useState(initialKind);
  const [party, setParty] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    if (!party.trim()) return setError(kind === 'receivable' ? 'Escribe quién te debe' : 'Escribe a quién le debes');
    if (!(Number(amount) > 0)) return setError('Ingresa un monto mayor que 0');
    setBusy(true);
    setError('');
    try {
      await onSubmit({
        kind,
        party: party.trim(),
        amount: Number(amount),
        dueDate: dueDate || null,
        description: description.trim() || null,
      });
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
    return undefined;
  };
  return (
    <form className="space-y-4" onSubmit={submit} noValidate aria-label="Nueva cuenta">
      <ChipGroup
        legend="¿Qué es?"
        options={[
          { value: 'receivable', label: 'Un cliente me debe' },
          { value: 'payable', label: 'Le debo a un proveedor' },
        ]}
        value={kind}
        onChange={setKind}
        disabled={disabled || busy}
      />
      <FormField id="acc-party" label={kind === 'receivable' ? 'Cliente' : 'Proveedor'}>
        <Input
          autoComplete="off"
          maxLength={80}
          placeholder={kind === 'receivable' ? 'Ej.: Tienda La Luz' : 'Ej.: Harinas del Huila'}
          value={party}
          onChange={(e) => setParty(e.target.value)}
          disabled={disabled || busy}
        />
      </FormField>
      <FormField id="acc-amount" label="Monto (COP)">
        <MoneyInput value={amount} onChange={setAmount} placeholder="0" disabled={disabled || busy} />
      </FormField>
      <FormField id="acc-due" label="Vence (opcional)">
        <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={disabled || busy} />
      </FormField>
      <FormField id="acc-desc" label="Detalle (opcional)">
        <Input
          autoComplete="off"
          maxLength={120}
          placeholder="Ej.: factura 123, pedido de 40 arepas"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          disabled={disabled || busy}
        />
      </FormField>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={disabled || busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        Guardar
      </Button>
    </form>
  );
}

/**
 * Formulario de abono: por defecto el saldo completo, hoy y el movimiento más común.
 * @param {{ account: object, today: string, disabled: boolean, onSubmit: (data: object) => Promise<void> }} props
 */
function PaymentForm({ account, today, disabled, onSubmit }) {
  const options = PAYMENT_KIND_OPTIONS[account.kind];
  const [amount, setAmount] = useState(String(account.remaining));
  const [date, setDate] = useState(today);
  const [movementKind, setMovementKind] = useState(options[0].value);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submit = async (event) => {
    event.preventDefault();
    const value = Number(amount);
    if (!(value > 0)) return setError('Ingresa un monto mayor que 0');
    if (value > account.remaining) return setError(`No puede ser mayor que el saldo (${formatMoney(account.remaining)})`);
    if (!date || date > today) return setError('La fecha no puede ser futura');
    setBusy(true);
    setError('');
    try {
      await onSubmit({ amount: value, date, movementKind });
      setBusy(false);
    } catch (err) {
      setError(errorText(err));
      setBusy(false);
    }
    return undefined;
  };
  return (
    <form className="space-y-4" onSubmit={submit} noValidate aria-label="Registrar abono">
      <FormField id="pay-amount" label="Abono (COP)">
        <MoneyInput value={amount} onChange={setAmount} placeholder="0" disabled={disabled || busy} />
      </FormField>
      <FormField id="pay-date" label="Fecha">
        <Input type="date" max={today} value={date} onChange={(e) => setDate(e.target.value)} disabled={disabled || busy} />
      </FormField>
      <ChipGroup
        legend={account.kind === 'receivable' ? 'Entra al negocio como' : 'Sale del negocio como'}
        options={options}
        value={movementKind}
        onChange={setMovementKind}
        disabled={disabled || busy}
      />
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full" disabled={disabled || busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        Registrar abono
      </Button>
    </form>
  );
}

/** Una cuenta de la lista: tercero, cuándo vence, cuánto falta y la barra de lo abonado. */
function AccountRow({ account, today, onOpen }) {
  const overdue = account.status === 'vencida';
  const paid = account.status === 'pagada';
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-2xl border border-ink/10 bg-surface p-4 text-left transition-colors hover:border-ink/20 focus-visible:outline-2 focus-visible:outline-violet"
      >
        <span className="min-w-0 flex-1">
          <span className={cn('block break-words font-medium', paid && 'text-ink/50')}>{account.party}</span>
          <span className={cn('block text-sm', overdue ? 'text-negative' : 'text-ink/60')}>
            {dueText(account, today)}
            {account.paid > 0 && !paid && ` · abonado ${formatMoney(account.paid)}`}
          </span>
          {account.paid > 0 && !paid && (
            <span className="mt-2 block h-1.5 overflow-hidden rounded-full bg-ink/10" aria-hidden="true">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${paidPercent(account)}%` }} />
            </span>
          )}
        </span>
        <span className={cn('shrink-0 text-right font-semibold tabular-nums', paid && 'text-ink/50')}>
          {formatMoney(paid ? account.amount : account.remaining)}
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink/40" aria-hidden="true" />
      </button>
    </li>
  );
}

/**
 * Cuentas por cobrar (clientes) y por pagar (proveedores) del negocio, con abonos parciales
 * (FT-0058). Cada abono entra como movimiento del negocio, así el mes lo incluye. Los lectores ven,
 * pero no registran ni borran.
 * @param {{ businessId: string, myRole: 'dueno'|'editor'|'lector', myId: string, online: boolean, refreshKey: number, onChanged: () => void }} props
 */
export default function BusinessAccounts({ businessId, myRole, myId, online, refreshKey, onChanged }) {
  const today = todayIso();
  const [tab, setTab] = useState('receivable');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null); // 'nueva' | id de la cuenta abierta
  const [notice, setNotice] = useState('');
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    listAccounts(businessId)
      .then((res) => !cancelled && (setData(res), setError('')))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [businessId, refreshKey, version]);

  /** Pinta la cuenta que devolvió la API y avisa al mes del negocio. */
  const replace = (account) => {
    setData((d) => ({ ...d, items: d.items.map((a) => (a.id === account.id ? account : a)) }));
    setVersion((v) => v + 1);
    onChanged();
  };

  const items = data?.items.filter((a) => a.kind === tab) ?? [];
  const opened = data?.items.find((a) => a.id === sheet) ?? null;
  const totals = data?.totals;
  const pending = tab === 'receivable' ? totals?.receivable : totals?.payable;
  const overdue = tab === 'receivable' ? totals?.overdueReceivable : totals?.overduePayable;
  const canDeleteAccount = opened && data?.canRecord && (myRole === 'dueno' || opened.createdBy === myId);

  return (
    <Panel aria-labelledby="cuentas-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="cuentas-title" className="font-semibold">
            Cuentas por cobrar y por pagar
          </h3>
          {totals && (
            <p className="text-sm text-ink/60">
              {pending > 0
                ? `${tab === 'receivable' ? 'Te deben' : 'Debes'} ${formatMoney(pending)}`
                : tab === 'receivable'
                  ? 'Nadie te debe.'
                  : 'No le debes a nadie.'}
              {overdue > 0 && <span className="text-negative"> · {formatMoney(overdue)} vencido</span>}
            </p>
          )}
        </div>
        {data?.canRecord && (
          <Button variant="soft" onClick={() => (setNotice(''), setSheet('nueva'))} disabled={!online}>
            <Plus aria-hidden="true" /> Nueva
          </Button>
        )}
      </div>

      <div role="radiogroup" aria-label="Qué cuentas mostrar" className="mt-4 flex gap-1 rounded-2xl bg-ink/5 p-1">
        {ACCOUNT_TABS.map((t) => (
          <button
            key={t.value}
            type="button"
            role="radio"
            aria-checked={tab === t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'h-10 flex-1 rounded-xl text-sm font-semibold transition-colors',
              tab === t.value ? 'bg-violet text-white' : 'text-ink/70 hover:text-ink',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p role="status" className={cn('mt-3 text-sm text-positive', !notice && 'sr-only')}>
        {notice}
      </p>
      {error && (
        <p role="alert" className="mt-3 text-sm text-negative">
          {error}{' '}
          <button type="button" className="underline" onClick={() => setVersion((v) => v + 1)}>
            Reintentar
          </button>
        </p>
      )}
      {!data && !error && (
        <p className="flex items-center gap-2 py-4 text-ink/60">
          <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
        </p>
      )}
      {data && items.length === 0 && (
        <p className="mt-3 text-sm text-ink/60">
          {tab === 'receivable'
            ? 'Anota aquí lo que te quedan debiendo tus clientes y ve registrando los abonos.'
            : 'Anota aquí lo que les debes a tus proveedores y ve registrando lo que les pagas.'}
        </p>
      )}
      {items.length > 0 && (
        <ul aria-label={tab === 'receivable' ? 'Cuentas por cobrar' : 'Cuentas por pagar'} className="mt-3 space-y-2">
          {items.map((a) => (
            <AccountRow key={a.id} account={a} today={today} onOpen={() => (setNotice(''), setSheet(a.id))} />
          ))}
        </ul>
      )}

      <Sheet open={sheet === 'nueva'} title="Nueva cuenta" onClose={() => setSheet(null)}>
        {sheet === 'nueva' && (
          <AccountForm
            kind={tab}
            disabled={!online}
            onSubmit={async (values) => {
              const account = await createAccount(businessId, values);
              setData((d) => ({ ...d, items: [account, ...d.items] }));
              setTab(account.kind);
              setVersion((v) => v + 1);
              setSheet(null);
              setNotice(`Guardada la cuenta de ${account.party}.`);
            }}
          />
        )}
      </Sheet>

      <Sheet open={Boolean(opened)} title={opened?.party ?? ''} onClose={() => setSheet(null)}>
        {opened && (
          <div className="space-y-5">
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">{opened.kind === 'receivable' ? 'Te debe' : 'Le debes'}</dt>
                <dd className="font-medium tabular-nums">{formatMoney(opened.amount)}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Falta</dt>
                <dd className={cn('font-semibold tabular-nums', opened.status === 'vencida' && 'text-negative')}>
                  {formatMoney(opened.remaining)}
                </dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt className="text-ink/60">Estado</dt>
                <dd className={cn(opened.status === 'vencida' && 'text-negative', opened.status === 'pagada' && 'text-positive')}>
                  {dueText(opened, today)}
                </dd>
              </div>
              {opened.description && (
                <div className="flex justify-between gap-3">
                  <dt className="text-ink/60">Detalle</dt>
                  <dd className="break-words text-right">{opened.description}</dd>
                </div>
              )}
            </dl>

            {opened.payments.length > 0 && (
              <div>
                <h4 className="mb-2 text-sm font-medium text-ink/60">Abonos</h4>
                <ul className="divide-y divide-ink/10 text-sm">
                  {opened.payments.map((p) => {
                    const mine = p.registeredBy?.id === myId;
                    const canUndo = data.canRecord && (myRole === 'dueno' || mine);
                    return (
                      <li key={p.id} className="flex items-center justify-between gap-3 py-2">
                        <span className="min-w-0">
                          <span className="block font-medium tabular-nums">{formatMoney(p.amount)}</span>
                          <span className="block text-xs text-ink/60">
                            {formatRelativeDay(p.date)} · {mine ? 'tú' : p.registeredBy?.name || 'un socio'}
                          </span>
                        </span>
                        {canUndo && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={!online}
                            onClick={async () => {
                              try {
                                replace(await deleteAccountPayment(businessId, opened.id, p.id));
                                setNotice('Abono deshecho: también se quitó del mes del negocio.');
                              } catch (err) {
                                setNotice('');
                                setError(err.message);
                              }
                            }}
                          >
                            <Undo2 aria-hidden="true" /> Deshacer
                          </Button>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            {data.canRecord && opened.status !== 'pagada' && (
              <div className="rounded-2xl bg-ink/5 p-4">
                <PaymentForm
                  key={`${opened.id}-${opened.paid}`}
                  account={opened}
                  today={today}
                  disabled={!online}
                  onSubmit={async (values) => {
                    const account = await payAccount(businessId, opened.id, values);
                    replace(account);
                    setNotice(
                      account.status === 'pagada'
                        ? `¡Listo! La cuenta de ${account.party} quedó pagada.`
                        : `Abono registrado. Falta ${formatMoney(account.remaining)}.`,
                    );
                  }}
                />
              </div>
            )}

            {notice && <p className="text-sm text-positive">{notice}</p>}

            {canDeleteAccount && (
              <ConfirmButton
                label="Borrar cuenta"
                question="¿Borrar esta cuenta y sus abonos? Las ventas o pagos que ya registraste se quedan en el mes."
                confirmLabel="Sí, borrar"
                icon={Trash2}
                disabled={!online}
                onConfirm={async () => {
                  await deleteAccount(businessId, opened.id);
                  setData((d) => ({ ...d, items: d.items.filter((a) => a.id !== opened.id) }));
                  setVersion((v) => v + 1);
                  setSheet(null);
                  setNotice('Cuenta borrada.');
                }}
              />
            )}
          </div>
        )}
      </Sheet>
    </Panel>
  );
}
