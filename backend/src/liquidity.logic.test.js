import { test } from 'node:test';
import assert from 'node:assert/strict';
import { monthlyOutflows, projectLiquidity } from './services/liquidity.logic.js';

/** El caso de la tarea FT-0059: hoy 5 de nov, $1.500.000, $40.000 al día, arriendo el 15 y tarjeta e internet el 20. */
const example = {
  today: '2026-11-05',
  money: 1_500_000,
  pace: 40_000,
  outflows: [
    { date: '2026-11-15', amount: 900_000, kind: 'compromiso', name: 'Arriendo' },
    { date: '2026-11-20', amount: 250_000, kind: 'card', name: 'Tarjeta' },
    { date: '2026-11-20', amount: 50_000, kind: 'compromiso', name: 'Internet' },
  ],
};

test('el ejemplo de la tarea: el 20 de noviembre faltan $300.000 por la tarjeta y el internet', () => {
  const result = projectLiquidity(example);
  assert.equal(result.firstShortfall.date, '2026-11-20');
  assert.equal(result.firstShortfall.missing, 300_000);
  assert.deepEqual(result.firstShortfall.causes.map((c) => c.name).sort(), ['Internet', 'Tarjeta']);
  assert.equal(result.risk, 'falta');
  const day15 = result.days.find((d) => d.date === '2026-11-15');
  assert.equal(day15.end, 200_000, 'después del arriendo quedan $200.000');
  assert.ok(result.safeDailySpend < 40_000);
  // Gastando eso cada día se llega al 20 sin que falte (el tope es "hasta el hueco").
  const safe = projectLiquidity({ ...example, pace: result.safeDailySpend });
  assert.ok(!safe.firstShortfall || safe.firstShortfall.date > '2026-11-20');
  assert.ok(safe.days.find((d) => d.date === '2026-11-20').end >= 0);
});

test('si nunca falta: sin hueco y riesgo ok', () => {
  const result = projectLiquidity({ ...example, money: 5_000_000, horizonDays: 30 });
  assert.equal(result.firstShortfall, null);
  assert.equal(result.risk, 'ok');
  assert.equal(result.days.length, 31, 'hoy más 30 días');
});

test('queda poco (menos de 7 días de gasto normal): riesgo', () => {
  const result = projectLiquidity({ ...example, money: 1_820_000, horizonDays: 15 });
  assert.equal(result.firstShortfall, null);
  assert.equal(result.lowest.amount, 20_000);
  assert.equal(result.risk, 'riesgo');
});

test('lo atrasado se resta hoy', () => {
  const result = projectLiquidity({
    today: '2026-11-05',
    money: 100_000,
    pace: 0,
    outflows: [{ date: '2026-11-01', amount: 150_000, kind: 'compromiso', name: 'Luz' }],
    horizonDays: 5,
  });
  assert.equal(result.firstShortfall.date, '2026-11-05');
  assert.equal(result.firstShortfall.missing, 50_000);
});

test('tarjeta y vaca el mismo día suman los dos', () => {
  const result = projectLiquidity({
    today: '2026-11-05',
    money: 300_000,
    pace: 0,
    outflows: [
      { date: '2026-11-10', amount: 200_000, kind: 'card', name: 'Visa' },
      { date: '2026-11-10', amount: 150_000, kind: 'vaca', name: 'Paseo' },
    ],
    horizonDays: 10,
  });
  const day = result.days.find((d) => d.date === '2026-11-10');
  assert.equal(day.out, 350_000);
  assert.equal(result.firstShortfall.missing, 50_000);
});

test('sin historial de gasto (pace null) solo cuenta los pagos', () => {
  const result = projectLiquidity({ ...example, pace: null, horizonDays: 15 });
  assert.equal(result.firstShortfall, null);
  assert.equal(result.lowest.amount, 300_000);
  // El tope diario sale igual: lo que sobra después de los pagos, repartido en los días.
  assert.equal(result.safeDailySpend, 20_000);
});

test('un ingreso esperado cuenta solo si viene en inflows y puede mover el hueco', () => {
  const result = projectLiquidity({
    ...example,
    inflows: [{ date: '2026-11-18', amount: 500_000, kind: 'esperado', name: 'Mes flaco' }],
  });
  assert.notEqual(result.firstShortfall?.date, '2026-11-20');
});

test('monthlyOutflows: repite el compromiso cada mes, salta el del mes si ya se pagó y ajusta el 31', () => {
  const outflows = monthlyOutflows({
    commitments: [
      { id: 'a', name: 'Arriendo', amount: 900_000, dayOfMonth: 31 },
      { id: 'b', name: 'Internet', amount: 50_000, dayOfMonth: 20 },
    ],
    paidThisMonth: (c) => c.name === 'Internet',
    today: '2026-11-05',
    until: '2027-01-21',
  });
  assert.deepEqual(
    outflows.map((o) => `${o.name} ${o.date}`),
    [
      'Arriendo 2026-11-30',
      'Arriendo 2026-12-31',
      'Internet 2026-12-20',
      'Internet 2027-01-20',
    ].sort((a, b) => a.slice(-10).localeCompare(b.slice(-10))),
  );
});

test('las fechas son días de calendario (sin corrimientos por zona horaria)', () => {
  const result = projectLiquidity({
    ...example,
    today: '2026-11-30',
    outflows: [],
    horizonDays: 2,
  });
  assert.deepEqual(
    result.days.map((d) => d.date),
    ['2026-11-30', '2026-12-01', '2026-12-02'],
  );
});

test('con el ingreso esperado de FT-0060 el hueco desaparece o se mueve, y no cuenta como causa', () => {
  // $400.000 el 18 cubren la tarjeta y el internet del 20: el hueco se corre al 23.
  const moved = projectLiquidity({
    ...example,
    inflows: [{ date: '2026-11-18', amount: 400_000, kind: 'esperado', name: 'Sueldo' }],
  });
  assert.equal(moved.firstShortfall.date, '2026-11-23');
  assert.equal(moved.days.find((d) => d.date === '2026-11-18').in, 400_000);

  // Con $2.000.000 el 18 alcanza hasta el final de la proyección.
  const covered = projectLiquidity({
    ...example,
    inflows: [{ date: '2026-11-18', amount: 2_000_000, kind: 'esperado', name: 'Sueldo' }],
  });
  assert.equal(covered.firstShortfall, null);

  // Si llega después del 20, el hueco sigue ese día.
  const late = projectLiquidity({
    ...example,
    inflows: [{ date: '2026-11-25', amount: 400_000, kind: 'esperado', name: 'Sueldo' }],
  });
  assert.equal(late.firstShortfall.date, '2026-11-20');
  assert.ok(late.firstShortfall.causes.every((c) => c.kind !== 'esperado'));
});
