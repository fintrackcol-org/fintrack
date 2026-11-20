import { z } from 'zod';
import { t } from '@/lib/i18n';

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, t('Ingresa tu correo electrónico'))
  .pipe(z.email(t('Ingresa un correo válido')));

/** Formulario de inicio de sesión. */
export const loginSchema = z.object({
  email,
  password: z.string().min(1, t('Ingresa tu contraseña')),
  remember: z.boolean(),
});

/** Contraseña nueva (registro y recuperación): 8+ caracteres con al menos una letra y un número. */
const newPassword = z
  .string()
  .min(8, t('Usa al menos 8 caracteres'))
  .max(72, t('Usa máximo 72 caracteres'))
  .regex(/[A-Za-z]/, t('Incluye al menos una letra'))
  .regex(/\d/, t('Incluye al menos un número'));

/** Error cuando las dos contraseñas no coinciden; se muestra debajo de `confirmPassword`. */
const PASSWORDS_MISMATCH = { message: t('Las contraseñas no coinciden'), path: ['confirmPassword'] };

/**
 * Formulario de registro (Rinde v2): nombre, correo y una sola contraseña con el ojo para verla y su
 * fuerza en vivo. Sigue `POST /auth/register { name, email, password, acceptTerms }`.
 */
export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, t('Escribe tu nombre: no puede quedar solo con espacios.'))
    .max(60, t('Máximo 60 caracteres')),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, t('Ingresa tu correo electrónico'))
    .pipe(z.email(t('Al correo le falta algo: revisa la @ y el final, por ejemplo .com o .co'))),
  password: newPassword,
  acceptTerms: z.boolean().refine((v) => v, t('Debes ser mayor de edad y aceptar los términos para continuar')),
});

export { passwordStrength } from './passwordStrength';

/** Formulario "¿Olvidaste tu contraseña?": solo el correo. */
export const forgotPasswordSchema = z.object({ email });

/** Formulario de la contraseña nueva, al abrir el enlace del correo. */
export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, t('Confirma tu contraseña')),
  })
  .refine((data) => data.password === data.confirmPassword, PASSWORDS_MISMATCH);
