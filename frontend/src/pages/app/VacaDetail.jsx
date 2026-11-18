import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, HandCoins, Loader2, LogOut, MoreHorizontal, Pencil, Target, Trash2, UserPlus } from 'lucide-react';
import ConfirmButton from '@/components/common/ConfirmButton';
import Sheet from '@/components/common/Sheet';
import Tabs from '@/components/common/Tabs';
import VacaCalendar from '@/components/vacas/VacaCalendar';
import Panel from '@/components/layout/Panel';
import { formatDate } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import AdviceCard from '@/components/vacas/AdviceCard';
import ContributionForm from '@/components/vacas/ContributionForm';
import ContributionList from '@/components/vacas/ContributionList';
import InvitePanel from '@/components/vacas/InvitePanel';
import MemberList from '@/components/vacas/MemberList';
import VacaForm from '@/components/vacas/VacaForm';
import VacaProgress from '@/components/vacas/VacaProgress';
import { MEMBER_STATUS, VACA_STATUS, deadlineText, formatPercent, formatPesos } from '@/components/vacas/vacaFormat';
import { useAuth } from '@/auth/AuthContext';
import useOnlineStatus from '@/hooks/useOnlineStatus';
import usePageTitle from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { getCategories } from '@/services/transactionService';
import {
  cancelInvitation,
  deleteContribution,
  deleteVaca,
  getVaca,
  inviteByEmail,
  makePersonal,
  regenerateCode,
  removeMember,
  sendReminders,
  updateMember,
  updateVaca,
} from '@/services/vacaService';
import { t } from '@/lib/i18n';

/** Cada cuánto se vuelve a pedir la vaca mientras la pantalla está a la vista (aportes de otros). */
const REFRESH_MS = 15_000;

/** `@/offline/vacaQueue` (con Dexie) se carga aparte para no engordar el bundle de la página. */
const loadQueue = () => import('@/offline/vacaQueue');

/**
 * Una cifra del resumen.
 * @param {{ label: string, value: string, hint?: string, className?: string }} props
 */
function Stat({ label, value, hint, className }) {
  return (
    <div className={cn('min-w-0 rounded-xl bg-ink/5 p-3', className)}>
      <dt className="text-xs text-ink/60">{label}</dt>
      <dd className="mt-0.5 break-words font-semibold tabular-nums">{value}</dd>
      {hint && <dd className="mt-0.5 break-words text-xs text-ink/60">{hint}</dd>}
    </div>
  );
}

/**
 * Página privada `/app/vacas/:id` (FT-0015) y `/app/metas/:id` (meta personal: la misma pantalla sin
 * miembros, invitaciones ni recordatorios).: seguimiento de aportes de una vaca. Arriba, el avance
 * del grupo con las dos acciones principales (aportar e invitar); debajo, miembros y aportes en
 * pestañas y si van a tiempo. Aportar, invitar y los ajustes se abren en una ventana.
 * Aportar funciona sin conexión. Se actualiza sola cada 15 s, al volver a la pestaña y al recuperar
 * la conexión, para ver los aportes de los demás.
 */
