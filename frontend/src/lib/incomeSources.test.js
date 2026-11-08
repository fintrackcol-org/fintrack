import { describe, expect, it } from 'vitest';
import { emptyForm, fromApiSources, incomeHeadline, toApiSources, toggleKind } from '@/lib/incomeSources';

describe('incomeSources (FT-0060)', () => {
  it('el formulario va a la API con números o null', () => {
    const forms = toggleKind(toggleKind({}, 'proyectos'), 'diario');
    forms.proyectos = { ...forms.proyectos, lastMonths: ['3000000', '', '2500000'] };
    forms.diario = { ...forms.diario, amount: '70000' };
    const [proyectos, diario] = toApiSources(forms);
    expect(proyectos).toMatchObject({ kind: 'proyectos', lastMonths: [3000000, 2500000], amount: null, frequency: 'irregular' });
    expect(diario).toMatchObject({ kind: 'diario', amount: 70000, workDays: 6, frequency: 'diario' });
  });

  it('lo guardado vuelve al formulario para cambiarlo', () => {
    const forms = fromApiSources([{ kind: 'sueldo', amount: 2000000, frequency: 'mensual', payDays: [15, 30], low: null, high: null, lastMonths: [], workDays: null }]);
    expect(forms.sueldo).toEqual({ ...emptyForm('sueldo'), amount: '2000000', payDays: [15, 30] });
  });

  it('elegir dos veces un tipo lo quita', () => {
    expect(toggleKind(toggleKind({}, 'mesada'), 'mesada')).toEqual({});
  });

  it('la frase del mes normal y el flaco', () => {
    expect(incomeHeadline({ normal: 2500000, lean: 1200000, basis: 'declared' })).toMatch(/normal te entran \$\s?2\.500\.000; en uno flaco, \$\s?1\.200\.000/);
    expect(incomeHeadline({ normal: 2000000, lean: 2000000, basis: 'declared' })).toMatch(/al mes/);
    expect(incomeHeadline({ normal: 0, lean: 0, basis: 'none' })).toBeNull();
  });
});
