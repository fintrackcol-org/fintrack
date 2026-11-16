import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import BigAmountWarning, { BIG_AMOUNT, isBigAmount } from './BigAmountWarning';
import NegativeBalanceNote from '@/components/money/NegativeBalanceNote';

describe('isBigAmount', () => {
  it('pregunta desde el límite, no antes', () => {
    expect(isBigAmount(BIG_AMOUNT - 1)).toBe(false);
    expect(isBigAmount(BIG_AMOUNT)).toBe(true);
    expect(isBigAmount('50000000')).toBe(true);
  });

  it('al editar, no vuelve a preguntar por el mismo monto ya guardado', () => {
    expect(isBigAmount(50_000_000, 50_000_000)).toBe(false);
    expect(isBigAmount(50_000_000, 50_000)).toBe(true);
  });

  it('el aviso dice el monto', () => {
    expect(renderToStaticMarkup(<BigAmountWarning amount={50_000_000} />)).toContain('50.000.000');
  });
});

describe('NegativeBalanceNote', () => {
  const render = (money) => renderToStaticMarkup(<MemoryRouter><NegativeBalanceNote money={money} /></MemoryRouter>);

  it('solo sale con saldo negativo', () => {
    expect(render(-50_000_000)).toContain('Tus gastos superan lo que tienes');
    expect(render(0)).toBe('');
    expect(render(1000)).toBe('');
    expect(render(null)).toBe('');
    expect(render(undefined)).toBe('');
  });
});
