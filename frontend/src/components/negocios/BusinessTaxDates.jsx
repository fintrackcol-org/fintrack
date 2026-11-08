import { useEffect, useState } from 'react';
import { CalendarClock, Loader2, Plus, Trash2 } from 'lucide-react';
import FormField from '@/components/auth/FormField';
import ChipGroup from '@/components/common/ChipGroup';
import Panel from '@/components/layout/Panel';
import { todayIso } from '@/components/vacas/vacaFormat';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { dayLabel } from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { createTaxDate, deleteTaxDate, listTaxDates } from '@/services/negocioService';

/** Los impuestos más comunes de un negocio pequeño en Colombia; "Otro" deja escribir el nombre. */
const TAX_OPTIONS = ['IVA', 'Retención en la fuente', 'ICA', 'Renta', 'Otro'].map((v) => ({ value: v, label: v }));

/**
 * "Hoy", "Mañana", "En 5 días" o "Pasó".
 * @param {string} date AAAA-MM-DD
 * @param {string} today AAAA-MM-DD
 * @returns {string}
 */
export function taxWhen(date, today) {
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  if (days < 0) return 'Pasó';
  if (days === 0) return 'Hoy';
  if (days === 1) return 'Mañana';
  return `En ${days} días`;
}

/**
 * Fechas de impuestos del negocio (FT-0058): IVA, retención, ICA… Tres días antes les llega un aviso
 * a los dueños y editores. Las fechas que ya pasaron se ven en gris.
 * @param {{ businessId: string, online: boolean }} props
 */
export default function BusinessTaxDates({ businessId, online }) {
  const today = todayIso();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState('IVA');
  const [other, setOther] = useState('');
  const [date, setDate] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listTaxDates(businessId)
      .then((res) => !cancelled && (setData(res), setError('')))
      .catch((err) => !cancelled && setError(err.message));
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  const add = async (event) => {
    event.preventDefault();
    const name = kind === 'Otro' ? other.trim() : kind;
    if (!name) return setError('Escribe el nombre del impuesto');
    if (!date) return setError('Elige la fecha');
    setBusy(true);
    setError('');
    try {
      const created = await createTaxDate(businessId, { name, date });
      setData((d) => ({ ...d, items: [...d.items, created].sort((a, b) => a.date.localeCompare(b.date)) }));
      setAdding(false);
      setDate('');
      setOther('');
    } catch (err) {
      setError(Object.values(err.fields ?? {})[0] ?? err.message);
    } finally {
      setBusy(false);
    }
    return undefined;
  };

  const upcoming = data?.items.filter((t) => t.date >= today) ?? [];
  const past = data?.items.filter((t) => t.date < today).slice(-3) ?? [];

  return (
    <Panel aria-labelledby="impuestos-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id="impuestos-title" className="font-semibold">
            Fechas de impuestos
          </h3>
          <p className="text-sm text-ink/60">Te avisamos 3 días antes.</p>
        </div>
        {data?.canEdit && !adding && (
          <Button variant="soft" onClick={() => setAdding(true)} disabled={!online}>
            <Plus aria-hidden="true" /> Agregar
          </Button>
        )}
      </div>

      {adding && (
        <form onSubmit={add} noValidate className="mt-4 space-y-4 rounded-2xl bg-ink/5 p-4" aria-label="Agregar fecha de impuestos">
          <ChipGroup legend="Impuesto" options={TAX_OPTIONS} value={kind} onChange={setKind} disabled={busy} scroll />
          {kind === 'Otro' && (
            <FormField id="tax-name" label="Nombre">
              <Input maxLength={40} value={other} onChange={(e) => setOther(e.target.value)} disabled={busy} />
            </FormField>
          )}
          <FormField id="tax-date" label="Fecha límite">
            <Input type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} disabled={busy} />
          </FormField>
          <div className="flex gap-2">
            <Button type="submit" disabled={busy || !online}>
              {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
              Guardar
            </Button>
            <Button type="button" variant="ghost" onClick={() => (setAdding(false), setError(''))} disabled={busy}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="mt-3 text-sm text-negative">
          {error}
        </p>
      )}
      {!data && !error && (
        <p className="flex items-center gap-2 py-4 text-ink/60">
          <Loader2 className="animate-spin" aria-hidden="true" /> Cargando…
        </p>
      )}
      {data && data.items.length === 0 && !adding && (
        <p className="mt-3 text-sm text-ink/60">
          Agrega las fechas de IVA, retención o ICA de tu negocio para que no se te pasen.
        </p>
      )}
      {(upcoming.length > 0 || past.length > 0) && (
        <ul className="mt-3 divide-y divide-ink/10" aria-label="Fechas de impuestos">
          {[...upcoming, ...past].map((t) => {
            const when = taxWhen(t.date, today);
            const soon = when === 'Hoy' || when === 'Mañana' || /^En [23] días$/.test(when);
            return (
              <li key={t.id} className={cn('flex items-center gap-3 py-2.5', when === 'Pasó' && 'text-ink/40')}>
                <CalendarClock className={cn('size-4 shrink-0', soon ? 'text-caution' : 'text-ink/40')} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{t.name}</span>
                  <span className="block text-xs text-ink/60">{dayLabel(t.date)}</span>
                </span>
                <span className={cn('shrink-0 text-sm', soon && 'font-semibold text-caution')}>{when}</span>
                {data.canEdit && (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={`Borrar ${t.name} del ${dayLabel(t.date)}`}
                    disabled={!online}
                    onClick={async () => {
                      try {
                        await deleteTaxDate(businessId, t.id);
                        setData((d) => ({ ...d, items: d.items.filter((x) => x.id !== t.id) }));
                      } catch (err) {
                        setError(err.message);
                      }
                    }}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Panel>
  );
}
