import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createReminderScheduler,
  debtReminderPayload,
} from './services/reminder-scheduler.service.js';

/** Sin avisos de negocios (FT-0058): estas pruebas no los miran. */
const NO_BUSINESS_ALERTS = {
  listAccountAlerts: async () => [],
  listTaxDateAlerts: async () => [],
  listRecorders: async () => [],
  markAccountAlert: async () => {},
  markTaxDateAlert: async () => {},
};

const CARD = {
  id: 'c1',
  name: 'Amex Blue ••1234',
  used: 500000,
  statementTotal: 616000,
  nextPaymentDate: '2026-11-15',
  daysToPayment: 3,
  paidThisCycle: false,
  reminderSentFor: null,
};

/** Arma un programador con una tarjeta y un usuario (09:00 en Bogotá = 14:00 UTC). */
function setup(card = {}) {
  const sent = [];
  const cards = [{ ...CARD, ...card }];
  const scheduler = createReminderScheduler({
    listDueDebts: async () => [],
    businessReminders: NO_BUSINESS_ALERTS,
    listLiquidityUsers: async () => [],
    listCommitments: async () => [],
    listCandidates: async () => [],
    listCardUsers: async () => [{ id: 'u1', timezone: 'America/Bogota', time: '09:00' }],
    listUserCards: async () => cards.map((c) => ({ ...c })),
    sendToUser: async (id, payload) => sent.push([id, payload]),
    markCardReminded: async (_id, _user, date) => {
      cards[0].reminderSentFor = date;
    },
    now: () => new Date('2026-11-12T14:00:00Z'),
    log: { info: () => {}, error: (m) => assert.fail(m) },
  });
  return { scheduler, sent };
}

test('una tarjeta a 3 días del pago envía un solo push aunque el tick corra dos veces', async () => {
  const { scheduler, sent } = setup();
  await scheduler.tick();
  await scheduler.tick();
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0], [
    'u1',
    {
      title: 'Pago de tarjeta',
      body: 'Tu Amex Blue ••1234 se paga el 15 nov. Debes $616.000.',
      url: '/app/tarjetas/c1',
    },
  ]);
});

test('sin extracto el monto es lo usado', async () => {
  const { scheduler, sent } = setup({ statementTotal: null });
  await scheduler.tick();
  assert.match(sent[0][1].body, /Debes \$500\.000\.$/);
});

test('con la tarjeta pagada o a otra distancia no envía nada', async () => {
  for (const change of [{ paidThisCycle: true }, { daysToPayment: 2 }]) {
    const { scheduler, sent } = setup(change);
    await scheduler.tick();
    assert.equal(sent.length, 0);
  }
});

test('sin nada que pagar no envía "Debes $0"', async () => {
  const { scheduler, sent } = setup({ used: 0, statementTotal: null });
  await scheduler.tick();
  assert.equal(sent.length, 0);
});

test('fuera de la hora del usuario no envía nada', async () => {
  const { scheduler, sent } = setup();
  const late = createReminderScheduler({
    listDueDebts: async () => [],
    businessReminders: NO_BUSINESS_ALERTS,
    listLiquidityUsers: async () => [],
    listCommitments: async () => [],
    listCandidates: async () => [],
    listCardUsers: async () => [{ id: 'u1', timezone: 'America/Bogota', time: '20:00' }],
    listUserCards: async () => [CARD],
    sendToUser: async (id, p) => sent.push([id, p]),
    now: () => new Date('2026-11-12T14:00:00Z'),
    log: { info: () => {}, error: (m) => assert.fail(m) },
  });
  await late.tick();
  await scheduler.tick(); // control: sí envía a su hora
  assert.equal(sent.length, 1);
});

test('con cardReminders en false no hay usuarios que avisar', async () => {
  // El filtro vive en listCardReminderUsers (recordar_tarjetas); aquí se verifica que sin usuarios no se envía.
  const sent = [];
  const scheduler = createReminderScheduler({
    listDueDebts: async () => [],
    businessReminders: NO_BUSINESS_ALERTS,
    listLiquidityUsers: async () => [],
    listCommitments: async () => [],
    listCandidates: async () => [],
    listCardUsers: async () => [],
    sendToUser: async (id, p) => sent.push([id, p]),
    now: () => new Date('2026-11-12T14:00:00Z'),
  });
  await scheduler.tick();
  assert.equal(sent.length, 0);
});

