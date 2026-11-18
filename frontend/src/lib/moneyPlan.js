
import { dateLocale } from '@/lib/region';
import { t } from '@/lib/i18n';/**
 * `30 de noviembre` a partir de `2026-11-30`.
 * @param {string} date AAAA-MM-DD
 * @returns {string}
 */
export function dayAndMonth(date) {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' });
}

/** `1 día` o `3 días`. */
const daysText = (days) => (days === 1 ? t('1 día') : t('{days} días', { days }));

/**
 * Aviso del día, si se acerca o se pasa del límite.
 * @param {{ dayStatus: string, overBy: number, leftToday: number }} plan
 * @param {(value: number) => string} money Formatea un monto (o lo oculta).
 * @returns {string} Vacío si va bien.
 */
export function dayMessage({ dayStatus, overBy, leftToday }, money) {
  if (dayStatus === 'over') return t('Te pasaste {overBy} hoy', { overBy: money(overBy) });
  if (dayStatus === 'near') return t('Ya casi llegas: te quedan {leftToday}', { leftToday: money(leftToday) });
  return '';
}

/**
 * Lo primero que dice la tarjeta de Mi plata, según cómo le entra la plata al usuario.
 * @param {object} plan Respuesta de `GET /money-profile/plan` con `ready: true`.
 * @param {(value: number) => string} money Formatea un monto (o lo oculta).
 * @returns {{ label: string, value: string, note: string, warning?: boolean }}
 */
export function planHeadline(plan, money) {
  if (plan.mode === 'daily') {
    if (plan.shortfall > 0) {
      return {
        label: t('Te faltan'),
        value: money(plan.shortfall),
        note: t('Para tus pagos antes del {nextPay}', { nextPay: dayAndMonth(plan.nextPay) }),
        warning: true,
      };
    }
    return {
      label: t('Puedes gastar hoy'),
      value: money(plan.leftToday),
      note: t('Faltan {days} para tu pago', { days: daysText(plan.days) }),
    };
  }
  if (plan.mode === 'goal') {
    return {
      label: t('Para cubrir todo necesitas hacer'),
      value: `${money(plan.goal)} al día`,
      note: t('Hasta {until}, en {days}', { until: plan.until, days: daysText(plan.days) }),
    };
  }
  if (plan.shortfall > 0) {
    return {
      label: t('Te faltan'),
      value: money(plan.shortfall),
      note: t('Revisa tus movimientos o corrige tu saldo'),
      warning: true,
    };
  }
  if (plan.runwayDays === null) {
    return {
      label: t('Tienes libres'),
      value: money(plan.free),
      note: t('Con 14 días de movimientos te diremos para cuánto te alcanza'),
    };
  }
  return {
    label: t('Tu plata te alcanza para'),
    value: daysText(plan.runwayDays),
    note: t('A tu ritmo de {pace} al día', { pace: money(plan.pace) }),
  };
}
