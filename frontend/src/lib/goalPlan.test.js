import { describe, expect, it } from 'vitest';
import { cushion, isCushionGoal, isTooMuch, monthlyFixed, weeklyPlan } from '@/lib/goalPlan';

describe('goalPlan', () => {
  it('reparte lo que falta en las semanas que quedan, redondeado a mil', () => {
    expect(weeklyPlan({ goal: 1200000, saved: 640000, deadline: '2026-12-15', today: '2026-11-10' })).toEqual({ perWeek: 112000, weeks: 5 });
    expect(weeklyPlan({ goal: 1000, deadline: null, today: '2026-11-10' })).toBeNull();
    expect(weeklyPlan({ goal: 1000, deadline: '2026-11-01', today: '2026-11-10' })).toBeNull();
  });

  it('avisa cuando pasa del 30 % de lo que entra por semana', () => {
    expect(isTooMuch(200000, 600000)).toBe(true);
    expect(isTooMuch(100000, 600000)).toBe(false);
    expect(isTooMuch(100000, null)).toBe(false);
  });

  it('colchón: 3 meses de gastos fijos y días que se aguanta', () => {
    const fixed = monthlyFixed([{ amount: 900000 }, { amount: 3600000, frequency: 'yearly' }]);
    expect(fixed).toBe(1200000);
    expect(cushion({ fixed, saved: 720000 })).toEqual({ goal: 3600000, days: 18 });
    expect(cushion({ fixed: 0, saved: 10 })).toBeNull();
    expect(isCushionGoal({ name: 'Fondo de Emergencia' })).toBe(true);
  });
});
