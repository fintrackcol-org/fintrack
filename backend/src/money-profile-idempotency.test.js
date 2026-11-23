import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { createApp } from './app.js';
import { createVerifiedSession } from './verified-session.helper.js';
import { pool } from './config/db.js';
import { env } from './config/env.js';

// Base real: necesita el esquema de `db/init/` (o el parche 038) con la tabla de llaves.
const { rows } = await pool.query("SELECT to_regclass('public.idempotency_keys') AS tabla");
const options = {
  skip: rows[0].tabla ? false : 'Esquema no aplicado: ejecuta db/init/*.sql sobre la base de datos',
};

const TEST_DOMAIN = '@idempotency-test.fintrack.test';
const WELCOME = {
  incomeType: 'fecha_fija',
  payDays: [15, 30],
  balance: 900000,
  commitments: [
    { name: 'Arriendo', amount: 350000, dayOfMonth: 30 },
    { name: 'Celular', amount: 50000, dayOfMonth: 22 },
  ],
};

// Las llaves caen con el usuario por ON DELETE CASCADE.
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
        ...(key !== undefined && { 'Idempotency-Key': key }),
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
 * @returns {Promise<number>} Llaves guardadas del usuario.
 */
async function keyCount(userId) {
  const { rows: found } = await pool.query('SELECT count(*)::int AS n FROM idempotency_keys WHERE usuario_id = $1', [userId]);
  return found[0].n;
}

const welcome = (api, token, key, body = WELCOME) => api('/money-profile/welcome', { method: 'POST', token, key, body });

test('repetir la misma llave no aplica nada otra vez y avisa que es repetición', options, async () => {
  await withApi(async (api) => {
    const { token, userId } = await newUser();
    const key = `welcome-${randomUUID()}`;
    const first = await welcome(api, token, key);
    assert.equal(first.status, 200);
    assert.equal(first.replayed, null);
    const again = await welcome(api, token, key);
    assert.equal(again.status, 200);
    assert.equal(again.replayed, 'true');
    assert.deepEqual(again.body, first.body);
    assert.equal(again.body.commitments.length, 2);
    assert.equal(again.body.balance, 900000);
    assert.equal(await keyCount(userId), 1);
  });
});

test('5 peticiones iguales a la vez: se aplica una sola y todas responden 200', options, async () => {
  await withApi(async (api) => {
    const { token } = await newUser();
    const key = `welcome-${randomUUID()}`;
    const results = await Promise.all(Array.from({ length: 5 }, () => welcome(api, token, key)));
    assert.deepEqual(results.map((r) => r.status), [200, 200, 200, 200, 200]);
    assert.equal(results.filter((r) => r.replayed === null).length, 1, 'una sola aplicación');
    const { body } = await api('/money-profile', { token });
    assert.equal(body.commitments.length, 2);
    assert.ok(results.every((r) => r.body.balanceAt === body.balanceAt));
  });
});

test('respuesta perdida: el reintento tardío no pisa lo que el usuario cambió después', options, async () => {
  await withApi(async (api) => {
    const { token } = await newUser();
    const key = `welcome-${randomUUID()}`;
    assert.equal((await welcome(api, token, key)).status, 200); // la respuesta "se perdió"
    await api('/money-profile', { method: 'PUT', token, body: { incomeType: 'sin_fecha', balance: 1000, resetBalance: true } });
    const retry = await welcome(api, token, key);
    assert.equal(retry.status, 200);
    assert.equal(retry.replayed, 'true');
    assert.equal(retry.body.balance, 1000, 'el cuerpo es el perfil actual, no el de la primera vez');
    assert.equal(retry.body.incomeType, 'sin_fecha');
  });
});

test('si falla a mitad de camino no queda la llave y el reintento funciona', options, async () => {
  const sentinel = `Falla-${randomUUID().slice(0, 8)}`;
  const constraint = `prueba_idem_${sentinel.slice(6)}`;
  await withApi(async (api) => {
    const { token, userId } = await newUser();
    const key = `welcome-${randomUUID()}`;
    const body = { ...WELCOME, commitments: [...WELCOME.commitments, { name: sentinel, amount: 1, dayOfMonth: 1 }] };
    // Hace fallar el tercer INSERT de compromisos, después de guardar el perfil.
    await pool.query(`ALTER TABLE compromisos ADD CONSTRAINT ${constraint} CHECK (nombre <> '${sentinel}') NOT VALID`);
    try {
      assert.equal((await welcome(api, token, key, body)).status, 500);
    } finally {
      await pool.query(`ALTER TABLE compromisos DROP CONSTRAINT IF EXISTS ${constraint}`);
    }
    assert.equal(await keyCount(userId), 0, 'la llave se deshizo con lo demás');
    const profile = await api('/money-profile', { token });
    assert.equal(profile.body.welcomeDone, false);
    assert.equal(profile.body.commitments.length, 0);

    const retry = await welcome(api, token, key, body);
    assert.equal(retry.status, 200);
    assert.equal(retry.replayed, null);
    assert.equal(retry.body.commitments.length, 3);
  });
});

