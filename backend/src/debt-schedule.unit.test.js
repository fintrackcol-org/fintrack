import { test } from 'node:test';
import assert from 'node:assert/strict';
import { addPeriods, progress, schedule } from './services/debt-schedule.js';

// Cuotas y abonos de las cuentas con personas (FT-0064), sin base de datos.

test('suma periodos: semanal, quincenal (15 días) y mensual con fin de mes', () => {
  assert.equal(addPeriods('2026-11-15', 'weekly', 1), '2026-11-22');
  assert.equal(addPeriods('2026-11-15', 'biweekly', 2), '2026-12-15');
  assert.equal(addPeriods('2026-01-31', 'monthly', 1), '2026-02-28');
  assert.equal(addPeriods('2026-11-30', 'monthly', 3), '2027-02-28');
});

test('reparte el monto en cuotas iguales y la última absorbe los centavos', () => {
  const cuotas = schedule({ amount: 100000, installments: 3, frequency: 'monthly', firstDueDate: '2026-11-15' });
  assert.deepEqual(
    cuotas.map((c) => [c.number, c.date, c.amount]),
    [
      [1, '2026-11-15', 33333.33],
      [2, '2026-12-15', 33333.33],
      [3, '2027-01-15', 33333.34],
    ],
  );
});

test('el saldo pendiente siempre es el monto menos los abonos', () => {
  const debt = { amount: 750000, installments: 5, frequency: 'biweekly', firstDueDate: '2026-10-15' };
  const p = progress(debt, 300000);
  assert.equal(p.paid, 300000);
  assert.equal(p.pending, 450000);
  assert.equal(p.paidInstallments, 2);
  assert.deepEqual(p.next, { number: 3, date: '2026-11-14', amount: 150000 });
});

test('un abono parcial deja la cuota en curso con lo que le falta', () => {
  const debt = { amount: 300000, installments: 3, frequency: 'monthly', firstDueDate: '2026-11-01' };
  const p = progress(debt, 150000);
  assert.equal(p.paidInstallments, 1);
  assert.deepEqual(p.next, { number: 2, date: '2026-12-01', amount: 50000 });
});

test('pagada completa no tiene próxima cuota', () => {
  const debt = { amount: 300000, installments: 3, frequency: 'monthly', firstDueDate: '2026-11-01' };
  const p = progress(debt, 300000);
  assert.equal(p.pending, 0);
  assert.equal(p.next, null);
});

test('a fecha fija, lo pendiente vence en la fecha límite', () => {
  const p = progress({ amount: 60000, dueDate: '2026-11-30' }, 20000);
  assert.deepEqual(p.next, { number: 1, date: '2026-11-30', amount: 40000 });
});
