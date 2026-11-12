import { reflectionTotals } from '../repositories/transactions.repository.js';
import { EMOTIONS, KAKEIBO_GROUPS } from '../validators/transactions.validator.js';
import { periodRange } from './transactions.service.js';

/**
 * Reflexión semanal de los gastos (FT-0070): cómo se sintió la persona con lo que gastó
 * (emociones) y en qué se le fue la plata según el Kakeibo (necesidad, deseo, cultura,
 * imprevisto), con preguntas para pensar. Va en Consejos.
 */

/** Emociones que cuentan como "no me convenció". */
const DOUBTFUL = ['no_lo_necesitaba', 'me_arrepiento'];

const cop = (n) => `$${Math.round(n).toLocaleString('es-CO')}`;
const sum = (values) => Math.round(values.reduce((acc, v) => acc + v, 0) * 100) / 100;

/**
 * @param {Array<{ count: number, total: number }>} rows
 * @returns {{ count: number, total: number }}
 */
function totals(rows) {
  return { count: rows.reduce((acc, r) => acc + r.count, 0), total: sum(rows.map((r) => r.total)) };
}

/**
 * Arma la reflexión a partir de los totales de la semana. Cálculo puro, sin base de datos.
 * @param {{ from: string, to: string, groups: Array<{ emotion: string|null, kakeibo: string|null, count: number, total: number }>, regrets: object[] }} data
 * @returns {{
 *   from: string, to: string,
 *   expenses: { count: number, total: number },
 *   withEmotion: number,
 *   emotions: Array<{ key: string, count: number, total: number }>,
 *   kakeibo: Array<{ key: string, count: number, total: number }>,
 *   withoutKakeibo: { count: number, total: number },
 *   regrets: object[],
 *   questions: string[]
 * }}
 *   `withEmotion`: cuántos gastos tienen emoción (la métrica de la propuesta). `emotions` y
 *   `kakeibo` traen siempre los cuatro grupos, en orden, aunque estén en cero.
 */
export function buildReflection({ from, to, groups, regrets }) {
  const expenses = totals(groups);
  const emotions = EMOTIONS.map((key) => ({ key, ...totals(groups.filter((g) => g.emotion === key)) }));
  const kakeibo = KAKEIBO_GROUPS.map((key) => ({ key, ...totals(groups.filter((g) => g.kakeibo === key)) }));
  const withEmotion = emotions.reduce((acc, e) => acc + e.count, 0);
  const withoutKakeibo = totals(groups.filter((g) => g.kakeibo === null));

  const byKey = (list, key) => list.find((x) => x.key === key);
  const doubtful = totals(emotions.filter((e) => DOUBTFUL.includes(e.key)));
  const questions = [];
  if (doubtful.count === 1) {
    questions.push(`Esta semana un gasto de ${cop(doubtful.total)} no te convenció. ¿Qué pasó antes de comprarlo?`);
  } else if (doubtful.count > 1) {
    questions.push(
      `Esta semana ${doubtful.count} gastos por ${cop(doubtful.total)} no te convencieron. ¿Qué tenían en común?`,
    );
  }
  const want = byKey(kakeibo, 'deseo');
  const need = byKey(kakeibo, 'necesidad');
  if (want.total > 0 && want.total > need.total) {
    questions.push(
      `Gastaste más en deseos (${cop(want.total)}) que en necesidades (${cop(need.total)}). ¿Cuáles repetirías?`,
    );
  }
  if (byKey(emotions, 'valio_la_pena').count > 0) questions.push('¿Cuál gasto valió más la pena y por qué?');
  if (expenses.count > 0) questions.push('¿Qué harías distinto la próxima semana?');

  return {
    from,
    to,
    expenses,
    withEmotion,
    emotions,
    kakeibo,
    withoutKakeibo,
    regrets,
    questions: questions.slice(0, 3),
  };
}

/**
 * Reflexión de la semana (lunes a domingo) que contiene `date`.
 * @param {string} userId
 * @param {string} date AAAA-MM-DD
 * @param {{ reflectionTotals?: typeof reflectionTotals }} [deps]
 * @returns {Promise<ReturnType<typeof buildReflection>>}
 */
export async function weeklyReflection(userId, date, deps = {}) {
  const { from, to } = periodRange('week', date);
  const data = await (deps.reflectionTotals ?? reflectionTotals)({ userId, from, to });
  return buildReflection({ from, to, ...data });
}
