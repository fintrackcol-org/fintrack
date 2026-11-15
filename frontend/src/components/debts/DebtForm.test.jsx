import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DebtForm from '@/components/debts/DebtForm';
import { debtSchema } from '@/lib/validation/debt';

const base = { person: 'Laura', amount: '200000', loanDate: '2026-11-01', plan: 'once', installments: '4', frequency: 'monthly', dueDate: '', note: '' };

describe('DebtForm', () => {
  it('empieza en el paso 1: quién, cuánto y cuándo se prestó', () => {
    const html = renderToStaticMarkup(<DebtForm onSubmit={() => {}} />);
    for (const t of ['Paso 1 de 3', '¿Quién te debe?', '¿Cuánto? (COP)', '¿Cuándo le prestaste?', 'Siguiente']) {
      expect(html).toContain(t);
    }
  });

  it('en cuotas pide de 2 a 60 y la fecha de la primera, que no sea antes del préstamo', () => {
    expect(debtSchema.safeParse(base).success).toBe(true);
    const plan = { ...base, plan: 'installments' };
    const paths = (v) => debtSchema.safeParse(v).error?.issues.map((i) => i.path[0]) ?? [];
    expect(paths({ ...plan, installments: '1', dueDate: '2026-12-01' })).toEqual(['installments']);
    expect(paths(plan)).toEqual(['dueDate']);
    expect(paths({ ...plan, dueDate: '2026-10-01' })).toEqual(['dueDate']);
    expect(paths({ ...plan, dueDate: '2026-12-01' })).toEqual([]);
  });
});
