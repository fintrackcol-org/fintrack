import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { pointLabel } from './report-data.service.js';
import { addCharts } from './report-excel-charts.js';

/*
 * Reporte en Excel (.xlsx) del periodo, con el diseño de Rinde (FT-0012).
 *
 * Hojas:
 * - "Resumen": tablero con indicadores, tres gráficos, hallazgos y los gastos más grandes.
 * - "Movimientos": una fila por movimiento (las mismas columnas del CSV), con filtros.
 * - "Categorías": gastos e ingresos por categoría, con su gráfico.
 * - "Evolución": ingresos y gastos por día, semana o mes, con su gráfico.
 * - "Presupuestos": solo si el periodo es un mes completo y tiene presupuestos.
 *
 * Las cifras son fórmulas que leen la hoja Movimientos: si alguien corrige un monto en Excel, las
 * tablas y los gráficos se recalculan. Cada fórmula lleva además su resultado ya calculado, para
 * que se vea bien en visores que no recalculan (vista previa del celular, Google Drive).
 */

const COLORS = {
  brand: 'FF6142FF',
  brandSoft: 'FFECE8FF',
  ink: 'FF16141F',
  muted: 'FF6B6880',
  canvas: 'FFF5F4F9',
  line: 'FFE4E2EE',
  white: 'FFFFFFFF',
  positive: 'FF087A59',
  negative: 'FFC8321F',
  caution: 'FF9A5B00',
  positiveSoft: 'FFE3F5EE',
  negativeSoft: 'FFFBE6E3',
  cautionSoft: 'FFFDF1DC',
};

/** Colores de los gráficos (sin el canal alfa): ingresos en verde, gastos en violeta. */
const CHART = { income: '087A59', expense: '6142FF' };

const MONEY = '"$" #,##0;[Red]-"$" #,##0';
const PERCENT = '0.0%';
const DATE = 'dd/mm/yyyy';
const MOVEMENTS = 'Movimientos';
const CATEGORIES = 'Categorías';
const EVOLUTION = 'Evolución';
const FONT = 'Calibri';

/** Logo oficial horizontal (1600 × 512), el mismo del kit de marca. */
const LOGO = readFileSync(new URL('../assets/rinde-logo.png', import.meta.url));
const LOGO_SIZE = { width: 106, height: 34 };

const TYPE_LABELS = { gasto: 'Gasto', ingreso: 'Ingreso' };
const SOURCE_LABELS = { manual: 'Manual', ia: 'IA', sin_clasificar: 'Sin clasificar' };
const GRANULARITY = { day: 'día', week: 'semana', month: 'mes' };
const LEVEL = {
  none: { label: 'Bien', color: COLORS.positive, fill: COLORS.positiveSoft },
  warning_80: { label: 'Cerca del límite', color: COLORS.caution, fill: COLORS.cautionSoft },
  at_limit: { label: 'En el límite', color: COLORS.caution, fill: COLORS.cautionSoft },
  exceeded_100: { label: 'Excedido', color: COLORS.negative, fill: COLORS.negativeSoft },
};

const fill = (argb) => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } });
const font = (opts = {}) => ({ name: FONT, size: 11, color: { argb: COLORS.ink }, ...opts });
const bottomLine = { bottom: { style: 'thin', color: { argb: COLORS.line } } };

/**
 * Texto para usar dentro de una fórmula de Excel: entre comillas y con las comillas duplicadas.
 * @param {string} text
 * @returns {string}
 */
const q = (text) => `"${String(text).replace(/"/g, '""')}"`;

/**
 * `2026-10-17` → fecha de Excel (sin hora, en UTC para que no se corra un día).
 * @param {string} iso AAAA-MM-DD
 * @returns {Date}
 */
const toDate = (iso) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
};

/**
 * `2026-10-01` → `1 de oct de 2026`.
 * @param {string} iso AAAA-MM-DD
 * @returns {string}
 */
const longDate = (iso) =>
  toDate(iso).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });

/**
 * `2026-10` → `Octubre de 2026`.
 * @param {string} month AAAA-MM
 * @returns {string}
 */
