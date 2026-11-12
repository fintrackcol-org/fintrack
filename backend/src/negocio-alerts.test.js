import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import * as businessReminders from './repositories/negocio-reminders.repository.js';
import { accountAlertPayload, taxDatePayload } from './services/negocio-accounts.logic.js';
import { createReminderScheduler } from './services/reminder-scheduler.service.js';
import { parseTaxDate } from './validators/negocio-accounts.validator.js';
import { createVerifiedSession } from './verified-session.helper.js';

// Avisos de los negocios y fechas de impuestos (FT-0058).

/* ---------- Funciones puras ---------- */

const alert = { businessId: 'n1', businessName: 'Arepas', party: 'Tienda Luz', remaining: 200_000 };

test('textos de los avisos de cuentas: antes y después de vencer, por cobrar y por pagar', () => {
  assert.equal(
    accountAlertPayload({ ...alert, kind: 'receivable', stage: 'previo' }).body,
    'Mañana Tienda Luz debe pagarle $200.000 a Arepas.',
  );
  assert.equal(
    accountAlertPayload({ ...alert, kind: 'receivable', stage: 'vencida' }).body,
    'Tienda Luz no ha pagado $200.000 a Arepas: ya venció.',
  );
  assert.equal(
    accountAlertPayload({ ...alert, kind: 'payable', stage: 'previo' }).body,
    'Mañana vence el pago de Arepas a Tienda Luz: $200.000.',
  );
  const late = accountAlertPayload({ ...alert, kind: 'payable', stage: 'vencida' });
  assert.equal(late.body, 'Venció el pago de Arepas a Tienda Luz: faltan $200.000.');
  assert.equal(late.url, '/app/negocios/n1');
});

test('texto del aviso de impuestos según cuántos días faltan', () => {
  const tax = { businessId: 'n1', businessName: 'Arepas', name: 'IVA', date: '2026-11-20' };
  assert.equal(taxDatePayload(tax, '2026-11-17').body, 'IVA de Arepas: vence el 20 de noviembre (en 3 días).');
  assert.equal(taxDatePayload(tax, '2026-11-19').body, 'IVA de Arepas: vence mañana.');
  assert.equal(taxDatePayload(tax, '2026-11-20').body, 'IVA de Arepas: vence hoy.');
  assert.deepEqual(parseTaxDate({ name: ' Retención ', date: '2026-11-20' }), { name: 'Retención', date: '2026-11-20' });
  assert.throws(() => parseTaxDate({ name: '', date: 'mañana' }), /Datos inválidos/);
});

/** Programador con solo los avisos de negocios. */
function scheduler(business, now) {
  const sent = [];
  const s = createReminderScheduler({
    listLiquidityUsers: async () => [],
    listCommitments: async () => [],
    listCandidates: async () => [],
    listCardUsers: async () => [],
    listDueDebts: async () => [],
    businessReminders: business,
    sendToUser: async (id, payload) => sent.push([id, payload]),
    now: () => now,
    log: { info: () => {}, error: (m) => assert.fail(m) },
  });
  return { s, sent };
}

test('los avisos del negocio salen desde las 8 a. m. de Colombia a dueños y editores, una vez', async () => {
  const marked = [];
  const business = {
    listAccountAlerts: async () =>
      marked.includes('a1') ? [] : [{ ...alert, id: 'a1', kind: 'receivable', stage: 'previo' }],
    listTaxDateAlerts: async () => [],
    listRecorders: async () => ['dueno', 'editor'],
    markAccountAlert: async (id) => marked.push(id),
    markTaxDateAlert: async () => {},
  };
  // 7:59 a. m. en Bogotá (12:59 UTC): todavía no.
  const early = scheduler(business, new Date('2026-11-17T12:59:00Z'));
  await early.s.tick();
  assert.equal(early.sent.length, 0);

  const { s, sent } = scheduler(business, new Date('2026-11-17T13:00:00Z'));
  await s.tick();
  await s.tick();
  assert.deepEqual(sent.map(([id]) => id), ['dueno', 'editor']);
  assert.deepEqual(marked, ['a1']);
});

/* ---------- Con la base real ---------- */

const { rows } = await pool.query("SELECT to_regclass('public.negocio_fechas_impuesto') AS tabla");
const options = { skip: !rows[0].tabla && 'Esquema no aplicado: falta la tabla negocio_fechas_impuesto' };
const TEST_DOMAIN = '@negocio-avisos-test.fintrack.test';

