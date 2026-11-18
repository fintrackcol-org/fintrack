import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Check, Loader2, Plus, X } from 'lucide-react';
import { useAuth } from '@/auth/AuthContext';
import MoneyInput from '@/components/common/MoneyInput';
import IncomeSourcesFields from '@/components/money/IncomeSourcesFields';
import CountryStep from '@/components/onboarding/CountryStep';
import HowItWorksTour, { TOUR_LENGTH } from '@/components/onboarding/HowItWorksTour';
import OnboardingShell, { StepAction, StepTitle } from '@/components/onboarding/OnboardingShell';
import WelcomeIntro from '@/components/onboarding/WelcomeIntro';
import Rin from '@/components/rin/Rin';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import usePageTitle from '@/hooks/usePageTitle';
import { getDisplayName } from '@/lib/displayName';
import { SUGGESTED_COMMITMENTS, balanceProposal, readCommitmentForm, toProfileData } from '@/lib/moneyProfile';
import { clearDraft, loadDraft, saveDraft } from '@/lib/onboardingDraft';
import { cn } from '@/lib/utils';
import { toApiSources } from '@/lib/incomeSources';
import { regionForCountry, setRegion, suggestCountry } from '@/lib/region';
import { finishWelcome, getMoneyProfile, saveIncomeSources } from '@/services/moneyProfileService';
import { saveCountry } from '@/services/userService';
import { ThemeProvider, useTheme } from '@/theme/ThemeProvider';
import { currentLanguage, t } from '@/lib/i18n';

/**
 * Las pantallas de la bienvenida, en orden y numeradas de corrido: una sola cuenta para todo.
 * 0 saludo · 1 país e idioma · 2 a 6 recorrido «Cómo funciona» · 7 ingresos · 8 plata de hoy · 9 pagos.
 */
const HELLO = 0;
const COUNTRY = 1;
const TOUR = 2;
const INCOME = TOUR + TOUR_LENGTH;
const BALANCE = INCOME + 1;
const PAYMENTS = INCOME + 2;

/** Lo que el usuario escribe de un compromiso. `custom` deja cambiar el nombre. */
const newItem = (name, custom = false) => ({ key: crypto.randomUUID(), name, amount: '', dayOfMonth: '', custom });

/** Posición guardada, si es una de las pantallas; si no, el saludo. */
const validPosition = (value) => (Number.isInteger(value) && value >= HELLO && value <= PAYMENTS ? value : HELLO);

/** Sin conexión el servidor no responde: se dice eso, y que lo respondido sigue aquí. */
const saveProblem = (err) =>
  globalThis.navigator?.onLine === false
    ? t('Estás sin conexión. Tus respuestas quedaron guardadas en este dispositivo: inténtalo de nuevo cuando vuelva.')
    : err.message;

/**
 * Por qué se pregunta algo de plata, dicho por Rin en una línea. Va una sola vez (en ingresos): Rin
 * acompaña, no aparece en cada pantalla.
 */
function Why({ children }) {
  return (
    <p className="flex items-center gap-3 rounded-2xl bg-brand-soft/60 p-3 text-sm text-ink/80">
      <Rin compact className="h-11 w-10 shrink-0" />
      <span>{children}</span>
    </p>
  );
}

