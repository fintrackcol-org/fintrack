import { describe, expect, it } from 'vitest';
import { firstUncovered } from './MiPlataMobile';

const pagos = [
  { name: 'Netflix', amount: 26900, dayOfMonth: 8 },
  { name: 'Plan celular', amount: 45000, dayOfMonth: 15 },
  { name: 'Arriendo', amount: 450000, dayOfMonth: 28 },
];
const today = new Date(2026, 10, 14);

describe('Mi plata: el pago que no alcanza (Rinde v2)', () => {
  it('avisa el primer pago después del día en que se acaba la plata', () => {
    const r = { until: new Date(2026, 10, 22), lasts: false };
    expect(firstUncovered(pagos, r, today).name).toBe('Arriendo');
  });

  it('no avisa si la plata llega a fin de mes', () => {
    expect(firstUncovered(pagos, { until: new Date(2026, 11, 3), lasts: true }, today)).toBeNull();
  });

  it('no cuenta los pagos que ya pasaron', () => {
    const r = { until: new Date(2026, 10, 14), lasts: false };
    expect(firstUncovered(pagos, r, today).name).toBe('Plan celular');
  });
});
