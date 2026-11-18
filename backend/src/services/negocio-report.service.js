import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';
import { pdfSafe } from './report-pdf.service.js';
import { currencyDigits, excelMoneyFormat, formatMoney, numberLocale, t } from '../i18n/index.js';

/*
 * Reporte del mes de un negocio para el contador (FT-0018), en Excel o PDF, con los colores de
 * Rinde. Lleva el estado de resultados, el punto de equilibrio, el reparto entre socios y la
 * lista de movimientos con quién registró cada uno.
 */

const KIND_LABEL = {
  get sale() { return t('Venta'); },
  get otherIncome() { return t('Otro ingreso'); },
  get cost() { return t('Costo de venta'); },
  get fixed() { return t('Gasto fijo'); },
  get variable() { return t('Gasto variable'); },
  get withdrawal() { return t('Retiro de socio'); },
};
const INCOME = new Set(['sale', 'otherIncome']);
const CATEGORY_LABEL = {
  get ventas() { return t('Ventas'); },
  get insumos() { return t('Insumos'); },
  get arriendo() { return t('Arriendo'); },
  get nomina() { return t('Nómina'); },
  get servicios() { return t('Servicios'); },
  get publicidad() { return t('Publicidad'); },
  get transporte() { return t('Transporte'); },
  get impuestos() { return t('Impuestos'); },
  get otros() { return t('Otros'); },
  get retiros() { return t('Retiros'); },
};
const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

const money = (n) => formatMoney(n, { digits: currencyDigits() });
const pct = (n) => `${n.toLocaleString(numberLocale(), { maximumFractionDigits: 2 })} %`;

/**
 * @param {string} month AAAA-MM.
 * @returns {string} p. ej. `noviembre de 2026`.
 */