export default function VacaDetail() {
  const { id } = useParams();
  const { state, pathname } = useLocation();
  // Se sabe por la ruta antes de cargar la meta, para que "volver" lleve al lugar correcto.
  const inMetas = pathname.startsWith('/app/metas');
  const home = inMetas ? { to: '/app/metas', label: t('Mis metas') } : { to: '/app/vacas', label: t('Mis vacas') };
  const navigate = useNavigate();
  const online = useOnlineStatus();
  const { user } = useAuth();
  const [vaca, setVaca] = useState(null);
  const [error, setError] = useState('');
  const [gone, setGone] = useState(false);
  const [fromCache, setFromCache] = useState(false);
  const [pending, setPending] = useState([]);
  const [categories, setCategories] = useState([]);
  const [notice, setNotice] = useState(
    state?.created
      ? inMetas
        ? t('Meta creada. Aporta cuando quieras: cada aporte queda en tus movimientos.')
        : t('Vaca creada. Invita a los demás con el enlace o el código.')
      : state?.joined
        ? t('¡Ya eres parte de la vaca!')
        : state?.movedToMetas
          ? t('Listo: ahora está en tus Metas, con todos tus aportes.')
          : '',
  );
  const [sheet, setSheet] = useState(state?.created && !inMetas ? 'invitar' : null); // 'aportar' | 'invitar' | 'opciones' | 'editar'
  const [tab, setTab] = useState(inMetas ? 'aportes' : 'miembros');
  const loading = useRef(false);
  usePageTitle(vaca?.name ?? (inMetas ? t('Meta') : t('Vaca')));

  const refreshPending = useCallback(async () => {
    const queue = await loadQueue();
    setPending(await queue.listPendingContributions(id).catch(() => []));
  }, [id]);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    const queue = await loadQueue();
    try {
      const data = await getVaca(id);
      setVaca(data);
      setFromCache(false);
      setError('');
      queue.cacheVaca(data).catch(() => {});
    } catch (err) {
      if (err.code === 'NOT_FOUND') {
        setGone(true);
        queue.uncacheVaca(id).catch(() => {});
      } else {
        const cached = await queue.getCachedVaca(id).catch(() => null);
        if (cached) {
          setVaca((current) => current ?? cached);
          setFromCache(true);
        } else {
          setError(err.message);
        }
      }
    } finally {
      loading.current = false;
    }
  }, [id]);

  // Carga inicial, aportes pendientes y los que se hayan quedado de antes.
  useEffect(() => {
    setVaca(null);
    setGone(false);
    load();
    refreshPending();
    loadQueue().then((queue) => queue.flushContributions());
  }, [load, refreshPending]);

  useEffect(() => {
    getCategories()
      .then((all) => setCategories(all.expense))
      .catch(() => {});
  }, []);

  // Aportes de los demás: se pide de nuevo cada 15 s con la pantalla a la vista y al volver a ella.
  useEffect(() => {
    if (!online) return undefined;
    const tick = () => document.visibilityState === 'visible' && load();
    const timer = setInterval(tick, REFRESH_MS);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, [online, load]);

  // Al volver la conexión se envían los pendientes; cada envío se anuncia y refresca la pantalla.
  useEffect(() => {
    let cleanup = () => {};
    let cancelled = false;
    loadQueue().then(({ VACA_SYNC_EVENT, flushContributions }) => {
      if (cancelled) return;
      const onSync = ({ detail }) => {
        if (detail.vacaId && detail.vacaId !== id) return;
        refreshPending();
        if (detail.synced) load();
        if (detail.fromQueue) setNotice(t('Se envió tu aporte que estaba pendiente.'));
        if (detail.rejected) setNotice('');
      };
      const onOnline = () => flushContributions().then(load);
      window.addEventListener(VACA_SYNC_EVENT, onSync);
      window.addEventListener('online', onOnline);
      cleanup = () => {
        window.removeEventListener(VACA_SYNC_EVENT, onSync);
        window.removeEventListener('online', onOnline);
      };
    });
    return () => {
      cancelled = true;
      cleanup();
    };
  }, [id, load, refreshPending]);

  /** Ejecuta una acción que devuelve la vaca actualizada y la pinta. */
  const apply = async (action, message) => {
    const updated = await action();
    if (updated) setVaca(updated);
    setNotice(message ?? '');
    if (updated) loadQueue().then((queue) => queue.cacheVaca(updated));
  };

  const handleContribute = async (values) => {
    const queue = await loadQueue();
    const result = await queue.saveContribution(id, values);
    setSheet(null);
    setTab('aportes');
    if (result.queued) {
      setNotice(t('Sin conexión: tu aporte quedó guardado en el dispositivo y se envía solo al volver internet.'));
      refreshPending();
    } else {
      setVaca(result.result.vaca);
      setNotice(t('Aporte de {amount} registrado. También quedó en tus movimientos.', { amount: formatPesos(values.amount) }));
    }
  };

  const handleDeleteContribution = async (contributionId) => {
    const { transactionId } = await deleteContribution(id, contributionId);
    if (transactionId) import('@/offline/sync').then((m) => m.uncacheTransaction(transactionId)).catch(() => {});
    setNotice(t('Aporte borrado, junto con su gasto.'));
    await load();
  };

  const handleDiscard = async (localId) => {
    const queue = await loadQueue();
    await queue.discardPendingContribution(localId);
    refreshPending();
  };

  const leave = async () => {
    await removeMember(id, user.id);
    (await loadQueue()).uncacheVaca(id).catch(() => {});
    navigate(home.to, { replace: true });
  };

  const remove = async () => {
    await deleteVaca(id);
    (await loadQueue()).uncacheVaca(id).catch(() => {});
    navigate(home.to, { replace: true });
  };

  /** Pasa la vaca a Metas (FT-0066) y abre la meta. */
  const toMetas = async () => {
    const meta = await makePersonal(id);
    (await loadQueue()).cacheVaca(meta).catch(() => {});
    navigate(`/app/metas/${meta.id}`, { replace: true, state: { movedToMetas: true } });
  };

  if (gone) {
    return (
      <Panel className="mx-auto max-w-lg text-center">
        <p className="text-lg font-semibold">{inMetas ? t('Esta meta ya no está disponible') : t('Esta vaca ya no está disponible')}</p>
        <p className="mt-1 text-ink/60">{inMetas ? t('Se eliminó.') : t('Se eliminó o ya no eres miembro.')}</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to={home.to}>{inMetas ? t('Ir a mis metas') : t('Ir a mis vacas')}</Link>
        </Button>
      </Panel>
    );
  }

  if (!vaca) {
    return error ? (
      <p role="alert" className="text-negative">
        {error}{' '}
        <button type="button" className="underline" onClick={load}>
          {t('Reintentar')}
        </button>
      </p>
    ) : (
      <p className="flex items-center gap-2 py-10 text-ink/60">
        <Loader2 className="animate-spin" aria-hidden="true" /> {t('Cargando…')}
      </p>
    );
  }

  const status = VACA_STATUS[vaca.status];
  const mine = MEMBER_STATUS[vaca.myStatus];
  const isAdmin = vaca.role === 'admin';
  const personal = Boolean(vaca.personal);
  const noun = personal ? 'la meta' : 'la vaca';
  const pendingTotal = pending.filter((p) => !p.rejected).reduce((acc, p) => acc + p.contribution.amount, 0);
  const closeSheet = () => setSheet(null);
  // FT-0066: una vaca de un solo integrante, del que la creó, probablemente es una meta personal. No se
  // sugiere recién creada (todavía no ha invitado a nadie) ni si hay invitaciones pendientes.
  const soloVaca =
    !personal && isAdmin && vaca.membersCount === 1 && !fromCache && !state?.created && !vaca.invitations?.length;

  return (
    <>
      <Link
        to={home.to}
        className="mb-3 inline-flex items-center gap-1 text-sm text-ink/60 transition-colors hover:text-ink"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> {home.label}
      </Link>

      <header className="mb-5 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <h1 className="break-words text-2xl font-semibold tracking-tight md:text-3xl">{vaca.name}</h1>
          {vaca.description && <p className="mt-1 break-words text-ink/60">{vaca.description}</p>}
          <span className={cn('mt-2 inline-block rounded-full px-2.5 py-0.5 text-sm font-medium', status.chip)}>
            {status.label}
          </span>
        </div>
        <Button variant="outline" size="icon" className="shrink-0" onClick={() => setSheet('opciones')} aria-label={t('Opciones de {noun}', { noun })}>
          <MoreHorizontal aria-hidden="true" />
        </Button>
      </header>

      <p role="status" className={cn('text-sm text-positive', notice && 'mb-4')}>
        {notice}
      </p>
      {soloVaca && (
        <Panel aria-label={t('¿Es solo tuya?')} className="mb-4 flex flex-wrap items-center gap-3 border-brand/20 bg-brand-soft p-4 md:p-4">
          <p className="min-w-0 flex-1 text-sm">
            <b>{t('¿Es solo tuya?')}</b> {t('Nadie más está en esta vaca. Pásala a Metas: guardas tu avance y deja de pedirte que invites gente.')}
          </p>
          <ConfirmButton
            label={t('Pasar a Metas')}
            question={t('Se cancelan las invitaciones pendientes y ya no podrás invitar a nadie. Tus aportes se conservan.')}
            confirmLabel={t('Sí, pasar a Metas')}
            icon={Target}
            disabled={!online}
            onConfirm={toMetas}
          />
        </Panel>
      )}
      {fromCache && (
        <p className="mb-4 text-sm text-ink/60">
          {t('Sin conexión: ves la última versión guardada. Los aportes que hagas se envían al volver internet.')}
        </p>
      )}

      <Panel aria-label={t('Avance de {noun}', { noun })} className="mb-6">
        <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
          <p className="flex min-w-0 flex-wrap items-baseline gap-x-1.5 tabular-nums text-ink/60">
            <span className="text-3xl font-semibold tracking-tight text-ink md:text-4xl">{formatPesos(vaca.total)}</span>
            <span>{t('de')} {formatPesos(vaca.goal)}</span>
          </p>
          <p className="text-lg font-semibold tabular-nums">{formatPercent(vaca.percentage)}</p>
        </div>
        <div className="mt-3">
          <VacaProgress
            size="lg"
            value={vaca.percentage}
            barClass={status.bar}
            label={t('Avance de {name}', { name: vaca.name })}
            valueText={`${formatPercent(vaca.percentage)}: ${formatPesos(vaca.total)} de ${formatPesos(vaca.goal)}`}
          />
        </div>
        {pendingTotal > 0 && (
          <p className="mt-2 text-sm text-caution">+ {formatPesos(pendingTotal)} {t('tuyos pendientes de enviar')}</p>
        )}

        <dl className={cn('mt-4 grid grid-cols-2 gap-2', personal ? 'lg:grid-cols-3' : 'lg:grid-cols-4')}>
          {!personal && (
            <Stat
              label={t('Tu parte')}
              value={formatPesos(vaca.myContributed)}
              hint={`de ${formatPesos(vaca.myQuota)} · ${mine.label}`}
            />
          )}
          <Stat label={personal ? t('Te falta') : t('Le falta al grupo')} value={formatPesos(vaca.projection.remaining)} />
          <Stat
            label={t('Ritmo por día')}
            // Es el promedio de lo aportado: sin aportes, "$ 0" no dice nada.
            value={vaca.total > 0 ? formatPesos(vaca.projection.averagePerDay) : '—'}
            hint={
              vaca.total === 0
                ? t('Aparece con el primer aporte')
                : vaca.projection.estimatedDate
                  ? t('{v1} hacia el {estimatedDate}', { v1: personal ? t('Terminas') : t('Terminan'), estimatedDate: formatDate(vaca.projection.estimatedDate) })
                  : undefined
            }
          />
          <Stat
            className={personal ? 'col-span-2 lg:col-span-1' : undefined}
            label={t('Plazo')}
            value={deadlineText(vaca, { withDate: false })}
            hint={
              vaca.projection.neededPerWeek !== null
                ? t('Hacen falta {neededPerWeek} por semana', { neededPerWeek: formatPesos(vaca.projection.neededPerWeek) })
                : vaca.deadline
                  ? formatDate(vaca.deadline)
                  : undefined
            }
          />
        </dl>

        <div className="mt-5 grid grid-cols-2 gap-2 sm:flex">
          <Button size="lg" className={cn('sm:min-w-40', personal && 'col-span-2')} onClick={() => setSheet('aportar')}>
            <HandCoins aria-hidden="true" /> {t('Aportar')}
          </Button>
          {!personal && (
            <Button size="lg" variant="outline" className="sm:min-w-40" onClick={() => setSheet('invitar')}>
              <UserPlus aria-hidden="true" /> {t('Invitar')}
            </Button>
          )}
        </div>
      </Panel>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Panel aria-label={personal ? t('Aportes') : t('Miembros y aportes')}>
          <Tabs
            label={personal ? t('Aportes y calendario') : t('Miembros y aportes')}
            value={personal && tab === 'miembros' ? 'aportes' : tab}
            onChange={setTab}
            tabs={[
              ...(personal ? [] : [{ value: 'miembros', label: t('Miembros'), count: vaca.membersCount }]),
              { value: 'aportes', label: t('Aportes'), count: vaca.contributions.length + pending.length },
              { value: 'calendario', label: t('Calendario') },
            ]}
          >
            {(current) =>
              current === 'miembros' ? (
                <>
                  <p className="pt-2 text-sm text-ink/60">
                    {vaca.split === 'igual' ? t('La meta se reparte en partes iguales.') : t('Cada miembro tiene una cuota a medida.')}
                  </p>
                  <MemberList
                    members={vaca.members}
                    isAdmin={isAdmin}
                    split={vaca.split}
                    online={online}
                    onUpdate={(userId, changes) => apply(() => updateMember(id, userId, changes), t('Miembro actualizado.'))}
                    onRemove={async (userId) => {
                      await removeMember(id, userId);
                      setNotice(t('Miembro retirado de la vaca. Sus aportes siguen contando.'));
                      await load();
                    }}
                  />
                </>
              ) : current === 'calendario' ? (
                <VacaCalendar vaca={vaca} />
              ) : (
                <ContributionList
                  contributions={vaca.contributions}
                  pending={pending}
                  online={online}
                  personal={personal}
                  onDelete={handleDeleteContribution}
                  onDiscard={handleDiscard}
                />
              )
            }
          </Tabs>
        </Panel>

        <Panel aria-labelledby="smart-title" className="self-start">
          <h2 id="smart-title" className="mb-4 text-lg font-semibold tracking-tight">
            {personal ? t('¿Vas a tiempo?') : t('¿Van a tiempo?')}
          </h2>
          <AdviceCard vaca={vaca} online={online && !fromCache} onRemind={() => sendReminders(id)} />
        </Panel>
      </div>

      <Sheet
        open={sheet === 'aportar'}
        title={t('Aportar')}
        description={
          personal
            ? vaca.myRemaining > 0
              ? t('Te faltan {myRemaining} para la meta.', { myRemaining: formatPesos(vaca.myRemaining) })
              : t('Ya completaste la meta.')
            : vaca.myRemaining > 0
              ? t('Te faltan {myRemaining} de tu parte.', { myRemaining: formatPesos(vaca.myRemaining) })
              : t('Ya pusiste tu parte.')
        }
        onClose={closeSheet}
      >
        <ContributionForm categories={categories} myRemaining={vaca.myRemaining} onSubmit={handleContribute} />
      </Sheet>

      <Sheet open={sheet === 'invitar' && !personal} title={t('Invitar a la vaca')} onClose={closeSheet}>
        <InvitePanel
          vaca={vaca}
          online={online}
          onInvite={async (email) => {
            const result = await inviteByEmail(id, email);
            if (isAdmin) load();
            return result;
          }}
          onCancelInvitation={async (email) => {
            await cancelInvitation(id, email);
            await load();
          }}
          onRegenerate={async () => {
            const { code } = await regenerateCode(id);
            setVaca((current) => ({ ...current, code }));
          }}
        />
      </Sheet>

      <Sheet open={sheet === 'editar'} title={t('Editar {noun}', { noun })} onClose={closeSheet}>
        <VacaForm
          initial={vaca}
          personal={personal}
          disabled={!online}
          onSubmit={(values) => apply(() => updateVaca(id, values), t('Cambios guardados.')).then(closeSheet)}
          onCancel={closeSheet}
        />
      </Sheet>

      <Sheet open={sheet === 'opciones'} title={t('Opciones de {noun}', { noun })} onClose={closeSheet}>
        <div className="flex flex-col gap-1">
          {isAdmin && (
            <Button variant="ghost" className="justify-start" disabled={!online} onClick={() => setSheet('editar')}>
              <Pencil aria-hidden="true" /> {personal ? t('Editar nombre, meta y plazo') : t('Editar nombre, meta y reparto')}
            </Button>
          )}
          {!personal && (
            <ConfirmButton
              label={t('Salirme de la vaca')}
              question={t('Tus aportes seguirán contando para el grupo y sus gastos quedan en tus movimientos.')}
              confirmLabel={t('Sí, salirme')}
              icon={LogOut}
              disabled={!online}
              onConfirm={leave}
            />
          )}
          {isAdmin && (
            <ConfirmButton
              label={t('Eliminar {noun}', { noun })}
              question={
                personal
                  ? t('Se borra la meta. Los gastos de tus aportes quedan en tus movimientos.')
                  : t('Se borra para todos los miembros. Los gastos de los aportes quedan en los movimientos de cada uno.')
              }
              confirmLabel={t('Sí, eliminar')}
              icon={Trash2}
              disabled={!online}
              onConfirm={remove}
            />
          )}
          {!online && <p className="mt-1 text-sm text-ink/60">{t('Necesitas conexión para cambiar')} {noun}.</p>}
        </div>
      </Sheet>
    </>
  );
}
