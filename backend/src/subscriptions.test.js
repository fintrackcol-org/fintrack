import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import { occursInMonth, pendingCommitments } from './services/money-plan.service.js';
import { subscriptionsSummary } from './services/money-profile.service.js';
import { commitmentReminderPayload, dueCommitments } from './services/reminder-scheduler.service.js';
import { parseCommitment } from './validators/money-profile.validator.js';
import { createVerifiedSession } from './verified-session.helper.js';

// Suscripciones dentro de los compromisos de Mi plata (FT-0067).

test('validación: pago fijo por defecto; anual exige el mes; "Avisarme" opcional', () => {
  assert.deepEqual(parseCommitment({ name: 'Arriendo', amount: 900000, dayOfMonth: 15 }), {
    name: 'Arriendo',
    amount: 900000,
    dayOfMonth: 15,
    kind: 'fixed',
    frequency: 'monthly',
    month: null,
  });
  const yearly = parseCommitment({
    name: 'Spotify anual',
    amount: 180000,
    dayOfMonth: 3,
    kind: 'subscription',
    frequency: 'yearly',
    month: 2,
    reminder: { daysBefore: [3, 1], channel: 'push' },
  });
  assert.equal(yearly.month, 2);
  assert.deepEqual(yearly.reminder, { daysBefore: [1, 3], time: null, channel: 'push' });
  assert.throws(
    () => parseCommitment({ name: 'X', amount: 1, dayOfMonth: 1, frequency: 'yearly' }),
    (err) => err.details.some((d) => d.field === 'month'),
  );
  assert.throws(() => parseCommitment({ name: 'X', amount: 1, dayOfMonth: 1, kind: 'gasto' }));
  assert.equal(parseCommitment({ name: 'X', amount: 1, dayOfMonth: 1, reminder: null }).reminder, null);
});

test('los anuales solo cuentan en su mes; el resumen de suscripciones suma la doceava parte', () => {
  const anual = { frequency: 'yearly', month: 2 };
  assert.equal(occursInMonth(anual, '2027-02'), true);
  assert.equal(occursInMonth(anual, '2026-11'), false);
  assert.equal(occursInMonth({ frequency: 'monthly' }, '2026-11'), true);

  const commitments = [
    { id: 'a', name: 'Netflix', amount: 38900, dayOfMonth: 20, frequency: 'monthly' },
    { id: 'b', name: 'Dominio', amount: 120000, dayOfMonth: 25, frequency: 'yearly', month: 11 },
    { id: 'c', name: 'Seguro', amount: 600000, dayOfMonth: 5, frequency: 'yearly', month: 3 },
  ];
  const pending = pendingCommitments({ commitments, expenses: [], today: '2026-11-12' });
  assert.deepEqual(pending.map((p) => p.name), ['Netflix', 'Dominio'], 'el seguro de marzo no sale en noviembre');

  assert.deepEqual(
    subscriptionsSummary([
      { kind: 'subscription', frequency: 'monthly', amount: 38900 },
      { kind: 'subscription', frequency: 'yearly', amount: 120000 },
      { kind: 'fixed', frequency: 'monthly', amount: 900000 },
    ]),
    { count: 2, monthly: 48900 },
  );
});

test('avisos: salen con la anticipación elegida y solo cuando hay cobro', () => {
  const now = new Date('2026-11-17T15:00:00Z'); // 10 a. m. en Bogotá, 17 de noviembre
  const base = { id: 'n1', userId: 'u1', timezone: 'America/Bogota', name: 'Netflix', amount: 38900, kind: 'subscription' };
  const items = dueCommitments(
    [
      { ...base, dayOfMonth: 20, frequency: 'monthly', month: null, daysBefore: [3, 1] },
      { ...base, id: 'n2', dayOfMonth: 18, frequency: 'yearly', month: 3, daysBefore: [1] },
      { ...base, id: 'n3', dayOfMonth: 31, frequency: 'monthly', month: null, daysBefore: [13] },
    ],
    now,
  );
  assert.deepEqual(
    items.map((i) => [i.id, i.dueDate, i.daysBefore]),
    [
      ['n1', '2026-11-20', 3],
      ['n3', '2026-11-30', 13],
    ],
    'el día 31 cae el 30 en noviembre; el anual de marzo no avisa en noviembre',
  );
  assert.equal(
    commitmentReminderPayload({ name: 'Netflix', amount: 38900, kind: 'subscription', daysBefore: 3 }).body,
    'En 3 días se cobra Netflix: $38.900.',
  );
  assert.equal(
    commitmentReminderPayload({ name: 'Arriendo', amount: 900000, kind: 'fixed', daysBefore: 0 }).body,
    'Hoy vence Arriendo: $900.000.',
  );
});

