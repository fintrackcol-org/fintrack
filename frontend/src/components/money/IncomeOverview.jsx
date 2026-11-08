import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, Loader2, PiggyBank, ShieldCheck, Sparkles } from 'lucide-react';
import Sheet from '@/components/common/Sheet';
import Panel from '@/components/layout/Panel';
import IncomeSourcesFields from '@/components/money/IncomeSourcesFields';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import VacaProgress from '@/components/vacas/VacaProgress';
import useAsync from '@/hooks/useAsync';
import { SOURCE_KINDS, fromApiSources, incomeHeadline, sourceSummary, toApiSources } from '@/lib/incomeSources';
import { createCommitment, getIncome, saveIncomeSources } from '@/services/moneyProfileService';
import { createVaca } from '@/services/vacaService';

/** Mismo nombre que busca el backend (`CUSHION_NAME` en income.service.js). */
export const CUSHION_NAME = 'Colchón para meses flacos';
const PILA_NAME = 'Seguridad social (PILA)';
const TITLES = Object.fromEntries(SOURCE_KINDS.map((k) => [k.kind, k.title]));

/** Un bloque del detalle, con ícono y título. */
function Block({ icon: Icon, title, children }) {
  return (
    <section className="rounded-2xl border border-ink/10 p-4">
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-brand" aria-hidden="true" />
        {title}
      </h3>
      <div className="mt-2 space-y-2 text-sm text-ink/80">{children}</div>
    </section>
  );
}

