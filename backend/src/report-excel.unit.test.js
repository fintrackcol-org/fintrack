import { test } from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import JSZip from 'jszip';
import { buildSeries, daysBetween, isWholeMonth, summarize } from './services/report-data.service.js';
import { buildWorkbook } from './services/report-excel.service.js';
import { parseExportQuery } from './validators/reports.validator.js';

/**
 * Movimiento de prueba con valores por defecto.
 * @param {object} overrides Campos a cambiar.
 * @returns {object}
 */
const tx = (overrides) => ({
  date: '2026-10-10',
  type: 'gasto',
  categoryName: 'Alimentación',
  description: 'Gasto',
  amount: 1000,
  source: 'manual',
  ...overrides,
});

const OCT = { from: '2026-10-01', to: '2026-10-31', today: '2026-10-20' };

// ---------------------------------------------------------------- fechas

test('isWholeMonth reconoce meses completos, incluido febrero bisiesto', () => {
  assert.equal(isWholeMonth('2026-10-01', '2026-10-31'), true);
  assert.equal(isWholeMonth('2028-02-01', '2028-02-29'), true);
  assert.equal(isWholeMonth('2026-02-01', '2026-02-29'), false, '2026 no es bisiesto');
  assert.equal(isWholeMonth('2026-10-02', '2026-10-31'), false);
  assert.equal(isWholeMonth('2026-10-01', '2026-11-30'), false);
});

test('daysBetween cuenta ambos extremos', () => {
  assert.equal(daysBetween('2026-10-01', '2026-10-01'), 1);
  assert.equal(daysBetween('2026-10-01', '2026-10-31'), 31);
  assert.equal(daysBetween('2026-12-31', '2027-01-01'), 2);
});

// ---------------------------------------------------------------- cálculos

test('summarize calcula ingresos, gastos, balance y tasa de ahorro sin residuos de decimales', () => {
  const s = summarize(
    [tx({ amount: 0.1 }), tx({ amount: 0.2 }), tx({ type: 'ingreso', categoryName: 'Salario', amount: 1 })],
    OCT,
  );
  assert.equal(s.totals.expense, 0.3, 'no 0.30000000000000004');
  assert.equal(s.totals.income, 1);
  assert.equal(s.totals.balance, 0.7);
  assert.equal(s.totals.savingsRate, 0.7);
  assert.equal(s.totals.count, 3);
});

test('summarize deja la tasa de ahorro en null si no hubo ingresos', () => {
  assert.equal(summarize([tx({})], OCT).totals.savingsRate, null);
});

test('el promedio diario solo cuenta los días que ya pasaron', () => {
  const s = summarize([tx({ amount: 2000 })], OCT); // hoy es 20 de octubre
  assert.equal(s.totals.daysElapsed, 20);
  assert.equal(s.totals.dailyAverageExpense, 100);
  const past = summarize([tx({ amount: 3100 })], { ...OCT, today: '2026-12-01' });
  assert.equal(past.totals.daysElapsed, 31, 'un mes ya terminado cuenta todos sus días');
});

test('summarize agrupa por categoría de mayor a menor con su participación', () => {
  const s = summarize(
    [
      tx({ categoryName: 'Transporte', amount: 250 }),
      tx({ categoryName: 'Vivienda', amount: 500 }),
      tx({ categoryName: 'Transporte', amount: 250 }),
      tx({ categoryName: null, amount: 1000 }),
    ],
    OCT,
  );
  assert.deepEqual(
    s.expenseByCategory.map((c) => [c.name, c.amount, c.count, c.share]),
    [
      ['Sin clasificar', 1000, 1, 0.5],
      ['Transporte', 500, 2, 0.25],
      ['Vivienda', 500, 1, 0.25],
    ],
    'a igual monto se conserva el orden de aparición',
  );
});

