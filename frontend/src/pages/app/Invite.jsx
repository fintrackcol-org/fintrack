import { useState } from 'react';
import { Check, Copy, Share2, Users } from 'lucide-react';
import PageHeader from '@/components/layout/PageHeader';
import Panel from '@/components/layout/Panel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import usePageTitle from '@/hooks/usePageTitle';
import { t } from '@/lib/i18n';

/** Dirección pública de Rinde: la que recibe el amigo. */
export const APP_URL = 'https://www.rindecol.online';

const SHARE_TEXT = t('Estoy organizando mis finanzas con Rinde. Pruébala y armemos una vaca:');

/** Página privada `/app/invitar`: compartir Rinde con amigos. No hay premio ni se cuenta quién se registra. */
export default function Invite() {
  usePageTitle(t('Invitar amigos'));
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState('');
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';

  const copy = async () => {
    setError('');
    try {
      await navigator.clipboard.writeText(APP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError(t('No se pudo copiar. Selecciona el enlace y cópialo a mano.'));
    }
  };

  const share = async () => {
    try {
      await navigator.share({ title: t('Rinde'), text: SHARE_TEXT, url: APP_URL });
    } catch {
      // El usuario cerró el menú de compartir: no es un error.
    }
  };

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t('Invitar amigos')} description={t('Compárteles Rinde y armen una vaca juntos.')} />

      <Panel>
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand">
            <Users className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight">{t('Ordenen sus cuentas juntos')}</h2>
            <p className="mt-1 text-sm text-ink/60">{t('Mándales el enlace por WhatsApp o por donde prefieras.')}</p>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          <Input
            readOnly
            value={APP_URL}
            aria-label={t('Enlace de Rinde')}
            className="min-w-0 text-sm"
            onFocus={(event) => event.target.select()}
          />
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="size-12 shrink-0"
            onClick={copy}
            aria-label={t('Copiar enlace')}
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </Button>
        </div>
        <p role="status" className="mt-2 min-h-5 text-sm text-positive">
          {copied && t('Enlace copiado.')}
        </p>
        {error && (
          <p role="alert" className="text-sm text-negative">
            {error}
          </p>
        )}

        {canShare && (
          <Button type="button" size="lg" className="mt-2 w-full" onClick={share}>
            <Share2 aria-hidden="true" />
            {t('Compartir Rinde')}
          </Button>
        )}
      </Panel>
    </div>
  );
}
