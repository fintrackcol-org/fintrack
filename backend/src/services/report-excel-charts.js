import JSZip from 'jszip';

/*
 * Gráficos nativos de Excel para el reporte (FT-0012).
 *
 * exceljs no sabe crear gráficos, así que se agregan después: un .xlsx es un zip de archivos XML y
 * aquí se le suman los del gráfico (`xl/charts/chartN.xml`) y se enlazan al dibujo de la hoja.
 * Son gráficos de verdad: leen sus datos de las celdas y se redibujan si alguien cambia un monto.
 * Cada gráfico lleva además sus valores ya calculados, para los visores que no recalculan.
 *
 * Requisito: la hoja ya debe tener un dibujo (el logo que pone exceljs); a ese dibujo se suma el gráfico.
 */

const CHART_TYPE = 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
const CHART_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/chart';
const NS_C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
const NS_A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const NS_R = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const TEXT_COLOR = '6B6880';
const LINE_COLOR = 'E4E2EE';
/** Área de las barras acostadas: deja sitio a la izquierda para el nombre y a la derecha para el monto de la barra más larga. */
const PLOT_WITH_LABEL_ROOM =
  '<c:layout><c:manualLayout><c:layoutTarget val="inner"/><c:xMode val="edge"/><c:yMode val="edge"/>' +
  '<c:x val="0.27"/><c:y val="0.04"/><c:w val="0.57"/><c:h val="0.92"/></c:manualLayout></c:layout>';

/**
 * Texto seguro para meter dentro de XML.
 * @param {unknown} text
 * @returns {string}
 */
const esc = (text) =>
  String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/**
 * Relleno de un solo color.
 * @param {string} rgb Seis dígitos, sin `#`.
 * @returns {string}
 */
const solid = (rgb) => `<a:solidFill><a:srgbClr val="${rgb}"/></a:solidFill>`;

/**
 * Puntos ya calculados de una referencia (lo que el gráfico muestra antes de recalcular).
 * @param {unknown[]} values
 * @returns {string}
 */
const cache = (values) =>
  `<c:ptCount val="${values.length}"/>${values.map((v, i) => `<c:pt idx="${i}"><c:v>${esc(v)}</c:v></c:pt>`).join('')}`;

/**
 * @typedef {object} ChartSeries
 * @property {string} name Nombre en la leyenda.
 * @property {string} color Seis dígitos, sin `#`.
 * @property {string[]} [pointColors] Color de cada barra, si no van todas iguales.
 * @property {{ ref: string, values: string[] }} categories Celdas con los nombres y su contenido.
 * @property {{ ref: string, values: number[] }} values Celdas con los montos y su contenido.
 */

/**
 * @typedef {object} ChartSpec
 * @property {string} sheet Nombre de la hoja donde va.
 * @property {{ col: number, row: number }} from Esquina superior izquierda (columna y fila desde 0).
 * @property {{ col: number, row: number }} to Esquina inferior derecha.
 * @property {boolean} [horizontal] Barras acostadas, con el monto escrito en cada una.
 * @property {string} numFmt Formato de los montos.
 * @property {ChartSeries[]} series Una por color; con dos o más aparece la leyenda.
 */

/**
 * XML de un gráfico de barras.
 * @param {ChartSpec} spec
 * @returns {string}
 */
