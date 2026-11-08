import { describe, expect, it } from 'vitest';
import { avoidTips, chartPoints, hasData, shortDay } from './liquidity';

const money = (n) => `$${n}`;
const shortfall = {
  date: '2026-11-20',
  missing: 300_000,
  causes: [
    { kind: 'compromiso', name: 'Internet', amount: 50_000 },
    { kind: 'card', name: 'Visa', amount: 250_000 },
  ],
};

describe('motor de liquidez en pantalla (FT-0059)', () => {
  it('las fechas no se corren un día por la zona horaria', () => {
    expect(shortDay('2026-12-01')).toBe('1 dic');
  });

  it('la gráfica marca el hueco y los pagos de cada día, sin los ingresos esperados', () => {
    const points = chartPoints(
      [
        { date: '2026-11-19', end: 10_000, events: [] },
        {
          date: '2026-11-20',
          end: -300_000,
          events: [
            { kind: 'card', name: 'Visa', amount: 250_000 },
            { kind: 'esperado', name: 'Sueldo', amount: 1 },
          ],
        },
      ],
      '2026-11-20',
    );
    expect(points[0]).toMatchObject({ shortfall: false, payments: [] });
    expect(points[1]).toMatchObject({ label: '20 nov', shortfall: true, payments: [{ name: 'Visa', amount: 250_000 }] });
  });

  it('consejos: tope diario, cobrar lo que le deben y mover los pagos más grandes primero', () => {
    const tips = avoidTips(
      { risk: 'falta', firstShortfall: shortfall, safeDailySpend: 28_000, pace: 40_000, receivable: 200_000 },
      money,
    );
    expect(tips).toEqual([
      'Gasta máximo $28000 al día (hoy gastas unos $40000).',
      'Cobra lo que te deben ($200000): te faltaría menos.',
      'Paga el mínimo de Visa y abona el resto después.',
      'Mira si puedes correr unos días «Internet».',
    ]);
  });

  it('si lo que le deben cubre el hueco, lo dice; sin hueco no hay consejos', () => {
    const tips = avoidTips({ risk: 'falta', firstShortfall: shortfall, safeDailySpend: 0, pace: null, receivable: 300_000 }, money);
    expect(tips[0]).toBe('Cobra lo que te deben ($300000): con eso llegas.');
    expect(avoidTips({ risk: 'ok', firstShortfall: null, safeDailySpend: 0, pace: 1 }, money)).toEqual([]);
  });

  it('sin pagos ni gasto normal no hay nada que proyectar', () => {
    expect(hasData({ pace: null, days: [{ events: [] }] })).toBe(false);
    expect(hasData({ pace: 1, days: [] })).toBe(true);
  });
});