const monthLabel = (month) => {
  const text = toDate(`${month}-01`).toLocaleDateString('es-CO', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
  return text.charAt(0).toUpperCase() + text.slice(1);
};

/**
 * Rango de una columna de datos de la hoja Movimientos, para usar en fórmulas de otras hojas.
 * @param {string} col Letra de la columna.
 * @param {{ first: number, last: number }} rows
 * @returns {string}
 */
const mov = (col, { first, last }) => `${MOVEMENTS}!$${col}$${first}:$${col}$${last}`;

/**
 * Encabezado de marca de una hoja: logo a la izquierda, título y periodo a la derecha, sobre el
 * gris claro de la app (una de las combinaciones aprobadas del logo a color).
 * @param {ExcelJS.Worksheet} ws
 * @param {{ logoId: number, logoCol: number, titleCol: string, lastCol: string, title: string, subtitle: string }} options
 *   `logoCol` cuenta desde 0; el título ocupa de `titleCol` a `lastCol`.
 * @returns {void}
 */
function brandHeader(ws, { logoId, logoCol, titleCol, lastCol, title, subtitle }) {
  ws.getRow(1).height = 28;
  ws.getRow(2).height = 20;
  const last = ws.getColumn(lastCol).number;
  for (const row of [1, 2]) {
    for (let col = 1; col <= last; col += 1) {
      const cell = ws.getRow(row).getCell(col);
      cell.fill = fill(COLORS.canvas);
      if (row === 2) cell.border = { bottom: { style: 'medium', color: { argb: COLORS.brand } } };
    }
  }
  ws.addImage(logoId, { tl: { col: logoCol + 0.15, row: 0.35 }, ext: LOGO_SIZE });
  ws.mergeCells(`${titleCol}1:${lastCol}1`);
  Object.assign(ws.getCell(`${titleCol}1`), {
    value: title,
    font: font({ bold: true, size: 16 }),
    alignment: { vertical: 'bottom', horizontal: 'right', indent: 1 },
  });
  ws.mergeCells(`${titleCol}2:${lastCol}2`);
  Object.assign(ws.getCell(`${titleCol}2`), {
    value: subtitle,
    font: font({ size: 10, color: { argb: COLORS.muted } }),
    alignment: { vertical: 'top', horizontal: 'right', indent: 1 },
  });
}

/**
 * Título de una sección: texto violeta en negrita y una línea debajo.
 * @param {ExcelJS.Worksheet} ws
 * @param {number} row
 * @param {string} text
 * @param {[string, string]} cols Primera y última columna que ocupa.
 * @returns {void}
 */
function sectionTitle(ws, row, text, [from, to]) {
  ws.mergeCells(`${from}${row}:${to}${row}`);
  const cell = ws.getCell(`${from}${row}`);
  cell.value = text;
  cell.font = font({ bold: true, size: 13, color: { argb: COLORS.brand } });
  cell.border = { bottom: { style: 'medium', color: { argb: COLORS.brand } } };
  ws.getRow(row).height = 22;
}

/**
 * Encabezados de una tabla, desde la columna A.
 * @param {ExcelJS.Worksheet} ws
 * @param {number} row
 * @param {string[]} labels
 * @returns {void}
 */
function tableHeader(ws, row, labels) {
  labels.forEach((label, i) => {
    const cell = ws.getRow(row).getCell(i + 1);
    cell.value = label;
    cell.font = font({ bold: true, size: 10, color: { argb: COLORS.muted } });
    cell.fill = fill(COLORS.canvas);
    cell.alignment = { horizontal: i === 0 ? 'left' : 'right' };
  });
}

/**
 * Hoja de movimientos: las mismas columnas del CSV, encabezado fijo, filtros y filas alternadas.
 * Fechas y montos son valores de Excel (se pueden ordenar, sumar y filtrar), no texto.
 * @param {ExcelJS.Workbook} workbook
 * @param {object} report Datos de buildReport.
 * @returns {{ first: number, last: number }} Filas de datos, para las fórmulas de las otras hojas.
 */
function addMovementsSheet(workbook, report) {
  const ws = workbook.addWorksheet(MOVEMENTS, {
    properties: { tabColor: { argb: COLORS.brand } },
    views: [{ state: 'frozen', ySplit: 1, showGridLines: false }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [
    { header: 'Fecha', key: 'date', width: 12, style: { numFmt: DATE } },
    { header: 'Tipo', key: 'type', width: 11 },
    { header: 'Categoría', key: 'category', width: 22 },
    { header: 'Descripción', key: 'description', width: 42 },
    { header: 'Monto', key: 'amount', width: 16, style: { numFmt: MONEY } },
    { header: 'Origen', key: 'source', width: 14 },
  ];

  const header = ws.getRow(1);
  header.height = 24;
  header.eachCell((cell) => {
    cell.font = font({ bold: true, color: { argb: COLORS.white } });
    cell.fill = fill(COLORS.brand);
    cell.alignment = { vertical: 'middle' };
  });
  header.getCell(5).alignment = { vertical: 'middle', horizontal: 'right' };
  ws.getColumn(6).alignment = { indent: 1 };

  report.rows.forEach((row, i) => {
    const income = row.type === 'ingreso';
    const added = ws.addRow({
      date: toDate(row.date),
      type: TYPE_LABELS[row.type],
      category: row.categoryName ?? 'Sin clasificar',
      // Texto que empieza por = + - @ se guarda como texto: exceljs no lo interpreta como fórmula.
      description: row.description,
      amount: row.amount,
      source: SOURCE_LABELS[row.source],
    });
    added.eachCell({ includeEmpty: true }, (cell, col) => {
      // El tipo va escrito en su columna; el verde del ingreso solo lo refuerza.
      cell.font = font(
        income && (col === 2 || col === 5)
          ? { bold: col === 2, color: { argb: COLORS.positive } }
          : {},
      );
      if (i % 2 === 1) cell.fill = fill(COLORS.canvas);
      cell.border = bottomLine;
    });
  });

  const first = 2;
  const last = report.rows.length + 1;
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: last, column: 6 } };

  // Totales que respetan los filtros: suman solo las filas visibles de cada tipo.
  const visible = (label) =>
    `SUMPRODUCT(SUBTOTAL(109,OFFSET(E${first},ROW(E${first}:E${last})-ROW(E${first}),0))*(B${first}:B${last}=${q(label)}))`;
  [
    ['Ingresos (respeta los filtros)', 'Ingreso', report.totals.income, COLORS.positive],
    ['Gastos (respeta los filtros)', 'Gasto', report.totals.expense, COLORS.ink],
  ].forEach(([label, type, result, color], i) => {
    const row = ws.getRow(last + 1 + i);
    row.getCell(4).value = label;
    row.getCell(5).value = { formula: visible(type), result };
    for (let col = 1; col <= 6; col += 1) {
      const cell = row.getCell(col);
      cell.font = font({ bold: true, color: { argb: col === 5 ? color : COLORS.ink } });
      cell.fill = fill(COLORS.brandSoft);
      if (i === 0) cell.border = { top: { style: 'thin', color: { argb: COLORS.brand } } };
    }
    row.getCell(4).alignment = { horizontal: 'right' };
  });

  return { first, last };
}

/**
 * Hoja de categorías: gastos (y debajo ingresos) por categoría, de mayor a menor, con su gráfico.
 * Cada cifra es SUMIFS / COUNTIFS sobre Movimientos.
 * @param {ExcelJS.Workbook} workbook
 * @param {object} report Datos de buildReport.
 * @param {{ first: number, last: number }} rows Filas de datos de la hoja Movimientos.
 * @param {object} header Datos comunes del encabezado de marca.
 * @returns {{ start: number, end: number }|null} Filas de las categorías de gasto; `null` si no hubo gastos.
 */
function addCategoriesSheet(workbook, report, rows, header) {
  const ws = workbook.addWorksheet(CATEGORIES, {
    properties: { tabColor: { argb: COLORS.brand } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [
    { width: 28 },
    { width: 18 },
    { width: 13 },
    { width: 14 },
    { width: 3 },
    ...Array(9).fill({ width: 11 }),
  ];
  brandHeader(ws, { ...header, logoCol: 0, titleCol: 'C', lastCol: 'N', title: 'Categorías' });

  let row = 4;
  /**
   * Tabla de un tipo de movimiento, con barra de datos en el monto.
   * @param {string} title
   * @param {Array<{ name: string, amount: number, count: number, share: number }>} groups
   * @param {string} typeLabel Gasto o Ingreso.
   * @param {string} amountLabel Encabezado de la columna del monto.
   * @param {string} color Color ARGB de la barra.
   * @returns {{ start: number, end: number }|null}
   */
  const table = (title, groups, typeLabel, amountLabel, color) => {
    if (groups.length === 0) return null;
    sectionTitle(ws, row, title, ['A', 'D']);
    tableHeader(ws, row + 1, ['Categoría', amountLabel, '% del total', 'Movimientos']);
    const start = row + 2;
    const end = start + groups.length - 1;
    const totalRow = end + 1;
    const ofType = `${mov('B', rows)},${q(typeLabel)}`;
    groups.forEach((g, i) => {
      const r = start + i;
      const ofCategory = `${mov('C', rows)},${q(g.name)},${ofType}`;
      ws.getCell(`A${r}`).value = g.name;
      ws.getCell(`B${r}`).value = {
        formula: `SUMIFS(${mov('E', rows)},${ofCategory})`,
        result: g.amount,
      };
      ws.getCell(`C${r}`).value = {
        formula: `IF(B$${totalRow}>0,B${r}/B$${totalRow},0)`,
        result: g.share,
      };
      ws.getCell(`D${r}`).value = { formula: `COUNTIFS(${ofCategory})`, result: g.count };
      ['A', 'B', 'C', 'D'].forEach((col) => {
        const cell = ws.getCell(`${col}${r}`);
        cell.font = font();
        cell.border = bottomLine;
        if (col !== 'A') cell.alignment = { horizontal: 'right' };
      });
    });
    const total = groups.reduce((s, g) => s + g.amount, 0);
    ws.getCell(`A${totalRow}`).value = 'Total';
    ws.getCell(`B${totalRow}`).value = { formula: `SUM(B${start}:B${end})`, result: total };
    ws.getCell(`C${totalRow}`).value = {
      formula: `IF(B${totalRow}>0,1,0)`,
      result: total > 0 ? 1 : 0,
    };
    ws.getCell(`D${totalRow}`).value = {
      formula: `SUM(D${start}:D${end})`,
      result: groups.reduce((s, g) => s + g.count, 0),
    };
    ['A', 'B', 'C', 'D'].forEach((col) => {
      const cell = ws.getCell(`${col}${totalRow}`);
      cell.font = font({ bold: true });
      cell.fill = fill(COLORS.brandSoft);
      if (col !== 'A') cell.alignment = { horizontal: 'right' };
    });
    for (let r = start; r <= totalRow; r += 1) {
      ws.getCell(`B${r}`).numFmt = MONEY;
      ws.getCell(`C${r}`).numFmt = PERCENT;
    }
    // Barra proporcional dentro de la celda del monto: se lee de un vistazo qué pesa más.
    ws.addConditionalFormatting({
      ref: `B${start}:B${end}`,
      rules: [
        {
          type: 'dataBar',
          priority: 1,
          cfvo: [{ type: 'num', value: 0 }, { type: 'max' }],
          color: { argb: color },
          gradient: false,
        },
      ],
    });
    row = totalRow + 2;
    return { start, end };
  };

  const expenseRows = table(
    'Gastos por categoría',
    report.expenseByCategory,
    'Gasto',
    'Gastado',
    'FFC9BEFF',
  );
  table('Ingresos por categoría', report.incomeByCategory, 'Ingreso', 'Recibido', 'FF8FD9BE');
  return expenseRows;
}

/**
 * Hoja de evolución: totales del periodo y la serie por día, semana o mes (la que trae el modelo;
 * no incluye días futuros ni periodos que el reporte no tenga). Cada cifra es SUMIFS sobre Movimientos.
 * @param {ExcelJS.Workbook} workbook
 * @param {object} report Datos de buildReport.
 * @param {{ first: number, last: number }} rows Filas de datos de la hoja Movimientos.
 * @param {object} header Datos comunes del encabezado de marca.
 * @returns {{ start: number, end: number }|null} Filas de la serie; `null` si no tiene tramos.
 */
function addEvolutionSheet(workbook, report, rows, header) {
  const ws = workbook.addWorksheet(EVOLUTION, {
    properties: { tabColor: { argb: COLORS.positive } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [
    { width: 28 },
    { width: 16 },
    { width: 14 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 3 },
    ...Array(9).fill({ width: 11 }),
  ];
  brandHeader(ws, { ...header, logoCol: 0, titleCol: 'C', lastCol: 'P', title: 'Evolución' });

  const amounts = mov('E', rows);
  const types = mov('B', rows);
  const t = report.totals;

  // Totales: de aquí lee el gráfico "Ingresos frente a gastos" del Resumen.
  sectionTitle(ws, 4, 'Totales del periodo', ['A', 'F']);
  tableHeader(ws, 5, ['Concepto', 'Monto']);
  [
    ['Ingresos', { formula: `SUMIFS(${amounts},${types},"Ingreso")`, result: t.income }],
    ['Gastos', { formula: `SUMIFS(${amounts},${types},"Gasto")`, result: t.expense }],
    ['Balance (ingresos − gastos)', { formula: 'B6-B7', result: t.balance }],
  ].forEach(([label, value], i) => {
    const r = 6 + i;
    ws.getCell(`A${r}`).value = label;
    Object.assign(ws.getCell(`B${r}`), {
      value,
      numFmt: MONEY,
      alignment: { horizontal: 'right' },
    });
    ['A', 'B'].forEach((col) => {
      ws.getCell(`${col}${r}`).font = font({ bold: i === 2 });
      ws.getCell(`${col}${r}`).border = bottomLine;
    });
  });

  const { granularity, points } = report.series;
  sectionTitle(ws, 10, `Ingresos y gastos por ${GRANULARITY[granularity]}`, ['A', 'F']);
  if (points.length === 0) {
    ws.getCell('A11').value = 'El periodo todavía no empieza: no hay días que mostrar.';
    ws.getCell('A11').font = font({ color: { argb: COLORS.muted } });
    return null;
  }
  tableHeader(ws, 11, ['Periodo', 'Desde', 'Hasta', 'Ingresos', 'Gastos', 'Balance']);
  const start = 12;
  const dates = mov('A', rows);
  points.forEach((p, i) => {
    const r = start + i;
    const inRange = `${dates},">="&B${r},${dates},"<="&C${r}`;
    ws.getCell(`A${r}`).value = pointLabel(p, granularity);
    ws.getCell(`B${r}`).value = toDate(p.from);
    ws.getCell(`C${r}`).value = toDate(p.to);
    ws.getCell(`D${r}`).value = {
      formula: `SUMIFS(${amounts},${types},"Ingreso",${inRange})`,
      result: p.income,
    };
    ws.getCell(`E${r}`).value = {
      formula: `SUMIFS(${amounts},${types},"Gasto",${inRange})`,
      result: p.expense,
    };
    ws.getCell(`F${r}`).value = {
      formula: `D${r}-E${r}`,
      result: Math.round((p.income - p.expense) * 100) / 100,
    };
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = ws.getCell(`${col}${r}`);
      cell.font = font();
      cell.border = bottomLine;
      cell.numFmt = col === 'B' || col === 'C' ? DATE : MONEY;
      if (col !== 'A') cell.alignment = { horizontal: 'right' };
      if (i % 2 === 1) cell.fill = fill(COLORS.canvas);
    });
  });
  return { start, end: start + points.length - 1 };
}

/**
 * Hoja de presupuestos del mes: límite, gastado (SUMIFS sobre Movimientos), disponible y estado.
 * @param {ExcelJS.Workbook} workbook
 * @param {object} report Datos de buildReport.
 * @param {{ first: number, last: number }} rows Filas de datos de la hoja Movimientos.
 * @param {object} header Datos comunes del encabezado de marca.
 * @returns {void}
 */
function addBudgetsSheet(workbook, report, rows, header) {
  const ws = workbook.addWorksheet('Presupuestos', {
    properties: { tabColor: { argb: COLORS.caution } },
    views: [{ showGridLines: false }],
  });
  ws.columns = [
    { width: 28 },
    { width: 16 },
    { width: 16 },
    { width: 16 },
    { width: 12 },
    { width: 18 },
  ];
  brandHeader(ws, { ...header, logoCol: 0, titleCol: 'C', lastCol: 'F', title: 'Presupuestos' });
  sectionTitle(
    ws,
    4,
    `Presupuestos de ${monthLabel(report.period.from.slice(0, 7)).toLowerCase()}`,
    ['A', 'F'],
  );
  tableHeader(ws, 5, ['Categoría', 'Límite', 'Gastado', 'Disponible', 'Uso', 'Estado']);
  report.budgets.forEach((b, i) => {
    const r = 6 + i;
    const level = LEVEL[b.level] ?? LEVEL.none;
    ws.getCell(`A${r}`).value = b.category;
    ws.getCell(`B${r}`).value = b.limit;
    ws.getCell(`C${r}`).value = {
      formula: `SUMIFS(${mov('E', rows)},${mov('C', rows)},${q(b.category)},${mov('B', rows)},"Gasto")`,
      result: b.spent,
    };
    ws.getCell(`D${r}`).value = { formula: `B${r}-C${r}`, result: b.available };
    ws.getCell(`E${r}`).value = { formula: `IF(B${r}>0,C${r}/B${r},0)`, result: b.usage };
    ws.getCell(`F${r}`).value = level.label;
    ['B', 'C', 'D'].forEach((col) => (ws.getCell(`${col}${r}`).numFmt = MONEY));
    ws.getCell(`E${r}`).numFmt = PERCENT;
    ['A', 'B', 'C', 'D', 'E', 'F'].forEach((col) => {
      const cell = ws.getCell(`${col}${r}`);
      cell.font = font(
        col === 'F' || col === 'E' ? { bold: true, color: { argb: level.color } } : {},
      );
      cell.border = bottomLine;
      if (col !== 'A') cell.alignment = { horizontal: col === 'F' ? 'center' : 'right' };
    });
    ws.getCell(`F${r}`).fill = fill(level.fill);
  });
  const note = ws.getCell(`A${7 + report.budgets.length}`);
  note.value = 'El estado es el del momento en que se generó el reporte.';
  note.font = font({ italic: true, size: 9, color: { argb: COLORS.muted } });
}

/** Columnas del tablero: 12 columnas iguales (B a M) entre dos márgenes angostos. */
const BOARD = { first: 'B', last: 'M' };
/** Filas del tablero donde van los gráficos (desde 0, como las pide el dibujo). */
const BOARD_ROWS = { top: [8, 22], evolution: [24, 39] };

/**
 * Hoja de resumen: el tablero que se ve al abrir el archivo.
 * @param {ExcelJS.Workbook} workbook
 * @param {object} report Datos de buildReport.
 * @param {{ first: number, last: number }} rows Filas de datos de la hoja Movimientos.
 * @param {object} header Datos comunes del encabezado de marca.
 * @returns {void}
 */
function addSummarySheet(workbook, report, rows, header) {
  const ws = workbook.addWorksheet('Resumen', {
    properties: { tabColor: { argb: COLORS.brand } },
    views: [{ showGridLines: false }],
    pageSetup: { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });
  ws.columns = [{ width: 2 }, ...Array(12).fill({ width: 11.5 }), { width: 2 }];
  brandHeader(ws, {
    ...header,
    logoCol: 1,
    titleCol: 'D',
    lastCol: 'N',
    title: 'Reporte financiero',
  });
  ws.getRow(3).height = 8;

  const amounts = mov('E', rows);
  const types = mov('B', rows);
  const t = report.totals;
  const countOf = (type) => `COUNTIFS(${types},${q(type)})`;
  const movementsText = (n) => `${n} ${n === 1 ? 'movimiento' : 'movimientos'}`;

  /**
   * Tarjeta de indicador: etiqueta, cifra grande y una línea de apoyo, sobre un fondo suave.
   * @param {[string, string]} cols Primera y última columna.
   * @param {string} label
   * @param {{ value: unknown, numFmt: string, color: string }} main
   * @param {unknown} sub
   * @param {string} background
   * @returns {void}
   */
  const card = ([from, to], label, main, sub, background) => {
    [
      [4, label, font({ size: 10, color: { argb: COLORS.muted } }), 20, 'bottom'],
      [5, main.value, font({ bold: true, size: 18, color: { argb: main.color } }), 30, 'middle'],
      [6, sub, font({ size: 9, color: { argb: COLORS.muted } }), 20, 'top'],
    ].forEach(([row, value, style, height, vertical]) => {
      ws.mergeCells(`${from}${row}:${to}${row}`);
      for (let col = ws.getColumn(from).number; col <= ws.getColumn(to).number; col += 1)
        ws.getRow(row).getCell(col).fill = fill(background);
      Object.assign(ws.getCell(`${from}${row}`), {
        value,
        font: style,
        alignment: { vertical, indent: 1 },
      });
      // Borde blanco grueso a la izquierda: separa cada tarjeta de la anterior.
      ws.getCell(`${from}${row}`).border = {
        left: { style: 'thick', color: { argb: COLORS.white } },
      };
      ws.getRow(row).height = height;
    });
    ws.getCell(`${from}5`).numFmt = main.numFmt;
  };
  card(
    ['B', 'D'],
    'Ingresos',
    {
      value: { formula: `SUMIFS(${amounts},${types},"Ingreso")`, result: t.income },
      numFmt: MONEY,
      color: COLORS.positive,
    },
    {
      formula: `${countOf('Ingreso')}&IF(${countOf('Ingreso')}=1," movimiento"," movimientos")`,
      result: movementsText(t.incomeCount),
    },
    COLORS.positiveSoft,
  );
  card(
    ['E', 'G'],
    'Gastos',
    {
      value: { formula: `SUMIFS(${amounts},${types},"Gasto")`, result: t.expense },
      numFmt: MONEY,
      color: COLORS.brand,
    },
    {
      formula: `${countOf('Gasto')}&IF(${countOf('Gasto')}=1," movimiento"," movimientos")`,
      result: movementsText(t.expenseCount),
    },
    COLORS.brandSoft,
  );
  card(
    ['H', 'J'],
    'Balance neto',
    {
      value: { formula: 'B5-E5', result: t.balance },
      numFmt: MONEY,
      color: t.balance < 0 ? COLORS.negative : COLORS.ink,
    },
    'Ingresos − gastos del periodo',
    COLORS.canvas,
  );
  card(
    ['K', 'M'],
    'Movimientos',
    {
      value: { formula: `COUNTA(${mov('A', rows)})`, result: t.count },
      numFmt: '0',
      color: COLORS.ink,
    },
    `Del ${longDate(report.period.from)} al ${longDate(report.period.to)}`,
    COLORS.canvas,
  );
  ws.getCell('B5').alignment =
    ws.getCell('E5').alignment =
    ws.getCell('H5').alignment =
    ws.getCell('K5').alignment =
      {
        vertical: 'middle',
        horizontal: 'left',
        indent: 1,
      };

  // Gráficos: aquí van solo los títulos; los dibujos se agregan al final (ver buildWorkbook).
  sectionTitle(ws, 8, 'Ingresos frente a gastos', ['B', 'E']);
  sectionTitle(ws, 8, 'Gastos por categoría', ['G', 'M']);
  if (report.expenseByCategory.length === 0) {
    ws.getCell('G10').value = 'Sin gastos en el periodo.';
    ws.getCell('G10').font = font({ color: { argb: COLORS.muted } });
  }
  sectionTitle(ws, 24, `Ingresos y gastos por ${GRANULARITY[report.series.granularity]}`, [
    BOARD.first,
    BOARD.last,
  ]);

  let row = 41;
  if (report.insights.length > 0) {
    sectionTitle(ws, row, 'Lo que dicen tus números', [BOARD.first, BOARD.last]);
    report.insights.forEach((insight, i) => {
      const r = row + 1 + i;
      ws.mergeCells(`B${r}:F${r}`);
      ws.mergeCells(`G${r}:M${r}`);
      Object.assign(ws.getCell(`B${r}`), { value: insight.title, font: font({ bold: true }) });
      Object.assign(ws.getCell(`G${r}`), {
        value: insight.detail,
        font: font({ color: { argb: COLORS.muted } }),
      });
      for (let col = 2; col <= 13; col += 1) {
        ws.getRow(r).getCell(col).border = bottomLine;
        ws.getRow(r).getCell(col).alignment = { vertical: 'middle', wrapText: true };
      }
      ws.getRow(r).height = 32;
    });
    row += report.insights.length + 2;
    const note = ws.getCell(`B${row - 1}`);
    note.value = 'Calculados al generar el reporte; no cambian si editas los movimientos.';
    note.font = font({ italic: true, size: 9, color: { argb: COLORS.muted } });
    row += 1;
  }

  if (report.topExpenses.length > 0) {
    sectionTitle(ws, row, `Top ${report.topExpenses.length} gastos más grandes`, [
      BOARD.first,
      BOARD.last,
    ]);
    report.topExpenses.forEach((e, i) => {
      const r = row + 1 + i;
      ws.mergeCells(`B${r}:F${r}`);
      ws.mergeCells(`G${r}:I${r}`);
      ws.mergeCells(`L${r}:M${r}`);
      ws.getCell(`B${r}`).value = `${i + 1}. ${e.description}`;
      ws.getCell(`G${r}`).value = e.categoryName ?? 'Sin clasificar';
      Object.assign(ws.getCell(`J${r}`), { value: toDate(e.date), numFmt: DATE });
      Object.assign(ws.getCell(`K${r}`), {
        value: {
          formula: `IF($E$5>0,L${r}/$E$5,0)`,
          result: t.expense > 0 ? e.amount / t.expense : 0,
        },
        numFmt: PERCENT,
      });
      Object.assign(ws.getCell(`L${r}`), { value: e.amount, numFmt: MONEY });
      for (let col = 2; col <= 13; col += 1) {
        const cell = ws.getRow(r).getCell(col);
        cell.font = font(
          col === 12 ? { bold: true } : col >= 7 ? { color: { argb: COLORS.muted } } : {},
        );
        cell.border = bottomLine;
        if (col >= 10) cell.alignment = { horizontal: 'right' };
      }
    });
    row += report.topExpenses.length + 2;
  }

  ws.mergeCells(`B${row}:M${row}`);
  Object.assign(ws.getCell(`B${row}`), {
    value:
      'Las cifras y los gráficos leen la hoja Movimientos: si corriges un monto allí, todo se actualiza.',
    font: font({ italic: true, size: 9, color: { argb: COLORS.muted } }),
  });
}

/**
 * Arma el libro de Excel del reporte.
 * @param {Awaited<ReturnType<typeof import('./report-data.service.js').buildReport>>} report
 * @returns {Promise<Buffer>} Contenido del archivo .xlsx.
 */
export async function buildWorkbook(report) {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Rinde';
  workbook.created = new Date();
  workbook.title = 'Reporte financiero';
  // Al abrir, Excel recalcula todas las fórmulas.
  workbook.calcProperties = { fullCalcOnLoad: true };

  const who = report.owner.name || report.owner.email;
  const header = {
    logoId: workbook.addImage({ buffer: LOGO, extension: 'png' }),
    subtitle: `${who} · Del ${longDate(report.period.from)} al ${longDate(report.period.to)} · Generado el ${longDate(report.generatedOn)}`,
  };

  // Se arma primero Movimientos: las fórmulas de las demás hojas necesitan saber en qué filas quedan los datos.
  const rows = addMovementsSheet(workbook, report);
  const categoryRows = addCategoriesSheet(workbook, report, rows, header);
  const seriesRows = addEvolutionSheet(workbook, report, rows, header);
  if (report.budgets.length > 0) addBudgetsSheet(workbook, report, rows, header);
  addSummarySheet(workbook, report, rows, header);
  // Orden de las pestañas al abrir.
  const order = ['Resumen', MOVEMENTS, CATEGORIES, EVOLUTION, 'Presupuestos'];
  workbook.worksheets.forEach((ws) => (ws.orderNo = order.indexOf(ws.name)));
  workbook.views = [{ activeTab: 0, firstSheet: 0 }];

  const numFmt = '"$" #,##0';
  const charts = [
    {
      sheet: 'Resumen',
      from: { col: 1, row: BOARD_ROWS.top[0] },
      to: { col: 5, row: BOARD_ROWS.top[1] },
      numFmt,
      series: [
        {
          name: 'Monto',
          color: CHART.income,
          pointColors: [CHART.income, CHART.expense],
          categories: { ref: `'${EVOLUTION}'!$A$6:$A$7`, values: ['Ingresos', 'Gastos'] },
          values: {
            ref: `'${EVOLUTION}'!$B$6:$B$7`,
            values: [report.totals.income, report.totals.expense],
          },
        },
      ],
    },
  ];
  if (categoryRows) {
    const { start, end } = categoryRows;
    const spec = {
      horizontal: true,
      numFmt,
      series: [
        {
          name: 'Gastado',
          color: CHART.expense,
          categories: {
            ref: `'${CATEGORIES}'!$A$${start}:$A$${end}`,
            values: report.expenseByCategory.map((c) => c.name),
          },
          values: {
            ref: `'${CATEGORIES}'!$B$${start}:$B$${end}`,
            values: report.expenseByCategory.map((c) => c.amount),
          },
        },
      ],
    };
    charts.push(
      {
        ...spec,
        sheet: 'Resumen',
        from: { col: 6, row: BOARD_ROWS.top[0] },
        to: { col: 13, row: BOARD_ROWS.top[1] },
      },
      {
        ...spec,
        sheet: CATEGORIES,
        from: { col: 5, row: 3 },
        to: { col: 14, row: Math.max(16, 6 + report.expenseByCategory.length * 2) },
      },
    );
  }
  if (seriesRows) {
    const { start, end } = seriesRows;
    const { granularity, points } = report.series;
    const categories = {
      ref: `'${EVOLUTION}'!$A$${start}:$A$${end}`,
      values: points.map((p) => pointLabel(p, granularity)),
    };
    const spec = {
      numFmt,
      series: [
        {
          name: 'Ingresos',
          color: CHART.income,
          categories,
          values: {
            ref: `'${EVOLUTION}'!$D$${start}:$D$${end}`,
            values: points.map((p) => p.income),
          },
        },
        {
          name: 'Gastos',
          color: CHART.expense,
          categories,
          values: {
            ref: `'${EVOLUTION}'!$E$${start}:$E$${end}`,
            values: points.map((p) => p.expense),
          },
        },
      ],
    };
    charts.push(
      {
        ...spec,
        sheet: 'Resumen',
        from: { col: 1, row: BOARD_ROWS.evolution[0] },
        to: { col: 13, row: BOARD_ROWS.evolution[1] },
      },
      { ...spec, sheet: EVOLUTION, from: { col: 7, row: 3 }, to: { col: 16, row: 22 } },
    );
  }

  return addCharts(Buffer.from(await workbook.xlsx.writeBuffer()), charts);
}