test('el top de gastos trae los 5 más grandes y desempata por fecha', () => {
  const rows = [10, 70, 30, 70, 50, 20, 60].map((amount, i) =>
    tx({ amount, description: `g${i}`, date: `2026-10-${String(10 + i).padStart(2, '0')}` }),
  );
  rows.push(tx({ type: 'ingreso', amount: 999, categoryName: 'Salario' }));
  const top = summarize(rows, OCT).topExpenses;
  assert.deepEqual(
    top.map((t) => t.description),
    ['g1', 'g3', 'g6', 'g4', 'g2'],
    'los ingresos no entran y a igual monto va primero el más antiguo',
  );
});

test('summarize separa los totales por mes', () => {
  const s = summarize(
    [
      tx({ date: '2026-09-30', amount: 100 }),
      tx({ date: '2026-10-01', amount: 40 }),
      tx({ date: '2026-10-02', type: 'ingreso', categoryName: 'Salario', amount: 500 }),
    ],
    { from: '2026-09-01', to: '2026-10-31', today: '2026-11-15' },
  );
  assert.deepEqual(s.byMonth, [
    { month: '2026-09', income: 0, expense: 100, balance: -100 },
    { month: '2026-10', income: 500, expense: 40, balance: 460 },
  ]);
});

// ---------------------------------------------------------------- serie y hallazgos

test('la serie va día por día, incluye los días sin movimientos y no pasa de hoy', () => {
  const s = summarize(
    [tx({ date: '2026-10-01', amount: 100 }), tx({ date: '2026-10-03', type: 'ingreso', categoryName: 'Salario', amount: 900 })],
    { ...OCT, today: '2026-10-04' },
  );
  assert.equal(s.series.granularity, 'day');
  assert.deepEqual(
    s.series.points.map((p) => [p.from, p.income, p.expense]),
    [
      ['2026-10-01', 0, 100],
      ['2026-10-02', 0, 0],
      ['2026-10-03', 900, 0],
      ['2026-10-04', 0, 0],
    ],
  );
});

test('la serie pasa a semanas y a meses en periodos largos, sin perder ni duplicar plata', () => {
  const rows = [tx({ date: '2026-08-31', amount: 10 }), tx({ date: '2026-09-07', amount: 20 }), tx({ date: '2026-10-31', amount: 40 })];
  const weekly = buildSeries(rows, '2026-08-31', '2026-10-31');
  assert.equal(weekly.granularity, 'week');
  assert.deepEqual([weekly.points[0].from, weekly.points[0].to, weekly.points[0].expense], ['2026-08-31', '2026-09-06', 10]);
  assert.equal(weekly.points.at(-1).to, '2026-10-31', 'la última semana se corta en el fin del periodo');
  assert.equal(weekly.points.reduce((sum, p) => sum + p.expense, 0), 70);

  const monthly = buildSeries(rows, '2026-01-01', '2026-10-31');
  assert.equal(monthly.granularity, 'month');
  assert.equal(monthly.points.length, 10);
  assert.deepEqual([monthly.points[7].from, monthly.points[7].to, monthly.points[7].expense], ['2026-08-01', '2026-08-31', 10]);
});

test('un periodo que todavía no empieza no tiene serie', () => {
  assert.deepEqual(buildSeries([], '2026-12-01', '2026-11-13').points, []);
});

test('los hallazgos salen de las cifras del periodo y no opinan', () => {
  const s = summarize(
    [
      tx({ date: '2026-10-02', type: 'ingreso', categoryName: 'Salario', amount: 1000 }),
      tx({ date: '2026-10-05', categoryName: 'Vivienda', amount: 400 }),
      tx({ date: '2026-10-05', categoryName: 'Transporte', amount: 100 }),
      tx({ date: '2026-10-06', categoryName: 'Salud', amount: 60 }),
      tx({ date: '2026-10-07', categoryName: 'Otros', amount: 40 }),
    ],
    OCT,
  );
  assert.deepEqual(s.topExpenseDay, { date: '2026-10-05', amount: 500, count: 2 });
  assert.deepEqual(
    s.insights.map((i) => i.kind),
    ['top-category', 'balance', 'top-day', 'concentration'],
  );
  const text = (kind) => Object.values(s.insights.find((i) => i.kind === kind)).join(' ').replace(/\s/g, ' ');
  assert.match(text('top-category'), /Vivienda .* 400, el 66,7 ?% de tus gastos/);
  assert.match(text('balance'), /Entró más de lo que salió .* 400, el 40 ?% de tus ingresos.*no tu saldo/);
  assert.match(text('top-day'), /El 5 de octubre .* 500 en 2 movimientos/);
  assert.match(text('concentration'), /el 93,3 ?% del gasto Vivienda, Transporte, Salud/);
});

