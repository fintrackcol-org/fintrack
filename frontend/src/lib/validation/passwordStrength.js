import { t } from '@/lib/i18n';

// Aparte de `auth.js` para que el indicador de fuerza no descargue zod.

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
