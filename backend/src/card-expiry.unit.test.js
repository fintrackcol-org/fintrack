import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dueExpiryNotice, expiryReminderPayload, expiryStatus } from './services/card-expiry.js';
import { parseNewCard } from './validators/cards.validator.js';

// Vencimiento del plástico (FT-0065), sin base de datos.
const card = { id: 'c1', name: 'Visa', last4: '8456', expiryMonth: 3, expiryYear: 2027, expiryNotified: [] };

test('muestra el vencimiento como MM/AA y cuenta hasta el mes en que vence', () => {
  const s = expiryStatus(card, '2027-01-01');
  assert.equal(s.label, '03/27');
  assert.equal(s.daysLeft, 59);
  assert.equal(s.expired, false);
  assert.equal(expiryStatus({ expiryMonth: null, expiryYear: null }, '2027-01-01'), null);
});

test('vencida solo cuando ya pasó el último día del mes', () => {
  assert.equal(expiryStatus(card, '2027-03-31').expired, false);
  assert.equal(expiryStatus(card, '2027-04-01').expired, true);
});

test('avisa a 60 y a 30 días, una vez cada uno', () => {
  assert.equal(dueExpiryNotice(card, '2026-11-15'), null);
  assert.equal(dueExpiryNotice(card, '2027-01-01'), 60);
  assert.equal(dueExpiryNotice({ ...card, expiryNotified: [60] }, '2027-01-15'), null);
  assert.equal(dueExpiryNotice({ ...card, expiryNotified: [60] }, '2027-02-01'), 30);
  // Si se registró tarde, va directo el de 30.
  assert.equal(dueExpiryNotice(card, '2027-02-10'), 30);
  assert.equal(dueExpiryNotice({ ...card, expiryNotified: [60, 30] }, '2027-02-10'), null);
  assert.equal(dueExpiryNotice(card, '2027-05-01'), null);
});

test('el aviso dice cuál tarjeta y en qué mes', () => {
  assert.match(expiryReminderPayload(card, '2027-01-01').body, /Visa ••8456 vence en marzo \(03\/27\)/);
});

test('valida MM/AA: van juntos, mes 1-12 y año de 2 o 4 cifras', () => {
  const base = { network: 'visa', tier: 'gold', last4: '8456', limit: 1000000, available: 1000000, paymentDay: 5 };
  const ok = parseNewCard({ ...base, expiryMonth: 3, expiryYear: 27 });
  assert.equal(ok.expiryYear, 2027);
  assert.throws(() => parseNewCard({ ...base, expiryMonth: 13, expiryYear: 27 }), (e) => e.details.some((d) => d.field === 'expiryMonth'));
  assert.throws(() => parseNewCard({ ...base, expiryMonth: 3 }), (e) => e.details.some((d) => d.field === 'expiryYear'));
});