export function monthTitle(month) {
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} de ${y}`;
}

/**
 * Nombre del archivo: `negocio-arepas-dona-rosa-2026-11.xlsx`.
 * @param {string} name
 * @param {string} month
 * @param {'xlsx'|'pdf'} extension
 * @returns {string}
 */
export function reportFilename(name, month, extension) {
  const slug =
    name
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 40) || 'negocio';
  return `negocio-${slug}-${month}.${extension}`;
}

/**
 * Filas del estado de resultados: [etiqueta, valor, ¿es total?].
 * @param {object} panel
 * @returns {Array<[string, number, boolean]>}
 */
export function resultLines(panel) {
  const lines = [
    [t('Ventas'), panel.sale, false],
    [t('Costo de venta'), -panel.cost, false],
    [t('Utilidad bruta'), panel.grossProfit, true],
    [t('Gastos variables'), -panel.variable, false],
    [t('Gastos fijos'), -panel.fixed, false],
  ];
  if (panel.otherIncome > 0) lines.push([t('Otros ingresos'), panel.otherIncome, false]);
  lines.push([t('Utilidad neta'), panel.netProfit, true]);
  if (panel.withdrawal > 0) {
    lines.push([t('Retiros de socios'), -panel.withdrawal, false]);
    lines.push([t('Quedó en el negocio'), panel.retained, true]);
  }
  return lines;
}

/**
 * @param {{ registeredBy: { name: string|null }|null }} m
 * @returns {string}
 */
const who = (m) => (m.registeredBy ? m.registeredBy.name || t('Un socio') : t('Exsocio'));
const signed = (m) => (INCOME.has(m.kind) ? m.amount : -m.amount);

/* ---------- Excel ---------- */

const XL = {
  brand: 'FF6142FF',
  brandSoft: 'FFECE8FF',
  muted: 'FF6B6880',
  line: 'FFE4E2EE',
  white: 'FFFFFFFF',
  positive: 'FF087A59',
  negative: 'FFC8321F',
};

/**
 * Arma el Excel del mes del negocio.
 * @param {{ business: { name: string, nit: string|null }, month: string, movements: object[], panel: object, distribution: object }} report
 * @returns {Promise<Buffer>}
 */
export async function buildBusinessWorkbook(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = t('Rinde');
  wb.created = new Date();
  const { business, panel } = report;

  const sheet = wb.addWorksheet(t('Resumen'), { views: [{ showGridLines: false }] });
  sheet.columns = [{ width: 34 }, { width: 20 }, { width: 18 }, { width: 18 }];
  const title = sheet.addRow([business.name]);
  title.font = { bold: true, size: 16, color: { argb: XL.brand } };
  sheet.addRow([
    t('Reporte de {month}{nit}', { month: monthTitle(report.month), nit: business.nit ? ` · NIT ${business.nit}` : '' }),
  ]).font = { color: { argb: XL.muted } };
  sheet.addRow([]);

  const header = (text) => {
    const row = sheet.addRow([text]);
    row.font = { bold: true, color: { argb: XL.white } };
    row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } };
    row.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } };
  };

  header('Estado de resultados');
  for (const [label, value, total] of resultLines(panel)) {
    const row = sheet.addRow([label, value]);
    row.getCell(2).numFmt = excelMoneyFormat();
    if (total) {
      row.font = { bold: true };
      row.getCell(1).border = { top: { style: 'thin', color: { argb: XL.line } } };
      row.getCell(2).border = { top: { style: 'thin', color: { argb: XL.line } } };
    }
  }
  if (panel.netMargin !== null) sheet.addRow([t('Margen neto'), pct(panel.netMargin)]);
  sheet.addRow([]);

  header('Punto de equilibrio');
  if (panel.breakEven === null) {
    sheet.addRow([
      panel.fixed === 0
        ? t('Sin gastos fijos registrados en el mes')
        : t('Con estos costos, vender no cubre los gastos fijos'),
    ]);
  } else {
    const row = sheet.addRow([t('Ventas necesarias para no perder'), panel.breakEven]);
    row.getCell(2).numFmt = excelMoneyFormat();
    sheet.addRow([t('Margen de contribución'), pct(panel.contributionMargin)]);
    sheet.addRow([t('¿Se alcanzó?'), panel.breakEvenReached ? t('Sí') : t('No')]);
  }

  if (report.distribution.items.length > 0) {
    sheet.addRow([]);
    header('Reparto de utilidades');
    const cols = sheet.addRow([t('Socio'), t('Participación'), t('Le toca'), t('Ya retiró')]);
    cols.font = { bold: true, color: { argb: XL.muted } };
    for (const item of report.distribution.items) {
      const row = sheet.addRow([item.name || t('Socio'), pct(item.share), item.due, item.withdrawn]);
      row.getCell(3).numFmt = excelMoneyFormat();
      row.getCell(4).numFmt = excelMoneyFormat();
    }
  }

  const list = wb.addWorksheet(t('Movimientos'), { views: [{ state: 'frozen', ySplit: 1 }] });
  list.columns = [
    { header: t('Fecha'), key: 'date', width: 12 },
    { header: t('Tipo'), key: 'kind', width: 16 },
    { header: t('Categoría'), key: 'category', width: 14 },
    { header: t('Descripción'), key: 'description', width: 40 },
    { header: t('Monto'), key: 'amount', width: 16 },
    { header: t('Lo registró'), key: 'who', width: 20 },
  ];
  const head = list.getRow(1);
  head.font = { bold: true, color: { argb: XL.white } };
  head.eachCell((cell) => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } };
  });
  for (const m of [...report.movements].reverse()) {
    const row = list.addRow({
      date: m.date,
      kind: KIND_LABEL[m.kind],
      category: m.categoryName ?? CATEGORY_LABEL[m.category] ?? m.category,
      description: m.description,
      amount: signed(m),
      who: who(m),
    });
    row.getCell('amount').numFmt = excelMoneyFormat();
  }
  list.autoFilter = { from: 'A1', to: 'F1' };

  return Buffer.from(await wb.xlsx.writeBuffer());
}

/* ---------- PDF ---------- */

const PAGE = { width: 612, height: 792 };
const MARGIN = 40;
const CONTENT = PAGE.width - MARGIN * 2;
const BOTTOM = PAGE.height - 50;
const C = {
  brand: '#6142ff',
  brandSoft: '#ece8ff',
  ink: '#16141f',
  muted: '#6b6880',
  line: '#e4e2ee',
  track: '#efedf6',
  positive: '#087a59',
  negative: '#c8321f',
};

/**
 * Arma el PDF del mes del negocio.
 * @param {{ business: { name: string, nit: string|null }, month: string, movements: object[], panel: object, distribution: object }} report
 * @returns {Promise<Buffer>}
 */
export function buildBusinessPdf(report) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 0,
    bufferPages: true,
    info: { Title: t('Reporte de {name}', { name: pdfSafe(report.business.name) }), Author: t('Rinde') },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });
  const { panel } = report;

  // Encabezado
  doc.rect(0, 0, PAGE.width, 90).fill(C.brand);
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#ffffff')
    .text(pdfSafe(report.business.name), MARGIN, 28, { width: CONTENT });
  doc
    .font('Helvetica')
    .fontSize(11)
    .text(
      t('Reporte de {month}{nit}', { month: monthTitle(report.month), nit: report.business.nit ? ` · NIT ${pdfSafe(report.business.nit)}` : '' }),
      MARGIN,
      56,
    );
  let y = 115;

  const heading = (text) => {
    doc.font('Helvetica-Bold').fontSize(13).fillColor(C.ink).text(text, MARGIN, y);
    y += 22;
  };
  const line = (label, value, { bold = false, color = C.ink } = {}) => {
    doc
      .font(bold ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(10.5)
      .fillColor(bold ? C.ink : C.muted)
      .text(label, MARGIN, y, { width: 300 });
    doc.fillColor(color).text(value, MARGIN + 300, y, { width: CONTENT - 300, align: 'right' });
    y += 18;
  };

  heading(t('Estado de resultados'));
  for (const [label, value, total] of resultLines(panel)) {
    if (total) {
      doc
        .moveTo(MARGIN, y - 3)
        .lineTo(MARGIN + CONTENT, y - 3)
        .lineWidth(0.6)
        .strokeColor(C.line)
        .stroke();
    }
    const color = total ? (value < 0 ? C.negative : value > 0 ? C.positive : C.ink) : C.ink;
    line(label, money(value), { bold: total, color });
  }
  if (panel.netMargin !== null) line(t('Margen neto'), pct(panel.netMargin));
  y += 10;

  heading(t('Punto de equilibrio'));
  if (panel.breakEven === null) {
    doc
      .font('Helvetica')
      .fontSize(10.5)
      .fillColor(C.muted)
      .text(
        panel.fixed === 0
          ? t('No hay gastos fijos registrados en el mes.')
          : t('Con estos costos, vender no alcanza a cubrir los gastos fijos.'),
        MARGIN,
        y,
      );
    y += 20;
  } else {
    line(t('Ventas necesarias para no perder'), money(panel.breakEven), { bold: true });
    const progress = Math.min(1, panel.sale / panel.breakEven);
    doc.roundedRect(MARGIN, y, CONTENT, 8, 4).fill(C.track);
    doc
      .roundedRect(MARGIN, y, Math.max(8, CONTENT * progress), 8, 4)
      .fill(panel.breakEvenReached ? C.positive : C.brand);
    y += 16;
    line(
      panel.breakEvenReached ? t('Ya se alcanzó') : t('Avance'),
      t('{round} % · margen de contribución {contributionMargin}', { round: Math.round(progress * 100), contributionMargin: pct(panel.contributionMargin) }),
    );
  }
  y += 10;

  if (report.distribution.items.length > 0) {
    heading(t('Reparto de utilidades'));
    for (const item of report.distribution.items) {
      line(
        `${pdfSafe(item.name || 'Socio')} (${item.share} %)`,
        t('Le toca {due} · ya retiró {withdrawn}', { due: money(item.due), withdrawn: money(item.withdrawn) }),
      );
    }
    y += 10;
  }

  // Movimientos
  const columns = [
    { label: t('Fecha'), width: 62 },
    { label: t('Tipo'), width: 90 },
    { label: t('Descripción'), width: 200 },
    { label: t('Lo registró'), width: 90 },
    { label: t('Monto'), width: CONTENT - 442, align: 'right' },
  ];
  const tableHeader = () => {
    doc.rect(MARGIN, y, CONTENT, 20).fill(C.brandSoft);
    let x = MARGIN + 6;
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.brand);
    for (const col of columns) {
      doc.text(col.label, x, y + 6, { width: col.width - 8, align: col.align ?? 'left' });
      x += col.width;
    }
    y += 24;
  };
  if (y + 60 > BOTTOM) {
    doc.addPage();
    y = 40;
  }
  heading(t('Movimientos ({length})', { length: report.movements.length }));
  tableHeader();
  for (const m of [...report.movements].reverse()) {
    if (y + 18 > BOTTOM) {
      doc.addPage();
      y = 40;
      tableHeader();
    }
    const amount = signed(m);
    const cells = [
      m.date,
      KIND_LABEL[m.kind],
      pdfSafe(m.description),
      pdfSafe(who(m)),
      `${amount < 0 ? '-' : '+'}${money(Math.abs(amount))}`,
    ];
    let x = MARGIN + 6;
    doc.font('Helvetica').fontSize(9);
    cells.forEach((text, i) => {
      const col = columns[i];
      doc.fillColor(i === 4 ? (amount < 0 ? C.ink : C.positive) : C.ink).text(text, x, y, {
        width: col.width - 8,
        align: col.align ?? 'left',
        lineBreak: false,
        ellipsis: true,
      });
      x += col.width;
    });
    y += 18;
  }

  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i += 1) {
    doc.switchToPage(range.start + i);
    doc
      .font('Helvetica')
      .fontSize(8)
      .fillColor(C.muted)
      .text(t('Rinde · Página {v1} de {count}', { v1: i + 1, count: range.count }), MARGIN, PAGE.height - 30, {
        width: CONTENT,
        align: 'center',
        lineBreak: false,
      });
  }
  doc.end();
  return done;
}

/* ---------- Varios meses (FT-0058) ---------- */

/**
 * Totales de varios meses: la suma de cada mes del panel.
 * @param {Array<{ panel: object }>} months
 * @returns {{ sale: number, cost: number, variable: number, fixed: number, otherIncome: number, netProfit: number, withdrawal: number }}
 */
export function rangeTotals(months) {
  const keys = ['sale', 'cost', 'variable', 'fixed', 'otherIncome', 'netProfit', 'withdrawal'];
  const totals = Object.fromEntries(keys.map((k) => [k, 0]));
  for (const { panel } of months) for (const k of keys) totals[k] += panel[k] ?? 0;
  for (const k of keys) totals[k] = Math.round(totals[k] * 100) / 100;
  return totals;
}

/**
 * `enero a junio de 2026` o `noviembre de 2025 a febrero de 2026`.
 * @param {string} from AAAA-MM
 * @param {string} to AAAA-MM
 * @returns {string}
 */
export function rangeTitle(from, to) {
  const sameYear = from.slice(0, 4) === to.slice(0, 4);
  const start = sameYear ? MONTHS[Number(from.slice(5)) - 1] : monthTitle(from);
  return `${start} a ${monthTitle(to)}`;
}

/** Columnas del resumen mes a mes: [título, llave del panel]. */
const rangeColumns = () => [
  [t('Ventas'), 'sale'],
  [t('Costo de venta'), 'cost'],
  [t('Gastos variables'), 'variable'],
  [t('Gastos fijos'), 'fixed'],
  [t('Otros ingresos'), 'otherIncome'],
  [t('Utilidad neta'), 'netProfit'],
];

/**
 * Excel de varios meses: resumen mes a mes con el total, y todos los movimientos.
 * @param {{ business: { name: string, nit: string|null }, from: string, to: string, months: Array<{ month: string, panel: object, movements: object[] }> }} report
 * @returns {Promise<Buffer>}
 */
export async function buildRangeWorkbook(report) {
  const wb = new ExcelJS.Workbook();
  wb.creator = t('Rinde');
  wb.created = new Date();
  const { business } = report;
  const paint = (row) => {
    row.font = { bold: true, color: { argb: XL.white } };
    row.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: XL.brand } };
    });
  };

  const sheet = wb.addWorksheet(t('Resumen'), { views: [{ showGridLines: false }] });
  sheet.columns = [{ width: 20 }, ...rangeColumns().map(() => ({ width: 17 }))];
  sheet.addRow([business.name]).font = { bold: true, size: 16, color: { argb: XL.brand } };
  sheet.addRow([
    t('Reporte de {from}{nit}', { from: rangeTitle(report.from, report.to), nit: business.nit ? ` · NIT ${business.nit}` : '' }),
  ]).font = { color: { argb: XL.muted } };
  sheet.addRow([]);
  paint(sheet.addRow([t('Mes'), ...rangeColumns().map(([label]) => label)]));
  const addMoneyRow = (label, panel) => {
    const row = sheet.addRow([label, ...rangeColumns().map(([, key]) => panel[key] ?? 0)]);
    for (let i = 2; i <= rangeColumns().length + 1; i += 1) row.getCell(i).numFmt = excelMoneyFormat();
    return row;
  };
  for (const { month, panel } of report.months) addMoneyRow(monthTitle(month), panel);
  const total = addMoneyRow(t('Total'), rangeTotals(report.months));
  total.font = { bold: true };
  total.eachCell((cell) => {
    cell.border = { top: { style: 'thin', color: { argb: XL.line } } };
  });

  const list = wb.addWorksheet(t('Movimientos'), { views: [{ state: 'frozen', ySplit: 1 }] });
  list.columns = [
    { header: t('Fecha'), key: 'date', width: 12 },
    { header: t('Tipo'), key: 'kind', width: 16 },
    { header: t('Categoría'), key: 'category', width: 14 },
    { header: t('Descripción'), key: 'description', width: 40 },
    { header: t('Monto'), key: 'amount', width: 16 },
    { header: t('Lo registró'), key: 'who', width: 20 },
  ];
  paint(list.getRow(1));
  for (const { movements } of report.months) {
    for (const m of [...movements].reverse()) {
      const row = list.addRow({
        date: m.date,
        kind: KIND_LABEL[m.kind],
        category: m.categoryName ?? CATEGORY_LABEL[m.category] ?? m.category,
        description: m.description,
        amount: signed(m),
        who: who(m),
      });
      row.getCell('amount').numFmt = excelMoneyFormat();
    }
  }
  list.autoFilter = { from: 'A1', to: 'F1' };
  return Buffer.from(await wb.xlsx.writeBuffer());
}

/**
 * PDF de varios meses: el resumen mes a mes con el total. El detalle línea por línea va en el
 * Excel, que es lo que usa el contador para revisar.
 * @param {{ business: { name: string, nit: string|null }, from: string, to: string, months: Array<{ month: string, panel: object, movements: object[] }> }} report
 * @returns {Promise<Buffer>}
 */
export function buildRangePdf(report) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 0,
    info: { Title: t('Reporte de {name}', { name: pdfSafe(report.business.name) }), Author: t('Rinde') },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  doc.rect(0, 0, PAGE.width, 90).fill(C.brand);
  doc
    .font('Helvetica-Bold')
    .fontSize(20)
    .fillColor('#ffffff')
    .text(pdfSafe(report.business.name), MARGIN, 28, { width: CONTENT });
  doc
    .font('Helvetica')
    .fontSize(11)
    .text(
      t('Reporte de {from}{nit}', { from: rangeTitle(report.from, report.to), nit: report.business.nit ? ` · NIT ${pdfSafe(report.business.nit)}` : '' }),
      MARGIN,
      56,
    );
  let y = 115;
  const columns = [
    { label: t('Mes'), width: 120 },
    { label: t('Ventas'), width: 100, value: (p) => p.sale },
    { label: t('Costos y gastos'), width: 110, value: (p) => -(p.cost + p.variable + p.fixed) },
    { label: t('Otros ingresos'), width: 100, value: (p) => p.otherIncome },
    { label: t('Utilidad neta'), width: CONTENT - 430, value: (p) => p.netProfit, colored: true },
  ];
  const row = (label, panel, bold = false) => {
    let x = MARGIN + 6;
    columns.forEach((col, i) => {
      const value = i === 0 ? null : col.value(panel);
      const color = col.colored ? (value < 0 ? C.negative : value > 0 ? C.positive : C.ink) : C.ink;
      doc
        .font(bold ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(10)
        .fillColor(color)
        .text(i === 0 ? label : money(value), x, y, {
          width: col.width - 8,
          align: i === 0 ? 'left' : 'right',
          lineBreak: false,
        });
      x += col.width;
    });
    y += 18;
  };

  doc.font('Helvetica-Bold').fontSize(13).fillColor(C.ink).text(t('Mes a mes'), MARGIN, y);
  y += 24;
  doc.rect(MARGIN, y - 4, CONTENT, 20).fill(C.brandSoft);
  let x = MARGIN + 6;
  doc.font('Helvetica-Bold').fontSize(9).fillColor(C.brand);
  columns.forEach((col, i) => {
    doc.text(col.label, x, y, { width: col.width - 8, align: i === 0 ? 'left' : 'right', lineBreak: false });
    x += col.width;
  });
  y += 22;
  for (const { month, panel } of report.months) row(monthTitle(month), panel);
  doc.moveTo(MARGIN, y - 2).lineTo(MARGIN + CONTENT, y - 2).lineWidth(0.6).strokeColor(C.line).stroke();
  y += 4;
  row(t('Total'), rangeTotals(report.months), true);
  y += 14;
  const count = report.months.reduce((n, m) => n + m.movements.length, 0);
  doc
    .font('Helvetica')
    .fontSize(9.5)
    .fillColor(C.muted)
    .text(t('{count} movimientos en el periodo. El detalle línea por línea está en el Excel.', { count }), MARGIN, y, {
      width: CONTENT,
    });
  doc.end();
  return done;
}
