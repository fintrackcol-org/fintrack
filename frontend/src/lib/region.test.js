import { afterEach, describe, expect, it } from 'vitest';
import { formatMoney, formatMoneyCompact } from '@/components/transactions/format';
import { formatMoneyInput, parseMoneyInput, parsePastedMoney } from '@/lib/money';
import {
  DEFAULT_REGION,
  currencySymbol,
  formatIn,
  isAbroad,
  localCurrency,
  localeFor,
  moneySample,
  regionForCountry,
  setRegion,
  suggestCountry,
} from '@/lib/region';

afterEach(() => setRegion(DEFAULT_REGION));

describe('país, moneda e idioma', () => {
  it('adivina el país por la zona horaria antes que por el idioma del celular', () => {
    expect(suggestCountry('America/Bogota', ['es-US'])).toBe('CO');
    expect(suggestCountry('Etc/UTC', ['es-419', 'pt-BR'])).toBe('BR');
    expect(suggestCountry('Etc/UTC', ['es'])).toBe('CO');
  });

  it('el país propone su moneda y su idioma', () => {
    expect(regionForCountry('BR')).toEqual({ country: 'BR', currency: 'BRL', language: 'pt' });
    // Mientras no haya mandarín, China propone inglés.
    expect(regionForCountry('CN')).toEqual({ country: 'CN', currency: 'CNY', language: 'en' });
  });

  it('quien viaja sigue viendo los números como en su casa', () => {
    expect(localeFor({ country: 'CO', currency: 'COP', language: 'es' })).toBe('es-CO');
    expect(localeFor({ country: 'MX', currency: 'COP', language: 'es' })).toBe('es-CO');
    expect(localeFor({ country: 'US', currency: 'USD', language: 'en' })).toBe('en-US');
  });

  it('de viaje: la moneda de allá se escribe con su código para no confundirla con la propia', () => {
    expect(isAbroad()).toBe(false);
    setRegion({ country: 'MX', currency: 'COP', language: 'es' });
    expect(isAbroad()).toBe(true);
    expect(localCurrency()).toBe('MXN');
    expect(currencySymbol('MXN')).toBe('MXN');
    expect(formatIn(200, 'MXN').replace(/\s/g, ' ')).toBe('MXN 200');
    expect(currencySymbol('COP')).toBe('$');
  });

  it('los números van como en la casa de la moneda, sin importar el idioma', () => {
    expect(localeFor({ country: 'BR', currency: 'BRL', language: 'es' })).toBe('pt-BR');
    setRegion({ country: 'BR', currency: 'BRL', language: 'es' });
    expect(formatMoneyInput('1234.56')).toBe('1.234,56');
  });

  it('en Colombia el dinero sale como siempre', () => {
    expect(formatMoney(12500).replace(/\s/g, ' ')).toBe('$ 12.500'); // Intl usa un espacio que no parte
    expect(formatMoneyInput('1234567.5')).toBe('1.234.567,5');
  });

  it('en Estados Unidos cambian el símbolo, los separadores y los centavos', () => {
    setRegion({ country: 'US', currency: 'USD', language: 'en' });
    expect(formatMoney(12500)).toBe('$12,500');
    expect(formatMoney(12.5)).toBe('$12.50');
    expect(formatMoneyCompact(1_200_000)).toBe('$1.2M');
    expect(formatMoneyInput('1234567.5')).toBe('1,234,567.5');
    expect(parseMoneyInput('1,234.5')).toBe('1234.5');
    expect(parsePastedMoney('12,50')).toBe('12.50');
  });

  it('muestra cómo se escribe la plata de un país antes de elegirlo, sin cambiar el actual', () => {
    expect(moneySample('CO', 1250000)).toMatch(/^\$\s1\.250\.000$/);
    expect(moneySample('US', 1250.5)).toBe('$1,250.50');
    expect(moneySample('BR', 1250.5)).toMatch(/^R\$\s1\.250,50$/);
    expect(formatMoney(12500)).toMatch(/^\$\s12\.500$/); // sigue en pesos colombianos
  });
});
