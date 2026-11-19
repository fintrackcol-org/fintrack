import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createExchangeRateService } from './services/exchange-rates.service.js';

/**
 * Repositorio en memoria que simula la tabla `tasas_cambio`.
 * @param {Record<string, number>} [saved] Tasas ya guardadas, por `"fecha base moneda"`.
 * @returns {object}
 */
function memoryRepo(saved = {}) {
  return {
    saved,
    findRate: async (date, base, quote) => saved[`${date} ${base} ${quote}`] ?? null,
    latestRate: async (base, quote) => {
      const keys = Object.keys(saved).filter((k) => k.endsWith(` ${base} ${quote}`)).sort();
      const last = keys.at(-1);
      return last ? { rate: saved[last], date: last.split(' ')[0] } : null;
    },
    saveRate: async (date, base, quote, rate) => {
      saved[`${date} ${base} ${quote}`] = rate;
    },
  };
}

const answer = (body, ok = true) => async () => ({ ok, status: ok ? 200 : 500, json: async () => body });
const offline = async () => {
  throw new Error('sin red');
};

test('la misma moneda vale 1 y no pregunta a nadie', async () => {
  const service = createExchangeRateService({ fetch: offline, repository: memoryRepo() });
  assert.deepEqual(await service.getRate({ from: 'COP', to: 'COP', date: '2026-11-17' }), {
    from: 'COP', to: 'COP', date: '2026-11-17', rate: 1, stale: false,
  });
});

test('trae la tasa de Frankfurter una vez y la guarda para la próxima', async () => {
  const repo = memoryRepo();
  let calls = 0;
  const fetch = async (url) => {
    calls += 1;
    assert.match(url, /base=MXN&quotes=COP&date=2026-11-10/);
    return answer([{ date: '2026-11-10', base: 'MXN', quote: 'COP', rate: 176.44 }])();
  };
  const service = createExchangeRateService({ fetch, repository: repo });
  const first = await service.getRate({ from: 'MXN', to: 'COP', date: '2026-11-10' });
  const second = await service.getRate({ from: 'MXN', to: 'COP', date: '2026-11-10' });
  assert.equal(first.rate, 176.44);
  assert.equal(second.rate, 176.44);
  assert.equal(calls, 1);
});

test('si Frankfurter no responde usa la última tasa guardada y lo avisa (stale)', async () => {
  const repo = memoryRepo({ '2026-11-15 MXN COP': 175 });
  const service = createExchangeRateService({ fetch: offline, repository: repo });
  assert.deepEqual(await service.getRate({ from: 'MXN', to: 'COP', date: '2026-11-17' }), {
    from: 'MXN', to: 'COP', date: '2026-11-15', rate: 175, stale: true,
  });
});

test('sin Frankfurter y sin tasa guardada responde 503 para que la persona la escriba', async () => {
  const service = createExchangeRateService({ fetch: answer({}, false), repository: memoryRepo() });
  await assert.rejects(service.getRate({ from: 'MXN', to: 'COP', date: '2026-11-17' }), (err) => {
    assert.equal(err.statusCode, 503);
    assert.equal(err.code, 'RATE_UNAVAILABLE');
    return true;
  });
});
