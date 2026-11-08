import { describe, expect, it } from 'vitest';
import { categoryLabel, changeText, filterMovements, monthLabel, shiftMonth } from '@/components/negocios/movementFormat';

describe('movementFormat', () => {
  it('shiftMonth cruza años', () => {
    expect(shiftMonth('2026-11', 1)).toBe('2026-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
  });

  it('monthLabel muestra el año solo si no es el actual', () => {
    expect(monthLabel('2026-11', '2026-11')).toBe('noviembre');
    expect(monthLabel('2025-12', '2026-11')).toBe('diciembre 2025');
  });

  it('changeText describe el cambio', () => {
    expect(changeText(12.5, 'octubre')).toBe('+12,5 % que octubre');
    expect(changeText(-30, 'octubre')).toBe('−30 % que octubre');
    expect(changeText(0, 'octubre')).toBe('Igual que octubre');
    expect(changeText(null, 'octubre')).toBeNull();
  });
});

describe('categorías propias y filtros del historial (FT-0058)', () => {
  it('usa el nombre propio si lo hay, o el de siempre', () => {
    expect(categoryLabel({ category: 'c_ab12cd34', categoryName: 'Empaques' })).toBe('Empaques');
    expect(categoryLabel({ category: 'nomina', categoryName: null })).toBe('Nómina');
    expect(categoryLabel({ category: 'c_borrada' })).toBe('Otros');
  });

  it('filtra por tipo y por socio', () => {
    const movements = [
      { id: 1, kind: 'sale', registeredBy: { id: 'ana' } },
      { id: 2, kind: 'cost', registeredBy: { id: 'luis' } },
      { id: 3, kind: 'sale', registeredBy: { id: 'luis' } },
      { id: 4, kind: 'sale', registeredBy: null },
    ];
    const ids = (filter) => filterMovements(movements, filter).map((m) => m.id);
    expect(ids({ kind: 'all', partner: 'all' })).toEqual([1, 2, 3, 4]);
    expect(ids({ kind: 'sale', partner: 'all' })).toEqual([1, 3, 4]);
    expect(ids({ kind: 'sale', partner: 'luis' })).toEqual([3]);
  });
});
