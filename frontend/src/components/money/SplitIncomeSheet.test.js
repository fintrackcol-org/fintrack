import { describe, expect, it } from 'vitest';
import { splitRows } from '@/components/money/SplitIncomeSheet';

describe('splitRows (FT-0060)', () => {
  it('en orden y sin las filas en cero', () => {
    const rows = splitRows({ commitments: 600000, socialSecurity: 0, salary: 700000, cushion: 700000, free: 0 });
    expect(rows.map((r) => r.key)).toEqual(['commitments', 'salary', 'cushion']);
  });
});
