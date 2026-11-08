import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { createVerifiedSession } from './verified-session.helper.js';
import { pool } from './config/db.js';

// Pruebas contra la base real (FT-0060): necesitan las fuentes de ingreso (parche 023).
const { rows } = await pool.query("SELECT to_regclass('public.fuentes_ingreso') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const TEST_DOMAIN = '@income-test.fintrack.test';

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

test('las rutas de ingresos exigen sesión (401) y validan (422)', options, async () => {
  await withUser(async (api, token) => {
    assert.equal((await api('/money-profile/income')).status, 401);
    assert.equal((await api('/money-profile/sources', { method: 'PUT', token, body: { sources: [{ kind: 'loteria' }] } })).status, 422);
    assert.equal((await api('/money-profile/income/split?amount=0', { token })).status, 422);
  });
});

test('PUT /sources guarda varias fuentes y GET /income da el mes normal y el flaco', options, async () => {
  await withUser(async (api, token) => {
    const empty = await api('/money-profile/income', { token });
    assert.equal(empty.status, 200);
    assert.equal(empty.body.basis, 'none');

    const saved = await api('/money-profile/sources', {
      method: 'PUT',
      token,
      body: { sources: [{ kind: 'proyectos', lastMonths: [3_000_000, 1_200_000, 2_500_000] }, { kind: 'diario', amount: 70_000, workDays: 6 }] },
    });
    assert.equal(saved.status, 200);
    assert.equal(saved.body.sources.length, 2);
    assert.equal(saved.body.sources[0].name, 'Proyectos', 'sin nombre, el del tipo');
    assert.equal(saved.body.independent, true);
    assert.ok(saved.body.ownSalary > 0);
    assert.ok(saved.body.socialSecurity.total > 0);
    assert.ok(saved.body.workDay.daysLeft > 0);

    // Compatibilidad: sin días fijos queda "sin fecha".
    const profile = await api('/money-profile', { token });
    assert.equal(profile.body.incomeType, 'sin_fecha');

    // Reemplazar deja solo las nuevas.
    const replaced = await api('/money-profile/sources', { method: 'PUT', token, body: { sources: [{ kind: 'sueldo', amount: 2_000_000, payDays: [15, 30] }] } });
    assert.deepEqual(replaced.body.sources.map((s) => s.kind), ['sueldo']);
    assert.equal(replaced.body.lean, 2_000_000);
    assert.equal(replaced.body.ownSalary, null);
    assert.equal((await api('/money-profile', { token })).body.incomeType, 'fecha_fija');
  });
});

test('GET /income/split reparte el ingreso sin pasarse de lo que entró', options, async () => {
  await withUser(async (api, token) => {
    await api('/money-profile/sources', { method: 'PUT', token, body: { sources: [{ kind: 'proyectos', lastMonths: [1_200_000, 1_500_000] }] } });
    const { status, body } = await api('/money-profile/income/split?amount=2000000', { token });
    assert.equal(status, 200);
    assert.equal(body.commitments + body.socialSecurity + body.salary + body.cushion + body.free, 2_000_000);
    assert.equal(body.large, true);
  });
});
