import { AppError } from '../errors/app-error.js';
import { listForExport } from '../repositories/transactions.repository.js';
import { buildReport, isWholeMonth, pointLabel } from './report-data.service.js';
import { buildWorkbook } from './report-excel.service.js';
import { buildPdf } from './report-pdf.service.js';

const XLSX_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

/** Separador de columnas: con `;` Excel en español (coma decimal) abre cada dato en su columna. */
const SEPARATOR = ';';
/** Fin de línea del estándar CSV (RFC 4180). */
const NEWLINE = '\r\n';
/** Marca invisible al inicio para que Excel lea el archivo como UTF-8 (tildes y ñ). */
const BOM = '﻿';

const HEADER = ['Fecha', 'Tipo', 'Categoría', 'Descripción', 'Monto', 'Origen'];
const TYPE_LABELS = { gasto: 'Gasto', ingreso: 'Ingreso' };
const SOURCE_LABELS = { manual: 'Manual', ia: 'IA', sin_clasificar: 'Sin clasificar' };

/**
 * Prepara un texto para una celda del CSV.
 * - Si empieza con `= + - @` (o tabulador / retorno), Excel lo ejecutaría como fórmula
 *   ("inyección de CSV"); se antepone un apóstrofo para que quede como texto.
 * - Si contiene el separador, comillas o saltos de línea, va entre comillas y las comillas
 *   internas se duplican, como pide el estándar.
 * @param {string} value
 * @returns {string}
 */
export function escapeCell(value) {
  let text = String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  if (/[;"\r\n]/.test(text)) text = `"${text.replace(/"/g, '""')}"`;
  return text;
}

/**
 * Monto como número que Excel en español reconoce: sin `$` ni puntos de miles y con coma
 * decimal solo si tiene centavos (`18000`, `18000,50`).
 * @param {number} amount
 * @returns {string}
 */
export function formatAmount(amount) {
  return Number.isInteger(amount) ? String(amount) : amount.toFixed(2).replace('.', ',');
}

/**
 * Arma el contenido completo del CSV a partir de los movimientos.
 * @param {Awaited<ReturnType<typeof listForExport>>} rows
 * @returns {string}
 */
export function toCsv(rows) {
  const lines = [HEADER.map(escapeCell).join(SEPARATOR)];
  for (const row of rows) {
    lines.push(
      [
        row.date,
        TYPE_LABELS[row.type],
        escapeCell(row.categoryName ?? 'Sin clasificar'),
        escapeCell(row.description),
        formatAmount(row.amount),
        SOURCE_LABELS[row.source],
      ].join(SEPARATOR),
    );
  }
  return BOM + lines.join(NEWLINE) + NEWLINE;
}

/**
 * Nombre del archivo: `rinde_2026-10.csv` si el rango es un mes completo,
 * `rinde_2026-10-01_2026-10-15.csv` en cualquier otro caso.
 * @param {string} from AAAA-MM-DD
 * @param {string} to AAAA-MM-DD
 * @param {string} extension
 * @returns {string}
 */
export function exportFilename(from, to, extension) {
  const period = isWholeMonth(from, to) ? from.slice(0, 7) : `${from}_${to}`;
  return `rinde_${period}.${extension}`;
}

/** Cuántas filas del CSV se muestran en la vista previa. */
const PREVIEW_ROWS = 5;

/**
 * Vista previa del reporte del periodo: las cifras que traerán los archivos, antes de descargarlos.
 * Sale de `buildReport`, el mismo modelo del Excel y el PDF, y el trozo de CSV lo arma `toCsv`:
 * lo que se ve en pantalla es lo que queda en el archivo.
 * @param {string} userId
 * @param {{ from: string, to: string }} period Fechas ya validadas.
 * @returns {Promise<object>} Totales, categorías, serie, hallazgos y las primeras filas del CSV.
 * @throws {AppError} 422 `NO_DATA` si no hay movimientos en el periodo (REQ-033).
 */
export async function previewReport(userId, { from, to }) {
  const report = await buildReport(userId, { from, to });
  if (!report) throw noData();
  const { granularity, points } = report.series;
  const sample = report.rows.slice(0, PREVIEW_ROWS);
  return {
    period: report.period,
    generatedOn: report.generatedOn,
    totals: report.totals,
    expenseByCategory: report.expenseByCategory,
    series: {
      granularity,
      points: points.map((p) => ({
        label: pointLabel(p, granularity),
        income: p.income,
        expense: p.expense,
      })),
    },
    insights: report.insights,
    hasBudgets: report.budgets.length > 0,
    csv: {
      columns: HEADER,
      rows: sample.map((row) => [
        row.date,
        TYPE_LABELS[row.type],
        row.categoryName ?? 'Sin clasificar',
        row.description,
        row.amount,
        SOURCE_LABELS[row.source],
      ]),
      // El texto tal cual queda en el archivo (sin la marca invisible del inicio).
      text: toCsv(sample).slice(BOM.length).trimEnd(),
    },
  };
}

/** @returns {AppError} 422 `NO_DATA`: no hay movimientos en el periodo (REQ-033). */
function noData() {
  return new AppError(422, 'NO_DATA', 'No hay movimientos en el periodo seleccionado');
}

/**
 * Genera el archivo de exportación del periodo (FT-0012, REQ-031 a REQ-033).
 * - `xlsx`: reporte con resumen, categorías, top 5, presupuestos y movimientos.
 * - `pdf`: el mismo reporte con gráficos, listo para ver o imprimir.
 * - `csv`: los movimientos en texto plano, para importarlos en otras herramientas.
 * Excel y PDF salen de `buildReport`, así sus cifras siempre coinciden.
 * @param {string} userId
 * @param {{ format: 'xlsx'|'csv'|'pdf', from: string, to: string, detail?: boolean }} query Datos ya
 *   validados. `detail: false` deja el PDF sin la tabla de movimientos.
 * @returns {Promise<{ filename: string, contentType: string, body: string|Buffer }>}
 * @throws {AppError} 422 `NO_DATA` si no hay movimientos en el periodo (REQ-033).
 */
export async function exportTransactions(userId, { format, from, to, detail = true }) {
  if (format === 'xlsx' || format === 'pdf') {
    const report = await buildReport(userId, { from, to });
    if (!report) throw noData();
    const pdf = format === 'pdf';
    return {
      filename: exportFilename(from, to, format),
      contentType: pdf ? 'application/pdf' : XLSX_TYPE,
      body: pdf ? await buildPdf(report, { detail }) : await buildWorkbook(report),
    };
  }

  const rows = await listForExport({ userId, from, to });
  if (rows.length === 0) throw noData();

  return {
    filename: exportFilename(from, to, 'csv'),
    contentType: 'text/csv; charset=utf-8',
    body: toCsv(rows),
  };
}
