import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  liquidityAlertDue,
  liquidityAlertPayload,
  liquidityLine,
} from './services/liquidity.logic.js';
import { createReminderScheduler } from './services/reminder-scheduler.service.js';

const shortfall = { date: '2026-11-20', missing: 300_000 };

test('avisa a 7, 3 y 1 día del hueco, y no a otras distancias', () => {
  assert.equal(liquidityAlertDue({ today: '2026-11-13', shortfall, last: null }), 7);
  assert.equal(liquidityAlertDue({ today: '2026-11-17', shortfall, last: null }), 3);
  assert.equal(liquidityAlertDue({ today: '2026-11-19', shortfall, last: null }), 1);
  for (const today of ['2026-11-10', '2026-11-15', '2026-11-20']) {
    assert.equal(liquidityAlertDue({ today, shortfall, last: null }), null, today);
  }
  assert.equal(liquidityAlertDue({ today: '2026-11-13', shortfall: null, last: null }), null);
});

test('no repite el aviso, salvo que lo que falta cambie más del 10 %', () => {
  const last = { date: '2026-11-20', daysBefore: 3, missing: 300_000 };
  const today = '2026-11-17';
  assert.equal(liquidityAlertDue({ today, shortfall, last }), null);
  assert.equal(liquidityAlertDue({ today, shortfall: { ...shortfall, missing: 320_000 }, last }), null);
  assert.equal(liquidityAlertDue({ today, shortfall: { ...shortfall, missing: 340_000 }, last }), 3);
  // Otro hueco, u otra distancia del mismo, sí se avisa.
  assert.equal(liquidityAlertDue({ today, shortfall, last: { ...last, daysBefore: 7 } }), 3);
  assert.equal(
    liquidityAlertDue({ today: '2026-11-18', shortfall: { date: '2026-11-21', missing: 1 }, last }),
    3,
  );
});

test('el texto dice cuándo, cuánto, por qué y cuánto gastar al día', () => {
  const payload = liquidityAlertPayload({
    firstShortfall: {
      ...shortfall,
      causes: [
        { name: 'Tarjeta', amount: 250_000 },
        { name: 'Internet', amount: 50_000 },
      ],
    },
    safeDailySpend: 28_000,
    pace: 40_000,
  });
  assert.equal(
    payload.body,
    'El 20 de noviembre te faltarían $300.000 por: Tarjeta ($250.000) e Internet ($50.000). Si gastas $28.000 al día, llegas.',
  );
  assert.equal(payload.url, '/app/liquidez');
  // Sin gasto normal, o si ni gastando $0 se llega, no promete nada.
  const plain = liquidityAlertPayload({
    firstShortfall: { ...shortfall, causes: [{ name: 'Arriendo', amount: 900_000 }] },
    safeDailySpend: 0,
    pace: null,
  });
  assert.equal(plain.body, 'El 20 de noviembre te faltarían $300.000 por: Arriendo ($900.000).');
});

test('la línea del bot en los tres estados', () => {
  const base = { ready: true, lowest: { date: '2026-11-18', amount: 40_000 }, until: '2026-11-30' };
  assert.equal(liquidityLine({ ...base, risk: 'ok' }), 'Hasta el 30 de noviembre vas bien.');
  assert.equal(liquidityLine({ ...base, risk: 'riesgo' }), 'Justo: el 18 de noviembre te quedan $40.000.');
  assert.equal(
    liquidityLine({ ...base, risk: 'falta', firstShortfall: shortfall }),
    'Ojo: el 20 de noviembre te faltan $300.000.',
  );
  assert.equal(liquidityLine({ ready: false }), null);
});

/** Programador con un usuario a las 09:00 en Bogotá (14:00 UTC) y el hueco a 3 días. */
function setup({ last = null, whatsapp = async () => true } = {}) {
  const sent = [];
  const saved = [];
  const messages = [];
  const user = { id: 'u1', timezone: 'America/Bogota', time: '09:00', last };
  const scheduler = createReminderScheduler({
    listDueDebts: async () => [],
    listCandidates: async () => [],
    listCardUsers: async () => [],
    listLiquidityUsers: async () => [{ ...user, last: saved.at(-1) ?? user.last }],
    getLiquidity: async () => ({
      ready: true,
      today: '2026-11-17',
      pace: 40_000,
      safeDailySpend: 28_000,
      firstShortfall: { ...shortfall, causes: [{ name: 'Arriendo', amount: 900_000 }] },
    }),
    saveLiquidityAlert: async (_id, alert) => saved.push(alert),
    sendToUser: async (id, payload) => sent.push([id, payload]),
    notifyWhatsapp: async (id, text) => {
      messages.push(text);
      return whatsapp(id, text);
    },
    now: () => new Date('2026-11-17T14:00:00Z'),
    log: { info: () => {}, error: () => {} },
  });
  return { scheduler, sent, saved, messages };
}

test('el programador avisa una sola vez por bandeja, push y WhatsApp, y guarda el aviso', async () => {
  const { scheduler, sent, saved, messages } = setup();
  await scheduler.tick();
  await scheduler.tick();
  assert.equal(sent.length, 1);
  assert.equal(sent[0][1].title, 'Ojo con tu plata');
  assert.deepEqual(saved, [{ date: '2026-11-20', daysBefore: 3, missing: 300_000 }]);
  assert.equal(messages.length, 1);
  assert.match(messages[0], /^El 20 de noviembre te faltarían \$300\.000/);
});

test('si ya se avisó a esa distancia (p. ej. tras reiniciar el servidor) no repite', async () => {
  const { scheduler, sent } = setup({ last: { date: '2026-11-20', daysBefore: 3, missing: 300_000 } });
  await scheduler.tick();
  assert.equal(sent.length, 0);
});

test('si WhatsApp falla, el aviso igual queda en la app', async () => {
  const { scheduler, sent } = setup({
    whatsapp: async () => {
      throw new Error('fuera de la ventana de 24 horas');
    },
  });
  const result = await scheduler.tick();
  assert.equal(sent.length, 1);
  assert.equal(result.sent, 1);
});
