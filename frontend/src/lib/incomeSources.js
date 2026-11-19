import { BriefcaseBusiness, Bike, Gift, TrendingUp, Wallet } from 'lucide-react';
import { formatMoney } from '@/components/transactions/format';
import { t } from '@/lib/i18n';

/**
 * Fuentes de ingreso (FT-0060): las tarjetas de "¿Cómo te entra la plata?" y la conversión entre lo
 * que se escribe en el formulario (texto de `MoneyInput`) y lo que recibe la API.
 */

/** `tone`: color del ícono de cada fuente, de los tonos de categorías (manual visual, sección 3). */
export const SOURCE_KINDS = [
  { kind: 'sueldo', title: t('Sueldo fijo'), text: t('Te pagan lo mismo cada mes o quincena'), icon: Wallet, tone: 'bg-emerald-500/15 text-emerald-600' },
  { kind: 'comisiones', title: t('Sueldo + comisiones'), text: t('Una base fija y lo que vendas'), icon: TrendingUp, tone: 'bg-sky-500/15 text-sky-600' },
  { kind: 'proyectos', title: t('Por proyectos u honorarios'), text: t('Diseño, programación, asesorías…'), icon: BriefcaseBusiness, tone: 'bg-indigo-500/15 text-indigo-500' },
  { kind: 'diario', title: t('Por días o por apps'), text: t('Domicilios, Uber, ventas diarias'), icon: Bike, tone: 'bg-amber-500/15 text-amber-600' },
  { kind: 'mesada', title: t('Mesada o ayuda'), text: t('Lo que te dan tus papás u otra persona'), icon: Gift, tone: 'bg-pink-500/15 text-pink-500' },
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

/** Montos redondos en la moneda de la persona. */
const pesos = { format: (value) => formatMoney(Math.round(value)) };

/**
 * La frase de Mi plata sobre cuánto le entra al usuario.
 * @param {{ normal: number, lean: number, basis: string }} income Respuesta de `GET /money-profile/income`.
 * @returns {string|null} `null` si todavía no se sabe.
 */
export function incomeHeadline({ normal, lean, basis }) {
  if (basis === 'none' || normal <= 0) return null;
  if (lean >= normal) return t('Te entran unos {normal} al mes.', { normal: pesos.format(normal) });
  return t('En un mes normal te entran {normal}; en uno flaco, {lean}. Planeamos con el flaco para que no te coja la tarde.', { normal: pesos.format(normal), lean: pesos.format(lean) });
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
      return [money(source.amount) && t('{amount} al mes', { amount: money(source.amount) }), source.payDays.length && t('días {join}', { join: source.payDays.join(' y ') })]
        .filter(Boolean)
        .join(' · ') || t('Sueldo fijo');
    case 'comisiones':
      return money(source.amount) ? t('Base de {amount} + comisiones', { amount: money(source.amount) }) : t('Base + comisiones');
    case 'proyectos':
      return source.lastMonths.length ? t('Últimos meses: {join}', { join: source.lastMonths.map((m) => pesos.format(m)).join(', ') }) : t('Por proyectos');
    case 'diario':
      return [source.workDays && t('{workDays} días a la semana', { workDays: source.workDays }), money(source.amount) && t('{amount} en un día normal', { amount: money(source.amount) })]
        .filter(Boolean)
        .join(' · ') || t('Por días');
    default:
      return money(source.amount) ? `${money(source.amount)} ${source.frequency === 'mensual' ? 'al mes' : `cada ${source.frequency === 'quincenal' ? 'quincena' : 'semana'}`}` : t('Mesada');
  }
}
