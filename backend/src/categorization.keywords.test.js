import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guessByKeyword } from './services/categorization.service.js';

test('las compras de mercado caen en alimentación sin la IA', () => {
  const keys = new Set(['alimentacion', 'otros']);
  assert.equal(guessByKeyword('Tomate, papa amarilla y papa pastusa y dos cabezas ajos', keys), 'alimentacion');
});
