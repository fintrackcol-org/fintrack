import { z } from 'zod';
import { t } from '@/lib/i18n';

const MAX_AMOUNT = 9_999_999_999.99;

/** Movimiento del negocio (FT-0017): monto y descripción obligatorios; la fecha, hasta hoy. */
export const businessMovementSchema = (today) =>
  z.object({
    // '' se rechaza antes de convertir: z.coerce.number() lo volvería 0.
    amount: z
      .string()
      .trim()
      .min(1, t('Ingresa un monto'))
      .pipe(
        z.coerce
          .number({ error: t('Ingresa un monto válido') })
          .positive(t('El monto debe ser mayor que 0'))
          .max(MAX_AMOUNT, t('El monto es demasiado grande')),
      ),
    description: z.string().trim().min(1, t('Escribe una descripción')).max(120, t('Máximo 120 caracteres')),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, t('Elige una fecha'))
      .refine((d) => d <= today, t('No puede ser una fecha futura')),
  });
