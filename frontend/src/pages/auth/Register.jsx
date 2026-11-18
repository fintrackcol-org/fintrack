import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import AuthLayout from '@/components/auth/AuthLayout';
import CheckInbox from '@/components/auth/CheckInbox';
import FormField from '@/components/auth/FormField';
import PasswordInput from '@/components/auth/PasswordInput';
import PasswordStrength from '@/components/auth/PasswordStrength';
import SocialAuth from '@/components/auth/SocialAuth';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { getReturnTo, invitationKind } from '@/auth/returnTo';
import usePageTitle from '@/hooks/usePageTitle';
import { registerSchema } from '@/lib/validation/auth';
import { register as registerUser, resendVerification } from '@/services/authService';
import { t } from '@/lib/i18n';

/**
 * Pantalla de registro (Rinde v2): nombre, correo y una contraseña con su fuerza en vivo. Valida en el
 * cliente (zod) con mensajes que dicen cómo arreglar el error. Al crear la cuenta no entra: muestra "Confirma tu correo" con reenvío, porque la API no da
 * sesión hasta abrir el enlace que llega al correo (FT-0016).
 */
export default function Register() {
  usePageTitle(t('Crear cuenta'));
  const location = useLocation();
  const invitation = invitationKind(getReturnTo(location.state?.from));
  const [serverError, setServerError] = useState('');
  const [sentTo, setSentTo] = useState(null);

  const {
    register,
    control,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      acceptTerms: false,
    },
  });
  const password = useWatch({ control, name: 'password' });

  const onSubmit = async (data) => {
    setServerError('');
    try {
      const { email } = await registerUser(data);
      setSentTo(email);
    } catch (err) {
      setServerError(err.message || t('No pudimos crear tu cuenta. Inténtalo de nuevo.'));
    }
  };

  if (sentTo) {
    return (
      <CheckInbox
        title={t('Confirma tu correo')}
        subtitle={
          <>
            {t('Te enviamos un enlace a')} <strong className="font-medium text-white">{sentTo}</strong>{t('. Ábrelo para activar tu cuenta y entrar.')}
          </>
        }
        tips={[
          t('El enlace vence en 24 horas y sirve una sola vez.'),
          t('¿No lo ves? Revisa las carpetas de spam o promociones.'),
        ]}
        onResend={() => resendVerification(sentTo)}
        onChangeEmail={() => setSentTo(null)}
        footer={
          <Link
            to="/login"
            state={{ email: sentTo, from: location.state?.from }}
            className="font-medium text-violet-light transition-colors hover:text-white"
          >
            {t('Ya lo confirmé, iniciar sesión')}
          </Link>
        }
      />
    );
  }

  return (
    <AuthLayout
      mode="register"
      title={t('Que tu plata alcance')}
      subtitle={t('Crea tu cuenta en un minuto. Los campos con * son obligatorios.')}
      footer={
        <>
          <span className="text-white/55">{t('¿Ya tienes cuenta?')} </span>
          <Link
            to="/login"
            state={location.state?.from ? { from: location.state.from } : undefined}
            className="font-medium text-violet-light transition-colors hover:text-white"
          >
            {t('Inicia sesión')}
          </Link>
        </>
      }
    >
      {invitation && (
        <p className="rounded-xl bg-violet/15 px-4 py-3 text-sm text-violet-light" role="status">
          {t('Te invitaron a')} {invitation === 'vaca' ? 'una vaca' : 'un negocio'}{t('. Al crear tu cuenta e iniciar sesión te llevamos a la invitación.')}
        </p>
      )}
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <div className="space-y-4">
          <FormField id="name" label={t('¿Cómo te llamas? *')} error={errors.name?.message}>
            <Input autoComplete="given-name" placeholder={t('Tu nombre')} maxLength={60} aria-required="true" {...register('name')} />
          </FormField>
          {!errors.name && <p className="-mt-2 text-xs text-white/55">{t('Así te saludamos en la app.')}</p>}

          <FormField id="email" label={t('Correo *')} error={errors.email?.message}>
            <Input type="email" autoComplete="email" inputMode="email" placeholder={t('tu@correo.com')} aria-required="true" {...register('email')} />
          </FormField>
          {!errors.email && <p className="-mt-2 text-xs text-white/55">{t('Te enviamos un enlace para confirmarlo.')}</p>}

          <div className="space-y-2">
            <FormField id="password" label={t('Contraseña *')} error={errors.password?.message}>
              <PasswordInput
                autoComplete="new-password"
                placeholder={t('Crea una contraseña')}
                aria-required="true"
                aria-describedby="password-strength"
                {...register('password')}
              />
            </FormField>
            <PasswordStrength id="password-strength" password={password} />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <Controller
              name="acceptTerms"
              control={control}
              render={({ field }) => (
                <Checkbox
                  id="acceptTerms"
                  className="mt-0.5"
                  checked={field.value}
                  onCheckedChange={(v) => field.onChange(v === true)}
                  aria-invalid={errors.acceptTerms ? true : undefined}
                  aria-describedby={errors.acceptTerms ? 'acceptTerms-error' : undefined}
                />
              )}
            />
            <Label htmlFor="acceptTerms" className="leading-snug text-white/55">
              {t('Soy mayor de edad y acepto los')}{' '}
              <Link to="/terminos" target="_blank" rel="noopener" className="text-violet-light underline underline-offset-4">
                {t('términos de uso')}
              </Link>{' '}
              {t('y la')}{' '}
              <Link to="/privacidad" target="_blank" rel="noopener" className="text-violet-light underline underline-offset-4">
                {t('política de privacidad')}
              </Link>{' '}
              {t('de Rinde.')}
            </Label>
          </div>
          {errors.acceptTerms && (
            <p id="acceptTerms-error" className="text-sm text-destructive">
              {errors.acceptTerms.message}
            </p>
          )}
        </div>

        {serverError && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive" role="alert">
            {serverError}
          </p>
        )}

        <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
          {isSubmitting ? t('Creando cuenta…') : t('Crear cuenta')}
        </Button>
      </form>

      <SocialAuth mode="register" />
    </AuthLayout>
  );
}
