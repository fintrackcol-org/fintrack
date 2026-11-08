import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  cushionGoal,
  expectedIncomeFor,
  isLargeIncome,
  legacyIncomeType,
  monthlyIncome,
  ownSalary,
  socialSecurity,
  splitIncome,
  workDayGoal,
  workDaysLeft,
} from './services/income.logic.js';

const source = (kind, extra = {}) => ({
  name: kind,
  kind,
  frequency: 'mensual',
  payDays: [],
  amount: null,
  low: null,
  high: null,
  lastMonths: [],
  workDays: null,
  ...extra,
});

test('ejemplo 1 de la tarea: independiente con $3.000.000, $1.200.000 y $2.500.000 → normal $2.500.000, flaco $1.200.000', () => {
  const sources = [source('proyectos', { lastMonths: [3_000_000, 1_200_000, 2_500_000] })];
  const result = monthlyIncome({ sources, history: [] });
  assert.equal(result.normal, 2_500_000);
  assert.equal(result.lean, 1_200_000);
  assert.equal(result.basis, 'declared');
  // La misma respuesta si eso está registrado en la app (historia).
  const fromHistory = monthlyIncome({ sources: [], history: [3_000_000, 1_200_000, 2_500_000] });
  assert.equal(fromHistory.normal, 2_500_000);
  assert.equal(fromHistory.lean, 1_200_000);
  assert.equal(fromHistory.basis, 'history');
});

test('ejemplo 2: vendedor con base $1.400.000 y comisiones de $400.000 a $1.200.000 → flaco $1.800.000', () => {
  const result = monthlyIncome({ sources: [source('comisiones', { amount: 1_400_000, low: 400_000, high: 1_200_000 })], history: [] });
  assert.equal(result.lean, 1_800_000);
  assert.equal(result.normal, 2_200_000);
  assert.equal(result.fixed, 1_400_000);
});

test('ejemplo 3: domiciliario, 6 días a la semana, $70.000 por día → unos $1.800.000 al mes', () => {
  const result = monthlyIncome({ sources: [source('diario', { amount: 70_000, workDays: 6 })], history: [] });
  assert.ok(Math.abs(result.normal - 1_800_000) < 30_000, `normal ${result.normal}`);
  assert.equal(result.lean, Math.round(result.normal * 0.8), 'sin historial: lo dicho × 0,8');
  assert.equal(result.estimated, true);
});

test('sin historial ni fuentes no hay número; con un solo mes de historial manda lo que dijo', () => {
  assert.equal(monthlyIncome({ sources: [], history: [] }).basis, 'none');
  const oneMonth = monthlyIncome({ sources: [source('sueldo', { amount: 2_000_000 })], history: [900_000] });
  assert.equal(oneMonth.basis, 'declared');
  assert.equal(oneMonth.lean, 2_000_000);
});

test('con seis meses: normal es la mediana de los seis y flaco el menor de los últimos tres', () => {
  const history = [1_000_000, 2_000_000, 1_500_000, 400_000, 3_000_000, 2_500_000];
  const result = monthlyIncome({ sources: [], history });
  assert.equal(result.normal, 1_750_000);
  assert.equal(result.lean, 1_000_000, 'el 400.000 es de hace cuatro meses: no cuenta para el flaco');
});

test('dos fuentes (sueldo + proyectos): lo fijo cuenta completo y el flaco nunca baja del sueldo', () => {
  const sources = [
    source('sueldo', { amount: 1_500_000, payDays: [15, 30] }),
    source('proyectos', { lastMonths: [800_000, 0, 500_000] }),
  ];
  const declared = monthlyIncome({ sources, history: [] });
  assert.equal(declared.lean, 2_000_000);
  const history = monthlyIncome({ sources, history: [1_600_000, 1_200_000, 2_100_000] });
  assert.equal(history.lean, 1_500_000, 'un mes con menos que el sueldo no baja el flaco por debajo de lo fijo');
  assert.equal(ownSalary({ sources, lean: history.lean }), null, 'quien tiene sueldo no necesita sueldo propio');
});

test('sueldo propio: el flaco menos el ahorro, redondeado ($1.200.000 → $1.100.000)', () => {
  assert.equal(ownSalary({ sources: [source('proyectos')], lean: 1_200_000 }), 1_100_000);
  assert.equal(ownSalary({ sources: [source('mesada')], lean: 500_000 }), null);
});

