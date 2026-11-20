import { t } from '@/lib/i18n';

// Aparte de `transaction.js` para que quien solo necesita la fecha no descargue zod.

/** Fecha de hoy en la zona horaria del dispositivo, como AAAA-MM-DD. */
export function today() {
  return new Date().toLocaleDateString('en-CA');
}

/** Un movimiento ya pasó; lo que viene va en el calendario de pagos (FT-0061). */
export const FUTURE_DATE_MESSAGE = t('No puedes anotar un movimiento en el futuro');
