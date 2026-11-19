import { z } from 'zod';
import { t } from '@/lib/i18n';

/**
 * Formulario de presupuesto. Sigue el contrato de `POST /budgets`: categoría de gasto y
 * límite mayor que 0. El mes no se pide: es el que se está viendo en la pantalla.
 */
export const budgetSchema = z.object({
  category: z.string().min(1, t('Elige una categoría')),
  amount: z.coerce
    .number({ error: t('Ingresa un monto válido') })
    .positive(t('El límite debe ser mayor que 0'))
    .max(9_999_999_999.99, t('El monto es demasiado grande')),
});
