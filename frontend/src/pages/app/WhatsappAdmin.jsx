import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, CircleCheck, Inbox, Loader2 } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { formatRelativeDay } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import useAsync from '@/hooks/useAsync';
import usePageTitle from '@/hooks/usePageTitle';
import { cn } from '@/lib/utils';
import { getWhatsappAdmin, setWhatsappAccess } from '@/services/whatsappService';
import { t } from '@/lib/i18n';

export const FILTERS = [
  { key: 'pending', label: t('Por aprobar') },
  { key: 'approved', label: t('Con acceso') },
  { key: 'rejected', label: t('Sin acceso') },
];

/** Parte del tope en la que la barra pasa a aviso; el backend avisa por correo en el mismo punto. */
const WARN_RATIO = 0.8;

/**
 * Cuánto del tope del mes se ha usado.
 * @param {{ sent: number, max: number }} month
 * @returns {{ percent: number, left: number, level: 'ok'|'warn'|'full' }}
 */
export function monthUsage({ sent, max }) {
  const ratio = max > 0 ? sent / max : 1;
  const level = ratio >= 1 ? 'full' : ratio >= WARN_RATIO ? 'warn' : 'ok';
  return { percent: Math.min(Math.round(ratio * 100), 100), left: Math.max(max - sent, 0), level };
}

const BAR = { ok: 'bg-brand', warn: 'bg-caution', full: 'bg-negative' };

/** Respuestas del mes frente al tope. */
function MonthMeter({ month }) {
  const { percent, left, level } = monthUsage(month);
  return (
    <Panel aria-labelledby="mes-title">
      <h2 id="mes-title" className="text-lg font-semibold tracking-tight">
        {t('Respuestas de este mes')}
      </h2>
      <p className="mt-3 text-3xl font-semibold tabular-nums tracking-tight">
        {month.sent} <span className="text-base font-normal text-ink/60">{t('de')} {month.max}</span>
      </p>
      <div
        role="meter"
        aria-label={t('Respuestas usadas este mes')}
        aria-valuemin={0}
        aria-valuemax={month.max}
        aria-valuenow={Math.min(month.sent, month.max)}
        aria-valuetext={`${month.sent} de ${month.max}`}
        className="mt-3 h-2.5 rounded-full bg-ink/10"
      >
        <div
          className={cn('h-full rounded-full motion-safe:transition-[width] motion-safe:duration-500', BAR[level])}
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="mt-3 text-sm text-ink/60">
        {level === 'full'
          ? t('El bot dejó de responder hasta el otro mes, para que Meta no cobre.')
          : t('Quedan {left}. Al llegar al tope, el bot deja de responder hasta el otro mes.', { left })}
      </p>
    </Panel>
  );
}

/**
 * Página `/app/whatsapp/admin`, para el equipo: cuántas respuestas lleva el bot en el mes y quién
 * puede usarlo. La seguridad está en la API, que responde 403 a quien no esté en `ADMIN_EMAILS`.
 */
export default function WhatsappAdmin() {
  usePageTitle(t('WhatsApp del equipo'));
  const { data, error, loading, reload } = useAsync(getWhatsappAdmin, []);
  const [filter, setFilter] = useState('pending');
  const [changing, setChanging] = useState(null);
  const [changeError, setChangeError] = useState('');
  const all = data?.users ?? [];
  const users = all.filter(({ status }) => status === filter);

  const change = async (user, status) => {
    setChanging(user.userId);
    setChangeError('');
    try {
      await setWhatsappAccess(user.userId, status);
      reload();
    } catch (err) {
      setChangeError(err.message);
    } finally {
      setChanging(null);
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <Link
        to="/app/cuenta"
        className="mb-2 inline-flex items-center gap-1 text-sm font-medium text-ink/60 transition-colors hover:text-brand"
      >
        <ChevronLeft className="size-4" aria-hidden="true" />
        {t('Cuenta')}
      </Link>
      <PageHeader title={t('WhatsApp del equipo')} description={t('Cuánto lleva el bot este mes y quién puede usarlo.')} />

      {error ? (
        <Panel>
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        </Panel>
      ) : loading && !data ? (
        <Panel>
          <p className="flex items-center gap-2 text-sm text-ink/60">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            {t('Cargando…')}
          </p>
        </Panel>
      ) : (
        data && (
          <div className="space-y-5">
            <MonthMeter month={data.month} />

            <div className="grid grid-cols-3 gap-1 rounded-xl bg-ink/5 p-1">
              {FILTERS.map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  aria-pressed={filter === key}
                  className={cn(
                    'h-10 rounded-lg px-1 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-violet',
                    filter === key ? 'bg-surface text-ink shadow-sm' : 'text-ink/60 hover:text-ink',
                  )}
                >
                  {label}{' '}
                  <span className="tabular-nums text-ink/60">{all.filter((u) => u.status === key).length}</span>
                </button>
              ))}
            </div>

            <Panel>
              {changeError && (
                <p role="alert" className="mb-2 text-sm text-negative">
                  {changeError}
                </p>
              )}
              {users.length === 0 ? (
                <div className="py-6 text-center">
                  <Inbox className="mx-auto size-6 text-brand" aria-hidden="true" />
                  <p className="mt-2 text-sm text-ink/60">
                    {filter === 'pending' ? t('Nadie está esperando aprobación.') : t('No hay nadie aquí.')}
                  </p>
                </div>
              ) : (
                <ul className="-my-3 divide-y divide-ink/10">
                  {users.map((user) => (
                    <li key={user.userId} className="py-3">
                      <p className="break-all text-[15px] font-medium">{user.email}</p>
                      <p className="mt-0.5 text-xs tabular-nums text-ink/60">
                        {user.name ? `${user.name} · ` : ''}
                        {t('Lo pidió')} {formatRelativeDay(user.requestedAt.slice(0, 10)).toLowerCase()}
                        {user.status === 'approved' &&
                          t(' · {monthSends} {v2} este mes', { monthSends: user.monthSends, v2: user.monthSends === 1 ? 'respuesta' : 'respuestas' })}
                      </p>
                      {user.linked && (
                        <p className="mt-1 flex items-center gap-1 text-xs text-ink/60">
                          <CircleCheck className="size-3.5 text-positive" aria-hidden="true" />
                          {user.hasPhone ? t('Número conectado') : t('Usuario conectado')}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2">
                        {user.status !== 'approved' && (
                          <Button size="sm" onClick={() => change(user, 'approved')} disabled={changing === user.userId}>
                            {user.status === 'rejected' ? t('Dar acceso') : t('Aprobar')}
                          </Button>
                        )}
                        {user.status !== 'rejected' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => change(user, 'rejected')}
                            disabled={changing === user.userId}
                          >
                            {user.status === 'approved' ? t('Quitar acceso') : t('Rechazar')}
                          </Button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        )
      )}
    </div>
  );
}
