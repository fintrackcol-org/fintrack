import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBusinessAdvice, ruleBusinessAdvice } from './services/negocio-advice.service.js';

// Consejo sobre el mes del negocio (FT-0058).

const base = {
  sale: 1_000_000,
  cost: 400_000,
  variable: 100_000,
  fixed: 300_000,
  otherIncome: 0,
  netProfit: 200_000,
  netMargin: 20,
  breakEven: 600_000,
  breakEvenReached: true,
  previous: { saleChange: 5 },
};

test('reglas: del problema más urgente al más leve', () => {
  const zero = { ...base, sale: 0, cost: 0, variable: 0, fixed: 0, netProfit: 0, netMargin: null, breakEven: null };
  assert.match(ruleBusinessAdvice(zero, { current: true }), /Aún no hay movimientos/);
  assert.match(ruleBusinessAdvice({ ...base, sale: 0 }, { current: true }), /ninguna venta/);
  assert.match(ruleBusinessAdvice({ ...base, breakEven: null }, { current: true }), /no alcanza a cubrir/);
  const losing = { ...base, sale: 500_000, netProfit: -100_000, breakEvenReached: false };
  assert.match(ruleBusinessAdvice(losing, { current: true }), /te faltan \$\s?100\.000/);
  assert.match(ruleBusinessAdvice(losing, { current: false }), /cerró en pérdida/);
  assert.match(ruleBusinessAdvice({ ...base, previous: { saleChange: -30 } }, { current: true }), /bajaron 30 %/);
  assert.match(ruleBusinessAdvice({ ...base, netMargin: 5 }, { current: true }), /margen de 5 %/);
  assert.match(ruleBusinessAdvice(base, { current: true }), /Vas bien/);
});

test('la IA solo recibe cifras, se guarda mientras no cambien y si falla quedan las reglas', async () => {
  const prompts = [];
  let fail = false;
  const advice = createBusinessAdvice({
    generate: async ({ prompt }) => {
      prompts.push(prompt);
      if (fail) throw new Error('sin cuota');
      return '  Sube un poco el precio.  ';
    },
    loadMonth: async () => ({ month: '2026-10', panel: base }),
    now: () => Date.parse('2026-11-08T15:00:00Z'),
  });
  const first = await advice.getBusinessAdvice('u1', 'n1', '2026-10');
  assert.deepEqual(first, { advice: 'Sube un poco el precio.', source: 'ia', month: '2026-10' });
  assert.match(prompts[0], /Mes cerrado/);
  assert.doesNotMatch(prompts[0], /u1|n1/);
  await advice.getBusinessAdvice('u1', 'n1', '2026-10');
  assert.equal(prompts.length, 1, 'la segunda vez sale de la caché');

  fail = true;
  const other = createBusinessAdvice({
    generate: async () => {
      throw new Error('sin cuota');
    },
    loadMonth: async () => ({ month: '2026-10', panel: base }),
  });
  assert.equal((await other.getBusinessAdvice('u1', 'n1', '2026-10')).source, 'reglas');
});
