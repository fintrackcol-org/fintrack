import { describe, expect, it } from 'vitest';
import { totalLinkLabel } from './totalLink';

describe('tarjetas de Ingresos y Gastos (FT-0068)', () => {
  it('dicen a dónde llevan, con el periodo', () => {
    expect(totalLinkLabel('ingresos', 'noviembre')).toBe('Ver ingresos de noviembre');
    expect(totalLinkLabel('gastos', 'esta semana')).toBe('Ver gastos de esta semana');
    expect(totalLinkLabel('gastos')).toBe('Ver gastos');
  });
});
