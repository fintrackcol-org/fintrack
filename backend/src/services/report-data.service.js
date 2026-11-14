import { listCategories } from '../repositories/categories.repository.js';
import { listForExport } from '../repositories/transactions.repository.js';
import { findUserById } from '../repositories/users.repository.js';
import * as budgets from './budgets.service.js';
import { addDays } from './liquidity.logic.js';

const DEFAULT_TIMEZONE = 'America/Bogota';
const TOP_EXPENSES = 5;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Redondea a centavos: las sumas de decimales en JS dejan residuos (0.1 + 0.2).
 * @param {number} n
 * @returns {number}
 */
const cents = (n) => Math.round(n * 100) / 100;

/**
 * @param {string} from AAAA-MM-DD
 * @param {string} to AAAA-MM-DD
 * @returns {boolean} `true` si el rango es un mes completo (del día 1 al último día).
 */
export function isWholeMonth(from, to) {
  const [year, month] = from.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate(); // día 0 del mes siguiente
  return from.endsWith('-01') && to === `${from.slice(0, 8)}${String(lastDay).padStart(2, '0')}`;
}

/**
 * Días del rango, ambos incluidos. Las fechas se tratan en UTC para que no influya el horario.
 * @param {string} from AAAA-MM-DD
 * @param {string} to AAAA-MM-DD
 * @returns {number}
 */
export function daysBetween(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY_MS) + 1;
}

/**
 * Agrupa movimientos por categoría: total, número de movimientos y participación en el total.
 * @param {Array<{ categoryName: string|null, amount: number }>} rows
 * @param {number} total
 * @returns {Array<{ name: string, amount: number, count: number, share: number }>} De mayor a menor.
 */
function byCategory(rows, total) {
  const groups = new Map();
  for (const row of rows) {
    const name = row.categoryName ?? 'Sin clasificar';
    const group = groups.get(name) ?? { name, amount: 0, count: 0 };
    group.amount += row.amount;
    group.count += 1;
    groups.set(name, group);
  }
  return [...groups.values()]
    .map((g) => ({ ...g, amount: cents(g.amount), share: total > 0 ? g.amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);
}

const moneyFormat = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  maximumFractionDigits: 0,
});
const percentFormat = new Intl.NumberFormat('es-CO', {
  style: 'percent',
  maximumFractionDigits: 1,
});

/**
 * @param {number} n
 * @returns {string} Pesos sin decimales, p. ej. `$ 18.000`.
 */
export const money = (n) => moneyFormat.format(n);

/**
 * @param {number} n Proporción (0.445 = 44,5 %).
 * @returns {string}
 */
export const percent = (n) => percentFormat.format(n);

/**
 * @param {string} iso AAAA-MM-DD
 * @param {Intl.DateTimeFormatOptions} options
 * @returns {string} Fecha en español sin pasar por la zona horaria del servidor.
 */
export const dateText = (iso, options) => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('es-CO', {
    ...options,
    timeZone: 'UTC',
  });
};

/** Hasta cuántos días el periodo se muestra día por día, y hasta cuántos semana por semana. */
const DAILY_UP_TO = 31;
const WEEKLY_UP_TO = 92;

/**
 * Ingresos y gastos del periodo en tramos seguidos: por día, por semana (bloques de 7 días desde
 * `from`) o por mes, según lo largo del periodo. Llega solo hasta `lastDay`: no rellena días que
 * todavía no han pasado. Los tramos sin movimientos salen en cero.
 * @param {Array<{ date: string, type: string, amount: number }>} rows
 * @param {string} from AAAA-MM-DD
 * @param {string} lastDay AAAA-MM-DD, último día con datos posibles (el fin del periodo u hoy).
 * @returns {{ granularity: 'day'|'week'|'month', points: Array<{ from: string, to: string, income: number, expense: number }> }}
 */
export function buildSeries(rows, from, lastDay) {
  if (lastDay < from) return { granularity: 'day', points: [] };
  const days = daysBetween(from, lastDay);
  const granularity = days <= DAILY_UP_TO ? 'day' : days <= WEEKLY_UP_TO ? 'week' : 'month';

  const points = [];
  for (let start = from; start <= lastDay;) {
    let end = start;
    if (granularity === 'week') end = addDays(start, 6);
    if (granularity === 'month') {
      const [y, m] = start.split('-').map(Number);
      end = new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10); // último día de ese mes
    }
    if (end > lastDay) end = lastDay;
    points.push({ from: start, to: end, income: 0, expense: 0 });
    start = addDays(end, 1);
  }
  for (const row of rows) {
    const point = points.find((p) => row.date >= p.from && row.date <= p.to);
    if (point) point[row.type === 'ingreso' ? 'income' : 'expense'] += row.amount;
  }
  for (const p of points) {
    p.income = cents(p.income);
    p.expense = cents(p.expense);
  }
  return { granularity, points };
}

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/**
 * Nombre corto de un tramo de la serie: `3 nov`, `29 oct – 4 nov` o `nov 2026`.
 * @param {{ from: string, to: string }} point
 * @param {'day'|'week'|'month'} granularity
 * @returns {string}
 */
