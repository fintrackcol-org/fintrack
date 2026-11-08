import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createApp } from './app.js';
import { pool } from './config/db.js';
import { accountState, accountTotals, sortAccounts } from './services/negocio-accounts.logic.js';
import { parseNewAccount, parsePayment } from './validators/negocio-accounts.validator.js';
import { createVerifiedSession } from './verified-session.helper.js';

// Cuentas por cobrar y por pagar de los negocios, con abonos (FT-0058).

/* ---------- Funciones puras ---------- */

test('estado de una cuenta: pendiente, vencida y pagada', () => {
  const today = '2026-11-10';
  assert.deepEqual(accountState({ amount: 100, paid: 30, dueDate: '2026-11-15' }, today), {
    remaining: 70,
    status: 'pendiente',
  });
  assert.equal(accountState({ amount: 100, paid: 30, dueDate: '2026-11-09' }, today).status, 'vencida');
  assert.equal(accountState({ amount: 100, paid: 30, dueDate: null }, today).status, 'pendiente');
  assert.deepEqual(accountState({ amount: 100, paid: 100, dueDate: '2026-11-01' }, today), {
    remaining: 0,
    status: 'pagada',
  });
  assert.equal(accountState({ amount: 0.3, paid: 0.1 + 0.2, dueDate: null }, today).status, 'pagada');
});

test('totales por tipo y orden: vencidas, pendientes por fecha y al final las pagadas', () => {
  const items = [
    { kind: 'receivable', remaining: 0, status: 'pagada', dueDate: '2026-11-01', createdAt: '2026-11-01' },
    { kind: 'receivable', remaining: 50, status: 'pendiente', dueDate: '2026-11-20', createdAt: '2026-11-01' },
    { kind: 'payable', remaining: 80, status: 'vencida', dueDate: '2026-11-02', createdAt: '2026-11-01' },
    { kind: 'receivable', remaining: 20, status: 'pendiente', dueDate: null, createdAt: '2026-11-01' },
    { kind: 'receivable', remaining: 30, status: 'pendiente', dueDate: '2026-11-12', createdAt: '2026-11-01' },
  ];
  assert.deepEqual(accountTotals(items), {
    receivable: 100,
    payable: 80,
    overdueReceivable: 0,
    overduePayable: 80,
  });
  assert.deepEqual(
    sortAccounts(items).map((a) => a.remaining),
    [80, 30, 50, 20, 0],
  );
});

test('validación de cuentas y abonos', () => {
  assert.deepEqual(
    parseNewAccount({ kind: 'receivable', party: ' Tienda Luz ', amount: 120000.456, dueDate: '2026-11-30' }),
    { kind: 'receivable', party: 'Tienda Luz', description: null, amount: 120000.46, dueDate: '2026-11-30' },
  );
  assert.throws(
    () => parseNewAccount({ kind: 'otra', party: '', amount: 0, dueDate: '2026-02-30' }),
    (err) => err.details.map((d) => d.field).join() === 'kind,party,amount,dueDate',
  );
  assert.deepEqual(parsePayment({ amount: 5000 }), { amount: 5000, date: null, movementKind: null });
  assert.throws(() => parsePayment({ amount: -1, movementKind: 'retiro' }), /Datos inválidos/);
});

/* ---------- Con la base real ---------- */

const { rows } = await pool.query("SELECT to_regclass('public.negocio_cuentas') AS tabla");
const options = { skip: !rows[0].tabla && 'Esquema no aplicado: falta la tabla negocio_cuentas' };

const TEST_DOMAIN = '@negocio-cuentas-test.fintrack.test';

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

/**
 * Levanta la app, ejecuta `fn` con un cliente JSON y cierra el servidor.
 * @param {(api: (url: string, init?: { method?: string, token?: string, body?: unknown }) => Promise<{ status: number, body: any }>) => Promise<void>} fn
 */