/** Colchón para meses flacos: una meta personal con barra (FT-0060). Si no existe, se ofrece crearla. */
function Cushion({ cushion, onChanged }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const percent = cushion.goal > 0 ? (cushion.saved / cushion.goal) * 100 : 0;

  const create = async () => {
    setBusy(true);
    setError('');
    try {
      await createVaca({ name: CUSHION_NAME, goal: cushion.suggestedGoal, personal: true });
      onChanged();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Block icon={PiggyBank} title="Colchón para meses flacos">
      {cushion.metaId ? (
        <>
          <VacaProgress
            value={percent}
            label="Avance del colchón"
            valueText={`${formatMoney(cushion.saved)} de ${formatMoney(cushion.goal)}`}
          />
          <p>
            Llevas <strong className="tabular-nums">{formatMoney(cushion.saved)}</strong> de {formatMoney(cushion.goal)}.
          </p>
          <Button asChild variant="soft" size="sm">
            <Link to={`/app/metas/${cushion.metaId}`}>Aportar al colchón</Link>
          </Button>
        </>
      ) : (
        <>
          <p>
            Para que un mes flaco no te coja la tarde, te sugerimos guardar{' '}
            <strong className="tabular-nums">{formatMoney(cushion.suggestedGoal)}</strong>. Si un mes viene flaco, usas de ahí:
            para eso es.
          </p>
          <Button size="sm" variant="soft" disabled={busy || cushion.suggestedGoal <= 0} onClick={create}>
            {busy && <Loader2 className="animate-spin" aria-hidden="true" />}
            Crear mi colchón
          </Button>
        </>
      )}
      {error && (
        <p role="alert" className="text-negative">
          {error}
        </p>
      )}
    </Block>
  );
}

/** Seguridad social de un independiente: valor aproximado y un botón para volverla pago del mes. */
function SocialSecurity({ data }) {
  const [state, setState] = useState(''); // '', 'saving', 'done' o un error
  const add = async () => {
    setState('saving');
    try {
      await createCommitment({ name: PILA_NAME, amount: data.total, dayOfMonth: 10 });
      setState('done');
    } catch (err) {
      setState(err.message);
    }
  };
  return (
    <Block icon={ShieldCheck} title="Salud y pensión">
      <p>
        Como trabajas por tu cuenta, aparta unos <strong className="tabular-nums">{formatMoney(data.total)}</strong> al mes: salud{' '}
        {formatMoney(data.health)} y pensión {formatMoney(data.pension)}, sobre el 40 % de lo que te entra (mínimo un salario
        mínimo).
      </p>
      <p className="text-xs text-ink/60">Valor aproximado, no es asesoría tributaria. La ARL es aparte y opcional.</p>
      {state === 'done' ? (
        <p role="status" className="text-positive">
          Listo: quedó en tus pagos del mes (día 10). Cambia el día si tu planilla vence otro.
        </p>
      ) : (
        <Button size="sm" variant="soft" disabled={state === 'saving'} onClick={add}>
          Recordármelo cada mes
        </Button>
      )}
      {state && !['saving', 'done'].includes(state) && (
        <p role="alert" className="text-negative">
          {state}
        </p>
      )}
    </Block>
  );
}

/**
 * "Cómo te entra la plata" en Mi plata (FT-0060). En la vista, solo la frase del mes normal y el flaco;
 * el detalle (fuentes, sueldo propio, colchón, salud y pensión, meta por días) va en una hoja, para
 * que la ficha siga siendo minimalista.
 */
export default function IncomeOverview() {
  const income = useAsync(getIncome, []);
  const data = income.data;
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null); // formularios por tipo mientras se cambia
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!data) return null;
  const headline = incomeHeadline(data);

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await saveIncomeSources(toApiSources(editing));
      setEditing(null);
      income.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const startEditing = () => {
    setEditing(fromApiSources(data.sources));
    setOpen(true);
  };

  return (
    <Panel aria-labelledby="income-title">
      <div className="flex items-center justify-between gap-3">
        <h2 id="income-title" className="text-lg font-semibold tracking-tight">
          Cómo te entra la plata
        </h2>
        <Button variant="ghost" size="sm" onClick={headline ? () => setOpen(true) : startEditing}>
          {headline ? 'Ver más' : 'Configurar'}
        </Button>
      </div>
      <p className="mt-1 text-ink/70">{headline ?? 'Cuéntanos cómo y cuánto te entra, aunque sea más o menos.'}</p>
      {data.estimated && <p className="mt-1 text-xs text-ink/60">Estimado con lo que nos contaste.</p>}
      {data.workDay && (
        <p className="mt-2 text-sm">
          Llevas {formatMoney(data.workDay.earned)} de {formatMoney(data.workDay.target)}
          {data.workDay.daysLeft > 0 && (
            <>
              ; te faltan {data.workDay.daysLeft} días de trabajo, unos <strong className="tabular-nums">{formatMoney(data.workDay.perDay)}</strong> por
              día.
            </>
          )}
          {data.workDay.extraToday > 0 && ` Hoy hiciste ${formatMoney(data.workDay.extraToday)} de más: apártalos para mañana o al colchón.`}
        </p>
      )}

      <Sheet
        open={open}
        title="Cómo te entra la plata"
        onClose={() => {
          setOpen(false);
          setEditing(null);
        }}
      >
        {editing ? (
          <div className="space-y-4">
            <IncomeSourcesFields forms={editing} onChange={setEditing} />
            {error && (
              <p role="alert" className="text-sm text-negative">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <Button onClick={save} disabled={saving}>
                {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
                Guardar
              </Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {headline && <p className="text-ink/80">{headline}</p>}
            <ul className="divide-y divide-ink/10 rounded-2xl border border-ink/10">
              {data.sources.map((s) => (
                <li key={s.id} className="flex items-center gap-3 p-3">
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{TITLES[s.kind]}</span>
                    <span className="block truncate text-sm text-ink/60">{sourceSummary(s)}</span>
                  </span>
                </li>
              ))}
              <li>
                <button type="button" onClick={startEditing} className="flex w-full items-center gap-2 p-3 text-left font-medium text-brand">
                  Cambiar cómo te entra la plata
                  <ChevronRight className="ml-auto size-4" aria-hidden="true" />
                </button>
              </li>
            </ul>
            {data.ownSalary && (
              <Block icon={Sparkles} title="Págate un sueldo">
                <p>
                  Te sugerimos vivir con <strong className="tabular-nums">{formatMoney(data.ownSalary)} al mes</strong>, aunque un mes
                  te entre más. Lo que sobre va al colchón.
                </p>
              </Block>
            )}
            <Cushion cushion={data.cushion} onChanged={income.reload} />
            {data.socialSecurity && <SocialSecurity data={data.socialSecurity} />}
          </div>
        )}
      </Sheet>
    </Panel>
  );
}
