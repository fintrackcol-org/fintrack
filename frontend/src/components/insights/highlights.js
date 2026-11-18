import { formatMoney } from '@/components/transactions/format';
import { t } from '@/lib/i18n';

/**
 * @typedef {object} Highlight
 * @property {'budget'|'top'|'balance'} kind Qué dato muestra (define el ícono).
 * @property {'positive'|'caution'|'negative'|'neutral'} tone Color de la tarjeta.
 * @property {string} title Frase corta.
 * @property {string} detail Cifra que la respalda.
 */

/**
 * Datos del mes hasta hoy para Insights mientras no hay un mes de historial (los consejos con IA
 * lo necesitan, REQ-021). Se calculan en el dispositivo con el resumen y los presupuestos, sin IA:
 * el presupuesto más cerca del límite, el mayor gasto y el balance (que también resta lo apartado en
 * ahorro). Sin movimientos, devuelve `[]`.
 *
 * @param {{ summary: import('@/services/summaryService').Summary, budgets: import('@/services/budgetService').Budget[], names: Record<string, string> }} data
 * @returns {Highlight[]}
 */
export function buildMonthHighlights({ summary, budgets, names }) {
  const income = summary.income.total;
  const expense = summary.expense.total;
  // Lo apartado en ahorro no es gasto, pero sí sale de lo que queda (igual que el balance de Inicio).
  const saved = summary.savings.total;
  const left = income - expense - saved;
  if (income === 0 && expense === 0 && saved === 0) return [];
  const name = (key) => (key ? (names[key] ?? key) : t('Sin clasificar'));
  const highlights = [];

  const tightest = [...budgets].sort((a, b) => b.percentage - a.percentage)[0];
  if (tightest) {
    const percent = `${Math.round(tightest.percentage)} %`;
    if (tightest.percentage === 100) {
      highlights.push({
        kind: 'budget',
        tone: 'caution',
        title: t('Ya usaste todo tu presupuesto de {category}', { category: name(tightest.category) }),
        detail: `Llevas ${formatMoney(tightest.consumed)} de ${formatMoney(tightest.amount)}`,
      });
    } else if (tightest.percentage > 100) {
      highlights.push({
        kind: 'budget',
        tone: 'negative',
        title: t('Te pasaste en {category}', { category: name(tightest.category) }),
        detail: `Llevas ${formatMoney(tightest.consumed)} de ${formatMoney(tightest.amount)}`,
      });
    } else if (tightest.percentage >= 80) {
      highlights.push({
        kind: 'budget',
        tone: 'caution',
        title: `${name(tightest.category)} va al ${percent}`,
        detail: t('Te quedan {formatMoney}', { formatMoney: formatMoney(tightest.amount - tightest.consumed) }),
      });
    } else {
      highlights.push({
        kind: 'budget',
        tone: 'positive',
        title: t('Tus presupuestos van bien'),
        detail: t('El más alto, {category}, va al {percent}', { category: name(tightest.category), percent }),
      });
    }
  }

  const top = summary.expense.byCategory[0];
  if (top) {
    highlights.push({
      kind: 'top',
      tone: 'neutral',
      title: t('Tu mayor gasto: {category}', { category: name(top.category) }),
      detail: t('{total}, el {percentage} % de tus gastos', { total: formatMoney(top.total), percentage: Math.round(top.percentage) }),
    });
  }

  if (income === 0) {
    highlights.push({
      kind: 'balance',
      tone: 'neutral',
      title: t('Llevas {expense} en gastos', { expense: formatMoney(expense) }),
      detail: t('Registra tus ingresos para ver cuánto te queda'),
    });
  } else if (left >= 0) {
    highlights.push({
      kind: 'balance',
      tone: 'positive',
      title: t('Te quedan {left}', { left: formatMoney(left) }),
      detail:
        saved > 0
          ? t('Entraron {income}, gastaste {expense} y apartaste {saved} para ahorro', { income: formatMoney(income), expense: formatMoney(expense), saved: formatMoney(saved) })
          : t('Entraron {income} y gastaste {expense}', { income: formatMoney(income), expense: formatMoney(expense) }),
    });
  } else {
    highlights.push({
      kind: 'balance',
      tone: 'negative',
      title: saved > 0 ? t('Entre gastos y ahorro salió más de lo que entró') : t('Gastaste más de lo que entró'),
      detail: t('{formatMoney} por encima de tus ingresos', { formatMoney: formatMoney(-left) }),
    });
  }

  return highlights;
}
