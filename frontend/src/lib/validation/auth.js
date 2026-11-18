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

/**
 * Qué tan fuerte es una contraseña (registro): 1 punto por 8+ caracteres, 1 por mezclar letras y
 * números, 1 por una mayúscula o un símbolo. Desde "Media" ya cumple lo mínimo.
 * @param {string} password
 * @returns {{ score: 0|1|2|3, label: string, tips: string[] }}
 */
export function passwordStrength(password) {
  const tips = [];
  if (password.length < 8) tips.push('usa al menos 8 caracteres');
  if (!(/\d/.test(password) && /[a-z]/i.test(password))) tips.push(t('mezcla letras y números'));
  if (!(/[A-Z]/.test(password) || /[^a-z0-9]/i.test(password))) tips.push(t('agrega una mayúscula o un símbolo'));
  const score = password ? 3 - tips.length : 0;
  return { score, label: score <= 1 ? t('Débil') : score === 2 ? t('Media') : t('Fuerte'), tips };
}

/** Formulario "¿Olvidaste tu contraseña?": solo el correo. */
export const forgotPasswordSchema = z.object({ email });

/** Formulario de la contraseña nueva, al abrir el enlace del correo. */
export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, t('Confirma tu contraseña')),
  })
  .refine((data) => data.password === data.confirmPassword, PASSWORDS_MISMATCH);
