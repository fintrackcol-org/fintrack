import { z } from 'zod';

const MAX_AMOUNT = 9_999_999_999.99;

const optionalDate = z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/, 'Fecha inválida');

// '' se rechaza antes de convertir: z.coerce.number() lo volvería 0.
const amount = z
  .string()
  .trim()
  .min(1, 'Ingresa un monto')
  .pipe(
    z.coerce
      .number({ error: 'Ingresa un monto válido' })
      .positive('El monto debe ser mayor que 0')
      .max(MAX_AMOUNT, 'El monto es demasiado grande'),
  );

/**
 * Cuenta por cobrar o por pagar (FT-0046): persona y monto obligatorios; fechas y nota no.
 * Con `plan: 'installments'` pide número de cuotas (2–60), frecuencia y fecha de la primera
 * (va en `dueDate`, como espera la API); la fecha del préstamo no puede ser después.
 */
export const debtSchema = z
  .object({
    person: z.string().trim().min(1, 'Escribe el nombre').max(60, 'Máximo 60 caracteres'),
    amount,
    loanDate: optionalDate,
    plan: z.enum(['once', 'installments']),
    installments: z.string().trim(),
    frequency: z.enum(['weekly', 'biweekly', 'monthly']),
    dueDate: optionalDate,
    note: z.string().trim().max(200, 'Máximo 200 caracteres'),
  })
  .superRefine((v, ctx) => {
    if (v.plan === 'installments') {
      const n = Number(v.installments);
      if (!Number.isInteger(n) || n < 2 || n > 60) {
        ctx.addIssue({ code: 'custom', path: ['installments'], message: 'De 2 a 60 cuotas' });
      }
      if (!v.dueDate)
        ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'Elige la fecha de la primera cuota' });
    }
    if (v.loanDate && v.dueDate && v.loanDate > v.dueDate) {
      ctx.addIssue({ code: 'custom', path: ['dueDate'], message: 'No puede ser antes del préstamo' });
    }
  });

/** "Registrar abono": monto y fecha; que no pase de lo pendiente lo revisa el formulario. */
export const debtPaymentSchema = z.object({
  amount,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Elige una fecha'),
});
