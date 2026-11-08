import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import Panel from '@/components/layout/Panel';
import { getBusinessAdvice } from '@/services/negocioService';

/**
 * Consejo sobre el mes del negocio (FT-0058): la IA con cifras agregadas del mes (sin nombres ni
 * descripciones) o, si no responde, uno calculado con reglas. Se vuelve a pedir cuando cambian las
 * ventas o los gastos del mes; el servidor lo guarda mientras las cifras no cambien.
 * @param {{ businessId: string, month: string, panel: object, online: boolean }} props
 */
export default function BusinessAdvice({ businessId, month, panel, online }) {
  const [advice, setAdvice] = useState(null);
  const [loading, setLoading] = useState(false);
  const signature = `${panel.sale}|${panel.cost}|${panel.variable}|${panel.fixed}|${panel.otherIncome}`;

  useEffect(() => {
    if (!online) return undefined;
    let cancelled = false;
    setLoading(true);
    getBusinessAdvice(businessId, month)
      .then((data) => !cancelled && setAdvice(data))
      .catch(() => !cancelled && setAdvice(null))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [businessId, month, signature, online]);

  if (!online || (!loading && !advice)) return null;
  return (
    <Panel aria-labelledby="consejo-negocio-title" className="p-4 md:p-5">
      <h3 id="consejo-negocio-title" className="flex items-center gap-2 text-sm font-semibold">
        <Sparkles className="size-4 text-brand" aria-hidden="true" /> Consejo del mes
      </h3>
      {loading && !advice ? (
        <p className="mt-2 flex items-center gap-2 text-sm text-ink/60">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" /> Pensando…
        </p>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed">{advice.advice}</p>
          <p className="mt-1 text-xs text-ink/50">
            {advice.source === 'ia' ? 'Con IA, solo con las cifras del mes.' : 'Calculado con las cifras del mes.'}
          </p>
        </>
      )}
    </Panel>
  );
}
