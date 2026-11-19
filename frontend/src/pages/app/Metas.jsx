import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Briefcase, Loader2, PiggyBank, Plus } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import MoneyInput from '@/components/common/MoneyInput';
import RindeLine from '@/components/common/RindeLine';
import ShortcutGrid from '@/components/common/ShortcutGrid';
import Sheet from '@/components/common/Sheet';
import PageHeader from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';
import { DEFAULT_CATEGORY } from '@/components/vacas/ContributionForm';
import VacaForm from '@/components/vacas/VacaForm';
import { deadlineText, formatPercent, formatPesos, todayIso } from '@/components/vacas/vacaFormat';
import useAsync from '@/hooks/useAsync';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { cushion, isCushionGoal, monthlyFixed, shortDate } from '@/lib/goalPlan';
import { runway, untilText } from '@/lib/runway';
import { getMoneyProfile } from '@/services/moneyProfileService';
import { getSummary } from '@/services/summaryService';
import { createVaca, listVacas } from '@/services/vacaService';
import { t } from '@/lib/i18n';

/** Lo que se maneja con otras personas, dentro de la pestaña Metas. */
const IN_GROUP = [
  { to: '/app/vacas', label: t('Vacas'), hint: t('Ahorrar con amigos'), icon: PiggyBank },
  { to: '/app/negocios', label: t('Negocios'), hint: t('Cuentas con socios'), icon: Briefcase },
];

/** Una meta es una vaca de una sola persona; las vacas en grupo salen en `/app/vacas`. */
const isPersonal = (vaca) => Boolean(vaca.personal);

/**
 * El colchón (lienzo «Metas»): la meta de 3 meses de gastos fijos y cuántos días se aguanta hoy sin
 * ingresos. Si aún no hay una meta de emergencia, invita a crearla con la cifra ya puesta.
 * @param {{ fixed: number, meta: object|undefined, onCreate: () => void, online: boolean }} props
 */
function CushionCard({ fixed, meta, onCreate, online }) {
  const saved = meta?.total ?? 0;
  const c = cushion({ fixed, saved });
  if (!c) {
    return (
      <section className="rounded-3xl bg-obsidian p-5 text-white ring-1 ring-white/10">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-success">{t('Tu colchón')}</p>
        <h2 className="mt-1 text-lg font-semibold">{t('Fondo de emergencia')}</h2>
        <p className="mt-2 text-sm text-white/75">
          {t('Anota tus pagos fijos en Mi plata y te decimos cuánto necesitas para aguantar 3 meses sin ingresos.')}
        </p>
        <Link to="/app/mi-plata/pagos" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-success">
          {t('Anotar pagos fijos')}
        </Link>
      </section>
    );
  }
  const goal = meta?.goal ?? c.goal;
  const body = (
    <>
      <span className="flex items-start justify-between gap-3">
        <span>
          <span className="block text-xs font-semibold uppercase tracking-[0.08em] text-success">{t('Tu colchón')}</span>
          <span className="mt-1 block text-lg font-semibold">{meta?.name ?? t('Fondo de emergencia')}</span>
        </span>
        <span className="shrink-0 rounded-full bg-white/15 px-2.5 py-1 text-xs font-semibold">{t('Meta: 3 meses')}</span>
      </span>
      <span className="mt-3 flex items-baseline gap-1.5 tabular-nums">
        <b className="text-[28px] font-extrabold tracking-tight">{formatPesos(saved)}</b>
        <span className="text-sm text-white/70">{t('de')} {formatPesos(goal)}</span>
      </span>
      <RindeLine value={goal > 0 ? saved / goal : 0} className="mt-2" />
      <span className="mt-3 block text-sm text-white/80">
        {saved > 0 ? (
          <>
            {t('Hoy aguantas')} <b className="font-semibold text-white">{c.days === 1 ? t('1 día') : t('{days} días', { days: c.days })}</b> {t('sin ingresos.')}{' '}
          </>
        ) : (
          t('Aún no tienes colchón. ')
        )}
        {t('La meta es 3 meses de tus gastos fijos (')}{formatPesos(fixed)} {t('al mes).')}
      </span>
    </>
  );
  return meta ? (
    <Link
      to={`/app/metas/${meta.id}`}
      className="block rounded-3xl bg-obsidian p-5 text-white ring-1 ring-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet"
    >
      {body}
    </Link>
  ) : (
    <section className="rounded-3xl bg-obsidian p-5 text-white ring-1 ring-white/10">
      {body}
      <Button className="mt-4 rounded-full bg-white text-obsidian hover:bg-white/90" onClick={onCreate} disabled={!online}>
        {t('Crear mi colchón')}
      </Button>
    </section>
  );
}

