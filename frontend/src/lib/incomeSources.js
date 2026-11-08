import { BriefcaseBusiness, Bike, Gift, TrendingUp, Wallet } from 'lucide-react';

/**
 * Fuentes de ingreso (FT-0060): las tarjetas de "¿Cómo te entra la plata?" y la conversión entre lo
 * que se escribe en el formulario (texto de `MoneyInput`) y lo que recibe la API.
 */

export const SOURCE_KINDS = [
  { kind: 'sueldo', title: 'Sueldo fijo', text: 'Te pagan lo mismo cada mes o quincena', icon: Wallet },
  { kind: 'comisiones', title: 'Sueldo + comisiones', text: 'Una base fija y lo que vendas', icon: TrendingUp },
  { kind: 'proyectos', title: 'Por proyectos u honorarios', text: 'Diseño, programación, asesorías…', icon: BriefcaseBusiness },
  { kind: 'diario', title: 'Por días o por apps', text: 'Domicilios, Uber, ventas diarias', icon: Bike },
  { kind: 'mesada', title: 'Mesada o ayuda', text: 'Lo que te dan tus papás u otra persona', icon: Gift },
];

/** Lo que muestra el formulario de cada tipo al elegirlo. Todo es texto: `''` es "no lo dijo". */
export function emptyForm(kind) {
  switch (kind) {
    case 'sueldo':
      return { kind, amount: '', frequency: 'mensual', payDays: [] };
    case 'comisiones':
      return { kind, amount: '', low: '', high: '', payDays: [] };
    case 'proyectos':
      return { kind, lastMonths: ['', '', ''] };
    case 'diario':
      return { kind, amount: '', workDays: '6' };
    default:
      return { kind, amount: '', frequency: 'mensual', payDays: [] };
  }
}

const num = (text) => (text === '' || text === undefined || text === null ? null : Number(text));
const text = (value) => (value === null || value === undefined ? '' : String(Math.round(value)));

/**
 * Formulario → cuerpo de `PUT /money-profile/sources`. Lo vacío va en `null`.
 * @param {Record<string, object>} forms Por tipo, solo los elegidos.
 * @returns {object[]}
 */
export function toApiSources(forms) {
  return Object.values(forms).map((f) => ({
    kind: f.kind,
    frequency: f.frequency ?? (f.kind === 'diario' ? 'diario' : f.kind === 'proyectos' ? 'irregular' : 'mensual'),
    payDays: f.payDays ?? [],
    amount: num(f.amount),
    low: num(f.low),
    high: num(f.high),
    lastMonths: (f.lastMonths ?? []).map((m) => num(m) ?? 0).filter((m) => m > 0),
    workDays: f.kind === 'diario' ? num(f.workDays) : null,
  }));
}

/**
 * Lo guardado → formulario, para cambiarlo.
 * @param {object[]} sources Respuesta de la API.
 * @returns {Record<string, object>}
 */
export function fromApiSources(sources) {
  const forms = {};
  for (const s of sources) {
    const base = emptyForm(s.kind);
    forms[s.kind] = {
      ...base,
      ...(base.amount !== undefined && { amount: text(s.amount) }),
      ...(base.low !== undefined && { low: text(s.low), high: text(s.high) }),
      ...(base.frequency !== undefined && { frequency: s.frequency }),
      ...(base.payDays !== undefined && { payDays: s.payDays }),
      ...(base.lastMonths && { lastMonths: [0, 1, 2].map((i) => text(s.lastMonths[i])) }),
      ...(base.workDays !== undefined && { workDays: text(s.workDays) }),
    };
  }
  return forms;
}

/**
 * Elige o quita un tipo.
 * @param {Record<string, object>} forms
 * @param {string} kind
 * @returns {Record<string, object>}
 */
export function toggleKind(forms, kind) {
  if (forms[kind]) {
    const next = { ...forms };
    delete next[kind];
    return next;
  }
  return { ...forms, [kind]: emptyForm(kind) };
}

const pesos = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 });

/**
 * La frase de Mi plata sobre cuánto le entra al usuario.
 * @param {{ normal: number, lean: number, basis: string }} income Respuesta de `GET /money-profile/income`.
 * @returns {string|null} `null` si todavía no se sabe.
 */
export function incomeHeadline({ normal, lean, basis }) {
  if (basis === 'none' || normal <= 0) return null;
  if (lean >= normal) return `Te entran unos ${pesos.format(normal)} al mes.`;
  return `En un mes normal te entran ${pesos.format(normal)}; en uno flaco, ${pesos.format(lean)}. Planeamos con el flaco para que no te coja la tarde.`;
}

/**
 * Una línea por fuente, para la lista de Mi plata.
 * @param {object} source De la API.
 * @returns {string}
 */
export function sourceSummary(source) {
  const money = (v) => (v ? pesos.format(v) : null);
  switch (source.kind) {
    case 'sueldo':
      return [money(source.amount) && `${money(source.amount)} al mes`, source.payDays.length && `días ${source.payDays.join(' y ')}`]
        .filter(Boolean)
        .join(' · ') || 'Sueldo fijo';
    case 'comisiones':
      return money(source.amount) ? `Base de ${money(source.amount)} + comisiones` : 'Base + comisiones';
    case 'proyectos':
      return source.lastMonths.length ? `Últimos meses: ${source.lastMonths.map((m) => pesos.format(m)).join(', ')}` : 'Por proyectos';
    case 'diario':
      return [source.workDays && `${source.workDays} días a la semana`, money(source.amount) && `${money(source.amount)} en un día normal`]
        .filter(Boolean)
        .join(' · ') || 'Por días';
    default:
      return money(source.amount) ? `${money(source.amount)} ${source.frequency === 'mensual' ? 'al mes' : `cada ${source.frequency === 'quincenal' ? 'quincena' : 'semana'}`}` : 'Mesada';
  }
}
