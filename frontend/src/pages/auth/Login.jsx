import { useEffect, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Loader2 } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import FormField from '@/components/auth/FormField';
import PasswordInput from '@/components/auth/PasswordInput';
import SocialAuth from '@/components/auth/SocialAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import usePageTitle from '@/hooks/usePageTitle';
import { lazyResolver } from '@/lib/validation/lazyResolver';
import { ACCOUNT_DELETED_KEY, useAuth } from '@/auth/AuthContext';
import { getReturnTo, invitationKind } from '@/auth/returnTo';
import { resendVerification } from '@/services/authService';
import { t } from '@/lib/i18n';

// zod baja al validar por primera vez, no con la página.
const resolver = lazyResolver(() => import('@/lib/validation/auth').then((m) => m.loginSchema));

/**
 * Pantalla de inicio de sesión. Valida en el cliente (zod), inicia la sesión con `signIn`
 * (AuthContext) y lleva a la página que el usuario pidió, o a `/app`.
 * Si viene del registro, precarga el correo. Si la cuenta aún no confirma el correo (FT-0016),
 * ofrece reenviar el enlace.
 */
export default function Login() {
  usePageTitle(t('Iniciar sesión'));
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signIn } = useAuth();
  const [serverError, setServerError] = useState('');
  // Correo de la cuenta sin confirmar con el que se intentó entrar, y el aviso del reenvío.
  const [unverified, setUnverified] = useState(null);
  const [resendNotice, setResendNotice] = useState('');
  // Aviso de un solo uso tras eliminar la cuenta (FT-0017); se borra al mostrarlo.
  const [accountDeleted] = useState(() => readFlag(ACCOUNT_DELETED_KEY));
  useEffect(() => {
    if (accountDeleted) removeFlag(ACCOUNT_DELETED_KEY);
  }, [accountDeleted]);
  const invitation = invitationKind(getReturnTo(location.state?.from));

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver,
    defaultValues: { email: location.state?.email ?? '', password: '', remember: false },
  });
  // El correo escrito pasa a "¿Olvidaste tu contraseña?" para no tener que escribirlo otra vez.
  const email = useWatch({ control, name: 'email' });

  const onSubmit = async (values) => {
    setServerError('');
    setUnverified(null);
    setResendNotice('');
    try {
      await signIn(values);
      navigate(getReturnTo(location.state?.from), { replace: true });
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') setUnverified(values.email);
      setServerError(err.message || t('No pudimos iniciar sesión. Inténtalo de nuevo.'));
    }
  };

  const resend = async () => {
    setResendNotice('');
    try {
      await resendVerification(unverified);
      setResendNotice(t('Te enviamos un enlace nuevo. Revisa tu correo.'));
    } catch (err) {
      setResendNotice(err.message);
    }
  };

  // Si ya hay sesión, no tiene sentido mostrar el formulario.
  if (user) {
    return <Navigate to={getReturnTo(location.state?.from)} replace />;
  }

  return (
    <AuthLayout
      mode="login"
      title={t('Inicia sesión en tu cuenta')}
      subtitle={t('Ingresa tus datos para continuar con tus finanzas.')}
      footer={
        <>
          <span className="text-white/55">{t('¿Primera vez en Rinde?')} </span>
          <Link
            to="/registro"
            state={location.state?.from ? { from: location.state.from } : undefined}
            className="font-medium text-violet-light transition-colors hover:text-white"
          >
            {t('Crea tu cuenta gratis')}
          </Link>
        </>
      }
    >
      {invitation && (
        <p className="rounded-xl bg-violet/15 px-4 py-3 text-sm text-violet-light" role="status">
          {t('Te invitaron a')} {invitation === 'vaca' ? 'una vaca' : 'un negocio'}{t('. Inicia sesión o crea tu cuenta y te llevamos a la invitación.')}
        </p>
      )}
      {location.state?.passwordReset && (
        <p className="rounded-xl bg-mint/10 px-4 py-3 text-sm text-mint" role="status">
          {t('Contraseña actualizada. Inicia sesión con la nueva.')}
        </p>
      )}
      {accountDeleted && (
        <p className="rounded-xl bg-white/10 px-4 py-3 text-sm text-white/80" role="status">
          {t('Eliminamos tu cuenta y tus datos. Te enviamos un correo de confirmación.')}
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div className="space-y-4">
          <FormField id="email" label={t('Correo electrónico')} error={errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" placeholder={t('tu@correo.com')} {...register('email')} />
          </FormField>
          <FormField id="password" label={t('Contraseña')} error={errors.password?.message}>
            <PasswordInput autoComplete="current-password" placeholder={t('Tu contraseña')} {...register('password')} />
          </FormField>
        </div>

        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Controller
              name="remember"
              control={control}
              render={({ field }) => (
                <Checkbox id="remember" checked={field.value} onCheckedChange={(v) => field.onChange(v === true)} />
              )}
            />
            <Label htmlFor="remember" className="text-white/55">
              {t('Recordarme 30 días')}
            </Label>
          </div>
          <Link
            to="/recuperar"
            state={{ email }}
            className="text-sm text-white/60 underline-offset-4 transition-colors hover:text-white hover:underline"
          >
            {t('¿Olvidaste tu contraseña?')}
          </Link>
        </div>

        {serverError && (
          <div className="space-y-2 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            <p>{serverError}</p>
            {unverified && (
              <button
                type="button"
                onClick={resend}
                className="font-medium text-white underline underline-offset-4 transition-colors hover:text-violet-light"
              >
                {t('Reenviar enlace')}
              </button>
            )}
          </div>
        )}
        {resendNotice && (
          <p className="text-center text-sm text-white/65" role="status">
            {resendNotice}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? t('Ingresando…') : t('Iniciar sesión')}
        </Button>
      </form>

      <SocialAuth mode="login" />
    </AuthLayout>
  );
}

/** @param {string} key @returns {boolean} */
function readFlag(key) {
  try {
    return sessionStorage.getItem(key) === '1';
  } catch {
    return false;
  }
}

/** @param {string} key */
function removeFlag(key) {
  try {
    sessionStorage.removeItem(key);
  } catch {
    // Sin almacenamiento: no hay nada que borrar.
  }
}
