import { describe, expect, it } from 'vitest';
import { transactionSchema } from '@/lib/validation/transaction';
import { pressKey, readDescription, readText, toTransaction } from '@/pages/app/Anotar';

describe('teclado de Anotar', () => {
  it('suma dígitos, 000 y borra el último', () => {
    let amount = '';
    for (const key of ['1', '5', '000']) amount = pressKey(amount, key);
    expect(amount).toBe('15000');
    expect(pressKey(amount, 'borrar')).toBe('1500');
  });

  it('no deja ceros a la izquierda ni pasa del máximo del servidor', () => {
    expect(pressKey('', '0')).toBe('');
    expect(pressKey('', '000')).toBe('');
    expect(pressKey('9999999999', '9')).toBe('9999999999');
  });
});

describe('toTransaction', () => {
  const base = { type: 'gasto', amount: '8000', description: ' Café ', category: 'ia', date: '2026-11-04', card: 'cash' };

  it('con "la IA la sugiere" y efectivo, va sin categoría ni tarjeta', () => {
    expect(toTransaction(base, transactionSchema).values).toEqual({
      type: 'gasto', amount: 8000, description: 'Café', date: '2026-11-04', category: null, card: null, installments: null,
    });
  });

  it('con tarjeta va en una cuota; en un ingreso la tarjeta no aplica', () => {
    expect(toTransaction({ ...base, card: 'c1', category: 'alimentacion' }, transactionSchema).values).toMatchObject({
      card: 'c1', installments: 1, category: 'alimentacion',
    });
    expect(toTransaction({ ...base, type: 'ingreso', card: 'c1' }, transactionSchema).values).toMatchObject({ card: null, installments: null });
  });

  it('con tarjeta lleva las cuotas elegidas y rechaza más de 48', () => {
    expect(toTransaction({ ...base, card: 'c1', installments: '6' }, transactionSchema).values).toMatchObject({ card: 'c1', installments: 6 });
    expect(toTransaction({ ...base, card: 'c1', installments: '60' }, transactionSchema).error).toBe('De 1 a 48 cuotas');
  });

  it('sin descripción devuelve el mismo error que el formulario', () => {
    expect(toTransaction({ ...base, description: '  ' }, transactionSchema).error).toBe('Escribe una descripción');
  });
});

describe('Anotar en una pantalla (Rinde v2)', () => {
  it('lee monto y descripción de lo que se escribe', () => {
    const read = readText('almuerzo 15 mil');
    expect(read.amount).toBe('15000');
    expect(read.description.toLowerCase()).toContain('almuerzo');
    expect(read.type).toBe('gasto');
  });

  it('reconoce un ingreso por cómo se dice', () => {
    expect(readText('me pagaron 300 mil').type).toBe('ingreso');
  });

  it('sin número no inventa un monto', () => {
    expect(readText('almuerzo').amount).toBe('');
  });

  it('solo un número en «¿En qué fue?» pasa al monto y deja la descripción vacía', () => {
    expect(readDescription('100000', false)).toMatchObject({ amount: '100000', description: '' });
  });

  it('con el monto ya escrito en su casilla, el número es parte del nombre', () => {
    expect(readDescription('iPhone 15', true)).toMatchObject({ amount: '', description: 'iPhone 15', date: null });
  });

  it('con el monto ya escrito, «ayer» sigue cambiando la fecha', () => {
    const read = readDescription('ayer taxi', true);
    expect(read.description).toBe('Taxi');
    expect(read.date).toBe(readText('ayer').date);
    expect(read.amount).toBe('');
  });

  it('el grupo Kakeibo va solo en los gastos', () => {
    const base = { amount: '15000', description: 'almuerzo', category: 'ia', date: '2026-11-10', card: 'cash', kakeibo: 'deseo' };
    expect(toTransaction({ ...base, type: 'gasto' }, transactionSchema).values.kakeibo).toBe('deseo');
    expect(toTransaction({ ...base, type: 'ingreso' }, transactionSchema).values.kakeibo).toBeUndefined();
  });
});
