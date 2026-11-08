import { describe, expect, it } from 'vitest';
import { liquidityMessage, longDay } from './LiquidityCard';

const money = (n) => `$${n}`;
const base = { pace: 40000, until: '2026-11-30', safeDailySpend: 20000, lowest: { date: '2026-11-18', amount: 40000 } };

describe('LiquidityCard (FT-0059)', () => {
  it('rojo: cuándo y cuánto falta, y cuánto gastar al día para llegar', () => {
    const msg = liquidityMessage(
      { ...base, risk: 'falta', firstShortfall: { date: '2026-11-20', missing: 300000 } },
      money,
    );
    expect(msg.title).toBe('El 20 de noviembre te faltan $300000');
    expect(msg.detail).toBe('Si gastas máximo $20000 al día, llegas.');
  });

  it('amarillo: justo, con el día más bajo', () => {
    expect(liquidityMessage({ ...base, risk: 'riesgo', firstShortfall: null }, money).title).toBe(
      'Justo: el 18 de noviembre te quedan $40000',
    );
  });

  it('verde: vas bien hasta el final de la proyección', () => {
    expect(liquidityMessage({ ...base, risk: 'ok', firstShortfall: null }, money).title).toBe('Vas bien hasta el 30 de noviembre');
  });

  it('las fechas no se corren un día por la zona horaria', () => {
    expect(longDay('2026-12-01')).toBe('1 de diciembre');
  });
});
