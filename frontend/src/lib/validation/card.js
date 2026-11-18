import { z } from 'zod';
import { TIERS } from '@/lib/cardStyles';
import { t } from '@/lib/i18n';

const MAX_AMOUNT = 9_999_999_999.99;
// '' se rechaza antes de convertir: z.coerce.number() lo volvería 0.
const filled = (msg) => z.string().trim().min(1, msg);
const money = (positiveMsg) =>
  filled(t('Ingresa un monto')).pipe(z.coerce.number({ error: t('Ingresa un monto válido') }).positive(positiveMsg).max(MAX_AMOUNT, t('El monto es demasiado grande')));
const day = filled(t('Ingresa un día')).pipe(z.coerce.number({ error: t('Ingresa un día') }).int(t('Ingresa un día')).min(1, t('Del 1 al 31')).max(31, t('Del 1 al 31')));

const base = z.object({
  network: z.enum(Object.keys(TIERS)),
  tier: z.string(),
  last4: z.string().regex(/^\d{4}$/, t('Escribe exactamente 4 dígitos')),
  name: z.string().trim().max(40, t('Máximo 40 caracteres')),
  limit: money(t('El cupo debe ser mayor que 0')),
  paymentDay: day,
  cutoffDay: z.union([z.literal(''), day]),
  // Solo mes y año del plástico (FT-0065): nunca el número completo ni el CVV.
  expiry: z.string().trim().regex(/^((0[1-9]|1[0-2])\/\d{2})?$/, t('Escribe el mes y el año: MM/AA')).optional(),
});

const tierMatchesNetwork = (v) => TIERS[v.network]?.includes(v.tier);
const TIER_ISSUE = { message: t('Elige un tipo de tarjeta'), path: ['tier'] };

/** Crear tarjeta: el disponible de hoy no puede pasar del cupo (el backend calcula lo usado). */
export const cardSchema = base
  .extend({ available: filled(t('Ingresa un monto')).pipe(z.coerce.number({ error: t('Ingresa un monto válido') }).min(0, t('No puede ser negativo')).max(MAX_AMOUNT, t('El monto es demasiado grande'))) })
  .refine(tierMatchesNetwork, TIER_ISSUE)
  .refine((v) => v.available <= v.limit, { message: t('No puede ser mayor que el cupo total'), path: ['available'] });

/** Editar tarjeta: sin disponible (la deuda solo cambia con pagos o al actualizar con el banco). */
export const cardEditSchema = base.refine(tierMatchesNetwork, TIER_ISSUE);

const optionalDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, t('Fecha inválida'));

/** "Ya pagué": monto y fecha. */
export const payCardSchema = z.object({ amount: money(t('El pago debe ser mayor que 0')), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, t('Elige una fecha')) });

/** "Actualizar con el banco": el cupo disponible es obligatorio; extracto y fecha límite no. */
export const bankSyncSchema = z.object({
  available: filled(t('Ingresa un monto')).pipe(z.coerce.number({ error: t('Ingresa un monto válido') }).min(0, t('No puede ser negativo')).max(MAX_AMOUNT, t('El monto es demasiado grande'))),
  statementTotal: z.union([z.literal(''), money(t('El total debe ser mayor que 0'))]),
  statementDueDate: optionalDate,
});
