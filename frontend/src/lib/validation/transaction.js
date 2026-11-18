import { z } from 'zod';
import { t } from '@/lib/i18n';

/** Fecha de hoy en la zona horaria del dispositivo, como AAAA-MM-DD. */
export function today() {
  return new Date().toLocaleDateString('en-CA');
}

/** Un movimiento ya pasó; lo que viene va en el calendario de pagos (FT-0061). */
export const FUTURE_DATE_MESSAGE = t('No puedes anotar un movimiento en el futuro');

/**
 * Formulario de transacción. Sigue el contrato de `POST /transactions`:
 * monto mayor que 0 (REQ-007), descripción de hasta 200 caracteres y fecha AAAA-MM-DD.
 * `category` vacío significa "que la IA la sugiera". `card` (id) e `installments` (1–48) van solo en un gasto con tarjeta.
 */
export const transactionSchema = z.object({
  type: z.enum(['gasto', 'ingreso']),
  amount: z.coerce
    .number({ error: t('Ingresa un monto válido') })
    .positive(t('El monto debe ser mayor que 0'))
    .max(9_999_999_999.99, t('El monto es demasiado grande')),
  description: z
    .string()
    .trim()
    .min(1, t('Escribe una descripción'))
    .max(200, t('Usa máximo 200 caracteres')),
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, t('Elige una fecha'))
    .refine((date) => date <= today(), FUTURE_DATE_MESSAGE),
  category: z.string(),
  card: z.string().nullable(),
  // '' se deja pasar aquí (campo oculto sin tarjeta) y se exige abajo; así nunca se vuelve 0.
  installments: z.union([
    z.literal(''),
    z.string().trim().min(1).pipe(z.coerce.number({ error: t('Ingresa las cuotas') }).int(t('De 1 a 48 cuotas')).min(1, t('De 1 a 48 cuotas')).max(48, t('De 1 a 48 cuotas'))),
  ], { error: t('De 1 a 48 cuotas') }),
})
  .refine((v) => v.type !== 'gasto' || !v.card || v.installments !== '', { message: t('Ingresa las cuotas'), path: ['installments'] })
  // Tarjeta y cuotas solo aplican a un gasto pagado con tarjeta.
  .transform((v) => {
    const carded = v.type === 'gasto' && Boolean(v.card);
    return { ...v, card: carded ? v.card : null, installments: carded ? v.installments : null };
  });
