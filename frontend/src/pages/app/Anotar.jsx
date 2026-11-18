import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Check, ChevronDown, Loader2, Mic, Paperclip, Plus, Sparkles, X } from 'lucide-react';
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
import { formatDate, formatMoney } from '@/components/transactions/format';
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
import { currencySymbol, formatIn, getRegion, isAbroad, localCurrency } from '@/lib/region';
import { parseSpokenTransaction } from '@/lib/voiceEntry';
import { today, transactionSchema } from '@/lib/validation/transaction';
import { saveNewTransaction } from '@/offline/saveNewTransaction';
import { uploadPending } from '@/services/attachmentService';
import { listBudgets } from '@/services/budgetService';
import { listCards } from '@/services/cardService';
import { getExchangeRate } from '@/services/exchangeRateService';
import { getMoneyPlan } from '@/services/moneyProfileService';
import { t } from '@/lib/i18n';

/** El monto máximo que acepta el servidor tiene 10 cifras enteras. */
const MAX_DIGITS = 10;
const AI = 'ia';
const CASH = 'cash';
/** Categorías que se ven sin tocar "Ver todas". */
const VISIBLE_CATEGORIES = 5;

const empty = (card = CASH) => ({
  type: 'gasto',
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
 * Lo que se guarda de la casilla «¿En qué fue?». Si el monto ya se escribió en su casilla, un número
 * en la descripción es parte del nombre («iPhone 15») y la fecha no cambia (`date: null`); si no, se
 * lee como al dictar: «almuerzo 15 mil» da el monto y deja «Almuerzo».
 * @param {string} text
 * @param {boolean} amountTyped
 */
export function readDescription(text, amountTyped) {
  const read = readText(text);
  if (amountTyped && read.amount) return { ...read, amount: '', options: [], description: text.trim(), date: null };
  return amountTyped ? { ...read, amount: '', options: [] } : read;
}

/**
 * Página privada `/app/anotar` (Rinde v2): anotar en una sola pantalla, con dos casillas a la vista:
 * «Monto» y «¿En qué fue?». La segunda también entiende cómo se habla ("almuerzo 15 mil" llena el
 * monto) y el dictado llena las dos. La IA elige la categoría al guardar (o se elige aquí). En los
 * gastos va también el grupo Kakeibo; lo demás (fecha, tarjeta, cuotas, soportes) está en "Más
 * detalles". Guarda con lo mismo que el formulario: sin conexión queda en la cola (FT-0009).
 */
export default function Anotar() {
  usePageTitle(t('Anotar'));
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
  const [manualAmount, setManualAmount] = useState(false); // el monto se escribió en su casilla
  const [tried, setTried] = useState(false); // ya tocó Guardar: se marca lo que falta
  const [details, setDetails] = useState(false);
  const [result, setResult] = useState(null); // lo que devolvió `saveNewTransaction`
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [askBig, setAskBig] = useState(null); // monto grande que espera el segundo toque
  const [allCategories, setAllCategories] = useState(false);
  const [voice, setVoice] = useState(false);
  const amountField = useRef(null);
  const descriptionField = useRef(null);
  const rateField = useRef(null);
  const symbolRef = useRef(null);
  const [symbolWidth, setSymbolWidth] = useState(17); // el ancho de "$" a 28 px
  // Al viajar: en qué moneda se pagó (la de allá, por defecto) y la tasa a la moneda principal.
  const main = getRegion().currency;
  const local = localCurrency();
  const [currency, setCurrency] = useState(local);
  const [rate, setRate] = useState({ status: 'idle' }); // de Frankfurter, vía el servidor
  const [manualRate, setManualRate] = useState(''); // la de su banco o casa de cambio
  const [editingRate, setEditingRate] = useState(false);
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

  const expense = form.type === 'gasto';
  const amount = Number(form.amount || 0);
  const foreign = currency !== main;
  const symbol = currencySymbol(currency);
  const typedRate = Number(manualRate.replace(',', '.'));
  const effectiveRate = !foreign ? 1 : manualRate ? typedRate : (rate.value ?? 0);
  // Lo que se guarda va en la moneda principal; en otra moneda queda también lo pagado allá.
  const converted = foreign ? Math.round(amount * effectiveRate * 100) / 100 : amount;
  const description = readDescription(form.description, manualAmount).description;
  const missing = !amount ? 'amount' : !description ? 'description' : !(effectiveRate > 0) ? 'rate' : null;

  // Se mide el símbolo antes de pintar, para que el monto empiece justo después.
  useLayoutEffect(() => {
    if (symbolRef.current) setSymbolWidth(symbolRef.current.offsetWidth);
  }, [symbol]);

  // La tasa del día del movimiento. Sin conexión, la última que se trajo; si no hay, se escribe a mano.
  useEffect(() => {
    if (!foreign) return undefined;
    let alive = true;
    setRate({ status: 'loading' });
    getExchangeRate(currency, main, form.date).then(
      (found) => alive && setRate({ status: 'ok', value: found.rate, date: found.date, stale: found.stale }),
      () => alive && setRate({ status: 'error' }),
    );
    return () => {
      alive = false;
    };
  }, [foreign, currency, main, form.date]);

  /** Al escribir en «¿En qué fue?»: se vuelve a leer todo el texto. El monto de su casilla no se pisa. */
  const write = (text) => {
    const read = readDescription(text, manualAmount);
    setOptions(read.options.length > 1 ? read.options : []);
    setForm((f) => ({
      ...f,
      description: text,
      date: read.date ?? f.date,
      ...(!manualAmount && { amount: read.amount }),
      // "Me pagaron 300 mil" cambia a ingreso, salvo que la persona ya haya elegido el tipo.
      ...(!typeTouched &&
        read.type !== f.type && { type: read.type, category: AI, kakeibo: null, card: read.type === 'gasto' ? startCard : CASH }),
    }));
  };

  /** Lo dictado ya viene separado: el monto va a su casilla y el resto a «¿En qué fue?». */
  const applyDraft = (draft) => {
    setTypeTouched(true);
    setManualAmount((typed) => typed || Boolean(draft.amount));
    setOptions([]);
    setForm((f) => ({
      ...f,
      type: draft.type,
      ...(draft.type !== f.type && { category: AI, kakeibo: null, card: draft.type === 'gasto' ? startCard : CASH }),
      amount: draft.amount ? String(Math.round(draft.amount)) : f.amount,
      description: draft.description ?? '',
      date: draft.date ?? f.date,
    }));
  };

  // De viaje, lo dictado en la barra rápida llega aquí para elegir la moneda antes de guardar.
  const { state: navigation } = useLocation();
  const [draftFromBar] = useState(() => navigation?.voiceDraft ?? null);
  useEffect(() => {
    if (draftFromBar) applyDraft(draftFromBar);
    // Solo al abrir: applyDraft cambia en cada render.
  }, [draftFromBar]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Al escribir en «Monto». Si el monto venía de la descripción, la descripción queda sin él. */
  const typeAmount = (raw) => {
    setOptions([]);
    setManualAmount(true);
    // `raw` ya viene limpio de MoneyInput ("1234.5", con centavos si la moneda los usa).
    set({ amount: raw, ...(!manualAmount && { description }) });
  };

  const reset = () => {
    setForm(empty(startCard));
    setResult(null);
    setAskBig(null);
    setOptions([]);
    setManualAmount(false);
    setTried(false);
    setDetails(false);
    setAllCategories(false);
    setTypeTouched(false);
    setCurrency(localCurrency());
    setManualRate('');
    setEditingRate(false);
    setTimeout(() => amountField.current?.focus(), 0);
  };

  const save = async () => {
    // El botón no se apaga: si falta algo, lleva a esa casilla y dice qué escribir.
    if (missing) {
      setTried(true);
      if (missing === 'rate') setEditingRate(true);
      const field = { amount: amountField, description: descriptionField, rate: rateField }[missing];
      return setTimeout(() => field.current?.focus(), 0);
    }
    const checked = toTransaction({ ...form, amount: String(converted), description, card: cardOk ? form.card : CASH });
    if (checked.error) return setError(checked.error);
    // El servidor vuelve a calcular el monto con lo pagado allá y la tasa.
    const values = foreign ? { ...checked.values, original: { currency, amount, rate: effectiveRate } } : checked.values;
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

  const loaded = (expense ? categories?.expense : categories?.income) ?? [];
  const mine = created.filter((c) => c.type === form.type);
  const list = [...mine, ...loaded.filter((c) => !mine.some((m) => m.key === c.key))];
  const shown = allCategories ? list : list.slice(0, VISIBLE_CATEGORIES);
  const amountError = tried && !amount;
  const descriptionError = tried && !description;

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
            {values.type === 'gasto' ? t('Gasto guardado') : t('Ingreso guardado')}
          </h1>
          <p className="mt-2 text-lg motion-safe:animate-done-in">
            {values.description} · {formatMoney(values.amount)}
          </p>
          <div className="mt-8 divide-y divide-white/30 rounded-2xl bg-white/15 px-4 motion-safe:animate-done-in">
            {offline ? (
              <p className="py-4 text-[15px]">{t('Guardado sin conexión. Se sincronizará cuando vuelva internet.')}</p>
            ) : (
              <>
                {money !== null && (
                  <p className="flex min-h-[60px] items-center justify-between gap-4 text-[15px]">
                    <span>{t('Tu saldo ahora')}</span>
                    <strong className="text-[17px] font-semibold tabular-nums">{formatMoney(money)}</strong>
                  </p>
                )}
                {left !== null ? (
                  <p className="flex min-h-[60px] items-center justify-between gap-4 text-[15px]">
                    <span>{t('Te quedan en')} {names[category] ?? category}</span>
                    <strong className="text-[17px] font-semibold tabular-nums">{formatMoney(left)}</strong>
                  </p>
                ) : (
                  category && (
                    <p className="flex min-h-[60px] items-center justify-between gap-4 text-[15px]">
                      <span>{transaction.source === 'ia' ? t('Categoría (sugerida por IA)') : t('Categoría')}</span>
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
              {t('Volver al inicio')}
            </Link>
          </Button>
          <Button size="lg" variant="ghost" className="text-white hover:bg-white/10 hover:text-white" onClick={reset}>
            {t('Anotar otro')}
          </Button>
        </div>
      </div>
    );
  }

  const kakeiboHint = KAKEIBO.find((k) => k.key === form.kakeibo)?.hint;

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col gap-4 max-md:overflow-x-hidden max-md:motion-safe:animate-screen-up max-md:bg-surface max-md:fixed max-md:inset-0 max-md:z-50 max-md:max-w-none max-md:overflow-y-auto max-md:px-4 max-md:pb-[max(1rem,env(safe-area-inset-bottom))] max-md:pt-[max(1rem,env(safe-area-inset-top))]">
      <div className="flex items-center gap-3">
        <h1 className="flex-1 text-2xl font-bold tracking-tight">{expense ? t('Anotar un gasto') : t('Anotar un ingreso')}</h1>
        <button
          type="button"
          aria-label={t('Cerrar sin anotar')}
          onClick={() => navigate('/app', { replace: true })}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-surface ring-1 ring-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>

      <Segmented
        label={t('Tipo de movimiento')}
        options={[
          { value: 'gasto', label: t('Gasto') },
          { value: 'ingreso', label: t('Ingreso') },
        ]}
        value={form.type}
        onChange={(type) => {
          setTypeTouched(true);
          set({ type, category: AI, kakeibo: null, card: type === 'gasto' ? startCard : CASH });
        }}
      />

      {/* Dos casillas a la vista: nadie tiene que adivinar que el monto y el «en qué» iban juntos. */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="anotar-monto">
            {t('Monto')} <span className="text-negative">*</span>
          </Label>
          {/* De viaje: se paga en la moneda de allá (por defecto) o en la propia. */}
          {isAbroad() && (
            <Segmented
              label={t('Moneda del gasto')}
              options={[
                { value: local, label: local },
                { value: main, label: main },
              ]}
              value={currency}
              onChange={(next) => (setCurrency(next), setManualRate(''), setEditingRate(false))}
              className="w-[140px]"
            />
          )}
        </div>
        <div className="relative">
          <span
            ref={symbolRef}
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute left-4 top-0 flex h-14 items-center text-[28px] font-extrabold',
              amount ? 'text-ink' : 'text-ink/35',
            )}
          >
            {symbol}
          </span>
          <MoneyInput
            ref={amountField}
            id="anotar-monto"
            value={form.amount}
            onChange={typeAmount}
            placeholder="0"
            autoFocus
            enterKeyHint="next"
            onKeyDown={(event) => event.key === 'Enter' && (event.preventDefault(), descriptionField.current?.focus())}
            aria-invalid={amountError || undefined}
            aria-describedby={amountError ? 'anotar-monto-error' : undefined}
            // Los avisos del campo ("¿faltan ceros?") piensan en la moneda propia.
            showHint={!foreign}
            // El símbolo cambia de largo ("$", "US$", "MXN"): el texto empieza 8 px después de él.
            style={{ paddingLeft: 16 + symbolWidth + 8 }}
            className="h-14 text-[28px] font-extrabold tracking-tight tabular-nums"
          />
        </div>
        {amountError && (
          <p id="anotar-monto-error" className="text-[13px] text-negative">
            {expense ? t('Escribe cuánto gastaste.') : t('Escribe cuánto te entró.')}
          </p>
        )}
        {/* En otra moneda: cuánto es en la propia y con qué tasa. La tasa se puede corregir. */}
        {foreign && (
          <div aria-live="polite" className="flex flex-wrap items-center gap-x-2 text-[13px] text-ink/70">
            {rate.status === 'loading' && !manualRate ? (
              <span>{t('Buscando la tasa del día…')}</span>
            ) : effectiveRate > 0 ? (
              <span>
                {amount > 0 && (
                  <>
                    ≈ <b className="font-semibold text-ink">{formatMoney(converted)}</b> ·{' '}
                  </>
                )}
                {effectiveRate >= 1
                  ? `1 ${currency} = ${formatMoney(effectiveRate)}`
                  : `1 ${main} = ${formatIn(Math.round(100 / effectiveRate) / 100, currency)}`}
                {rate.stale && !manualRate && t(' (del {date})', { date: formatDate(rate.date) })}
              </span>
            ) : (
              <span>{t('No pudimos traer la tasa. Escríbela abajo.')}</span>
            )}
            {!editingRate && effectiveRate > 0 && (
              <button
                type="button"
                onClick={() => (setEditingRate(true), setTimeout(() => rateField.current?.focus(), 0))}
                className="inline-flex min-h-11 items-center font-semibold text-brand focus-visible:outline-2 focus-visible:outline-violet"
              >
                {t('Corregir tasa')}
              </button>
            )}
          </div>
        )}
        {foreign && (editingRate || rate.status === 'error') && (
          <div className="space-y-1.5">
            <Label htmlFor="anotar-tasa">
              1 {currency} {t('= ¿cuántos')} {main}?
            </Label>
            <Input
              ref={rateField}
              id="anotar-tasa"
              inputMode="decimal"
              autoComplete="off"
              value={manualRate}
              placeholder={rate.value ? String(rate.value).replace('.', ',') : ''}
              onChange={(event) => setManualRate(event.target.value.replace(/[^\d.,]/g, ''))}
              aria-invalid={(tried && missing === 'rate') || undefined}
              aria-describedby="anotar-tasa-ayuda"
              className="w-40"
            />
            <p id="anotar-tasa-ayuda" className={cn('text-[13px]', tried && missing === 'rate' ? 'text-negative' : 'text-ink/60')}>
              {tried && missing === 'rate' ? t('Escribe la tasa para poder convertir.') : t('La de tu banco o casa de cambio, si la sabes.')}
            </p>
          </div>
        )}
        {options.length > 1 && (
          <div role="group" aria-label={t('¿Cuál es el monto?')} className="flex flex-wrap items-center gap-2 pt-1 text-[13px]">
            <span className="text-ink/70">{t('¿Cuál es el monto?')}</span>
            {options.map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={Number(form.amount) === value}
                onClick={() => (setManualAmount(true), set({ amount: String(Math.round(value)), description }))}
                className={cn(
                  'h-11 rounded-lg px-3 font-semibold focus-visible:outline-2 focus-visible:outline-violet',
                  Number(form.amount) === value ? 'bg-brand text-white' : 'bg-surface ring-1 ring-ink/10',
                )}
              >
                {formatMoney(value)}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="anotar-descripcion">
          {expense ? t('¿En qué fue?') : t('¿De qué fue?')} <span className="text-negative">*</span>
        </Label>
        <div className="relative">
          <Sparkles className="pointer-events-none absolute left-3.5 top-1/2 size-5 -translate-y-1/2 text-brand" aria-hidden="true" />
          <Input
            ref={descriptionField}
            id="anotar-descripcion"
            value={form.description}
            onChange={(event) => write(event.target.value)}
            placeholder={expense ? t('almuerzo, taxi, arriendo…') : t('salario, venta, freelance…')}
            autoComplete="off"
            enterKeyHint="done"
            onKeyDown={(event) => event.key === 'Enter' && !event.nativeEvent.isComposing && save()}
            aria-invalid={descriptionError || undefined}
            aria-describedby="anotar-ayuda"
            className="h-12 pl-11 pr-12 text-base"
          />
          <button
            type="button"
            aria-label={t('Dictarlo')}
            onClick={() => setVoice(true)}
            className="absolute right-0.5 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full text-brand hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-violet"
          >
            <Mic className="size-5" aria-hidden="true" />
          </button>
        </div>
        <p id="anotar-ayuda" className={cn('text-[13px]', descriptionError ? 'text-negative' : 'text-ink/60')}>
          {descriptionError
            ? `Escribe ${expense ? t('en qué fue, p. ej. «almuerzo»') : t('de qué fue, p. ej. «salario»')}.`
            : t('O toca el micrófono y dilo: «almuerzo 15 mil» llena las dos casillas.')}
        </p>
      </div>

      {/* Categoría y Kakeibo: la IA elige si no se toca nada. */}
      <section aria-label={t('Categoría')} className="flex flex-col gap-3 rounded-2xl bg-canvas p-4">
        <div className="flex flex-col gap-1.5">
          <p id="anotar-categoria" className="text-xs font-semibold uppercase tracking-[0.08em] text-ink/60">
            {t('Categoría')}
          </p>
          <ul aria-labelledby="anotar-categoria" className="flex flex-wrap gap-1.5">
            <li>
              <button
                type="button"
                aria-pressed={form.category === AI}
                onClick={() => set({ category: AI })}
                className={cn(
                  'flex h-11 items-center gap-1 rounded-lg px-2.5 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                  form.category === AI ? 'bg-brand text-white' : 'bg-brand-soft text-ink',
                )}
              >
                <Sparkles className="size-3.5" aria-hidden="true" />
                {t('Que la elija la IA')}
              </button>
            </li>
            {shown.map((c) => (
              <li key={c.key}>
                <button
                  type="button"
                  aria-pressed={form.category === c.key}
                  onClick={() => set({ category: c.key })}
                  className={cn(
                    'h-11 rounded-lg px-3 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-violet',
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
                  className="h-11 rounded-lg bg-surface px-3 text-[13px] font-semibold text-brand ring-1 ring-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
                >
                  {t('Ver todas')}
                </button>
              </li>
            )}
            <li>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex h-11 items-center gap-1 rounded-lg bg-surface px-3 text-[13px] font-semibold text-brand ring-1 ring-ink/10 focus-visible:outline-2 focus-visible:outline-violet"
              >
                <Plus className="size-3.5" aria-hidden="true" />
                {t('Nueva')}
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
              {t('¿Podías evitarlo?')} <span className="font-normal normal-case tracking-normal">{t('(opcional)')}</span>
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
              {kakeiboHint ?? t('Necesidad, deseo, cultura o imprevisto: te ayuda a ver en qué podrías ahorrar.')}
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
            <b className="font-semibold">{t('Más detalles')}</b>
            <span className="text-ink/60">
              {' '}
              · {form.date === today() ? t('Hoy') : form.date}
              {expense && ` · ${form.card === CASH || !cardOk ? t('Efectivo o débito') : t('Tarjeta')}`}
              {(form.files?.length ?? 0) > 0 && t(' · {length} soporte{v2}', { length: form.files.length, v2: form.files.length === 1 ? '' : 's' })}
            </span>
          </span>
          <ChevronDown className={cn('size-5 shrink-0 transition-transform', details && 'rotate-180')} aria-hidden="true" />
        </button>
        {details && (
          <div id="anotar-detalles" className="flex flex-col gap-5 border-t border-ink/10 p-4">
            <DateQuickPick value={form.date} onChange={(date) => set({ date })} />
            {expense && cards.data?.length > 0 && (
              <ChipGroup
                legend={t('Pagado con')}
                options={[
                  { value: CASH, label: t('Efectivo o débito') },
                  ...cards.data.map((c) => ({ value: c.id, label: `${NETWORK_LABELS[c.network] ?? c.name} ••${c.last4}` })),
                ]}
                value={form.card}
                onChange={(card) => set({ card })}
              />
            )}
            {expense && form.card !== CASH && cardOk && (
              <div className="space-y-1.5">
                <Label htmlFor="anotar-cuotas">{t('Cuotas')}</Label>
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
                  {t('De 1 a 48. A más de una cuota el banco suele cobrar intereses.')}
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
      {askBig === converted && <BigAmountWarning amount={converted} />}
      <Button size="lg" className="mt-auto" disabled={saving} onClick={save}>
        {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
        {askBig === converted
          ? t('Sí, guardar {converted}', { converted: formatMoney(converted) })
          : `${expense ? t('Guardar gasto') : t('Guardar ingreso')}${converted ? ` · ${formatMoney(converted)}` : ''}`}
      </Button>

      <VoiceEntry
        open={voice}
        autoStart
        names={names}
        onClose={() => setVoice(false)}
        onEdit={(draft) => {
          setVoice(false);
          if (draft) applyDraft(draft);
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