test('sin gastos no hay hallazgos de gasto, y con balance negativo se dice sin juzgar', () => {
  const onlyIncome = summarize([tx({ type: 'ingreso', categoryName: 'Salario' })], OCT);
  assert.deepEqual(onlyIncome.insights.map((i) => i.kind), ['balance']);
  const negative = summarize([tx({ amount: 500 })], OCT).insights.find((i) => i.kind === 'balance');
  assert.equal(negative.title, 'Salió más de lo que entró');
  assert.doesNotMatch(negative.detail, /ingresos\.? de tus/);
});

// ---------------------------------------------------------------- libro de Excel

/**
 * Reporte completo de prueba, como lo devuelve buildReport.
 * @param {{ from?: string, to?: string, rows?: object[], budgets?: object[] }} [options]
 * @returns {object}
 */
function sampleReport({ from = '2026-10-01', to = '2026-10-31', rows, budgets = [] } = {}) {
  const data = rows ?? [
    tx({ date: '2026-10-02', type: 'ingreso', categoryName: 'Salario', description: 'Pago', amount: 350000 }),
    tx({ date: '2026-10-05', description: '=HYPERLINK("http://x")', amount: 18000 }),
    tx({ date: '2026-10-07', categoryName: 'Transporte', description: 'Bus', amount: 2950 }),
  ];
  return {
    period: { from, to, wholeMonth: isWholeMonth(from, to) },
    owner: { name: 'María', email: 'maria@example.com' },
    generatedOn: '2026-10-20',
    ...summarize(data, { from, to, today: '2026-10-20' }),
    budgets,
    rows: data,
  };
}

/**
 * Arma el libro y lo vuelve a leer, como lo haría Excel.
 * @param {object} report
 * @returns {Promise<ExcelJS.Workbook>}
 */
async function roundTrip(report) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(await buildWorkbook(report));
  return workbook;
}

/**
 * Valor visible de una celda: el resultado si es fórmula, o el valor tal cual.
 * @param {ExcelJS.Cell} cell
 * @returns {unknown}
 */
const shown = (cell) => (cell.value && typeof cell.value === 'object' && 'formula' in cell.value ? cell.value.result : cell.value);

/**
 * Textos de una hoja, para buscar títulos y etiquetas sin depender de la celda exacta.
 * @param {ExcelJS.Worksheet} ws
 * @returns {string[]}
 */
function textsOf(ws) {
  const texts = [];
  ws.eachRow((row) => row.eachCell((cell) => typeof cell.value === 'string' && texts.push(cell.value)));
  return texts;
}

test('el libro abre en Resumen y trae Movimientos, Categorías y Evolución', async () => {
  const wb = await roundTrip(sampleReport());
  assert.deepEqual(
    wb.worksheets.map((w) => w.name),
    ['Resumen', 'Movimientos', 'Categorías', 'Evolución'],
  );
});

test('los indicadores del resumen son fórmulas sobre Movimientos con el resultado ya calculado', async () => {
  const ws = (await roundTrip(sampleReport())).getWorksheet('Resumen');
  assert.equal(ws.getCell('B5').value.formula, 'SUMIFS(Movimientos!$E$2:$E$4,Movimientos!$B$2:$B$4,"Ingreso")');
  assert.equal(shown(ws.getCell('B5')), 350000);
  assert.equal(shown(ws.getCell('E5')), 20950);
  assert.equal(ws.getCell('H5').value.formula, 'B5-E5');
  assert.equal(shown(ws.getCell('H5')), 329050);
  assert.equal(shown(ws.getCell('K5')), 3);
  assert.equal(shown(ws.getCell('E6')), '2 movimientos');
  assert.equal(ws.getCell('B5').numFmt, '"$" #,##0;[Red]-"$" #,##0');
});

