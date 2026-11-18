import CountrySelect from '@/components/account/CountrySelect';
import Segmented from '@/components/common/Segmented';
import { StepTitle } from '@/components/onboarding/OnboardingShell';
import { Label } from '@/components/ui/label';
import { currentLanguage, t } from '@/lib/i18n';
import { LANGUAGES, currencyName, moneySample, regionForCountry } from '@/lib/region';

const LANGUAGE_OPTIONS = LANGUAGES.map(({ code, name }) => ({ value: code, label: name }));

/** Monto de muestra: en pesos colombianos, sin centavos; en las demás monedas, con los suyos. */
const sampleAmount = (currency) => (currency === 'COP' ? 1250000 : 1250.5);

/**
 * País e idioma (pantalla 1 de la bienvenida). El país propone la moneda y el idioma; el idioma se
 * elige aparte y, una vez la persona lo toca, cambiar de país ya no lo mueve. La ficha violeta (la
 * misma del inicio) muestra cómo se va a escribir su plata, y cambia al instante con el país.
 *
 * Solo dibuja: guardar es de quien la usa (`pages/app/Welcome.jsx`). Nada de lo ya anotado se
 * convierte al cambiar la moneda; eso lo decide el servidor.
 *
 * @param {{ country: string, language: string, onCountry: (code: string) => void, onLanguage: (code: string) => void }} props
 */
export default function CountryStep({ country, language, onCountry, onLanguage }) {
  const { currency } = regionForCountry(country);
  const languageName = LANGUAGES.find((l) => l.code === language)?.name;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <StepTitle>{t('Hagamos que Rinde hable tu idioma.')}</StepTitle>
        <p className="mt-2 text-base text-ink/60">{t('Elige tu país y ajustamos la moneda por ti.')}</p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="welcome-country">{t('País')}</Label>
        <CountrySelect id="welcome-country" value={country} onChange={onCountry} />
      </div>

      <div className="rounded-3xl bg-violet p-5 text-white" aria-live="polite">
        <p className="text-sm text-white/80">{t('Así se verá tu plata')}</p>
        <p key={currency} className="mt-1 text-4xl font-semibold tabular-nums motion-safe:animate-swap-in">
          {moneySample(country, sampleAmount(currency))}
        </p>
        <p key={`${currency}-name`} className="mt-3 inline-block rounded-full bg-white/15 px-3 py-1 text-sm motion-safe:animate-swap-in">
          {currencyName(currency)} · {currency}
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">
          {t('Idioma')}
        </p>
        <Segmented label={t('Idioma')} options={LANGUAGE_OPTIONS} value={language} onChange={onLanguage} />
        <p className="text-sm text-ink/60">
          {language === currentLanguage()
            ? t('Los dos se cambian cuando quieras en Cuenta.')
            : t('Al seguir, Rinde pasa a {language}. Lo cambias cuando quieras en Cuenta.', { language: languageName })}
        </p>
      </div>
    </div>
  );
}