test('reparto de $2.000.000: pagos, seguridad social, sueldo y colchón, en ese orden', () => {
  const result = splitIncome({ amount: 2_000_000, pendingCommitments: 600_000, salaryLeft: 700_000, cushionGap: 5_000_000, independent: true });
  assert.equal(result.commitments, 600_000);
  assert.equal(result.socialSecurity, 228_000); // 2.000.000 × 40 % × 28,5 %
  assert.equal(result.salary, 700_000);
  assert.equal(result.cushion, 472_000);
  assert.equal(result.free, 0);
  const total = result.commitments + result.socialSecurity + result.salary + result.cushion + result.free;
  assert.equal(total, 2_000_000, 'se reparte todo, ni un peso más');
});

test('reparto con poca plata: alcanza solo para los pagos', () => {
  const result = splitIncome({ amount: 300_000, pendingCommitments: 600_000, salaryLeft: 700_000, cushionGap: 1, independent: false });
  assert.deepEqual(result, { commitments: 300_000, socialSecurity: 0, salary: 0, cushion: 0, free: 0 });
});

test('ingreso grande: más de dos días de gasto normal', () => {
  assert.equal(isLargeIncome({ amount: 100_000, pace: 40_000 }), true);
  assert.equal(isLargeIncome({ amount: 80_000, pace: 40_000 }), false);
  assert.equal(isLargeIncome({ amount: 150_000, pace: null }), true);
});

test('colchón: tres meses para ingresos variables, uno para fijos', () => {
  assert.equal(cushionGoal({ commitments: 900_000, pace: 30_000, variable: true }), 5_400_000);
  assert.equal(cushionGoal({ commitments: 900_000, pace: 30_000, variable: false }), 1_800_000);
});

test('seguridad social: 40 % del ingreso, con mínimo de un salario mínimo', () => {
  const big = socialSecurity(5_000_000);
  assert.equal(big.ibc, 2_000_000);
  assert.equal(big.health, 250_000);
  assert.equal(big.pension, 320_000);
  const small = socialSecurity(1_000_000);
  assert.equal(small.ibc, 1_750_905, 'nunca por debajo de 1 SMMLV');
});

test('días de trabajo: noviembre 2026 desde el sábado 7, trabajando 6 días (descansa el domingo)', () => {
  // Del 7 al 30: 24 días, de los que 3 son domingo (8, 15, 22, 29 → 4). Quedan 20.
  assert.equal(workDaysLeft('2026-11-07', 6), 20);
  assert.equal(workDaysLeft('2026-11-07', 7), 24);
});

test('meta por día de trabajo y lo que sobró hoy', () => {
  const result = workDayGoal({ target: 1_800_000, earned: 980_000, todayIncome: 0, today: '2026-11-19', workDays: 6 });
  assert.equal(result.daysLeft, 10);
  assert.equal(result.perDay, 82_000);
  const extra = workDayGoal({ target: 1_800_000, earned: 1_082_000, todayIncome: 102_000, today: '2026-11-19', workDays: 6 });
  assert.equal(extra.extraToday, 20_000);
});

test('expectedIncome: el sueldo es seguro y en sus días; lo variable con el flaco y sin fecha', () => {
  const sources = [
    { ...source('sueldo', { amount: 2_000_000, payDays: [15, 30] }), id: 's1' },
    { ...source('proyectos', { lastMonths: [800_000, 500_000, 1_000_000] }), id: 'p1' },
  ];
  const result = expectedIncomeFor({ sources, from: '2026-11-07', to: '2026-11-30' });
  assert.deepEqual(
    result.filter((r) => r.sure),
    [
      { date: '2026-11-15', amount: 1_000_000, sourceId: 's1', sure: true },
      { date: '2026-11-30', amount: 1_000_000, sourceId: 's1', sure: true },
    ],
  );
  assert.deepEqual(result.filter((r) => !r.sure), [{ date: null, amount: 500_000, sourceId: 'p1', sure: false }]);
});

test('tipo_ingreso de siempre: fecha fija si alguna fuente fija tiene días', () => {
  assert.deepEqual(legacyIncomeType([source('sueldo', { payDays: [30, 15] })]), { incomeType: 'fecha_fija', payDays: [15, 30] });
  assert.deepEqual(legacyIncomeType([source('diario')]), { incomeType: 'sin_fecha', payDays: [] });
  assert.deepEqual(legacyIncomeType([]), { incomeType: null, payDays: [] });
});
