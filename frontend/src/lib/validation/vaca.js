import { z } from 'zod';
import { t } from '@/lib/i18n';

const MAX_AMOUNT = 9_999_999_999.99;

/**
 * Formulario para crear o editar una vaca (FT-0014). Sigue `POST /vacas`: nombre y meta
 * obligatorios; fecha límite, descripción y reparto opcionales.
 */
export const vacaSchema = z.object({
  name: z.string().trim().min(1, t('Ponle un nombre a la vaca')).max(60, t('Máximo 60 caracteres')),
  goal: z.coerce
    .number({ error: t('Ingresa un monto válido') })
    .positive(t('La meta debe ser mayor que 0'))
    .max(MAX_AMOUNT, t('El monto es demasiado grande')),
  description: z.string().trim().max(200, t('Máximo 200 caracteres')),
  deadline: z.string(),
  split: z.enum(['igual', 'personalizado']),
});

/** Formulario de un aporte: monto, fecha (no futura) y nota opcional. */
export const contributionSchema = z.object({
  amount: z.coerce
    .number({ error: t('Ingresa un monto válido') })
    .positive(t('El aporte debe ser mayor que 0'))
    .max(MAX_AMOUNT, t('El monto es demasiado grande')),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('Elige una fecha')),
  note: z.string().trim().max(120, t('Máximo 120 caracteres')),
  category: z.string(),
});
