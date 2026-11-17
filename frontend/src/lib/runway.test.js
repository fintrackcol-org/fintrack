import { describe, expect, it } from 'vitest';
import { daysLabel, runway, untilText } from './runway';

describe('te alcanza (Rinde v2)', () => {
  it('cuenta los días que dura la plata al ritmo del mes', () => {
    // 10 de noviembre, $300.000 gastados: $30.000 al día. Con $420.000 alcanza 14 días.
    const r = runway({ balance: 420000, monthExpense: 300000, today: new Date(2026, 10, 10) });
    expect(r.days).toBe(14);
    expect(r.pace).toBe(30000);
    expect(r.lasts).toBe(false);
    expect(untilText(r)).toBe('hasta el 24 nov');
    expect(r.coverage).toBeCloseTo(14 / 20);
  });

  it('dice si llega a fin de mes', () => {
    const r = runway({ balance: 2_000_000, monthExpense: 100000, today: new Date(2026, 10, 10) });
    expect(r.lasts).toBe(true);
    expect(r.coverage).toBe(1);
    expect(untilText(r)).toBe('pasa el fin de mes');
  });

  it('sin saldo o sin gastos no inventa un número', () => {
    expect(runway({ balance: null, monthExpense: 100 })).toBeNull();
    expect(runway({ balance: 1000, monthExpense: 0 })).toBeNull();
  });

  it('con saldo negativo no da días negativos', () => {
    expect(runway({ balance: -5000, monthExpense: 10000, today: new Date(2026, 10, 5) }).days).toBe(0);
  });

  it('pone el plural bien', () => {
    expect(daysLabel(1)).toBe('1 día');
    expect(daysLabel(3)).toBe('3 días');
  });
});
