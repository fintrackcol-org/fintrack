import { describe, expect, it } from 'vitest';
import { groupByDay, withAdjustments } from '@/components/money/MovementList';
import { formatRelativeDay } from '@/components/transactions/format';

describe('groupByDay', () => {
  it('junta los movimientos seguidos del mismo día, con su nombre corto', () => {
    const now = new Date(2026, 10, 4);
    const groups = groupByDay(
      [
        { id: 'a', date: '2026-11-04' },
        { id: 'b', date: '2026-11-04' },
        { id: 'c', date: '2026-11-03' },
        { id: 'd', date: '2026-11-01' },
      ],
      now,
    );
    expect(groups.map((g) => [g.day, g.items.map((t) => t.id)])).toEqual([
      ['Hoy', ['a', 'b']],
      ['Ayer', ['c']],
      [formatRelativeDay('2026-11-01', now), ['d']],
    ]);
  });
});

describe('withAdjustments (FT-0062)', () => {
  const moves = [{ id: 'a', date: '2026-11-04' }, { id: 'b', date: '2026-11-02' }];
  const adjustments = [{ id: 'x', date: '2026-11-02' }, { id: 'y', date: '2026-11-01' }];

  it('pone cada ajuste al inicio de su día', () => {
    expect(withAdjustments(moves, adjustments, true).map((r) => r.id)).toEqual(['a', 'x', 'b', 'y']);
  });

  it('si faltan páginas, deja para después los ajustes más viejos que lo cargado', () => {
    expect(withAdjustments(moves, adjustments, false).map((r) => r.id)).toEqual(['a', 'x', 'b']);
  });

  it('un mes sin movimientos igual muestra sus ajustes', () => {
    expect(withAdjustments([], adjustments, true).map((r) => [r.id, r.adjustment])).toEqual([['x', true], ['y', true]]);
  });
});
