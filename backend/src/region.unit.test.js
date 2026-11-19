import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { COUNTRY_DATA } from './i18n/countries.js';
import { aiRegionRule, cleanRegion, currencyDigits, currentRegion, excelMoneyFormat, formatMoney, numberLocale, t, withRegion } from './i18n/index.js';

const plain = (s) => s.replace(/\s/g, ' ');

test('la tabla de países es la misma que la de la app', () => {
  const front = readFileSync(new URL('../../frontend/src/lib/region.js', import.meta.url), 'utf8');
  const rows = [...front.matchAll(/'([A-Z]{2} [A-Z]{3} [a-z]{2} [\w/]+)'/g)].map((m) => m[1]);
  assert.deepEqual(rows, COUNTRY_DATA);
});

test('sin región o con datos raros, Colombia en español', () => {
  assert.deepEqual(currentRegion(), { language: 'es', currency: 'COP', country: 'CO' });
  assert.deepEqual(cleanRegion({ language: 'xx', currency: 'NOPE', country: 'colombia' }), {
    language: 'es',
    currency: 'COP',
    country: 'CO',
  });
  assert.deepEqual(cleanRegion({ language: 'EN', currency: 'usd', country: 'us' }), { language: 'en', currency: 'USD', country: 'US' });
});

test('el dinero va con la moneda y el formato de su casa', () => {
  assert.equal(plain(formatMoney(12500)), '$ 12.500');
  withRegion({ language: 'en', currency: 'USD', country: 'US' }, () => {
    assert.equal(formatMoney(12.5), '$12.50');
    assert.equal(numberLocale(), 'en-US');
  });
  withRegion({ language: 'es', currency: 'BRL', country: 'BR' }, () => assert.equal(numberLocale(), 'pt-BR'));
});

test('t() traduce en la región actual, llena variables y sin traducción deja el español', () => {
  assert.equal(t('Texto que no existe {n}', { n: 3 }), 'Texto que no existe 3');
  withRegion({ language: 'en' }, () => assert.equal(t('Texto que no existe'), 'Texto que no existe'));
});

test('reportes y Excel: pesos sin centavos, reales con centavos y su símbolo', () => {
  assert.equal(currencyDigits(), 0);
  assert.equal(excelMoneyFormat(), '"$" #,##0;[Red]-"$" #,##0');
  withRegion({ language: 'pt', currency: 'BRL', country: 'BR' }, () => {
    assert.equal(currencyDigits(), 2);
    assert.equal(excelMoneyFormat({ red: false }), '"R$" #,##0.00');
  });
});

test('la IA solo recibe la regla de idioma fuera del español con pesos', () => {
  assert.equal(aiRegionRule(), '');
  withRegion({ language: 'en', currency: 'USD', country: 'US' }, () => assert.match(aiRegionRule(), /solo en inglés.*USD/));
});
