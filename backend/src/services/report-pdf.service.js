import { readFileSync } from 'node:fs';
import PDFDocument from 'pdfkit';
import { dateText, money, percent, pointLabel } from './report-data.service.js';

/** @typedef {InstanceType<typeof PDFDocument>} PdfDoc Documento de pdfkit. */

/*
 * Reporte en PDF del periodo, con el diseño de Rinde (FT-0012).
 *
 * Orden de lectura: portada con el periodo, indicadores, "Lo que dicen tus números", ingresos
 * frente a gastos, gastos por categoría, movimiento del dinero (acumulado), gastos destacados,
 * presupuestos del mes y, al final, el detalle de movimientos. Las secciones fluyen: si una no cabe
 * en lo que queda de la página, pasa completa a la siguiente (nada queda cortado).
 *
 * Todo se dibuja como vectores con pdfkit: nítido al ampliar o imprimir y liviano. Las cifras y los
 * hallazgos vienen de buildReport, los mismos del Excel.
 */

const PAGE = { width: 612, height: 792 }; // Carta, en puntos (1/72 de pulgada)
const MARGIN = 40;
const CONTENT = PAGE.width - MARGIN * 2;
const TOP = 44; // Dónde empieza el contenido en las páginas sin portada
const FOOTER_Y = PAGE.height - 34;
const BOTTOM = FOOTER_Y - 16; // Hasta dónde puede llegar el contenido antes de saltar de página

const C = {
  brand: '#6142ff',
  brandSoft: '#ece8ff',
  ink: '#16141f',
  muted: '#6b6880',
  canvas: '#f5f4f9',
  track: '#efedf6',
  line: '#e4e2ee',
  white: '#ffffff',
  positive: '#087a59',
  positiveSoft: '#e3f5ee',
  negative: '#c8321f',
  caution: '#9a5b00',
};

const LEVEL = {
  none: { label: 'Bien', color: C.positive },
  warning_80: { label: 'Cerca del límite', color: C.caution },
  at_limit: { label: 'En el límite', color: C.caution },
  exceeded_100: { label: 'Excedido', color: C.negative },
};

const FONT = 'Helvetica';
const BOLD = 'Helvetica-Bold';
const MAX_CATEGORIES = 6;
const WARNING_AT = 0.8;
const GRANULARITY = { day: 'día', week: 'semana', month: 'mes' };

/** Logo oficial horizontal a color (va sobre el gris claro de la portada, combinación aprobada). */
const LOGO = readFileSync(new URL('../assets/rinde-logo.png', import.meta.url));