after(async () => {
  if (!options.skip) {
    await pool.query(
      `DELETE FROM negocios WHERE id IN (
         SELECT s.negocio_id FROM negocio_socios s JOIN usuarios u ON u.id = s.usuario_id
         WHERE u.email LIKE $1)`,
      [`%${TEST_DOMAIN}`],
    );
    await pool.query('DELETE FROM usuarios WHERE email LIKE $1', [`%${TEST_DOMAIN}`]);
  }
  await pool.end();
});

/** Levanta la app y ejecuta `fn` con un cliente JSON. */
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

async function newUser() {
  const session = await createVerifiedSession({ email: `u-${randomUUID()}${TEST_DOMAIN}`, password: 'clave-segura-1' });
  return { token: session.accessToken, id: session.user.id };
}

test('fechas de impuestos y cuentas por avisar, con la base real', options, async () => {
  await withApi(async (api) => {
    const [owner, reader] = await Promise.all([newUser(), newUser()]);
    const created = await api('/businesses', { method: 'POST', token: owner.token, body: { name: 'Arepas' } });
    const id = created.body.id;
    await pool.query("INSERT INTO negocio_socios (negocio_id, usuario_id, rol) VALUES ($1, $2, 'lector')", [id, reader.id]);

    // Fechas de impuestos: el lector ve pero no agrega.
    const body = { name: 'IVA bimestral', date: '2026-11-20' };
    assert.equal((await api(`/businesses/${id}/tax-dates`, { method: 'POST', token: reader.token, body })).status, 403);
    const tax = await api(`/businesses/${id}/tax-dates`, { method: 'POST', token: owner.token, body });
    assert.equal(tax.status, 201);
    const listed = await api(`/businesses/${id}/tax-dates`, { token: reader.token });
    assert.equal(listed.body.canEdit, false);
    assert.deepEqual(listed.body.items.map((t) => t.name), ['IVA bimestral']);

    const due = (await businessReminders.listTaxDateAlerts('2026-11-17')).filter((t) => t.businessId === id);
    assert.equal(due.length, 1);
    assert.equal((await businessReminders.listTaxDateAlerts('2026-11-16')).filter((t) => t.businessId === id).length, 0);
    await businessReminders.markTaxDateAlert(tax.body.id);
    assert.equal((await businessReminders.listTaxDateAlerts('2026-11-17')).filter((t) => t.businessId === id).length, 0);

    // Cuentas: mañana vence una; otra ya venció; una pagada no avisa.
    const add = (b) => api(`/businesses/${id}/accounts`, { method: 'POST', token: owner.token, body: b });
    const tomorrow = await add({ kind: 'receivable', party: 'Mañana', amount: 100, dueDate: '2026-11-18' });
    const late = await add({ kind: 'payable', party: 'Atrasado', amount: 100, dueDate: '2026-11-10' });
    const paid = await add({ kind: 'receivable', party: 'Pagado', amount: 100, dueDate: '2026-11-10' });
    await api(`/businesses/${id}/accounts/${paid.body.id}/payments`, {
      method: 'POST',
      token: owner.token,
      body: { amount: 100, date: '2026-11-08' },
    });
    const alerts = (await businessReminders.listAccountAlerts('2026-11-17')).filter((a) => a.businessId === id);
    assert.deepEqual(
      alerts.map((a) => [a.party, a.stage]).sort(),
      [
        ['Atrasado', 'vencida'],
        ['Mañana', 'previo'],
      ],
    );
    await businessReminders.markAccountAlert(tomorrow.body.id, 'previo');
    await businessReminders.markAccountAlert(late.body.id, 'vencida');
    assert.equal((await businessReminders.listAccountAlerts('2026-11-17')).filter((a) => a.businessId === id).length, 0);
    // Al día siguiente, la de "mañana" ya venció y vuelve a avisar como vencida.
    const next = (await businessReminders.listAccountAlerts('2026-11-19')).filter((a) => a.businessId === id);
    assert.deepEqual(next.map((a) => [a.party, a.stage]), [['Mañana', 'vencida']]);

    // Solo dueños y editores reciben.
    assert.deepEqual(await businessReminders.listRecorders(id), [owner.id]);

    // Borrar una fecha.
    assert.equal((await api(`/businesses/${id}/tax-dates/${tax.body.id}`, { method: 'DELETE', token: owner.token })).status, 204);
  });
});