async function withApi(fn) {
  const server = createApp().listen(0);
  const base = `http://127.0.0.1:${server.address().port}/api/v1`;
  const api = async (url, { method = 'GET', token, body } = {}) => {
    const res = await fetch(`${base}${url}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
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

/** @returns {Promise<{ token: string, id: string }>} */
async function newUser() {
  const session = await createVerifiedSession({
    email: `u-${randomUUID()}${TEST_DOMAIN}`,
    password: 'clave-segura-1',
  });
  return { token: session.accessToken, id: session.user.id };
}

/** Negocio con dueño, editor, lector y alguien de afuera. */
async function setup(api) {
  const [owner, editor, reader, outsider] = await Promise.all([newUser(), newUser(), newUser(), newUser()]);
  const created = await api('/businesses', { method: 'POST', token: owner.token, body: { name: 'Arepas' } });
  await api('/businesses/join', { method: 'POST', token: editor.token, body: { code: created.body.code } });
  await pool.query("INSERT INTO negocio_socios (negocio_id, usuario_id, rol) VALUES ($1, $2, 'lector')", [
    created.body.id,
    reader.id,
  ]);
  return { owner, editor, reader, outsider, id: created.body.id };
}

test('cuentas por cobrar con abonos parciales: saldo, estado y movimientos del negocio', options, async () => {
  await withApi(async (api) => {
    const { owner, editor, reader, outsider, id } = await setup(api);
    const base = `/businesses/${id}/accounts`;

    // Un lector y alguien de afuera no registran.
    const body = { kind: 'receivable', party: 'Tienda Luz', amount: 300000, dueDate: '2020-01-01' };
    assert.equal((await api(base, { method: 'POST', token: reader.token, body })).status, 403);
    assert.equal((await api(base, { method: 'POST', token: outsider.token, body })).status, 404);

    const created = await api(base, { method: 'POST', token: editor.token, body });
    assert.equal(created.status, 201);
    assert.equal(created.body.status, 'vencida');
    assert.equal(created.body.remaining, 300000);
    const payments = `${base}/${created.body.id}/payments`;

    const first = await api(payments, { method: 'POST', token: editor.token, body: { amount: 100000 } });
    assert.equal(first.status, 201);
    assert.equal(first.body.paid, 100000);
    assert.equal(first.body.remaining, 200000);
    assert.equal(first.body.payments.length, 1);

    // No puede pasar del saldo, ni ser un gasto, ni tener fecha futura.
    const tooMuch = await api(payments, { method: 'POST', token: editor.token, body: { amount: 200001 } });
    assert.equal(tooMuch.status, 422);
    assert.match(tooMuch.body.error.details[0].problem, /saldo/);
    const wrongKind = await api(payments, {
      method: 'POST',
      token: editor.token,
      body: { amount: 1, movementKind: 'cost' },
    });
    assert.equal(wrongKind.status, 422);
    const future = await api(payments, {
      method: 'POST',
      token: editor.token,
      body: { amount: 1, date: '2999-01-01' },
    });
    assert.equal(future.status, 422);

    const last = await api(payments, {
      method: 'POST',
      token: owner.token,
      body: { amount: 200000, movementKind: 'otherIncome' },
    });
    assert.equal(last.body.status, 'pagada');
    const paidAgain = await api(payments, { method: 'POST', token: owner.token, body: { amount: 1 } });
    assert.match(paidAgain.body.error.details[0].problem, /ya está pagada/);

    // Cada abono quedó como movimiento del negocio (venta y otro ingreso).
    const month = await api(`/businesses/${id}/movements`, { token: reader.token });
    const fromAccount = month.body.movements.filter((m) => m.description === 'Abono de Tienda Luz');
    assert.deepEqual(fromAccount.map((m) => m.kind).sort(), ['otherIncome', 'sale']);

    // Todos los socios ven la lista, con totales.
    const listed = await api(base, { token: reader.token });
    assert.equal(listed.body.canRecord, false);
    assert.equal(listed.body.totals.receivable, 0);
    assert.equal(listed.body.items[0].payments.length, 2);
  });
});

test('pagos a proveedores, deshacer abonos y borrar la cuenta', options, async () => {
  await withApi(async (api) => {
    const { owner, editor, id } = await setup(api);
    const base = `/businesses/${id}/accounts`;
    const account = await api(base, {
      method: 'POST',
      token: owner.token,
      body: { kind: 'payable', party: 'Harinas del Huila', amount: 500000, description: 'Factura 123' },
    });
    const payments = `${base}/${account.body.id}/payments`;
    const paid = await api(payments, {
      method: 'POST',
      token: owner.token,
      body: { amount: 150000, movementKind: 'variable' },
    });
    const payment = paid.body.payments[0];
    const movements = await api(`/businesses/${id}/movements`, { token: owner.token });
    const movement = movements.body.movements.find((m) => m.id === payment.movementId);
    assert.equal(movement.kind, 'variable');
    assert.equal(movement.description, 'Pago a Harinas del Huila');

    // El editor no puede deshacer el abono del dueño; el dueño sí, y se va el movimiento.
    const forbidden = await api(`${payments}/${payment.id}`, { method: 'DELETE', token: editor.token });
    assert.equal(forbidden.status, 403);
    const undone = await api(`${payments}/${payment.id}`, { method: 'DELETE', token: owner.token });
    assert.equal(undone.status, 200);
    assert.equal(undone.body.remaining, 500000);
    const after = await api(`/businesses/${id}/movements`, { token: owner.token });
    assert.ok(!after.body.movements.some((m) => m.id === payment.movementId));

    // Si se borra el movimiento desde el historial, el abono también se va.
    const again = await api(payments, { method: 'POST', token: editor.token, body: { amount: 50000 } });
    await api(`/businesses/${id}/movements/${again.body.payments[0].movementId}`, {
      method: 'DELETE',
      token: editor.token,
    });
    const listed = await api(base, { token: owner.token });
    assert.equal(listed.body.items[0].paid, 0);

    // Borrar la cuenta: el editor no (no la registró), el dueño sí.
    assert.equal((await api(`${base}/${account.body.id}`, { method: 'DELETE', token: editor.token })).status, 403);
    assert.equal((await api(`${base}/${account.body.id}`, { method: 'DELETE', token: owner.token })).status, 204);
    assert.equal((await api(base, { token: owner.token })).body.items.length, 0);
  });
});

test('dos abonos al mismo tiempo no pasan del saldo', options, async () => {
  await withApi(async (api) => {
    const { owner, id } = await setup(api);
    const base = `/businesses/${id}/accounts`;
    const account = await api(base, {
      method: 'POST',
      token: owner.token,
      body: { kind: 'receivable', party: 'Cliente', amount: 100000 },
    });
    const payments = `${base}/${account.body.id}/payments`;
    const results = await Promise.all(
      [1, 2, 3].map(() => api(payments, { method: 'POST', token: owner.token, body: { amount: 60000 } })),
    );
    assert.deepEqual(results.map((r) => r.status).sort(), [201, 422, 422]);
    const listed = await api(base, { token: owner.token });
    assert.equal(listed.body.items[0].paid, 60000);
  });
});