/** "Vas bien" / "Vas lento" / "Cumplida" según la proyección. */
function paceChip(meta) {
  if (meta.status === 'completada') return { label: t('Cumplida'), className: 'bg-success/15 text-positive', dot: true };
  if (meta.status === 'vencida') return { label: t('Venció'), className: 'bg-negative/10 text-negative' };
  if (meta.projection.onTrack === true) return { label: t('Vas bien'), className: 'bg-success/15 text-positive', dot: true };
  if (meta.projection.onTrack === false) return { label: t('Vas lento'), className: 'bg-brand-soft text-brand' };
  return null;
}

/** Qué hacer para llegar: el plan por semana, cuándo se completa a este ritmo o cómo empezar. */
function adviceText(meta) {
  const p = meta.projection;
  if (meta.status === 'completada') return t('Ya completaste la meta.');
  if (meta.deadline && p.neededPerWeek > 0) return t('Si apartas {formatPesos} cada semana, llegas a tiempo.', { formatPesos: formatPesos(Math.ceil(p.neededPerWeek / 1000) * 1000) });
  if (p.estimatedDate) return t('A tu ritmo la completas el {estimatedDate}.', { estimatedDate: shortDate(p.estimatedDate) });
  return t('Aparta algo hoy para arrancar.');
}

/**
 * Tarjeta de una meta (lienzo «Metas»): para cuándo, cuánto lleva, si va a tiempo, qué hacer y el botón
 * para apartar plata sin entrar al detalle.
 * @param {{ meta: import('@/services/vacaService').Vaca, onSave: () => void, online: boolean }} props
 */
function MetaCard({ meta, onSave }) {
  const chip = paceChip(meta);
  const days = meta.projection.daysLeft;
  return (
    <li className="relative min-w-0 rounded-3xl bg-surface p-5 ring-1 ring-ink/10">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 break-words text-lg font-semibold tracking-tight">
            {/* El enlace cubre la tarjeta; el botón de apartar queda encima. */}
            <Link to={`/app/metas/${meta.id}`} className="after:absolute after:inset-0 after:rounded-3xl focus-visible:outline-2 focus-visible:outline-violet">
              {meta.name}
            </Link>
          </h3>
          <p className="mt-0.5 text-sm text-ink/60">
            {meta.deadline
              ? t('Para el {deadline}{v2}', { deadline: shortDate(meta.deadline), v2: days > 0 ? ` · faltan ${days === 1 ? t('1 día') : `${days} días`}` : '' })
              : deadlineText(meta, { withDate: false })}
          </p>
        </div>
        {chip && (
          <span className={cn('inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold', chip.className)}>
            {chip.dot && <span aria-hidden="true" className="size-1.5 rounded-full bg-success" />}
            {chip.label}
          </span>
        )}
      </div>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
        <span className="text-[26px] font-extrabold tracking-tight">{formatPesos(meta.total)}</span>
        <span className="text-sm text-ink/60">{t('de')} {formatPesos(meta.goal)}</span>
      </p>
      <RindeLine tone="surface" value={meta.goal > 0 ? meta.total / meta.goal : 0} className="mt-2" />
      <span className="sr-only">
        {t('Avance:')} {formatPercent(meta.percentage)}
      </span>
      <p className="mt-3 text-sm text-ink/70">{adviceText(meta)}</p>
      {meta.status === 'activa' && (
        <Button variant="outline" className="relative z-10 mt-3 rounded-full" onClick={onSave}>
          {t('Apartar plata')}
        </Button>
      )}
    </li>
  );
}

/**
 * Hoja «Apartar plata» (lienzo «Apartar»): cuánto apartar hoy (propone el plan de la semana), cómo
 * queda la meta y hasta cuándo alcanzaría Mi plata después. El aporte queda como gasto de ahorro y
 * funciona sin conexión (se envía solo al volver).
 * @param {{ meta: object, balance: number|null|undefined, monthExpense: number|undefined, onDone: (result: object) => void }} props
 */
