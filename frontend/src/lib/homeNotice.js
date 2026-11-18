import { displayLevel } from '@/lib/budgetLevel';
import { NETWORK_LABELS } from '@/lib/cardStyles';
import { dayAndMonth } from '@/lib/moneyPlan';
import { t } from '@/lib/i18n';

/** Días antes del pago en los que la tarjeta pasa por encima de un pago pendiente. */
const CARD_SOON_DAYS = 3;

const when = (days) => (days === 0 ? 'hoy' : days === 1 ? t('mañana') : t('en {days} días', { days }));
const cardName = (card) => `${NETWORK_LABELS[card.network] ?? card.name} ••${card.last4}`;

/**
 * El único aviso del inicio en el celular, el más urgente: tarjeta atrasada, presupuesto pasado,
 * tarjeta por vencer, pago pendiente, presupuesto cerca del límite y, por último, la próxima tarjeta.
 *
 * @param {{ cards?: object[], budgets?: object[], pending?: object[], names: Record<string, string>, money: (value: number) => string }} data
 * @returns {{ to: string, title: string, detail: string }|null}
 */
export function pickHomeNotice({ cards = [], budgets = [], pending = [], names, money }) {
  const unpaid = cards.filter((card) => !card.paidThisCycle).sort((a, b) => a.daysToPayment - b.daysToPayment);
  const nextCard = unpaid[0];
  const cardNotice = (title) => ({
    to: `/app/tarjetas/${nextCard.id}`,
    title,
    detail: `Debes ${money(nextCard.used)}`,
  });
  const budgetName = (budget) => names[budget.category] ?? budget.category;

  if (nextCard?.daysToPayment < 0) return cardNotice(t('Tu {nextCard} tiene el pago atrasado', { nextCard: cardName(nextCard) }));

  const exceeded = budgets.find((budget) => displayLevel(budget.alert) === 'exceeded_100');
  if (exceeded) {
    return {
      to: '/app/presupuestos',
      title: t('Te pasaste en {exceeded}', { exceeded: budgetName(exceeded) }),
      detail: `Llevas ${money(exceeded.consumed)} de ${money(exceeded.amount)}`,
    };
  }

  if (nextCard?.daysToPayment <= CARD_SOON_DAYS) {
    return cardNotice(t('Tu {nextCard} se paga {daysToPayment}', { nextCard: cardName(nextCard), daysToPayment: when(nextCard.daysToPayment) }));
  }

  if (pending[0]) {
    return {
      to: '/app/mi-plata',
      title: t('{name} vence el {date}', { name: pending[0].name, date: dayAndMonth(pending[0].date) }),
      detail: money(pending[0].amount),
    };
  }

  const warning = budgets.find((budget) => budget.alert.level === 'warning_80');
  if (warning) {
    return {
      to: '/app/presupuestos',
      title: t('{warning} ya casi llega al límite', { warning: budgetName(warning) }),
      detail: `Quedan ${money(Math.max(0, warning.amount - warning.consumed))}`,
    };
  }

  return nextCard ? cardNotice(t('Tu {nextCard} se paga {daysToPayment}', { nextCard: cardName(nextCard), daysToPayment: when(nextCard.daysToPayment) })) : null;
}
