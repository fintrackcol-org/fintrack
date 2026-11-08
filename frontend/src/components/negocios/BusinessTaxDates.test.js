import { describe, expect, it } from 'vitest';
import { taxWhen } from './BusinessTaxDates';

describe('fechas de impuestos del negocio (FT-0058)', () => {
  it('dice cuánto falta', () => {
    const today = '2026-11-17';
    expect(taxWhen('2026-11-17', today)).toBe('Hoy');
    expect(taxWhen('2026-11-18', today)).toBe('Mañana');
    expect(taxWhen('2026-11-20', today)).toBe('En 3 días');
    expect(taxWhen('2026-11-16', today)).toBe('Pasó');
  });
});
