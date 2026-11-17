import { describe, expect, it } from 'vitest';
import { addPeriods, progress, schedule } from '@/lib/debtSchedule';
import { initials, progressText } from '@/lib/debts';

describe('debtSchedule', () => {
  it('mensual se queda en el último día de los meses cortos', () => {
    expect(addPeriods('2027-01-31', 'monthly', 1)).toBe('2027-02-28');
    expect(addPeriods('2026-11-15', 'biweekly', 2)).toBe('2026-12-15');
  });

  it('la última cuota absorbe los centavos', () => {
    const cuotas = schedule({ amount: 100000, installments: 3, frequency: 'monthly', firstDueDate: '2026-12-01' });
    expect(cuotas.map((c) => c.amount)).toEqual([33333.33, 33333.33, 33333.34]);
  });

  it('un abono parcial deja la cuota en curso con lo que falta', () => {
    const debt = { amount: 200000, installments: 4, frequency: 'monthly', firstDueDate: '2026-12-01' };
    expect(progress(debt, 70000)).toEqual({
      paid: 70000,
      pending: 130000,
      paidInstallments: 1,
      next: { number: 2, date: '2027-01-01', amount: 30000 },
    });
  });
});

describe('textos de cuentas', () => {
  const money = (n) => `$${n}`;
  it('progressText cuenta las cuotas', () => {
    expect(progressText({ amount: 200, paid: 50, installments: 4, paidInstallments: 1 }, money)).toBe(
      'Pagado $50 de $200 · 1 de 4 cuotas',
    );
    expect(progressText({ amount: 200, paid: 0 }, money)).toBe('Pagado $0 de $200');
  });
  it('initials', () => {
    expect(initials('Laura Gómez Ruiz')).toBe('LR');
    expect(initials('mamá')).toBe('M');
  });
});