export function pointLabel(point, granularity) {
  const short = (iso) => `${Number(iso.slice(8))} ${MONTHS[Number(iso.slice(5, 7)) - 1]}`;
  if (granularity === 'month')
    return `${MONTHS[Number(point.from.slice(5, 7)) - 1]} ${point.from.slice(0, 4)}`;
  if (granularity === 'day' || point.from === point.to) return short(point.from);
  const sameMonth = point.from.slice(0, 7) === point.to.slice(0, 7);
  return `${sameMonth ? Number(point.from.slice(8)) : short(point.from)} – ${short(point.to)}`;
}

/** Desde cuántas categorías de gasto tiene sentido hablar de concentración. */
const CONCENTRATION_FROM = 4;

/**
 * Hallazgos del periodo, escritos con reglas fijas sobre cifras ya calculadas (ninguna IA calcula
 * nada). Describen qué pasó; no opinan si estuvo bien o mal ni comparan con periodos que el
 * reporte no trae.
 * @param {{ totals: object, expenseByCategory: Array<{ name: string, amount: number, share: number }>, topExpenseDay: { date: string, amount: number, count: number }|null }} summary
 * @returns {Array<{ kind: string, title: string, detail: string }>} Entre 0 y 4 hallazgos.
 */
export function buildInsights({ totals, expenseByCategory, topExpenseDay }) {
  const insights = [];
  const [top] = expenseByCategory;
  if (top) {
    insights.push({
      kind: 'top-category',
      title: `${top.name} fue la categoría con más gasto`,
      detail: `${money(top.amount)}, el ${percent(top.share)} de tus gastos.`,
    });
  }
  if (totals.balance !== 0) {
    const positive = totals.balance > 0;
    const share =
      positive && totals.income > 0 ? `, el ${percent(totals.savingsRate)} de tus ingresos` : '';
    insights.push({
      kind: 'balance',
      title: positive ? 'Entró más de lo que salió' : 'Salió más de lo que entró',
      detail: `${positive ? 'Ingresos menos gastos' : 'Gastos menos ingresos'}: ${money(Math.abs(totals.balance))}${share}. Es el balance del periodo, no tu saldo en el banco.`,
    });
  }
  if (topExpenseDay) {
    const n = topExpenseDay.count;
    insights.push({
      kind: 'top-day',
      title: `El ${dateText(topExpenseDay.date, { day: 'numeric', month: 'long' })} fue el día de mayor gasto`,
      detail: `${money(topExpenseDay.amount)} en ${n} ${n === 1 ? 'movimiento' : 'movimientos'}.`,
    });
  }
  if (expenseByCategory.length >= CONCENTRATION_FROM) {
    const three = expenseByCategory.slice(0, 3);
    insights.push({
      kind: 'concentration',
      title: `Tres categorías concentran el ${percent(three.reduce((s, c) => s + c.share, 0))} del gasto`,
      detail: `${three.map((c) => c.name).join(', ')}.`,
    });
  }
  return insights;
}

/**
 * Calcula todas las cifras del reporte a partir de los movimientos del periodo.
 * Es una función pura (sin base de datos), así se prueba con datos inventados.
 *
 * @param {Awaited<ReturnType<typeof listForExport>>} rows Movimientos en orden cronológico.
 * @param {{ from: string, to: string, today: string }} period `today` en la zona del usuario: el
 *   promedio diario se calcula solo sobre los días que ya pasaron.
 * @returns {object} Totales, categorías, top de gastos y meses (ver `buildReport`).
 */
