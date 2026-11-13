import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import { buildReflection } from './services/reflection.service.js';
import { parseCreateTransaction, parseUpdateTransaction } from './validators/transactions.validator.js';
import { createVerifiedSession } from './verified-session.helper.js';

// Emociones y Kakeibo en los gastos (FT-0070).

const base = { amount: 1000, description: 'Café', type: 'gasto', date: '2026-11-10' };

test('validación: emoción y Kakeibo opcionales, con valores cerrados y null para quitarlos', () => {
  assert.equal(parseCreateTransaction(base).emotion, undefined);
  const full = parseCreateTransaction({ ...base, emotion: 'me_arrepiento', kakeibo: 'deseo' });
  assert.equal(full.emotion, 'me_arrepiento');
  assert.equal(full.kakeibo, 'deseo');
  assert.throws(
    () => parseCreateTransaction({ ...base, emotion: 'feliz' }),
    (err) => err.details.some((d) => d.field === 'emotion'),
  );
  assert.throws(
    () => parseCreateTransaction({ ...base, kakeibo: 'ahorro' }),
    (err) => err.details.some((d) => d.field === 'kakeibo'),
  );
  assert.deepEqual(parseUpdateTransaction({ emotion: null }), { emotion: null });
  assert.deepEqual(parseUpdateTransaction({ kakeibo: 'cultura' }), { kakeibo: 'cultura' });
});

test('la reflexión suma por emoción y Kakeibo y pregunta según lo que pasó', () => {
  const reflection = buildReflection({
    from: '2026-11-09',
    to: '2026-11-15',
    groups: [
      { emotion: 'me_arrepiento', kakeibo: 'deseo', count: 2, total: 80000 },
      { emotion: 'valio_la_pena', kakeibo: 'cultura', count: 1, total: 30000 },
      { emotion: null, kakeibo: 'necesidad', count: 1, total: 50000 },
      { emotion: null, kakeibo: null, count: 3, total: 20000 },
    ],
    regrets: [],
  });
  assert.deepEqual(reflection.expenses, { count: 7, total: 180000 });
  assert.equal(reflection.withEmotion, 3);
  assert.deepEqual(
    reflection.emotions.map((e) => [e.key, e.count]),
    [
      ['valio_la_pena', 1],
      ['normal', 0],
      ['no_lo_necesitaba', 0],
      ['me_arrepiento', 2],
    ],
  );
  assert.deepEqual(reflection.kakeibo.find((k) => k.key === 'deseo'), { key: 'deseo', count: 2, total: 80000 });
  assert.deepEqual(reflection.withoutKakeibo, { count: 3, total: 20000 });
  assert.deepEqual(reflection.questions, [
    'Esta semana 2 gastos por $80.000 no te convencieron. ¿Qué tenían en común?',
    'Gastaste más en deseos ($80.000) que en necesidades ($50.000). ¿Cuáles repetirías?',
    '¿Cuál gasto valió más la pena y por qué?',
  ]);

  const empty = buildReflection({ from: '2026-11-09', to: '2026-11-15', groups: [], regrets: [] });
  assert.deepEqual(empty.expenses, { count: 0, total: 0 });
  assert.deepEqual(empty.questions, []);
});

/* ---------- Con la base real ---------- */

const { rows } = await pool.query(
  "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'transacciones' AND column_name = 'emocion'",
);
const options = { skip: rows[0].n === 0 && 'Esquema no aplicado: falta transacciones.emocion (parche 031)' };
const TEST_DOMAIN = '@emociones-test.fintrack.test';

after(async () => {
  if (!options.skip) await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  await pool.end();
});

async function withApi(fn) {
  const server = createApp().listen(0);
  const url = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = async (path, { method = 'GET', token, body } = {}) => {
    const res = await fetch(`${url}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  };
  try {
    await fn(api);
  } finally {
    server.close();
  }
}

test('marcar emoción y Kakeibo en los gastos y ver la reflexión de la semana', options, async () => {
  await withApi(async (api) => {
    const session = await createVerifiedSession({ email: `u-${randomUUID()}${TEST_DOMAIN}`, password: 'clave-segura-1' });
    const token = session.accessToken;
    const date = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const post = (body) =>
      api('/transactions', { method: 'POST', token, body: { date, type: 'gasto', category: 'alimentacion', ...body } });

    // Se guarda sin emoción (el registro rápido no cambia) y luego se marca "¿Cómo te sentiste?".
    const pizza = await post({ amount: 45000, description: 'Pizza' });
    assert.equal(pizza.status, 201);
    assert.equal(pizza.body.transaction.emotion, null);
    const marked = await api(`/transactions/${pizza.body.transaction.id}`, {
      method: 'PUT',
      token,
      body: { emotion: 'me_arrepiento', kakeibo: 'deseo' },
    });
    assert.equal(marked.status, 200);
    assert.equal(marked.body.transaction.emotion, 'me_arrepiento');
    assert.equal(marked.body.transaction.kakeibo, 'deseo');

    const book = await post({ amount: 30000, description: 'Libro', emotion: 'valio_la_pena', kakeibo: 'cultura' });
    assert.equal(book.body.transaction.kakeibo, 'cultura');

    // Un ingreso no lleva emoción; si un gasto pasa a ingreso, se le quitan.
    const income = await api('/transactions', {
      method: 'POST',
      token,
      body: { date, type: 'ingreso', amount: 1000, description: 'Venta', emotion: 'normal' },
    });
    assert.equal(income.status, 422);
    const other = await post({ amount: 9000, description: 'Error', emotion: 'normal', kakeibo: 'imprevisto' });
    const flipped = await api(`/transactions/${other.body.transaction.id}`, {
      method: 'PUT',
      token,
      body: { type: 'ingreso', category: null },
    });
    assert.equal(flipped.status, 200);
    assert.equal(flipped.body.transaction.emotion, null);
    assert.equal(flipped.body.transaction.kakeibo, null);

    const reflection = await api(`/transactions/reflection?date=${date}`, { token });
    assert.equal(reflection.status, 200);
    assert.deepEqual(reflection.body.expenses, { count: 2, total: 75000 });
    assert.equal(reflection.body.withEmotion, 2);
    assert.deepEqual(
      reflection.body.regrets.map((r) => [r.description, r.amount, r.emotion]),
      [['Pizza', 45000, 'me_arrepiento']],
    );
    assert.match(reflection.body.questions[0], /un gasto de \$45\.000 no te convenció/);
    assert.equal((await api('/transactions/reflection?date=2026-13-01', { token })).status, 422);
  });
});
