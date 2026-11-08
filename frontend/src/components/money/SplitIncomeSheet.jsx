import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Sheet from '@/components/common/Sheet';
import { formatMoney } from '@/components/transactions/format';
import { Button } from '@/components/ui/button';
import { TRANSACTION_SAVED_EVENT } from '@/offline/saveNewTransaction';
import { getIncomeSplit } from '@/services/moneyProfileService';

/**
 * Filas del reparto, en el orden en que se aparta la plata. Las que dan 0 no se muestran.
 * @param {object} split Respuesta de `GET /money-profile/income/split`.
 * @returns {Array<{ key: string, label: string, amount: number }>}
 */
export function splitRows(split) {
  return [
    { key: 'commitments', label: 'Para tus pagos que faltan este mes', amount: split.commitments },
    { key: 'socialSecurity', label: 'Para salud y pensión', amount: split.socialSecurity },
    { key: 'salary', label: 'A tu sueldo de este mes', amount: split.salary },
    { key: 'cushion', label: 'Al colchón para meses flacos', amount: split.cushion },
    { key: 'free', label: 'Libre', amount: split.free },
  ].filter((row) => row.amount > 0);
}

/**
 * "Reparte lo que entró" (FT-0060): al registrar un ingreso grande, quien tiene ingresos variables
 * ve en qué usarlo. Escucha el evento de movimiento guardado, así sale venga de donde venga (barra
 * rápida, voz o formulario). Sin conexión no sale: el reparto lo calcula el servidor.
 */
export default function SplitIncomeSheet() {
  const [split, setSplit] = useState(null);

  useEffect(() => {
    const onSaved = ({ detail }) => {
      const t = detail?.transaction;
      if (!t || t.type !== 'ingreso') return;
      getIncomeSplit(t.amount)
        .then((result) => result.large && setSplit(result))
        .catch(() => {}); // Es un consejo: si falla, no estorba.
    };
    window.addEventListener(TRANSACTION_SAVED_EVENT, onSaved);
    return () => window.removeEventListener(TRANSACTION_SAVED_EVENT, onSaved);
  }, []);

  const close = () => setSplit(null);

  return (
    <Sheet open={Boolean(split)} title="Reparte lo que entró" description={split ? `Te entraron ${formatMoney(split.amount)}. Así te alcanza todo el mes:` : ''} onClose={close}>
      {split && (
        <div className="space-y-4">
          <ul className="divide-y divide-ink/10 rounded-2xl border border-ink/10">
            {splitRows(split).map((row) => (
              <li key={row.key} className="flex items-center justify-between gap-3 p-3">
                <span>{row.label}</span>
                <span className="font-semibold tabular-nums">{formatMoney(row.amount)}</span>
              </li>
            ))}
          </ul>
          {split.ownSalary && (
            <p className="text-sm text-ink/70">Tu sueldo propio es de {formatMoney(split.ownSalary)} al mes: vive con eso aunque un mes te entre más.</p>
          )}
          <div className="flex flex-wrap gap-2">
            {split.cushion > 0 && split.cushionStatus.metaId && (
              <Button asChild>
                <Link to={`/app/metas/${split.cushionStatus.metaId}`} onClick={close}>
                  Aportar al colchón
                </Link>
              </Button>
            )}
            <Button variant={split.cushion > 0 && split.cushionStatus.metaId ? 'ghost' : 'default'} onClick={close}>
              Entendido
            </Button>
          </div>
        </div>
      )}
    </Sheet>
  );
}