export function summarize(rows, { from, to, today }) {
  const expenses = rows.filter((r) => r.type === 'gasto');
  const incomes = rows.filter((r) => r.type === 'ingreso');
  const income = cents(incomes.reduce((sum, r) => sum + r.amount, 0));
  const expense = cents(expenses.reduce((sum, r) => sum + r.amount, 0));
  const balance = cents(income - expense);

  // En un periodo que incluye días futuros ("este mes" a mitad de mes) se promedia hasta hoy.
  const lastCountedDay = to < today ? to : today;
  const daysElapsed = Math.max(1, from <= lastCountedDay ? daysBetween(from, lastCountedDay) : 1);

  const months = new Map();
  for (const row of rows) {
    const key = row.date.slice(0, 7);
    const month = months.get(key) ?? { month: key, income: 0, expense: 0 };
    month[row.type === 'ingreso' ? 'income' : 'expense'] += row.amount;
    months.set(key, month);
  }

  // Día con más gasto; a igual monto gana el más antiguo.
  const perDay = new Map();
  for (const row of expenses) {
    const day = perDay.get(row.date) ?? { date: row.date, amount: 0, count: 0 };
    day.amount += row.amount;
    day.count += 1;
    perDay.set(row.date, day);
  }
  const [topDay] = [...perDay.values()].sort(
    (a, b) => b.amount - a.amount || a.date.localeCompare(b.date),
  );

  const summary = {
    totals: {
      income,
      expense,
      balance,
      // Balance del periodo como parte de los ingresos. Sin ingresos no tiene sentido (null).
      savingsRate: income > 0 ? balance / income : null,
      dailyAverageExpense: cents(expense / daysElapsed),
      daysElapsed,
      count: rows.length,
      expenseCount: expenses.length,
      incomeCount: incomes.length,
    },
    expenseByCategory: byCategory(expenses, expense),
    topExpenseDay: topDay ? { ...topDay, amount: cents(topDay.amount) } : null,
    // Hasta hoy, o hasta el último movimiento si alguno quedó anotado con fecha futura.
    series: buildSeries(
      rows,
      from,
      rows.length > 0 && rows.at(-1).date > lastCountedDay ? rows.at(-1).date : lastCountedDay,
    ),
    incomeByCategory: byCategory(incomes, income),
    topExpenses: [...expenses]
      .sort((a, b) => b.amount - a.amount || a.date.localeCompare(b.date))
      .slice(0, TOP_EXPENSES),
    byMonth: [...months.values()].map((m) => ({
      month: m.month,
      income: cents(m.income),
      expense: cents(m.expense),
      balance: cents(m.income - m.expense),
    })),
  };
  return { ...summary, insights: buildInsights(summary) };
}

/**
 * Fecha de hoy (AAAA-MM-DD) en una zona horaria; si la zona no es válida, la de Colombia.
 * @param {string} timeZone
 * @returns {string}
 */
function todayIn(timeZone) {
  const format = (tz) => new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(new Date());
  try {
    return format(timeZone);
  } catch {
    return format(DEFAULT_TIMEZONE);
  }
}

/**
 * Datos completos del reporte de un periodo, compartidos por el Excel y el PDF (FT-0012).
 * Si el periodo es un mes completo incluye los presupuestos de ese mes.
 * @param {string} userId
 * @param {{ from: string, to: string }} period Fechas AAAA-MM-DD ya validadas.
 * @returns {Promise<object|null>} `null` si no hay movimientos en el periodo.
 */
export async function buildReport(userId, { from, to }) {
  const rows = await listForExport({ userId, from, to });
  if (rows.length === 0) return null;

  const user = await findUserById(userId);
  const timeZone = user?.timezone ?? DEFAULT_TIMEZONE;
  const today = todayIn(timeZone);
  const summary = summarize(rows, { from, to, today });

  let monthBudgets = [];
  if (isWholeMonth(from, to)) {
    const [list, categories] = await Promise.all([
      budgets.list(userId, from.slice(0, 7)),
      listCategories(userId),
    ]);
    const names = new Map(categories.map((c) => [c.key, c.name]));
    monthBudgets = list.map((b) => ({
      category: names.get(b.category) ?? b.category,
      limit: b.amount,
      spent: b.consumed,
      available: cents(b.amount - b.consumed),
      usage: b.amount > 0 ? b.consumed / b.amount : 0,
      // RN-04 avisa desde el 100 %, pero en el reporte gastar justo el límite no es excederlo.
      level: b.consumed === b.amount ? 'at_limit' : b.alert.level,
    }));
  }

  return {
    period: { from, to, wholeMonth: isWholeMonth(from, to) },
    owner: { name: user?.name ?? null, email: user?.email ?? '' },
    generatedOn: today,
    ...summary,
    budgets: monthBudgets,
    rows,
  };
}
