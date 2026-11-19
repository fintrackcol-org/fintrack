import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import CountrySelect from '@/components/account/CountrySelect';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { countryName, currencyName, getRegion, setRegion } from '@/lib/region';
import { saveCountry } from '@/services/userService';
import { t } from '@/lib/i18n';

/**
 * El país donde está la persona, en Cuenta. Reemplaza la fila fija «Moneda»: quien viaja cambia el
 * país y sus cuentas siguen en su moneda principal (lo que anote allá se convierte a ella).
 * @param {{ onSaved?: () => void }} props
 */
export default function CountrySettings({ onSaved }) {
  const current = getRegion();
  const [country, setCountry] = useState(current.country);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const save = async () => {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const profile = await saveCountry(country);
      // Sin movimientos, la moneda principal siguió al país: se recarga para ver todo en la nueva.
      if (setRegion(profile)) return window.location.reload();
      setNotice(t('Listo: estás en {country}.', { country: countryName(profile.country) }));
      onSaved?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="space-y-1.5">
        <Label htmlFor="cuenta-pais">{t('¿En qué país estás?')}</Label>
        <CountrySelect
          id="cuenta-pais"
          value={country}
          onChange={(code) => (setCountry(code), setNotice(''))}
          aria-describedby="cuenta-pais-ayuda"
        />
      </div>
      <p id="cuenta-pais-ayuda" className="text-sm text-ink/60">
        {t('Tus cuentas siguen en')} {currencyName(current.currency)} ({current.currency}{t('). Si viajas, cambia el país: lo que anotes allá se convierte solo a tu moneda.')}
      </p>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
      <p role="status" className="min-h-0 text-sm text-ink/60 empty:hidden">
        {notice}
      </p>
      <Button size="lg" disabled={saving || country === current.country} onClick={save}>
        {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
        {t('Guardar país')}
      </Button>
    </div>
  );
}
