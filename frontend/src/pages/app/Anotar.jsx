import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Keyboard, Loader2, Mic, Paperclip, Plus, Sparkles, X } from 'lucide-react';
import NewCategoryDialog from '@/components/categories/NewCategoryDialog';
import FeelingPrompt from '@/components/transactions/FeelingPrompt';
import MoneyInput from '@/components/common/MoneyInput';
import { KAKEIBO, toggle } from '@/components/transactions/reflection';
import ChipGroup from '@/components/common/ChipGroup';
import Segmented from '@/components/common/Segmented';
import { currentMonth } from '@/components/budgets/month';
import AttachmentPicker from '@/components/transactions/AttachmentPicker';
import BigAmountWarning, { isBigAmount } from '@/components/transactions/BigAmountWarning';
import BudgetAlert from '@/components/transactions/BudgetAlert';
import DateQuickPick from '@/components/transactions/DateQuickPick';
import VoiceEntry from '@/components/transactions/VoiceEntry';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import useAsync from '@/hooks/useAsync';
import useAttachmentLimits from '@/hooks/useAttachmentLimits';
import useCategoryNames from '@/hooks/useCategoryNames';
import usePageTitle from '@/hooks/usePageTitle';
import { NETWORK_LABELS } from '@/lib/cardStyles';
import { attachedText } from '@/lib/attachedText';
import { cn } from '@/lib/utils';
import { parseMoneyInput } from '@/lib/money';
import { parseSpokenTransaction } from '@/lib/voiceEntry';
import { today, transactionSchema } from '@/lib/validation/transaction';
import { saveNewTransaction } from '@/offline/saveNewTransaction';
import { uploadPending } from '@/services/attachmentService';
import { listBudgets } from '@/services/budgetService';
import { listCards } from '@/services/cardService';
import { getMoneyPlan } from '@/services/moneyProfileService';

/** El monto máximo que acepta el servidor tiene 10 cifras enteras. */
const MAX_DIGITS = 10;
const AI = 'ia';
const CASH = 'cash';
/** Categorías que se ven sin tocar "Ver todas". */
const VISIBLE_CATEGORIES = 5;

const empty = (card = CASH) => ({
  type: 'gasto',
  text: '',
  amount: '',
  description: '',
  category: AI,
  kakeibo: null,
  date: today(),
  card,
  installments: '1',
  files: [],
});

/**
 * Suma una tecla del teclado al monto (solo dígitos, sin ceros a la izquierda) o borra la última.
 * @param {string} amount Dígitos del monto, `''` si está vacío.
 * @param {string} key `'0'`–`'9'`, `'000'` o `'borrar'`.
 * @returns {string}
 */
export function pressKey(amount, key) {
  if (key === 'borrar') return amount.slice(0, -1);
  const next = (amount + key).replace(/^0+/, '');
  return next.length > MAX_DIGITS ? amount : next;
}

/**
 * Lo anotado, listo para guardar como lo haría el formulario de Movimientos (mismas reglas).
 * @returns {{ values?: object, error?: string }}
 */