export function barChartXml({ horizontal = false, numFmt, series }) {
  const format = esc(numFmt);
  const labels = horizontal
    ? `<c:dLbls><c:numFmt formatCode="${format}" sourceLinked="0"/><c:spPr><a:noFill/><a:ln><a:noFill/></a:ln></c:spPr>` +
      `<c:showLegendKey val="0"/><c:showVal val="1"/><c:showCatName val="0"/><c:showSerName val="0"/><c:showPercent val="0"/><c:showBubbleSize val="0"/></c:dLbls>`
    : '';
  const ser = series
    .map((s, i) => {
      const points = (s.pointColors ?? [])
        .map(
          (rgb, j) =>
            `<c:dPt><c:idx val="${j}"/><c:invertIfNegative val="0"/><c:bubble3D val="0"/><c:spPr>${solid(rgb)}</c:spPr></c:dPt>`,
        )
        .join('');
      return (
        `<c:ser><c:idx val="${i}"/><c:order val="${i}"/><c:tx><c:v>${esc(s.name)}</c:v></c:tx><c:spPr>${solid(s.color)}</c:spPr>` +
        `<c:invertIfNegative val="0"/>${points}${labels}` +
        `<c:cat><c:strRef><c:f>${esc(s.categories.ref)}</c:f><c:strCache>${cache(s.categories.values)}</c:strCache></c:strRef></c:cat>` +
        `<c:val><c:numRef><c:f>${esc(s.values.ref)}</c:f><c:numCache><c:formatCode>${format}</c:formatCode>${cache(s.values.values)}</c:numCache></c:numRef></c:val></c:ser>`
      );
    })
    .join('');
  const axisLine = `<c:spPr><a:ln w="6350">${solid(LINE_COLOR)}</a:ln></c:spPr>`;
  // Acostadas: la primera categoría arriba y sin eje de montos (cada barra ya dice el suyo).
  const catAx =
    `<c:catAx><c:axId val="1"/><c:scaling><c:orientation val="${horizontal ? 'maxMin' : 'minMax'}"/></c:scaling><c:delete val="0"/>` +
    `<c:axPos val="${horizontal ? 'l' : 'b'}"/><c:numFmt formatCode="General" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/>` +
    `<c:tickLblPos val="nextTo"/>${axisLine}<c:crossAx val="2"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/><c:noMultiLvlLbl val="0"/></c:catAx>`;
  const valAx =
    `<c:valAx><c:axId val="2"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="${horizontal ? 1 : 0}"/>` +
    `<c:axPos val="${horizontal ? 'b' : 'l'}"/>${horizontal ? '' : `<c:majorGridlines>${axisLine}</c:majorGridlines>`}` +
    `<c:numFmt formatCode="${format}" sourceLinked="0"/><c:majorTickMark val="none"/><c:minorTickMark val="none"/><c:tickLblPos val="nextTo"/>` +
    `<c:spPr><a:ln><a:noFill/></a:ln></c:spPr><c:crossAx val="1"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx>`;
  const legend =
    series.length > 1 ? '<c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend>' : '';
  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<c:chartSpace xmlns:c="${NS_C}" xmlns:a="${NS_A}" xmlns:r="${NS_R}"><c:roundedCorners val="0"/><c:chart><c:autoTitleDeleted val="1"/>` +
    `<c:plotArea>${horizontal ? PLOT_WITH_LABEL_ROOM : '<c:layout/>'}<c:barChart><c:barDir val="${horizontal ? 'bar' : 'col'}"/><c:grouping val="clustered"/><c:varyColors val="0"/>${ser}` +
    `<c:gapWidth val="${horizontal ? 60 : 80}"/><c:axId val="1"/><c:axId val="2"/></c:barChart>${catAx}${valAx}</c:plotArea>${legend}` +
    `<c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart>` +
    `<c:spPr>${solid('FFFFFF')}<a:ln><a:noFill/></a:ln></c:spPr>` +
    `<c:txPr><a:bodyPr/><a:lstStyle/><a:p><a:pPr><a:defRPr sz="900">${solid(TEXT_COLOR)}</a:defRPr></a:pPr><a:endParaRPr lang="es-CO"/></a:p></c:txPr></c:chartSpace>`
  );
}

/**
 * Marco que ubica un gráfico sobre las celdas de la hoja.
 * @param {ChartSpec} spec
 * @param {number} n Número del gráfico en el libro.
 * @returns {string}
 */
function anchorXml({ from, to }, n) {
  const corner = (tag, { col, row }) =>
    `<xdr:${tag}><xdr:col>${col}</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:${tag}>`;
  return (
    `<xdr:twoCellAnchor editAs="oneCell">${corner('from', from)}${corner('to', to)}<xdr:graphicFrame macro="">` +
    `<xdr:nvGraphicFramePr><xdr:cNvPr id="${100 + n}" name="Gráfico ${n}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr>` +
    `<xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="${NS_C}">` +
    `<c:chart xmlns:c="${NS_C}" xmlns:r="${NS_R}" r:id="rIdChart${n}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`
  );
}

/**
 * Agrega gráficos de barras a un libro ya armado por exceljs.
 * @param {Buffer} xlsx Contenido del .xlsx.
 * @param {ChartSpec[]} charts
 * @returns {Promise<Buffer>} El .xlsx con los gráficos.
 * @throws {Error} Si la hoja no existe o no tiene dibujo (falta ponerle el logo).
 */
export async function addCharts(xlsx, charts) {
  if (charts.length === 0) return xlsx;
  const zip = await JSZip.loadAsync(xlsx);
  const read = (path) => zip.file(path).async('string');
  const workbook = await read('xl/workbook.xml');
  const workbookRels = await read('xl/_rels/workbook.xml.rels');
  let types = await read('[Content_Types].xml');

  /**
   * Ruta del dibujo de una hoja: nombre → id de relación → archivo de la hoja → su dibujo.
   * @param {string} sheet
   * @returns {Promise<string>} P. ej. `xl/drawings/drawing1.xml`.
   */
  const drawingOf = async (sheet) => {
    const rId = workbook.match(
      new RegExp(`<sheet [^>]*name="${esc(sheet)}"[^>]*r:id="([^"]+)"`),
    )?.[1];
    const file = workbookRels.match(new RegExp(`Id="${rId}"[^>]*Target="worksheets/([^"]+)"`))?.[1];
    const rels = zip.file(`xl/worksheets/_rels/${file}.rels`);
    const drawing =
      rels && (await rels.async('string')).match(/Target="\.\.\/drawings\/([^"]+)"/)?.[1];
    if (!drawing) throw new Error(`La hoja "${sheet}" no tiene dibujo donde poner el gráfico`);
    return `xl/drawings/${drawing}`;
  };

  for (const [i, spec] of charts.entries()) {
    const n = i + 1;
    const drawing = await drawingOf(spec.sheet);
    const relsPath = `${drawing.replace('drawings/', 'drawings/_rels/')}.rels`;
    zip.file(`xl/charts/chart${n}.xml`, barChartXml(spec));
    zip.file(
      drawing,
      (await read(drawing)).replace('</xdr:wsDr>', `${anchorXml(spec, n)}</xdr:wsDr>`),
    );
    zip.file(
      relsPath,
      (await read(relsPath)).replace(
        '</Relationships>',
        `<Relationship Id="rIdChart${n}" Type="${CHART_REL}" Target="../charts/chart${n}.xml"/></Relationships>`,
      ),
    );
    types = types.replace(
      '</Types>',
      `<Override PartName="/xl/charts/chart${n}.xml" ContentType="${CHART_TYPE}"/></Types>`,
    );
  }
  zip.file('[Content_Types].xml', types);
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
