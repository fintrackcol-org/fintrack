import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { createVerifiedSession } from './verified-session.helper.js';
import { pool } from './config/db.js';

// Pruebas contra la base real (FT-0059): necesitan el esquema de Mi plata (parche 011).
const { rows } = await pool.query("SELECT to_regclass('public.compromisos') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const TEST_DOMAIN = '@liquidity-test.fintrack.test';

after(async () => {
  if (!options.skip)
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  await pool.end();
});

/**
 * Levanta la app, crea un usuario con sesión y ejecuta `fn`.
 * @param {(api: Function, token: string) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withUser(fn) {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = async (path, { method = 'GET', body, token } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  try {
    const { accessToken } = await createVerifiedSession({
      email: `u-${randomUUID()}${TEST_DOMAIN}`,
      password: 'clave-segura-1',
    });
    await fn(api, accessToken);
  } finally {
    server.close();
  }
}

test('GET /liquidity exige sesión (401) y valida days (422)', options, async () => {
  await withUser(async (api, token) => {
    assert.equal((await api('/liquidity')).status, 401);
    assert.equal((await api('/liquidity?days=0', { token })).status, 422);
    assert.equal((await api('/liquidity?days=91', { token })).status, 422);
  });
});

test('sin Mi plata configurada responde ready: false', options, async () => {
  await withUser(async (api, token) => {
    const res = await api('/liquidity', { token });
    assert.equal(res.status, 200);
    assert.equal(res.body.ready, false);
  });
});

test(
  'con un pago más grande que la plata, dice cuándo y cuánto falta y por qué',
  options,
  async () => {
    await withUser(async (api, token) => {
      await api('/money-profile', {
        method: 'PUT',
        token,
        body: { incomeType: 'sin_fecha', balance: 1_000_000 },
      });
      const commitment = await api('/money-profile/commitments', {
        method: 'POST',
        token,
        body: { name: 'Renta del local', amount: 2_000_000, dayOfMonth: 15 },
      });
      assert.equal(commitment.status, 201);

      const res = await api('/liquidity', { token });
      assert.equal(res.status, 200);
      assert.equal(res.body.ready, true);
      assert.equal(res.body.money, 1_000_000);
      assert.equal(res.body.risk, 'falta');
      assert.equal(res.body.firstShortfall.missing, 1_000_000);
      assert.deepEqual(
        res.body.firstShortfall.causes.map((c) => c.name),
        ['Renta del local'],
      );
      assert.equal(res.body.days.length, 46, 'hoy más 45 días');
      assert.ok(res.body.assumptions.some((a) => a.includes('No contamos ingresos futuros')));
    });
  },
);
