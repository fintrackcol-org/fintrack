import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { createVerifiedSession } from './verified-session.helper.js';
import { pool } from './config/db.js';

// Versión del perfil (parche 039): `expectedVersion` opcional en las escrituras de Mi plata.
const { rows } = await pool.query(
  "SELECT 1 FROM information_schema.columns WHERE table_name = 'perfiles_financieros' AND column_name = 'version'",
);
const options = { skip: rows.length > 0 ? false : 'Esquema no aplicado: falta perfiles_financieros.version (parche 039)' };

const TEST_DOMAIN = '@version-test.fintrack.test';

after(async () => {
  if (!options.skip) await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  await pool.end();
});

/**
 * Levanta la app en un puerto libre, ejecuta `fn` y cierra el servidor.
 * @param {(api: (path: string, init?: object) => Promise<{ status: number, body: object, replayed: string|null }>) => Promise<void>} fn
 * @returns {Promise<void>}
 */
async function withApi(fn) {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = async (path, { method = 'GET', body, token, key } = {}) => {
    const res = await fetch(base + path, {
      method,
      headers: {
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(key && { 'Idempotency-Key': key }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null, replayed: res.headers.get('idempotent-replayed') };
  };
  try {
    await fn(api);
  } finally {
    server.close();
  }
}

/** @returns {Promise<{ token: string, userId: string }>} */
async function newUser() {
  const session = await createVerifiedSession({ email: `u-${randomUUID()}${TEST_DOMAIN}`, password: 'clave-segura-1' });
  return { token: session.accessToken, userId: session.user.id };
}

/**
 * @param {string} userId
 * @returns {Promise<{ saldoAt: string, adjustments: number }>}
 */
async function stored(userId) {
  const { rows: found } = await pool.query(
    `SELECT saldo_at::text AS "saldoAt", (SELECT count(*)::int FROM ajustes_saldo WHERE usuario_id = $1) AS adjustments
     FROM perfiles_financieros WHERE usuario_id = $1`,
    [userId],
  );
  return found[0];
}

const profile = (api, token) => api('/money-profile', { token });
const put = (api, token, body) => api('/money-profile', { method: 'PUT', token, body });

test('GET da version 0 sin perfil; cada escritura suma 1 y sin expectedVersion todo es como antes', options, async () => {
  await withApi(async (api) => {
    const { token } = await newUser();
    assert.equal((await profile(api, token)).body.version, 0);
    const first = await put(api, token, { incomeType: 'sin_fecha', balance: 100000 });
    assert.equal(first.status, 200);
    assert.equal(first.body.version, 1);
    const second = await put(api, token, { incomeType: 'sin_fecha', balance: 90000 });
    assert.equal(second.status, 200);
    assert.equal(second.body.version, 2);
    assert.equal(second.body.balance, 90000);
  });
});

test('dos correcciones con la misma versión: la segunda da 409 y no deja ajuste ni mueve saldo_at', options, async () => {
  await withApi(async (api) => {
    const { token, userId } = await newUser();
    const { body: start } = await put(api, token, { incomeType: 'sin_fecha', balance: 100000 });
    const seen = start.version;
    const ok = await put(api, token, { incomeType: 'sin_fecha', balance: 80000, resetBalance: true, expectedVersion: seen });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.version, seen + 1);
    const before = await stored(userId);
    const stale = await put(api, token, { incomeType: 'sin_fecha', balance: 50000, resetBalance: true, expectedVersion: seen });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'PROFILE_CHANGED');
    assert.equal(stale.body.error.message, 'Tu plata cambió en otro dispositivo. Revisa y vuelve a guardar.');
    assert.deepEqual(await stored(userId), before, 'ni ajuste nuevo ni saldo_at reiniciado');
    const { body } = await profile(api, token);
    assert.equal(body.balance, 80000);
    assert.equal(body.version, seen + 1);
  });
});

test('expectedVersion mal formada responde 422 y no guarda', options, async () => {
  await withApi(async (api) => {
    const { token } = await newUser();
    for (const expectedVersion of [-1, 1.5, '2']) {
      const res = await put(api, token, { incomeType: 'sin_fecha', balance: 1, expectedVersion });
      assert.equal(res.status, 422);
      assert.equal(res.body.error.details[0].field, 'expectedVersion');
    }
    assert.equal((await profile(api, token)).body.version, 0);
  });
});

test('bienvenida: primero la llave (la repetición responde 200), después la versión; un 409 suelta la llave', options, async () => {
  await withApi(async (api) => {
    const { token, userId } = await newUser();
    const body = { incomeType: 'sin_fecha', balance: 500000, commitments: [], expectedVersion: 0 };
    const key = `welcome-${randomUUID()}`;
    const first = await api('/money-profile/welcome', { method: 'POST', token, key, body });
    assert.equal(first.status, 200);
    assert.equal(first.body.version, 1);
    // Respuesta perdida: el reintento va con la misma llave y la versión que se leyó antes.
    const again = await api('/money-profile/welcome', { method: 'POST', token, key, body });
    assert.equal(again.status, 200);
    assert.equal(again.replayed, 'true');

    // Otra bienvenida con otra llave y una versión vieja no pisa nada y no deja su llave.
    const otherKey = `welcome-${randomUUID()}`;
    const late = await api('/money-profile/welcome', { method: 'POST', token, key: otherKey, body: { ...body, balance: 1 } });
    assert.equal(late.status, 409);
    assert.equal(late.body.error.code, 'PROFILE_CHANGED');
    const { rows: keys } = await pool.query('SELECT 1 FROM idempotency_keys WHERE usuario_id = $1 AND clave = $2', [userId, otherKey]);
    assert.equal(keys.length, 0);
    assert.equal((await profile(api, token)).body.balance, 500000);
    const fixed = await api('/money-profile/welcome', { method: 'POST', token, key: otherKey, body: { ...body, balance: 1, expectedVersion: 1 } });
    assert.equal(fixed.status, 200);
    assert.equal(fixed.body.version, 2);
  });
});

test('cambiar las fuentes sube la versión y respeta expectedVersion; el tutorial no la toca', options, async () => {
  await withApi(async (api) => {
    const { token } = await newUser();
    const sources = { sources: [{ kind: 'sueldo', amount: 2000000, payDays: [30] }] };
    const saved = await api('/money-profile/sources', { method: 'PUT', token, body: { ...sources, expectedVersion: 0 } });
    assert.equal(saved.status, 200);
    assert.equal((await profile(api, token)).body.version, 1);
    const stale = await api('/money-profile/sources', { method: 'PUT', token, body: { sources: [], expectedVersion: 0 } });
    assert.equal(stale.status, 409);
    assert.equal(stale.body.error.code, 'PROFILE_CHANGED');
    assert.equal((await api('/money-profile/income', { token })).body.sources.length, 1, 'no se borraron');
    await api('/money-profile/tutorial', { method: 'POST', token });
    assert.equal((await profile(api, token)).body.version, 1);
    assert.equal((await api('/money-profile/sources', { method: 'PUT', token, body: sources })).status, 200);
    assert.equal((await profile(api, token)).body.version, 2);
  });
});
