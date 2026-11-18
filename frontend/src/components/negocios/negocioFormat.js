/**
 * Textos compartidos de Emprendimientos (FT-0016).
 */
import { appOrigin } from '@/components/vacas/vacaFormat';
import { t } from '@/lib/i18n';
import { numberLocale } from '@/lib/region';

/** Nombre, explicación y colores de cada rol. */
export const ROLES = {
  dueno: { label: t('Dueño'), hint: t('Administra el negocio y sus socios'), chip: 'bg-brand-soft text-brand' },
  editor: { label: t('Editor'), hint: t('Registra ventas y gastos'), chip: 'bg-positive/15 text-positive' },
  lector: { label: t('Lector'), hint: t('Solo ve las finanzas (p. ej. el contador)'), chip: 'bg-ink/10 text-ink/70' },
};

/** Opciones para elegir un rol. */
export const ROLE_OPTIONS = Object.entries(ROLES).map(([value, { label }]) => ({ value, label }));

const percent = new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: 2 });

/**
 * @param {number} value
 * @returns {string} p. ej. `33,33 %`.
 */
export function formatShare(value) {
  return `${percent.format(value)} %`;
}

/**
 * Enlace para invitar al negocio (lo abre la PWA; si no hay sesión, pasa por el login y vuelve).
 * @param {string} code
 * @param {string} [origin]
 * @returns {string}
 */
export function inviteLink(code, origin = appOrigin()) {
  return `${origin}/app/negocios/unirse/${code}`;
}
