import { describe, expect, it } from 'vitest';
import { dueText, paidPercent } from './accountFormat';

describe('cuentas del negocio (FT-0058)', () => {
  const today = '2026-11-10';
  it('dice cuándo vence o hace cuánto venció', () => {
    expect(dueText({ status: 'pendiente', dueDate: '2026-11-10' }, today)).toBe('Vence hoy');
    expect(dueText({ status: 'pendiente', dueDate: '2026-11-11' }, today)).toBe('Vence mañana');
    expect(dueText({ status: 'pendiente', dueDate: '2026-11-20' }, today)).toBe('Vence el 20 nov');
    expect(dueText({ status: 'vencida', dueDate: '2026-11-09' }, today)).toBe('Venció ayer');
    expect(dueText({ status: 'vencida', dueDate: '2026-11-01' }, today)).toBe('Venció hace 9 días');
    expect(dueText({ status: 'pendiente', dueDate: null }, today)).toBe('Sin fecha');
    expect(dueText({ status: 'pagada', dueDate: '2026-11-01' }, today)).toBe('Pagada');
  });

  it('el avance del abono no pasa de 100 %', () => {
    expect(paidPercent({ amount: 300, paid: 100 })).toBe(33);
    expect(paidPercent({ amount: 300, paid: 300 })).toBe(100);
  });
});