const longDate = (iso) => dateText(iso, { day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (iso) => dateText(iso, { day: 'numeric', month: 'short' });
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/** Caracteres fuera de Latin-1 que la fuente Helvetica del PDF sí sabe dibujar (WinAnsi). */
const EXTRA_GLYPHS = new Set('…–—‘’“”•€·'.split(''));

/**
 * Quita lo que Helvetica no puede dibujar (emojis, otros alfabetos, caracteres dañados): sin esto
 * aparecerían símbolos raros en el PDF. Tildes, ñ, ¿ y ¡ se conservan.
 * @param {string} text
 * @returns {string}
 */
export function pdfSafe(text) {
  return [...String(text)]
    .filter((ch) => {
      const code = ch.codePointAt(0);
      return (code >= 32 && code <= 126) || (code >= 160 && code <= 255) || EXTRA_GLYPHS.has(ch);
    })
    .join('')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/**
 * Recorta un texto para que quepa en un ancho, terminando en "…".
 * @param {PdfDoc} doc
 * @param {string} text
 * @param {number} width
 * @returns {string}
 */
function fit(doc, text, width) {
  if (doc.widthOfString(text) <= width) return text;
  let cut = text;
  while (cut.length > 1 && doc.widthOfString(`${cut}…`) > width) cut = cut.slice(0, -1);
  return `${cut.trimEnd()}…`;
}

/**
 * Escribe texto en una posición fija. Por defecto va en una línea (si no cabe en `width` termina
 * en "…"); con `lines` puede ocupar hasta ese número de líneas.
 * @param {PdfDoc} doc
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {{ size?: number, font?: string, color?: string, width?: number, align?: 'left'|'right'|'center', lines?: number }} [o]
 * @returns {void}
 */
function write(
  doc,
  text,
  x,
  y,
  { size = 9, font = FONT, color = C.ink, width, align = 'left', lines = 1 } = {},
) {
  doc.font(font).fontSize(size).fillColor(color);
  const clean = pdfSafe(text);
  if (lines > 1) {
    // Reparte las palabras en renglones; lo que no quepa en el último termina en "…".
    const words = clean.split(' ');
    for (let line = 0; line < lines && words.length > 0; line += 1) {
      let text = words.shift();
      while (
        line < lines - 1 &&
        words.length > 0 &&
        doc.widthOfString(`${text} ${words[0]}`) <= width
      )
        text += ` ${words.shift()}`;
      if (line === lines - 1) text = fit(doc, [text, ...words].join(' '), width);
      doc.text(text, x, y + line * (doc.currentLineHeight() + 1.5), {
        lineBreak: false,
        width,
        align,
      });
    }
    return;
  }
  const shown = width ? fit(doc, clean, width) : clean;
  doc.text(shown, x, y, { lineBreak: false, ...(width && { width, align }) });
}

/**
 * Título de sección: una marca violeta corta y el texto en negrita; debajo, una aclaración opcional.
 * @param {PdfDoc} doc
 * @param {string} text
 * @param {number} x
 * @param {number} y
 * @param {string} [hint] Aclaración en gris, a la derecha del título.
 * @returns {number} La posición y donde empieza el contenido de la sección.
 */
function sectionTitle(doc, text, x, y, hint) {
  doc.rect(x, y, 22, 2.5).fill(C.brand);
  write(doc, text, x, y + 9, { size: 12, font: BOLD });
  if (hint) {
    const offset = doc.font(BOLD).fontSize(12).widthOfString(pdfSafe(text)) + 8;
    write(doc, hint, x + offset, y + 12, { size: 8.5, color: C.muted });
  }
  return y + 32;
}

/**
 * Si la sección no cabe en lo que queda de la página, la pasa completa a una página nueva.
 * @param {PdfDoc} doc
 * @param {number} y
 * @param {number} needed Alto de la sección.
 * @returns {number} La y donde dibujarla.
 */
function room(doc, y, needed) {
  if (y + needed <= BOTTOM) return y;
  doc.addPage();
  return TOP;
}

/**
 * Portada: logo, título, periodo del reporte, a quién pertenece y cuándo se generó.
 * @param {PdfDoc} doc
 * @param {object} report
 * @returns {number} y siguiente.
 */
function drawCover(doc, report) {
  const { from, to, wholeMonth } = report.period;
  doc.rect(0, 0, PAGE.width, 156).fill(C.canvas);
  doc.rect(0, 156, PAGE.width, 2).fill(C.brand);
  doc.image(LOGO, MARGIN, 26, { height: 28 });
  write(doc, 'REPORTE FINANCIERO', MARGIN, 37, {
    size: 8,
    font: BOLD,
    color: C.muted,
    width: CONTENT,
    align: 'right',
  });

  write(doc, 'Tu dinero, en perspectiva', MARGIN, 72, { size: 27, font: BOLD });
  const month = dateText(from, { month: 'long', year: 'numeric' });
  const coverage =
    from === to ? `El ${longDate(from)}` : `Del ${longDate(from)} al ${longDate(to)}`;
  write(doc, wholeMonth ? month.charAt(0).toUpperCase() + month.slice(1) : coverage, MARGIN, 106, {
    size: 13,
    font: BOLD,
    color: C.brand,
    width: CONTENT,
  });
  const who = report.owner.name || report.owner.email;
  const parts = [
    who,
    wholeMonth ? coverage : '',
    `Generado el ${longDate(report.generatedOn)}`,
  ].filter(Boolean);
  write(doc, parts.join(' · '), MARGIN, 130, { size: 9, color: C.muted, width: CONTENT });
  return 176;
}

/**
 * Las 4 tarjetas de indicadores.
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} y
 * @returns {number} y siguiente.
 */
function drawKpis(doc, report, y) {
  const t = report.totals;
  const days = plural(t.daysElapsed, 'día', 'días');
  const cards = [
    {
      label: 'Ingresos',
      value: money(t.income),
      sub: plural(t.incomeCount, 'movimiento', 'movimientos'),
      color: C.positive,
      fill: C.positiveSoft,
    },
    {
      label: 'Gastos',
      value: money(t.expense),
      sub: plural(t.expenseCount, 'movimiento', 'movimientos'),
      color: C.brand,
      fill: C.brandSoft,
    },
    {
      label: 'Balance neto',
      value: money(t.balance),
      sub: 'Ingresos menos gastos',
      color: t.balance < 0 ? C.negative : C.ink,
      fill: C.canvas,
    },
    {
      label: 'Movimientos',
      value: String(t.count),
      sub: `En ${days} · ${money(t.dailyAverageExpense)} al día`,
      color: C.ink,
      fill: C.canvas,
    },
  ];
  const gap = 8;
  const width = (CONTENT - gap * 3) / 4;
  cards.forEach((card, i) => {
    const x = MARGIN + i * (width + gap);
    doc.roundedRect(x, y, width, 62, 6).fill(card.fill);
    write(doc, card.label, x + 10, y + 10, { size: 8.5, color: C.muted });
    write(doc, card.value, x + 10, y + 25, {
      size: 15,
      font: BOLD,
      color: card.color,
      width: width - 20,
    });
    write(doc, card.sub, x + 10, y + 46, { size: 7, color: C.muted, width: width - 20 });
  });
  return y + 62 + 18;
}

/**
 * "Lo que dicen tus números": los hallazgos del modelo, en tarjetas a dos columnas.
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} y
 * @returns {number} y siguiente.
 */
function drawInsights(doc, report, y) {
  const { insights } = report;
  if (insights.length === 0) return y;
  const cardHeight = 46;
  const gap = 8;
  const rows = Math.ceil(insights.length / 2);
  let top = sectionTitle(
    doc,
    'Lo que dicen tus números',
    MARGIN,
    room(doc, y, 32 + rows * (cardHeight + gap)),
  );
  const width = (CONTENT - gap) / 2;
  insights.forEach((insight, i) => {
    const x = MARGIN + (i % 2) * (width + gap);
    const cardY = top + Math.floor(i / 2) * (cardHeight + gap);
    doc.roundedRect(x, cardY, width, cardHeight, 6).fill(C.canvas);
    doc.rect(x, cardY + 9, 2.5, cardHeight - 18).fill(C.brand);
    write(doc, insight.title, x + 12, cardY + 8, { size: 9.5, font: BOLD, width: width - 22 });
    write(doc, insight.detail, x + 12, cardY + 22, {
      size: 8,
      color: C.muted,
      width: width - 22,
      lines: 2,
    });
  });
  top += rows * (cardHeight + gap);
  return top + 10;
}

/**
 * Ingresos frente a gastos: dos barras con la misma escala y el balance debajo.
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @returns {number} y donde termina.
 */
function drawIncomeVsExpense(doc, report, x, y, width) {
  const t = report.totals;
  let top = sectionTitle(doc, 'Ingresos frente a gastos', x, y);
  const max = Math.max(t.income, t.expense, 1);
  for (const [label, value, color] of [
    ['Ingresos', t.income, C.positive],
    ['Gastos', t.expense, C.brand],
  ]) {
    write(doc, label, x, top, { color: C.muted });
    write(doc, money(value), x, top, { font: BOLD, width, align: 'right' });
    doc.roundedRect(x, top + 14, width, 10, 3).fill(C.track);
    if (value > 0)
      doc.roundedRect(x, top + 14, Math.max(4, (value / max) * width), 10, 3).fill(color);
    top += 38;
  }
  doc
    .moveTo(x, top)
    .lineTo(x + width, top)
    .lineWidth(0.5)
    .strokeColor(C.line)
    .stroke();
  write(doc, 'Balance neto', x, top + 8, { color: C.muted });
  write(doc, money(t.balance), x, top + 8, {
    font: BOLD,
    color: t.balance < 0 ? C.negative : C.ink,
    width,
    align: 'right',
  });
  return top + 24;
}

/**
 * Gastos por categoría, de mayor a menor (las 6 mayores; el resto se suma en "Otras").
 * @param {object} report
 * @returns {Array<{ name: string, amount: number, share: number }>}
 */
function topCategories(report) {
  const groups = [...report.expenseByCategory];
  if (groups.length <= MAX_CATEGORIES) return groups;
  const rest = groups.splice(MAX_CATEGORIES - 1);
  return [
    ...groups,
    {
      name: `Otras (${rest.length})`,
      amount: rest.reduce((s, g) => s + g.amount, 0),
      share: rest.reduce((s, g) => s + g.share, 0),
    },
  ];
}

/**
 * Barras horizontales de gastos por categoría, todas en el violeta de la marca: lo que distingue a
 * una de otra es su nombre y su largo, no un color por categoría.
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} x
 * @param {number} y
 * @param {number} width
 * @returns {number} y donde termina.
 */
function drawCategoryBars(doc, report, x, y, width) {
  let top = sectionTitle(doc, 'Gastos por categoría', x, y);
  const groups = topCategories(report);
  if (groups.length === 0) {
    write(doc, 'Sin gastos en el periodo.', x, top, { color: C.muted });
    return top + 16;
  }
  const labelWidth = 96;
  const valueWidth = 104;
  const barMax = width - labelWidth - valueWidth - 8;
  const max = Math.max(...groups.map((g) => g.amount));
  for (const g of groups) {
    write(doc, g.name, x, top, { width: labelWidth - 6 });
    const barWidth = max > 0 ? Math.max(2, (g.amount / max) * barMax) : 2;
    doc.roundedRect(x + labelWidth, top, barWidth, 10, 2).fill(C.brand);
    write(doc, `${money(g.amount)} · ${percent(g.share)}`, x + width - valueWidth, top, {
      size: 8.5,
      color: C.muted,
      width: valueWidth,
      align: 'right',
    });
    top += 18;
  }
  return top;
}

/**
 * Movimiento del dinero: ingresos y gastos acumulados a lo largo del periodo, con los tramos que
 * trae el modelo (no incluye días que todavía no han pasado).
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} y
 * @returns {number} y siguiente.
 */
function drawMoneyFlow(doc, report, y) {
  const { granularity, points } = report.series;
  if (points.length === 0) return y;
  const height = 96;
  const top = sectionTitle(
    doc,
    'Movimiento del dinero',
    MARGIN,
    room(doc, y, 32 + height + 40),
    `Acumulado por ${GRANULARITY[granularity]}`,
  );

  // Leyenda con el total de cada línea, a la derecha del título.
  const t = report.totals;
  const legend = [
    ['Ingresos', t.income, C.positive],
    ['Gastos', t.expense, C.brand],
  ];
  let legendX = MARGIN + CONTENT;
  for (const [label, total, color] of legend.reverse()) {
    const text = `${label} ${money(total)}`;
    legendX -= doc.font(FONT).fontSize(8.5).widthOfString(pdfSafe(text));
    write(doc, text, legendX, top - 20, { size: 8.5, color: C.muted });
    doc.rect(legendX - 11, top - 19, 7, 7).fill(color);
    legendX -= 26;
  }

  const axis = 62; // Ancho reservado para los montos del eje
  const x0 = MARGIN + axis;
  const width = CONTENT - axis;
  const base = top + height;
  const running = { income: 0, expense: 0 };
  const lines = points.map((p) => ({
    income: (running.income += p.income),
    expense: (running.expense += p.expense),
  }));
  const max = Math.max(1, running.income, running.expense);

  for (const fraction of [0, 0.5, 1]) {
    const lineY = base - fraction * height;
    doc
      .moveTo(x0, lineY)
      .lineTo(x0 + width, lineY)
      .lineWidth(0.5)
      .strokeColor(C.line)
      .stroke();
    write(doc, money(max * fraction), MARGIN, lineY - 4, {
      size: 7.5,
      color: C.muted,
      width: axis - 8,
      align: 'right',
    });
  }

  const step = points.length > 1 ? width / (points.length - 1) : 0;
  const at = (i, value) => [
    points.length > 1 ? x0 + i * step : x0 + width / 2,
    base - (value / max) * height,
  ];
  for (const [key, color] of [
    ['income', C.positive],
    ['expense', C.brand],
  ]) {
    lines.forEach((line, i) => {
      const [px, py] = at(i, line[key]);
      if (i === 0) doc.moveTo(px, py);
      else doc.lineTo(px, py);
    });
    doc.lineWidth(1.6).lineJoin('round').strokeColor(color).stroke();
    const [endX, endY] = at(lines.length - 1, lines.at(-1)[key]);
    doc.circle(endX, endY, 2.6).fill(color);
  }

  // Hasta 7 etiquetas en el eje del tiempo, siempre con la primera y la última.
  const ticks = Math.min(points.length, 7);
  for (let k = 0; k < ticks; k += 1) {
    const i = ticks === 1 ? 0 : Math.round((k * (points.length - 1)) / (ticks - 1));
    const [px] = at(i, 0);
    const align = k === 0 && ticks > 1 ? 'left' : k === ticks - 1 && ticks > 1 ? 'right' : 'center';
    const labelX = align === 'left' ? px : align === 'right' ? px - 70 : px - 35;
    write(doc, pointLabel(points[i], granularity), labelX, base + 6, {
      size: 7.5,
      color: C.muted,
      width: 70,
      align,
    });
  }
  return base + 34;
}

/**
 * Gastos destacados: los gastos más grandes del periodo.
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} y
 * @returns {number} y siguiente.
 */
function drawTopExpenses(doc, report, y) {
  const top5 = report.topExpenses;
  if (top5.length === 0) return y;
  let top = sectionTitle(
    doc,
    'Gastos destacados',
    MARGIN,
    room(doc, y, 32 + top5.length * 18 + 8),
    `Los ${top5.length} más grandes`,
  );
  top5.forEach((e, i) => {
    if (i % 2 === 0) doc.rect(MARGIN, top - 4, CONTENT, 18).fill(C.canvas);
    write(doc, String(i + 1), MARGIN + 8, top, { font: BOLD, color: C.brand });
    write(doc, e.description, MARGIN + 24, top, { width: 226 });
    write(doc, e.categoryName ?? 'Sin clasificar', MARGIN + 258, top, {
      color: C.muted,
      width: 110,
    });
    write(doc, shortDate(e.date), MARGIN + 374, top, { color: C.muted, width: 56 });
    write(doc, money(e.amount), MARGIN + CONTENT - 96, top, {
      font: BOLD,
      width: 90,
      align: 'right',
    });
    top += 18;
  });
  return top + 14;
}

/**
 * Barras de progreso de los presupuestos del mes, con la marca fija del 80 % (RN-04).
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} y
 * @returns {number} y siguiente.
 */
function drawBudgets(doc, report, y) {
  if (report.budgets.length === 0) return y;
  const month = dateText(report.period.from, { month: 'long' });
  let top = sectionTitle(
    doc,
    `Presupuestos de ${month}`,
    MARGIN,
    room(doc, y, 32 + report.budgets.length * 20 + 20),
  );
  const barX = MARGIN + 110;
  const barWidth = 220;
  for (const b of report.budgets) {
    const level = LEVEL[b.level] ?? LEVEL.none;
    write(doc, b.category, MARGIN, top, { width: 104 });
    doc.roundedRect(barX, top + 1, barWidth, 8, 4).fill(C.track);
    doc
      .roundedRect(barX, top + 1, Math.max(4, Math.min(b.usage, 1) * barWidth), 8, 4)
      .fill(level.color);
    const mark = barX + barWidth * WARNING_AT;
    doc
      .moveTo(mark, top - 2)
      .lineTo(mark, top + 12)
      .lineWidth(1.2)
      .strokeColor(C.ink)
      .stroke();
    write(doc, `${percent(b.usage)} · ${level.label}`, barX + barWidth + 10, top, {
      font: BOLD,
      color: level.color,
      width: 110,
    });
    write(doc, `${money(b.spent)} de ${money(b.limit)}`, MARGIN + CONTENT - 92, top, {
      color: C.muted,
      width: 92,
      align: 'right',
    });
    top += 20;
  }
  write(doc, 'La línea vertical marca el 80 % del límite.', MARGIN, top, {
    size: 7.5,
    color: C.muted,
  });
  return top + 24;
}

const COLUMNS = [
  { label: 'Fecha', width: 62 },
  { label: 'Descripción', width: 180 },
  { label: 'Categoría', width: 104 },
  { label: 'Ingreso', width: 90, align: 'right' },
  { label: 'Gasto', width: 90, align: 'right' },
];

/**
 * Encabezado de la tabla de movimientos (se repite en cada página).
 * @param {PdfDoc} doc
 * @param {number} y
 * @returns {number} y de la primera fila.
 */
function tableHeader(doc, y) {
  doc.rect(MARGIN, y, CONTENT, 20).fill(C.ink);
  let x = MARGIN + 6;
  for (const col of COLUMNS) {
    write(doc, col.label, x, y + 6, {
      font: BOLD,
      color: C.white,
      width: col.width - 8,
      align: col.align,
    });
    x += col.width;
  }
  return y + 24;
}

/**
 * Detalle completo de movimientos, con totales al final. Ingresos y gastos van en columnas
 * distintas: se distinguen por su posición, no solo por el color.
 * @param {PdfDoc} doc
 * @param {object} report
 * @param {number} from La y donde terminó el resumen.
 * @returns {void}
 */
function drawMovements(doc, report, from) {
  // Empieza en la misma página solo si caben el título, el encabezado y unas cuantas filas.
  let y = sectionTitle(
    doc,
    'Detalle de movimientos',
    MARGIN,
    room(doc, from, 32 + 24 + 16 * 6),
    `${report.rows.length} en total`,
  );
  y = tableHeader(doc, y);
  report.rows.forEach((row, i) => {
    if (y > BOTTOM - 16) {
      doc.addPage();
      y = tableHeader(doc, TOP);
    }
    if (i % 2 === 1) doc.rect(MARGIN, y - 4, CONTENT, 16).fill(C.canvas);
    const income = row.type === 'ingreso';
    const cells = [
      shortDate(row.date),
      row.description,
      row.categoryName ?? 'Sin clasificar',
      income ? money(row.amount) : '',
      income ? '' : money(row.amount),
    ];
    let x = MARGIN + 6;
    cells.forEach((text, j) => {
      const col = COLUMNS[j];
      const color = j === 3 ? C.positive : j === 0 || j === 2 ? C.muted : C.ink;
      write(doc, text, x, y, { color, width: col.width - 8, align: col.align });
      x += col.width;
    });
    y += 16;
  });

  if (y > BOTTOM - 24) {
    doc.addPage();
    y = TOP;
  }
  doc.rect(MARGIN, y - 2, CONTENT, 20).fill(C.brandSoft);
  const incomeX = MARGIN + 6 + COLUMNS.slice(0, 3).reduce((s, c) => s + c.width, 0);
  write(doc, 'Total', MARGIN + 6, y + 4, { font: BOLD });
  write(doc, money(report.totals.income), incomeX, y + 4, {
    font: BOLD,
    color: C.positive,
    width: COLUMNS[3].width - 8,
    align: 'right',
  });
  write(doc, money(report.totals.expense), incomeX + COLUMNS[3].width, y + 4, {
    font: BOLD,
    width: COLUMNS[4].width - 8,
    align: 'right',
  });
}

/**
 * Pie de página en todas las páginas: nombre del reporte y "Página X de Y".
 * @param {PdfDoc} doc
 * @returns {void}
 */
function drawFooters(doc) {
  const { start, count } = doc.bufferedPageRange();
  for (let i = start; i < start + count; i += 1) {
    doc.switchToPage(i);
    doc
      .moveTo(MARGIN, FOOTER_Y - 6)
      .lineTo(PAGE.width - MARGIN, FOOTER_Y - 6)
      .lineWidth(0.5)
      .strokeColor(C.line)
      .stroke();
    write(doc, 'Rinde · Reporte financiero', MARGIN, FOOTER_Y, { size: 8, color: C.muted });
    write(doc, `Página ${i - start + 1} de ${count}`, MARGIN, FOOTER_Y, {
      size: 8,
      color: C.muted,
      width: CONTENT,
      align: 'right',
    });
  }
}

/**
 * Arma el PDF del reporte.
 * @param {Awaited<ReturnType<typeof import('./report-data.service.js').buildReport>>} report
 * @param {{ detail?: boolean }} [options] `detail: false` deja solo el resumen, sin la tabla de
 *   movimientos (para compartirlo sin mostrar cada compra).
 * @returns {Promise<Buffer>} Contenido del archivo .pdf.
 */
export function buildPdf(report, { detail = true } = {}) {
  const doc = new PDFDocument({
    size: 'LETTER',
    margin: 0, // Las posiciones se manejan a mano; sin margen pdfkit no agrega páginas por su cuenta.
    bufferPages: true, // Necesario para escribir "Página X de Y" al final.
    info: { Title: 'Reporte financiero', Author: 'Rinde', Creator: 'Rinde' },
  });
  const chunks = [];
  doc.on('data', (chunk) => chunks.push(chunk));
  const done = new Promise((resolve, reject) => {
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
  });

  let y = drawCover(doc, report);
  y = drawKpis(doc, report, y);
  y = drawInsights(doc, report, y);

  // Dos columnas: ingresos frente a gastos y gastos por categoría.
  const leftWidth = 196;
  const gap = 28;
  y = room(doc, y, 32 + Math.max(100, topCategories(report).length * 18) + 8);
  const afterTotals = drawIncomeVsExpense(doc, report, MARGIN, y, leftWidth);
  const afterBars = drawCategoryBars(
    doc,
    report,
    MARGIN + leftWidth + gap,
    y,
    CONTENT - leftWidth - gap,
  );
  y = Math.max(afterTotals, afterBars) + 18;

  y = drawMoneyFlow(doc, report, y);
  y = drawTopExpenses(doc, report, y);
  y = drawBudgets(doc, report, y);
  if (detail) drawMovements(doc, report, y);

  drawFooters(doc);
  doc.end();
  return done;
}