/* ---------- Con la base real ---------- */

const { rows } = await pool.query(
  "SELECT count(*)::int AS n FROM information_schema.columns WHERE table_name = 'compromisos' AND column_name = 'frecuencia'",
);
const options = { skip: rows[0].n === 0 && 'Esquema no aplicado: falta compromisos.frecuencia (parche 030)' };
const TEST_DOMAIN = '@suscripciones-test.fintrack.test';

after(async () => {
  if (!options.skip) await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  await pool.end();
});

async function withApi(fn) {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = async (url, { method = 'GET', token, body } = {}) => {
    const res = await fetch(`${base}${url}`, {
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

test('crear suscripciones con "Avisarme", verlas en Mi plata y en el calendario', options, async () => {
  await withApi(async (api) => {
    const session = await createVerifiedSession({ email: `u-${randomUUID()}${TEST_DOMAIN}`, password: 'clave-segura-1' });
    const token = session.accessToken;
    await api('/money-profile', { method: 'PUT', token, body: { incomeType: 'sin_fecha', balance: 1000000 } });

    const netflix = await api('/money-profile/commitments', {
      method: 'POST',
      token,
      body: {
        name: 'Netflix',
        amount: 38900,
        dayOfMonth: 20,
        kind: 'subscription',
        reminder: { daysBefore: [1], time: '08:00', channel: 'push' },
      },
    });
    assert.equal(netflix.status, 201);
    assert.equal(netflix.body.kind, 'subscription');
    assert.deepEqual(netflix.body.reminder, { daysBefore: [1], time: '08:00', channel: 'push' });

    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Bogota' });
    const otherMonth = ((Number(today.slice(5, 7)) + 5) % 12) + 1; // un mes distinto al actual
    const yearly = await api('/money-profile/commitments', {
      method: 'POST',
      token,
      body: { name: 'Antivirus', amount: 120000, dayOfMonth: 5, kind: 'subscription', frequency: 'yearly', month: otherMonth },
    });
    assert.equal(yearly.status, 201);
    assert.equal(yearly.body.reminder, null, 'sin "Avisarme" no avisa');
    assert.equal(
      (await api('/money-profile/commitments', { method: 'POST', token, body: { name: 'Mal', amount: 1, dayOfMonth: 1, frequency: 'yearly' } })).status,
      422,
    );

    const profile = await api('/money-profile', { token });
    assert.deepEqual(profile.body.subscriptions, { count: 2, monthly: 48900 });
    assert.equal(profile.body.commitments.find((c) => c.name === 'Netflix').reminder.time, '08:00');

    // El calendario del mes actual trae Netflix marcada como suscripción y no el anual de otro mes.
    const calendar = await api('/money-profile/calendar', { token });
    const names = calendar.body.events.filter((e) => e.kind === 'compromiso').map((e) => [e.name, e.subscription]);
    assert.deepEqual(names, [['Netflix', true]]);

    // Quitar el aviso y borrar el compromiso limpia su configuración.
    const off = await api(`/money-profile/commitments/${netflix.body.id}`, {
      method: 'PUT',
      token,
      body: { name: 'Netflix', amount: 38900, dayOfMonth: 20, kind: 'subscription', reminder: null },
    });
    assert.equal(off.body.reminder, null);
    assert.equal((await api(`/money-profile/commitments/${yearly.body.id}`, { method: 'DELETE', token })).status, 204);
  });
});
