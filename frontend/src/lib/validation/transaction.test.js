import { afterEach, describe, expect, it, vi } from 'vitest';
import { FUTURE_DATE_MESSAGE, transactionSchema } from './transaction';

const BASE = { type: 'gasto', amount: '5000', description: 'Almuerzo', category: '', card: null, installments: '' };
const dateError = (date) =>
  transactionSchema.safeParse({ ...BASE, date }).error?.issues.find((i) => i.path[0] === 'date')?.message;

describe('fecha del movimiento (FT-0061)', () => {
  afterEach(() => vi.useRealTimers());

  it('acepta hoy y ayer; rechaza mañana y el año siguiente', () => {
    // 31 de diciembre, 11:59 p. m. en el dispositivo: "hoy" sigue siendo el 31.
    vi.useFakeTimers({ now: new Date(2026, 11, 31, 23, 59) });
    expect(dateError('2026-12-31')).toBeUndefined();
    expect(dateError('2026-12-30')).toBeUndefined();
    expect(dateError('2027-01-01')).toBe(FUTURE_DATE_MESSAGE);
    expect(dateError('2027-12-31')).toBe(FUTURE_DATE_MESSAGE);
  });
});