test('una cuenta personal que vence mañana avisa una vez, a la hora del usuario', async () => {
  const sent = [];
  const marked = [];
  const due = [
    {
      id: 'd1',
      userId: 'u1',
      timezone: 'America/Bogota',
      time: '09:00',
      kind: 'receivable',
      person: 'Juan',
      amount: 50000,
      dueDate: '2026-11-13',
      daysBefore: 1,
      channel: 'push',
    },
    {
      id: 'd2',
      userId: 'u2',
      timezone: 'America/Bogota',
      time: '20:00',
      kind: 'payable',
      person: 'Ana',
      amount: 12500,
      dueDate: '2026-11-13',
      daysBefore: 1,
      channel: 'push',
    },
  ];
  const scheduler = createReminderScheduler({
    businessReminders: NO_BUSINESS_ALERTS,
    listLiquidityUsers: async () => [],
    listCommitments: async () => [],
    listCandidates: async () => [],
    listCardUsers: async () => [],
    listDueDebts: async () => due.filter((d) => !marked.includes(d.id)),
    markReminderSent: async ({ id }) => marked.push(id) > 0,
    sendToUser: async (id, payload) => sent.push([id, payload]),
    now: () => new Date('2026-11-12T14:00:00Z'), // 09:00 en Bogotá
    log: { info: () => {}, error: (m) => assert.fail(m) },
  });
  await scheduler.tick();
  await scheduler.tick();
  assert.deepEqual(sent, [
    ['u1', { title: 'Te deben', body: 'Mañana Juan te debe pagar $50.000.', url: '/app/cuentas' }],
  ]);
  assert.deepEqual(debtReminderPayload(due[1]), {
    title: 'Tienes que pagar',
    body: 'Mañana vence lo que le debes a Ana: $12.500.',
    url: '/app/cuentas',
  });
});

test('el motor entrega por el canal elegido y no pierde el aviso si WhatsApp falla (FT-0063)', async () => {
  const pushed = [];
  const texted = [];
  const item = (id, channel, daysBefore) => ({
    id,
    userId: id,
    timezone: 'America/Bogota',
    time: '09:00',
    kind: 'payable',
    person: 'Ana',
    amount: 12500,
    dueDate: '2026-11-15',
    daysBefore,
    channel,
  });
  const scheduler = createReminderScheduler({
    businessReminders: NO_BUSINESS_ALERTS,
    listLiquidityUsers: async () => [],
    listCommitments: async () => [],
    listCandidates: async () => [],
    listCardUsers: async () => [],
    listDueDebts: async () => [
      item('solo-push', 'push', 3),
      item('ambos', 'both', 0),
      item('solo-whatsapp', 'whatsapp', 7),
      item('sin-bot', 'whatsapp', 1),
      item('otra-hora', 'push', 1),
    ].map((d) => (d.id === 'otra-hora' ? { ...d, time: '20:00' } : d)),
    markReminderSent: async () => true,
    sendToUser: async (id, payload) => pushed.push([id, payload.body]),
    // Quien no tiene el bot conectado recibe `false`.
    notifyWhatsapp: async (id, text) => id !== 'sin-bot' && texted.push([id, text]) > 0,
    now: () => new Date('2026-11-12T14:00:00Z'), // 09:00 en Bogotá
    log: { info: () => {}, error: (m) => assert.fail(m) },
  });
  const { sent } = await scheduler.tick();
  assert.equal(sent, 4, 'la de las 20:00 no sale a las 09:00');
  assert.deepEqual(pushed, [
    ['solo-push', 'En 3 días vence lo que le debes a Ana: $12.500.'],
    ['ambos', 'Hoy vence lo que le debes a Ana: $12.500.'],
    ['sin-bot', 'Mañana vence lo que le debes a Ana: $12.500.'],
  ]);
  assert.deepEqual(texted, [
    ['ambos', 'Tienes que pagar: Hoy vence lo que le debes a Ana: $12.500.'],
    ['solo-whatsapp', 'Tienes que pagar: En 7 días vence lo que le debes a Ana: $12.500.'],
  ]);
});