/** La bienvenida completa. Va fuera de `AppShell`, sin menú, así que pone el tema por su cuenta. */
function WelcomeSteps() {
  usePageTitle(t('Bienvenida'));
  const { theme } = useTheme();
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id ?? 'anon';
  const [params] = useSearchParams();
  // Quien vuelve desde el inicio a responder («Responder») entra directo a las preguntas.
  const returning = params.get('paso') === 'preguntas';
  const first = returning ? INCOME : COUNTRY;

  // Lo que ya respondió sigue en su dispositivo hasta que termine (ver `lib/onboardingDraft`).
  const [draft] = useState(() => loadDraft(userId));
  const [position, setPosition] = useState(() => (returning ? INCOME : validPosition(draft.position)));
  const [direction, setDirection] = useState(1);
  const [country, setCountry] = useState(() => draft.country ?? suggestCountry());
  const [language, setLanguage] = useState(() => draft.language ?? regionForCountry(draft.country ?? suggestCountry()).language);
  // Una vez elige idioma a mano, cambiar de país ya no se lo cambia.
  const [languagePicked, setLanguagePicked] = useState(() => draft.languagePicked === true);
  // FT-0060: fuentes de ingreso elegidas (por tipo). Se puede elegir varias o ninguna.
  const [sources, setSources] = useState(() => (draft.sources && typeof draft.sources === 'object' ? draft.sources : {}));
  const [balance, setBalance] = useState(() => (typeof draft.balance === 'string' ? draft.balance : ''));
  const [items, setItems] = useState(() => (Array.isArray(draft.items) ? draft.items : []));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  // Guardar son dos llamadas. Si la primera ya quedó y falla la segunda, reintentar no la repite
  // (duplicaría los pagos del mes).
  const answersSaved = useRef(false);

  useEffect(() => {
    saveDraft(userId, { position, country, language, languagePicked, sources, balance, items });
  }, [userId, position, country, language, languagePicked, sources, balance, items]);

  // Quien ya registró movimientos no empieza con un número de memoria: se le propone lo que suman.
  useEffect(() => {
    getMoneyProfile()
      .then(({ totals }) => {
        const proposal = balanceProposal(totals);
        if (proposal !== null) setBalance((current) => current || String(proposal));
      })
      .catch(() => {});
  }, []);

  const go = (to) => {
    setError('');
    setDirection(to > position ? 1 : -1);
    setPosition(to);
  };

  /** Termina la bienvenida. `saving` evita que un segundo toque la envíe dos veces. */
  const save = async (answers) => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      if (!answersSaved.current) await finishWelcome(answers);
      answersSaved.current = true;
      // Las fuentes también fijan "con fecha fija" o "sin fecha" en el perfil.
      const list = toApiSources(sources);
      if (list.length > 0 && Object.keys(answers).length > 0) await saveIncomeSources(list);
      clearDraft(userId);
      navigate('/app', { replace: true });
    } catch (err) {
      setError(saveProblem(err));
      setSaving(false);
    }
  };

  const pickCountry = (code) => {
    setCountry(code);
    if (!languagePicked) setLanguage(regionForCountry(code).language);
  };

  const pickLanguage = (code) => {
    setLanguage(code);
    setLanguagePicked(true);
  };

  const saveRegion = async () => {
    if (saving) return;
    setSaving(true);
    setError('');
    try {
      setRegion(await saveCountry(country, language));
      if (language !== currentLanguage()) {
        // Otro idioma: se recarga para verlo todo con sus textos. El borrador la trae de vuelta aquí.
        saveDraft(userId, { position: TOUR, country, language, languagePicked, sources, balance, items });
        window.location.reload();
        return;
      }
      setSaving(false);
      go(TOUR);
    } catch (err) {
      setError(saveProblem(err));
      setSaving(false);
    }
  };

  const profile = () => toProfileData({ incomeType: '', payDays: [], balance });

  const finish = () => {
    const read = items.map(readCommitmentForm);
    const problem = read.find((r) => r.error);
    if (problem) {
      setError(problem.error);
      return;
    }
    save({ ...profile(), commitments: read.map((r) => r.data) });
  };

  const toggleSuggestion = (name) => {
    setItems((current) =>
      current.some((i) => i.name === name) ? current.filter((i) => i.name !== name) : [...current, newItem(name)],
    );
  };

  const changeItem = (key, changes) => {
    setError('');
    setItems((current) => current.map((i) => (i.key === key ? { ...i, ...changes } : i)));
  };

  /** Atrás: la pantalla anterior; desde la primera, al saludo (o al inicio si vino a responder). */
  const back = () => (position > first ? go(position - 1) : returning ? navigate('/app', { replace: true }) : go(HELLO));

  /** Omitir deja pasar esta pantalla (o el recorrido entero) sin tocar lo ya respondido en las otras. */
  const skip = () => {
    if (position === COUNTRY) return go(TOUR);
    if (position < INCOME) return go(INCOME);
    if (position === INCOME) {
      setSources({});
      return go(BALANCE);
    }
    if (position === BALANCE) {
      setBalance('');
      return go(PAYMENTS);
    }
    return save(profile());
  };

  /** Nada es obligatorio: "más o menos" está bien y nunca se bloquea al usuario. */
  const action =
    position === COUNTRY ? (
      <StepAction onClick={saveRegion} disabled={saving}>
        {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
        {t('Seguir')}
      </StepAction>
    ) : position === PAYMENTS ? (
      <StepAction onClick={finish} disabled={saving}>
        {saving && <Loader2 className="animate-spin" aria-hidden="true" />}
        {saving ? t('Guardando…') : t('Ver mi plata')}
      </StepAction>
    ) : (
      <StepAction onClick={() => go(position + 1)}>{position < INCOME ? t('Siguiente') : t('Seguir')}</StepAction>
    );

  return (
    <div data-theme={theme} className="min-h-dvh bg-canvas text-ink antialiased">
      {position === HELLO ? (
        <WelcomeIntro name={getDisplayName(user)} busy={saving} error={error} onStart={() => go(COUNTRY)} onLater={() => save({})} />
      ) : (
        <OnboardingShell
          step={position - first + 1}
          total={PAYMENTS - first + 1}
          direction={direction}
          onBack={back}
          onSkip={skip}
          busy={saving}
          error={error}
          action={action}
        >
          {position === COUNTRY && <CountryStep country={country} language={language} onCountry={pickCountry} onLanguage={pickLanguage} />}

          {position >= TOUR && position < INCOME && (
            <HowItWorksTour index={position - TOUR} onNext={() => go(position + 1)} onBack={() => go(position - 1)} />
          )}

          {position === INCOME && (
            <div className="flex flex-col gap-5">
              <StepTitle>{t('¿Cómo te entra la plata?')}</StepTitle>
              <IncomeSourcesFields forms={sources} onChange={setSources} />
              <Why>{t('Con esto sé cuándo te entra plata y te aviso antes de que quedes corto. Es para planear: no se anota como ingreso.')}</Why>
            </div>
          )}

          {position === BALANCE && (
            <div className="flex flex-col gap-5">
              <div>
                <StepTitle>{t('¿Cuánta plata tienes hoy, más o menos?')}</StepTitle>
                <p className="mt-2 text-base text-ink/60">{t('Desde ese número sumamos y restamos lo que anotes: así tu saldo es el de verdad.')}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="welcome-balance">{t('Total aproximado')}</Label>
                <MoneyInput id="welcome-balance" value={balance} onChange={setBalance} placeholder="0" autoFocus />
                <p className="text-sm text-ink/60">
                  {t('Suma banco, Nequi y efectivo. No tiene que ser exacto y lo puedes corregir cuando quieras.')}
                </p>
              </div>
            </div>
          )}

          {position === PAYMENTS && (
            <div className="flex flex-col gap-5">
              <div>
                <StepTitle>{t('¿Qué pagas cada mes?')}</StepTitle>
                <p className="mt-2 text-base text-ink/60">{t('Apartamos esa plata antes de decirte cuánto puedes gastar. Toca los que tengas.')}</p>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t('Pagos frecuentes')}>
                {SUGGESTED_COMMITMENTS.map((name) => {
                  const selected = items.some((i) => i.name === name);
                  return (
                    <button
                      key={name}
                      type="button"
                      aria-pressed={selected}
                      onClick={() => toggleSuggestion(name)}
                      className={cn(
                        'inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-medium transition-[color,background-color,border-color,transform] duration-150 motion-safe:active:scale-[0.97]',
                        selected ? 'border-brand bg-brand-soft text-brand' : 'border-ink/15 text-ink/70 hover:border-ink/30',
                      )}
                    >
                      {selected && <Check className="size-4" strokeWidth={2.5} aria-hidden="true" />}
                      {name}
                    </button>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setItems((current) => [...current, newItem('', true)])}
                  className="inline-flex h-11 items-center gap-1.5 rounded-full border border-dashed border-ink/25 px-4 text-[15px] font-medium text-ink/70 transition-transform duration-150 hover:border-ink/40 motion-safe:active:scale-[0.97]"
                >
                  <Plus className="size-4" aria-hidden="true" />
                  {t('Otro')}
                </button>
              </div>

              {items.length > 0 && (
                <ul className="space-y-3">
                  {items.map((item) => (
                    <li key={item.key} className="rounded-2xl bg-surface p-4 ring-1 ring-ink/10 motion-safe:animate-rise">
                      <div className="flex items-center justify-between gap-2">
                        {item.custom ? (
                          <Input
                            aria-label={t('Nombre del pago')}
                            placeholder={t('Nombre del pago')}
                            maxLength={60}
                            value={item.name}
                            onChange={(e) => changeItem(item.key, { name: e.target.value })}
                          />
                        ) : (
                          <p className="font-medium">{item.name}</p>
                        )}
                        <button
                          type="button"
                          aria-label={t('Quitar {v1}', { v1: item.name || t('este pago') })}
                          onClick={() => setItems((current) => current.filter((i) => i.key !== item.key))}
                          className="-mr-2 grid size-11 shrink-0 place-items-center rounded-full text-ink/60 hover:text-ink"
                        >
                          <X className="size-4" aria-hidden="true" />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-[minmax(0,1fr)_88px] gap-3">
                        <div className="min-w-0 space-y-2">
                          <Label htmlFor={`amount-${item.key}`}>{t('Monto')}</Label>
                          <MoneyInput
                            id={`amount-${item.key}`}
                            value={item.amount}
                            showHint={false}
                            onChange={(amount) => changeItem(item.key, { amount })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor={`day-${item.key}`}>{t('Día')}</Label>
                          <Input
                            id={`day-${item.key}`}
                            inputMode="numeric"
                            maxLength={2}
                            placeholder="30"
                            value={item.dayOfMonth}
                            onChange={(e) => changeItem(item.key, { dayOfMonth: e.target.value.replace(/\D/g, '') })}
                          />
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </OnboardingShell>
      )}
    </div>
  );
}

/**
 * Página privada `/app/bienvenida` (FT-0036): saludo, país e idioma, recorrido y tres preguntas que
 * se pueden omitir, para que Rinde se ajuste a cómo le entra la plata a cada persona. Sale una vez;
 * todo se cambia luego en Cuenta. Con `?paso=preguntas` entra directo a las preguntas.
 */
export default function Welcome() {
  return (
    <ThemeProvider>
      <WelcomeSteps />
    </ThemeProvider>
  );
}