function SaveSheet({ meta, balance, monthExpense, onDone }) {
  const suggested = meta.projection.neededPerWeek > 0 ? Math.ceil(meta.projection.neededPerWeek / 1000) * 1000 : null;
  const [amount, setAmount] = useState(suggested ? String(Math.min(suggested, meta.projection.remaining)) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const value = Number(amount) || 0;
  const after = meta.total + value;
  const pct = meta.goal > 0 ? Math.min(100, Math.round((after / meta.goal) * 100)) : 0;
  const now = typeof balance === 'number' ? runway({ balance, monthExpense }) : null;
  const then = typeof balance === 'number' ? runway({ balance: balance - value, monthExpense }) : null;

  const save = async (event) => {
    event.preventDefault();
    if (!(value > 0)) return setError(t('Escribe cuánto vas a apartar'));
    setBusy(true);
    setError('');
    try {
      const queue = await import('@/offline/vacaQueue');
      const result = await queue.saveContribution(meta.id, { amount: value, date: todayIso(), note: null, category: DEFAULT_CATEGORY });
      onDone(result, value);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} noValidate className="space-y-4" aria-label={t('Apartar para {name}', { name: meta.name })}>
      <FormField id="apartar-monto" label={t('¿Cuánto apartas hoy?')} error={error}>
        <MoneyInput name="amount" value={amount} onChange={setAmount} placeholder="0" disabled={busy} />
      </FormField>
      {suggested && (
        <button
          type="button"
          onClick={() => setAmount(String(Math.min(suggested, meta.projection.remaining)))}
          className="-mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-brand-soft px-3 text-sm font-semibold text-brand"
        >
          {formatPesos(Math.min(suggested, meta.projection.remaining))} {t('· tu plan')}
        </button>
      )}
      <div className="rounded-2xl bg-ink/5 p-4">
        <p className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.08em] text-ink/60">
          {t('La meta queda en')} <span className="text-lg font-extrabold tracking-tight text-ink tabular-nums">{pct} %</span>
        </p>
        <RindeLine tone="surface" value={pct / 100} className="mt-2" />
        <p className="mt-2 text-sm tabular-nums text-ink/70">
          <b className="font-semibold text-ink">{formatPesos(after)}</b> {t('de')} {formatPesos(meta.goal)}
        </p>
      </div>
      {then && now && value > 0 && (
        <p className="text-[15px]">
          <b className="font-semibold">{t('Mi plata te alcanzaría')} {then.lasts ? t('hasta después de fin de mes') : untilText(then)}</b>{' '}
          <span className="text-ink/60">{t('(hoy:')} {now.lasts ? 'pasa el fin de mes' : untilText(now).replace('hasta el ', '')}).</span>{' '}
          {then.days < now.days ? t('Apartar también es gastar: revisa que te quede para el mes.') : t('Sigues cubierto.')}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full rounded-full" disabled={busy}>
        {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
        {value > 0 ? t('Apartar {value}', { value: formatPesos(value) }) : t('Apartar')}
      </Button>
    </form>
  );
}

/**
 * Página privada `/app/metas`: metas de ahorro personales (la moto, el semestre, un viaje). Por
 * dentro son vacas de una sola persona, sin invitaciones ni cuotas: aportar deja el gasto de ahorro
 * en los movimientos y saca la plata del saldo disponible. Sin conexión muestra la última lista.
 */
export default function Metas() {
  usePageTitle(t('Metas'));
  const online = useOnlineStatus();
  const navigate = useNavigate();
  const [metas, setMetas] = useState(null);
  const [error, setError] = useState('');
  const [fromCache, setFromCache] = useState(false);
  /** `false` cerrado; `{}` meta nueva; `{ name, goal }` el colchón con la cifra puesta. */
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(null);
  const [notice, setNotice] = useState('');
  const profile = useAsync(getMoneyProfile, [online]);
  const summary = useAsync(() => getSummary('month', todayIso()), [online]);
  const fixed = monthlyFixed(profile.data?.commitments);
  const income = summary.data?.income.total ?? 0;
  const weeklyIncome = income > 0 ? Math.round(income / Math.max(1, new Date().getDate() / 7)) : null;
  const [version, setVersion] = useState(0);
  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const queue = await import('@/offline/vacaQueue');
      try {
        // La lista guardada en el dispositivo es la misma de Vacas: se pide completa y se filtra.
        const data = await listVacas();
        if (cancelled) return;
        setMetas(data.filter(isPersonal));
        setFromCache(false);
        setError('');
        queue.cacheVacaList(data).catch(() => {});
      } catch (err) {
        if (cancelled) return;
        const cached = await queue.getCachedVacaList().catch(() => null);
        if (cancelled) return;
        if (cached) {
          setMetas(cached.filter(isPersonal));
          setFromCache(true);
        } else {
          setError(err.message);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [version, online]);

  const cushionMeta = metas?.find(isCushionGoal);
  const others = metas?.filter((m) => m !== cushionMeta) ?? [];
  const handleSaved = (result, value) => {
    setSaving(null);
    setNotice(
      result.queued
        ? t('Sin conexión: lo que apartaste quedó en el dispositivo y se envía solo al volver internet.')
        : t('Apartaste {value}. También quedó en tus movimientos.', { value: formatPesos(value) }),
    );
    reload();
  };

  const handleCreate = async (values) => {
    const meta = await createVaca({ ...values, personal: true });
    navigate(`/app/metas/${meta.id}`, { state: { created: true } });
  };

  return (
    <>
      <PageHeader title={t('¿Para qué estás ahorrando?')} description={t('Cada peso que apartas sale de tu plata disponible.')} />

      {fromCache && (
        <p className="mb-3 text-sm text-ink/60">{t('Sin conexión: es la última lista guardada en este dispositivo.')}</p>
      )}
      {notice && (
        <p role="status" className="mb-3 rounded-xl bg-success/10 px-4 py-2.5 text-sm">
          {notice}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-3 text-sm text-negative">
          {error}{' '}
          <button type="button" className="underline" onClick={reload}>
            {t('Reintentar')}
          </button>
        </p>
      )}

      {metas === null && !error ? (
        <div className="space-y-3" aria-busy="true">
          <div className="h-44 animate-pulse rounded-3xl bg-ink/10" />
          <div className="h-48 animate-pulse rounded-3xl bg-ink/5" />
        </div>
      ) : (
        metas && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="lg:col-span-2 xl:col-span-1">
              <CushionCard
                fixed={fixed}
                meta={cushionMeta}
                online={online}
                onCreate={() => setCreating({ name: t('Fondo de emergencia'), goal: fixed * 3 })}
              />
            </div>
            {others.length > 0 ? (
              <ul aria-label={t('Mis metas')} className="contents">
                {others.map((meta) => (
                  <MetaCard key={meta.id} meta={meta} onSave={() => setSaving(meta)} />
                ))}
              </ul>
            ) : (
              <p className="rounded-3xl bg-surface p-5 text-ink/70 ring-1 ring-ink/10">
                {t('Ponle nombre y fecha a lo que quieres (la moto, el semestre, un viaje) y Rinde te dice cuánto apartar cada semana.')}
              </p>
            )}
          </div>
        )
      )}

      <Button size="lg" className="mt-4 w-full rounded-full lg:w-auto" onClick={() => setCreating({})} disabled={!online}>
        <Plus aria-hidden="true" /> {t('Nueva meta')}
      </Button>

      {/* Rinde v2: en el celular, las metas en grupo se abren desde aquí (antes, desde el menú lateral). */}
      <div className="mt-8 md:hidden">
        <ShortcutGrid id="metas-en-grupo" title={t('En grupo')} items={IN_GROUP} />
      </div>

      <Sheet open={Boolean(creating)} title={t('¿Para qué quieres ahorrar?')} onClose={() => setCreating(false)}>
        <VacaForm
          personal
          prefill={creating || undefined}
          weeklyIncome={weeklyIncome}
          disabled={!online}
          onSubmit={handleCreate}
          onCancel={() => setCreating(false)}
        />
      </Sheet>
      <Sheet open={saving !== null} title={saving ? t('Apartar para {name}', { name: saving.name }) : ''} onClose={() => setSaving(null)}>
        {saving && (
          <SaveSheet
            key={saving.id}
            meta={saving}
            balance={profile.data?.money}
            monthExpense={summary.data?.expense.total}
            onDone={handleSaved}
          />
        )}
      </Sheet>
    </>
  );
}
