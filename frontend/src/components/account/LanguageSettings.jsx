import { useState } from 'react';
import Segmented from '@/components/common/Segmented';
import { t } from '@/lib/i18n';
import { LANGUAGES, getRegion, setRegion } from '@/lib/region';
import { saveLanguage } from '@/services/userService';

/** Cada idioma con su nombre en ese mismo idioma: quien no entiende el actual reconoce el suyo. */
const OPTIONS = LANGUAGES.map(({ code, name }) => ({ value: code, label: name }));

/**
 * El idioma de la app, en Cuenta. Se cambia aparte del país: viajar no cambia el idioma. Al elegir
 * otro se guarda y la app se recarga con los textos nuevos; los datos no cambian.
 */
export default function LanguageSettings() {
  const { language } = getRegion();
  const [saving, setSaving] = useState(null);
  const [error, setError] = useState('');

  const pick = async (code) => {
    if (code === language || saving) return;
    setSaving(code);
    setError('');
    try {
      if (setRegion(await saveLanguage(code))) window.location.reload();
      else setSaving(null);
    } catch (err) {
      setError(err.message);
      setSaving(null);
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <Segmented label={t('Idioma')} options={OPTIONS} value={saving ?? language} onChange={pick} />
      <p aria-live="polite" className="text-sm text-ink/60">
        {saving ? t('Cambiando el idioma…') : t('La app se recarga con los textos nuevos. Tus datos no cambian.')}
      </p>
      {error && (
        <p role="alert" className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
}