test('Movimientos trae las columnas del CSV, con fechas y montos que Excel puede operar', async () => {
  const ws = (await roundTrip(sampleReport())).getWorksheet('Movimientos');
  assert.deepEqual(ws.getRow(1).values.slice(1), ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Origen']);
  assert.deepEqual(ws.getRow(2).values.slice(2), ['Ingreso', 'Salario', 'Pago', 350000, 'Manual']);
  assert.ok(ws.getCell('A2').value instanceof Date, 'las fechas son fechas de Excel, no texto');
  assert.equal(typeof ws.getCell('E3').value, 'number');
  assert.equal(ws.autoFilter, 'A1:F4');
  assert.match(ws.getCell('E5').value.formula, /^SUMPRODUCT\(SUBTOTAL\(109,.*="Ingreso"\)\)$/, 'el total respeta los filtros');
  assert.equal(shown(ws.getCell('E5')), 350000);
  assert.equal(shown(ws.getCell('E6')), 20950);
});

test('una descripción que empieza por = queda como texto, no como fórmula', async () => {
  const ws = (await roundTrip(sampleReport())).getWorksheet('Movimientos');
  assert.equal(ws.getCell('D3').value, '=HYPERLINK("http://x")');
  assert.equal(ws.getCell('D3').type, ExcelJS.ValueType.String);
});

test('Categorías suma cada categoría de gasto con fórmulas, de mayor a menor', async () => {
  const ws = (await roundTrip(sampleReport())).getWorksheet('Categorías');
  assert.equal(ws.getCell('A6').value, 'Alimentación');
  assert.equal(
    ws.getCell('B6').value.formula,
    'SUMIFS(Movimientos!$E$2:$E$4,Movimientos!$C$2:$C$4,"Alimentación",Movimientos!$B$2:$B$4,"Gasto")',
  );
  assert.equal(shown(ws.getCell('B6')), 18000);
  assert.equal(shown(ws.getCell('B7')), 2950);
  assert.equal(shown(ws.getCell('B8')), 20950, 'total');
  assert.equal(shown(ws.getCell('D6')), 1);
  assert.ok(textsOf(ws).includes('Ingresos por categoría'));
});

test('Evolución va día por día sin pasar de hoy, y por semanas en periodos largos', async () => {
  const daily = (await roundTrip(sampleReport())).getWorksheet('Evolución');
  assert.equal(shown(daily.getCell('B6')), 350000);
  assert.equal(shown(daily.getCell('B8')), 329050);
  assert.equal(daily.getCell('A13').value, '2 oct');
  assert.equal(shown(daily.getCell('D13')), 350000);
  assert.match(daily.getCell('E16').value.formula, /^SUMIFS\(.*"Gasto",.*">="&B16,.*"<="&C16\)$/);
  assert.equal(daily.getCell('A31').value, '20 oct', 'hoy es el último día');
  assert.equal(daily.getCell('A32').value, null);

  const twoMonths = sampleReport({
    from: '2026-09-01',
    to: '2026-10-31',
    rows: [tx({ date: '2026-09-15', amount: 100 }), tx({ date: '2026-10-15', amount: 300 })],
  });
  const weekly = (await roundTrip(twoMonths)).getWorksheet('Evolución');
  assert.ok(textsOf(weekly).includes('Ingresos y gastos por semana'));
  assert.equal(weekly.getCell('A14').value, '15 – 21 sep');
  assert.equal(shown(weekly.getCell('E14')), 100);
});

test('el resumen incluye los hallazgos y el top de gastos', async () => {
  const texts = textsOf((await roundTrip(sampleReport())).getWorksheet('Resumen'));
  assert.ok(texts.includes('Lo que dicen tus números'));
  assert.ok(texts.includes('Alimentación fue la categoría con más gasto'));
  assert.ok(texts.includes('Top 2 gastos más grandes'));
  assert.ok(texts.includes('1. =HYPERLINK("http://x")'));
});

test('la hoja Presupuestos aparece solo si hay presupuestos, con su estado', async () => {
  assert.equal((await roundTrip(sampleReport())).getWorksheet('Presupuestos'), undefined);
  const exceeded = sampleReport({
    budgets: [{ category: 'Transporte', limit: 2000, spent: 2950, available: -950, usage: 1.475, level: 'exceeded_100' }],
  });
  const ws = (await roundTrip(exceeded)).getWorksheet('Presupuestos');
  assert.ok(textsOf(ws).includes('Presupuestos de octubre de 2026'));
  assert.ok(textsOf(ws).includes('Excedido'));
  assert.equal(shown(ws.getCell('C6')), 2950);

  const atLimit = sampleReport({
    budgets: [{ category: 'Vivienda', limit: 300000, spent: 300000, available: 0, usage: 1, level: 'at_limit' }],
  });
  const texts = textsOf((await roundTrip(atLimit)).getWorksheet('Presupuestos'));
  assert.ok(texts.includes('En el límite'));
  assert.ok(!texts.includes('Excedido'), 'gastar justo el límite no es excederlo');
});

// ---------------------------------------------------------------- gráficos nativos

/**
 * Archivos de gráfico dentro del .xlsx, con su contenido.
 * @param {object} report
 * @returns {Promise<{ charts: string[], types: string }>}
 */
async function chartsOf(report) {
  const zip = await JSZip.loadAsync(await buildWorkbook(report));
  const paths = Object.keys(zip.files).filter((path) => /^xl\/charts\/chart\d+\.xml$/.test(path));
  return {
    charts: await Promise.all(paths.sort().map((path) => zip.file(path).async('string'))),
    types: await zip.file('[Content_Types].xml').async('string'),
  };
}

test('el libro lleva cinco gráficos nativos que leen sus datos de las celdas', async () => {
  const { charts, types } = await chartsOf(sampleReport());
  assert.equal(charts.length, 5, 'tres en Resumen, uno en Categorías y uno en Evolución');
  assert.equal((types.match(/drawingml\.chart\+xml/g) ?? []).length, 5);
  assert.ok(charts[0].includes("<c:f>'Evolución'!$B$6:$B$7</c:f>"), 'ingresos frente a gastos');
  assert.ok(charts[1].includes("<c:f>'Categorías'!$B$6:$B$7</c:f>"), 'gastos por categoría');
  assert.ok(charts[3].includes("<c:f>'Evolución'!$E$12:$E$31</c:f>"), 'gastos por día');
  assert.ok(charts[1].includes('<c:pt idx="0"><c:v>18000</c:v></c:pt>'), 'lleva el valor ya calculado');
});

test('sin gastos no hay gráfico de categorías, y un texto con < o & no rompe el libro', async () => {
  const report = sampleReport({ rows: [tx({ type: 'ingreso', categoryName: 'Ventas <A&B>', amount: 500 })] });
  const { charts } = await chartsOf(report);
  assert.equal(charts.length, 3);
  const wb = await roundTrip(report);
  assert.ok(textsOf(wb.getWorksheet('Resumen')).includes('Sin gastos en el periodo.'));
  assert.equal(wb.getWorksheet('Categorías').getCell('A6').value, 'Ventas <A&B>');
});

test('una categoría con caracteres de XML llega bien escrita al gráfico', async () => {
  const { charts } = await chartsOf(sampleReport({ rows: [tx({ categoryName: 'Café & "pan" <dulce>' })] }));
  assert.ok(charts[1].includes('<c:v>Café &amp; &quot;pan&quot; &lt;dulce&gt;</c:v>'));
});

// ---------------------------------------------------------------- validador

test('parseExportQuery acepta xlsx', () => {
  assert.equal(parseExportQuery({ format: 'xlsx', from: '2026-10-01', to: '2026-10-31' }).format, 'xlsx');
});