test('la misma llave con otros datos responde 409 y no aplica nada', options, async () => {
  await withApi(async (api) => {
    const { token } = await newUser();
    const key = `welcome-${randomUUID()}`;
    await welcome(api, token, key);
    const other = await welcome(api, token, key, { ...WELCOME, balance: 5, commitments: [{ name: 'Gym', amount: 9, dayOfMonth: 3 }] });
    assert.equal(other.status, 409);
    assert.equal(other.body.error.code, 'IDEMPOTENCY_KEY_REUSED');
    const { body } = await api('/money-profile', { token });
    assert.equal(body.balance, 900000);
    assert.equal(body.commitments.length, 2);
  });
});

test('la misma llave en otro usuario es independiente', options, async () => {
  await withApi(async (api) => {
    const a = await newUser();
    const b = await newUser();
    const key = `welcome-${randomUUID()}`;
    await welcome(api, a.token, key);
    const second = await welcome(api, b.token, key, { ...WELCOME, balance: 7 });
    assert.equal(second.status, 200);
    assert.equal(second.replayed, null);
    assert.equal(second.body.balance, 7);
  });
});

test('las llaves de más de 30 días se borran', options, async () => {
  await withApi(async (api) => {
    const { token, userId } = await newUser();
    await pool.query(
      `INSERT INTO idempotency_keys (usuario_id, scope, clave, huella, created_at)
       VALUES ($1, 'money-profile.welcome', 'vieja-llave-01', $2, now() - interval '31 days')`,
      [userId, '0'.repeat(64)],
    );
    await welcome(api, token, `welcome-${randomUUID()}`);
    const { rows: old } = await pool.query("SELECT 1 FROM idempotency_keys WHERE usuario_id = $1 AND clave = 'vieja-llave-01'", [userId]);
    assert.equal(old.length, 0);
    assert.equal(await keyCount(userId), 1);
  });
});

test('con el token vencido responde 401 y no guarda la llave', options, async () => {
  await withApi(async (api) => {
    const { userId } = await newUser();
    const expired = jwt.sign({ sub: userId }, env.jwtSecret, { expiresIn: -10 });
    const res = await welcome(api, expired, `welcome-${randomUUID()}`);
    assert.equal(res.status, 401);
    assert.equal(res.body.error.code, 'TOKEN_EXPIRED');
    assert.equal(await keyCount(userId), 0);
  });
});

test('sin la cabecera se comporta como siempre (la web no la manda)', options, async () => {
  await withApi(async (api) => {
    const { token, userId } = await newUser();
    const first = await welcome(api, token, undefined);
    assert.equal(first.status, 200);
    const second = await welcome(api, token, undefined, { ...WELCOME, balance: 1234 });
    assert.equal(second.status, 200);
    assert.equal(second.replayed, null);
    assert.equal(second.body.balance, 1234, 'cada petición se aplica');
    assert.equal(second.body.commitments.length, 2, 'los compromisos no se repiten');
    assert.equal(await keyCount(userId), 0);
  });
});

test('una llave mal formada responde 400 y no aplica nada', options, async () => {
  await withApi(async (api) => {
    const { token } = await newUser();
    for (const key of ['corta', 'tiene espacio', 'ñandú-llave', 'a'.repeat(129), '']) {
      const res = await welcome(api, token, key);
      assert.equal(res.status, 400, `llave ${JSON.stringify(key)}`);
      assert.equal(res.body.error.code, 'VALIDATION_ERROR');
      assert.equal(res.body.error.details[0].field, 'Idempotency-Key');
    }
    assert.equal((await api('/money-profile', { token })).body.welcomeDone, false);
  });
});

test('la repetición funciona tras reiniciar el servidor (otro proceso y otro pool)', options, async () => {
  const { token } = await newUser();
  const key = `welcome-${randomUUID()}`;
  await withApi(async (api) => assert.equal((await welcome(api, token, key)).status, 200));
  // Otro proceso de Node: nada en memoria compartido con este.
  const appUrl = new URL('./app.js', import.meta.url).href;
  const dbUrl = new URL('./config/db.js', import.meta.url).href;
  const script = `
    const { createApp } = await import(${JSON.stringify(appUrl)});
    const { pool } = await import(${JSON.stringify(dbUrl)});
    const server = createApp().listen(0);
    const res = await fetch('http://127.0.0.1:' + server.address().port + '/api/v1/money-profile/welcome', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.T, 'Idempotency-Key': process.env.K },
      body: process.env.B,
    });
    const body = await res.json();
    console.log(JSON.stringify({ status: res.status, replayed: res.headers.get('idempotent-replayed'), n: body.commitments?.length }));
    server.close();
    await pool.end();`;
  const { stdout } = await promisify(execFile)(process.execPath, ['--input-type=module', '-e', script], {
    env: { ...process.env, T: token, K: key, B: JSON.stringify(WELCOME) },
  });
  assert.deepEqual(JSON.parse(stdout.trim().split('\n').pop()), { status: 200, replayed: 'true', n: 2 });
});