export function toTransaction({ type, amount, description, category, date, card, installments = '1', kakeibo = null }) {
  const parsed = transactionSchema.safeParse({
    type,
    amount,
    description: description.trim(),
    date,
    category: category === AI ? '' : category,
    card: card === CASH ? null : card,
    installments: String(installments).trim(),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  // FT-0070: el grupo Kakeibo solo va en los gastos.
  return { values: { ...parsed.data, category: parsed.data.category || null, ...(type === 'gasto' && kakeibo && { kakeibo }) } };
}

/**
 * Lo que la persona escribió ("almuerzo 15 mil", "ayer taxi 9.000"), convertido en los campos del
 * movimiento con el mismo intérprete del dictado y de WhatsApp. Corre en el dispositivo, sin red: la
 * categoría la sigue eligiendo la IA del servidor al guardar.
 * @param {string} text
 * @returns {{ amount: string, description: string, date: string, type: 'gasto'|'ingreso', options: number[] }}
 */
export function readText(text) {
  const parsed = parseSpokenTransaction(text);
  return {
    amount: parsed.amount ? String(Math.round(parsed.amount)) : '',
    description: parsed.description ?? '',
    date: parsed.date,
    type: parsed.type,
    options: parsed.options ?? [],
  };
}

/**
 * Página privada `/app/anotar` (Rinde v2): anotar en una sola pantalla. Se escribe como se habla
 * ("almuerzo 15 mil"), la app saca el monto, la descripción y la fecha, y la IA elige la categoría al
 * guardar (o se elige aquí). En los gastos va también el grupo Kakeibo. El monto se puede corregir con
 * el teclado numérico y lo demás (fecha, tarjeta, cuotas, soportes) está en "Más detalles". Guarda con
 * lo mismo que el formulario: sin conexión queda en la cola (FT-0009).
 */
export default function Anotar() {
  usePageTitle('Anotar');
  const navigate = useNavigate();
  const [params] = useSearchParams();
  // Desde el detalle de una tarjeta (`?tarjeta=id`) llega con esa tarjeta elegida.
  const [startCard] = useState(() => params.get('tarjeta') ?? CASH);
  // Desde un presupuesto (`?categoria=clave`) llega con esa categoría; desde un acceso (`?tipo=ingreso`), con ese tipo.
  const [form, setForm] = useState(() => ({
    ...empty(startCard),
    type: params.get('tipo') === 'ingreso' ? 'ingreso' : 'gasto',
    category: params.get('categoria') ?? AI,
  }));
  const [typeTouched, setTypeTouched] = useState(params.has('tipo'));
  const [options, setOptions] = useState([]); // "2 almuerzos de 12 mil": el precio o el total
  const [manualAmount, setManualAmount] = useState(false); // el monto se corrigió con el teclado
  const [keypad, setKeypad] = useState(false);
  const [details, setDetails] = useState(false);
  const [result, setResult] = useState(null); // lo que devolvió `saveNewTransaction`
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [askBig, setAskBig] = useState(null); // monto grande que espera el segundo toque
  const [allCategories, setAllCategories] = useState(false);
  const [voice, setVoice] = useState(false);
  const textField = useRef(null);
  const { categories, names: loadedNames } = useCategoryNames();
  // Las que se crean aquí mismo: quedan elegidas y de primeras, aunque la lista esté recortada.
  const [created, setCreated] = useState([]);
  const [creating, setCreating] = useState(false);
  const names = { ...loadedNames, ...Object.fromEntries(created.map((c) => [c.key, c.name])) };
  const cards = useAsync(listCards, []);
  const attachmentLimits = useAttachmentLimits();

  const set = (changes) => setForm((f) => ({ ...f, ...changes }));
  // Solo vale una tarjeta que existe: con un enlace viejo, o sin poder cargarlas, va en efectivo.
  const cardOk = form.card === CASH || Boolean(cards.data?.some((c) => c.id === form.card));

  /** Al escribir: se vuelve a leer todo el texto. El monto corregido a mano no se pisa. */
  const write = (text) => {
    const read = readText(text);
    setOptions(read.options.length > 1 ? read.options : []);
    setForm((f) => ({
      ...f,
      text,
      description: read.description,
      date: read.date,
      ...(!manualAmount && { amount: read.amount }),
      // "Me pagaron 300 mil" cambia a ingreso, salvo que la persona ya haya elegido el tipo.
      ...(!typeTouched &&
        read.type !== f.type && { type: read.type, category: AI, kakeibo: null, card: read.type === 'gasto' ? startCard : CASH }),
    }));
  };

  const reset = () => {
    setForm(empty(startCard));
    setResult(null);
    setAskBig(null);
    setOptions([]);
    setManualAmount(false);
    setKeypad(false);
    setDetails(false);
    setAllCategories(false);
    setTypeTouched(false);
    setTimeout(() => textField.current?.focus(), 0);
  };

  const save = async () => {
    const { values, error: invalid } = toTransaction({ ...form, card: cardOk ? form.card : CASH });
    if (invalid) return setError(invalid);
    setError('');
    // Monto grande: el primer toque pregunta, el segundo guarda. Si cambia el monto, vuelve a preguntar.
    if (isBigAmount(values.amount) && askBig !== values.amount) return setAskBig(values.amount);
    setSaving(true);
    try {
      const saved = await saveNewTransaction(values);
      // Los soportes van después del movimiento: necesitan su id. Sin conexión no se pueden subir.
      const files = form.files ?? [];
      const attached =
        files.length === 0
          ? null
          : saved.transaction
            ? await uploadPending(saved.transaction.id, files)
            : { uploaded: 0, failed: files.map((f) => f.name) };
      setResult({ ...saved, values, attached, money: null, left: null });
      // El saldo llega después: "listo" no espera otra respuesta del servidor.
      if (!saved.offline) {
        getMoneyPlan()
          .then((plan) => plan.ready && setResult((r) => r && { ...r, money: plan.money }))
          .catch(() => {});
        // Cuánto queda del presupuesto de esa categoría, si tiene y el gasto es de este mes.
        const category = saved.transaction?.category;
        if (values.type === 'gasto' && category && values.date.startsWith(currentMonth())) {
          listBudgets(currentMonth())
            .then((budgets) => {
              const budget = budgets.find((b) => b.category === category);
              if (budget) setResult((r) => r && { ...r, left: Math.max(0, budget.amount - budget.consumed) });
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const expense = form.type === 'gasto';
  const amount = Number(form.amount || 0);
  const loaded = (expense ? categories?.expense : categories?.income) ?? [];
  const mine = created.filter((c) => c.type === form.type);
  const list = [...mine, ...loaded.filter((c) => !mine.some((m) => m.key === c.key))];
  const shown = allCategories ? list : list.slice(0, VISIBLE_CATEGORIES);
  const missing = !amount ? (expense ? 'Escribe cuánto gastaste' : 'Escribe cuánto te entró') : !form.description.trim() ? 'Falta en qué fue' : '';

  if (result) {
    const { values, transaction, alert, offline, money, left, attached } = result;
    const attachedNote = attachedText(attached);
    const category = transaction?.category;
    return (
      <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-between gap-8 rounded-3xl bg-violet p-6 text-white max-md:rounded-none max-md:fixed max-md:inset-0 max-md:z-50 max-md:max-w-none max-md:overflow-y-auto max-md:px-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:pt-[max(1rem,env(safe-area-inset-top))]">
        <div className="my-auto">
          <span className="grid size-16 place-items-center rounded-full bg-white text-brand motion-safe:animate-pop">
            <Check className="size-8" strokeWidth={2.5} aria-hidden="true" />
          </span>
          <h1 role="status" className="mt-6 text-[32px] font-semibold tracking-tight motion-safe:animate-done-in">
            {values.type === 'gasto' ? 'Gasto guardado' : 'Ingreso guardado'}
          </h1>
          <p className="mt-2 text-lg motion-safe:animate-done-in">
            {values.description} · {formatMoney(values.amount)}
          </p>
          <div className="mt-8 divide-y divide-white/30 rounded-2xl bg-white/15 px-4 motion-safe:animate-done-in">
            {offline ? (
              <p className="py-4 text-[15px]">Guardado sin conexión. Se sincronizará cuando vuelva internet.</p>
            ) : (
              <>
                {money !== null && (
                  <p className="flex min-h-[60px] items-center justify-between gap-4 text-[15px]">
                    <span>Tu saldo ahora</span>
                    <strong className="text-[17px] font-semibold tabular-nums">{formatMoney(money)}</strong>
                  </p>
                )}
                {left !== null ? (
                  <p className="flex min-h-[60px] items-center justify-between gap-4 text-[15px]">
                    <span>Te quedan en {names[category] ?? category}</span>
                    <strong className="text-[17px] font-semibold tabular-nums">{formatMoney(left)}</strong>
                  </p>
                ) : (
                  category && (
                    <p className="flex min-h-[60px] items-center justify-between gap-4 text-[15px]">
                      <span>{transaction.source === 'ia' ? 'Categoría (sugerida por IA)' : 'Categoría'}</span>
                      <strong className="font-semibold">{names[category] ?? category}</strong>
                    </p>
                  )
                )}
              </>
            )}
          </div>
          {attachedNote && (
            <p
              role={attached.failed.length ? 'alert' : undefined}
              className="mt-4 flex items-start gap-2 rounded-2xl bg-white/15 px-4 py-3 text-[15px] motion-safe:animate-done-in"
            >
              <Paperclip className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {attachedNote}
            </p>
          )}
          <BudgetAlert className="mt-4" alert={alert} categoryName={names[category]} />
          {/* FT-0070: solo con el gasto ya en el servidor (sin conexión aún no tiene id). */}
          {values.type === 'gasto' && transaction && <FeelingPrompt className="mt-4" transaction={transaction} />}
        </div>

        <div className="flex flex-col gap-2">
          <Button asChild size="lg" variant="outline-light" className="bg-white text-brand hover:bg-white/90 hover:text-brand">
            <Link to="/app" replace>
              Volver al inicio
            </Link>
          </Button>
          <Button size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={reset}>
            Anotar otro
          </Button>
        </div>
      </div>
    );
  }

  const kakeiboHint = KAKEIBO.find((k) => k.key === form.kakeibo)?.hint;

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col gap-4 max-md:overflow-x-hidden max-md:motion-safe:animate-screen-up max-md:bg-surface max-md:fixed max-md:inset-0 max-md:z-50 max-md:max-w-none max-md:overflow-y-auto max-md:px-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold tracking-tight">{expense ? 'Anotar un gasto' : 'Anotar un ingreso'}</h1>
        <button
          type="button"
          aria-label="Cerrar sin anotar"
          onClick={() => navigate('/app', { replace: true })}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <Segmented
        label="Tipo de movimiento"
        options={[
          { value: 'gasto', label: 'Gasto' },
          { value: 'ingreso', label: 'Ingreso' },
        ]}
        value={form.type}
        onChange={(type) => {
          setTypeTouched(true);
          set({ type, category: AI, kakeibo: null, card: type === 'gasto' ? startCard : CASH });
        }}
      />

      <div className="space-y-1.5">
        <Label htmlFor="anotar-texto">
          Escríbelo como te salga <span className="text-negative">*</span>
        </Label>
        <div className="relative">
          <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-brand" aria-hidden="true" />
          <Input
            ref={textField}
            id="anotar-texto"
            value={form.text}
            onChange={(event) => write(event.target.value)}
            placeholder={expense ? 'almuerzo 15 mil' : 'me pagaron 300 mil'}
            autoFocus
            autoComplete="off"
            enterKeyHint="done"
            aria-describedby="anotar-ayuda"
            className="h-12 border-brand pl-11 pr-12 text-base"
          />
          <button
            type="button"
            aria-label="Dictarlo"
            onClick={() => setVoice(true)}
            className="absolute right-1 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-violet"
          >
            <Mic className="size-5" aria-hidden="true" />
          </button>
        </div>
        <p id="anotar-ayuda" className="text-[13px] text-ink/60">
          Ej.: «almuerzo 15 mil», «ayer taxi 9.000». Tú corriges lo de abajo.
        </p>
      </div>

      {/* Lo que se entendió: monto, descripción, categoría y Kakeibo. */}
      <section aria-label="Lo que vamos a guardar" className="flex flex-col gap-3 rounded-2xl bg-canvas p-4">
        <div className="flex items-start justify-between gap-3">
          <p aria-live="polite" className={cn('text-[28px] font-extrabold leading-[34px] tracking-tight tabular-nums', !amount && 'text-ink/30')}>
            {formatMoney(amount)}
          </p>
          <p className="min-w-0 pt-1 text-right text-[13px]">
            <b className="block truncate font-semibold">{form.description.trim() || (expense ? 'Sin descripción' : 'Sin descripción')}</b>
            {form.date !== today() && <span className="text-ink/60">{form.date}</span>}
          </p>
        </div>
        {options.length > 1 && (
          <div role="group" aria-label="¿Cuál es el monto?" className="flex flex-wrap items-center gap-2 text-[13px]">
            <span className="text-ink/70">¿Cuál es el monto?</span>
            {options.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={Number(form.amount) === value}
                onClick={() => (setManualAmount(true), set({ amount: String(Math.round(value)) }))}
                className={cn(
                  'h-9 rounded-lg px-3 font-semibold focus-visible:outline-2 focus-visible:outline-violet',
                  Number(form.amount) === value ? 'bg-brand text-white' : 'bg-surface ring-1 ring-ink/10',
                )}
              >
                {formatMoney(value)}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          aria-expanded={keypad}
          onClick={() => setKeypad((open) => !open)}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-[13px] font-semibold text-brand focus-visible:outline-2 focus-visible:outline-violet"
        >
          <Keyboard className="size-4" aria-hidden="true" />
          {keypad ? 'Listo con el monto' : 'Corregir el monto con el teclado'}
        </button>
        {keypad && (
          <div className="space-y-1.5">
            <Label htmlFor="anotar-monto">Monto</Label>
            <MoneyInput
              id="anotar-monto"
              value={form.amount}
              onChange={(raw) => {
                setManualAmount(true);
                const value = parseMoneyInput(raw);
                set({ amount: value ? String(Math.min(Math.round(value), 9_999_999_999)) : '' });
              }}
            />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <p id="anotar-categoria" className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/60">
            Categoría
          </p>
          <ul role="group" aria-labelledby="anotar-categoria" className="flex flex-wrap gap-1.5">
            <li>
              <button
                type="button"
                aria-pressed={form.category === AI}
                onClick={() => set({ category: AI })}
                className={cn(
                  'flex h-9 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                  form.category === AI ? 'bg-brand text-white' : 'bg-brand-soft text-ink',
                )}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                Que la elija la IA
              </button>
            </li>
            {shown.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  aria-pressed={form.category === c.key}
                  onClick={() => set({ category: c.key })}
                  className={cn(
                    'h-9 rounded-lg px-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                    form.category === c.key ? 'bg-brand text-white' : 'bg-brand-soft text-ink',
                  )}
                >
                  {c.name}
                </button>
              </li>
            ))}
            {!allCategories && list.length > VISIBLE_CATEGORIES && (
              <li>
                <button
                  type="button"
                  onClick={() => setAllCategories(true)}
                  className="h-9 rounded-lg bg-surface px-2.5 text-[13px] font-semibold text-brand ring-1 ring-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
                >
                  Ver todas
                </button>
              </li>
            )}
            <li>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex h-9 items-center gap-1 rounded-lg bg-surface px-2.5 text-[13px] font-semibold text-brand ring-1 ring-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                Nueva
              </button>
            </li>
          </ul>
          <NewCategoryDialog
            open={creating}
            type={form.type}
            onClose={() => setCreating(false)}
            onCreated={(category) => {
              setCreated((current) => [{ ...category, type: form.type }, ...current]);
              set({ category: category.key });
            }}
          />
        </div>

        {expense && (
          <div className="flex flex-col gap-1.5">
            <p id="anotar-kakeibo" className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/60">
              ¿Podías evitarlo? <span className="font-normal normal-case tracking-normal">(opcional)</span>
            </p>
            <div role="group" aria-labelledby="anotar-kakeibo" className="grid grid-cols-4 gap-1.5">
              {KAKEIBO.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  aria-pressed={form.kakeibo === key}
                  onClick={() => set({ kakeibo: toggle(form.kakeibo, key) })}
                  className={cn(
                    'min-h-11 rounded-lg px-1 text-[12px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                    form.kakeibo === key ? 'bg-brand text-white' : 'bg-surface text-ink ring-1 ring-ink/10',
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <p className="text-[12px] text-ink/60" aria-live="polite">
              {kakeiboHint ?? 'Necesidad, deseo, cultura o imprevisto: te ayuda a ver en qué podrías ahorrar.'}
            </p>
          </div>
        )}
      </section>

      {/* Lo que casi nunca cambia queda plegado: fecha, tarjeta, cuotas y soportes. */}
      <div className="rounded-2xl ring-1 ring-ink/10">
        <button
          type="button"
          aria-expanded={details}
          aria-controls="anotar-detalles"
          onClick={() => setDetails((open) => !open)}
          className="flex min-h-12 w-full items-center justify-between gap-3 px-4 text-left text-[15px] focus-visible:outline-2 focus-visible:outline-violet"
        >
          <span>
            <b className="font-semibold">Más detalles</b>
            <span className="text-ink/60">
              {' '}
              · {form.date === today() ? 'Hoy' : form.date}
              {expense && ` · ${form.card === CASH || !cardOk ? 'Efectivo o débito' : 'Tarjeta'}`}
              {(form.files?.length ?? 0) > 0 && ` · ${form.files.length} soporte${form.files.length === 1 ? '' : 's'}`}
            </span>
          </span>
          <ChevronDown className={cn('size-5 shrink-0 transition-transform', details && 'rotate-180')} aria-hidden="true" />
        </button>
        {details && (
          <div id="anotar-detalles" className="flex flex-col gap-5 border-t border-ink/10 p-4">
            <DateQuickPick value={form.date} onChange={(date) => set({ date })} />
            {expense && cards.data?.length > 0 && (
              <ChipGroup
                legend="Pagado con"
                options={[
                  { value: CASH, label: 'Efectivo o débito' },
                  ...cards.data.map((c) => ({ value: c.id, label: `${NETWORK_LABELS[c.network] ?? c.name} ••${c.last4}` })),
                ]}
                value={form.card}
                onChange={(card) => set({ card })}
              />
            )}
            {expense && form.card !== CASH && cardOk && (
              <div className="space-y-1.5">
                <Label htmlFor="anotar-cuotas">Cuotas</Label>
                <Input
                  id="anotar-cuotas"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={48}
                  step={1}
                  value={form.installments}
                  onChange={(event) => set({ installments: event.target.value })}
                  aria-describedby="anotar-cuotas-ayuda"
                  className="w-28"
                />
                <p id="anotar-cuotas-ayuda" className="text-sm text-ink/60">
                  De 1 a 48. A más de una cuota el banco suele cobrar intereses.
                </p>
              </div>
            )}
            <AttachmentPicker files={form.files ?? []} onChange={(files) => set({ files })} limits={attachmentLimits} />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      {askBig === amount && <BigAmountWarning amount={amount} />}
      <Button size="lg" className="mt-auto" disabled={saving || Boolean(missing)} onClick={save}>
        {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
        {missing || (askBig === amount ? `Sí, guardar ${formatMoney(amount)}` : `${expense ? 'Guardar gasto' : 'Guardar ingreso'} · ${formatMoney(amount)}`)}
      </Button>

      <VoiceEntry
        open={voice}
        autoStart
        names={names}
        onClose={() => setVoice(false)}
        onEdit={(draft) => {
          setVoice(false);
          if (!draft) return;
          // Lo dictado queda escrito en el campo, para corregirlo como si se hubiera tecleado.
          const said = [draft.description, draft.amount ? Math.round(draft.amount).toLocaleString('es-CO') : ''].filter(Boolean).join(' ');
          setTypeTouched(true);
          setManualAmount(Boolean(draft.amount));
          setForm((f) => ({
            ...f,
            text: said,
            type: draft.type,
            ...(draft.type !== f.type && { category: AI, kakeibo: null, card: draft.type === 'gasto' ? startCard : CASH }),
            amount: draft.amount ? String(Math.round(draft.amount)) : f.amount,
            description: draft.description ?? '',
            date: draft.date ?? f.date,
          }));
        }}
        onSaved={(saved) => {
          setVoice(false);
          if (saved.transaction || saved.offline) {
            navigate('/app', { replace: true });
          }
        }}
      />
    </div>
  );
}
