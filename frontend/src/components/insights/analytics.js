import { formatMoney } from '@/components/transactions/format';
import { t } from '@/lib/i18n';
import { dateLocale, numberLocale } from '@/lib/region';

/**
 * Número con a lo sumo un decimal y coma decimal, como se escribe en Colombia (17,5).
 * @param {number} value
 * @returns {string}
 */
export function formatNumber(value) {
  return value.toLocaleString(numberLocale(), { maximumFractionDigits: 1 });
}

/** Nombre y tono de cada nivel del puntaje de salud financiera. */
export const LEVELS = {
  excellent: { label: t('Excelente'), tone: 'positive' },
  good: { label: t('Bien'), tone: 'positive' },
  attention: { label: t('Atención'), tone: 'caution' },
  risk: { label: t('En riesgo'), tone: 'negative' },
};

/**
 * Frase del ahorro. Con gastos mayores a los ingresos el porcentaje sale negativo y no se entiende
 * ("ahorras el -1.482 %"): se dice cuánto los superan.
 * @param {number|null} rate (ingresos − gastos) ÷ ingresos × 100.
 * @returns {string}
 */
export function savingsDetail(rate) {
  if (rate === null) return t('Aún no hay ingresos este mes');
  if (rate >= 0) return t('Ahorras el {rate} % de tus ingresos', { rate: formatNumber(rate) });
  // gastos ÷ ingresos = 1 − tasa
  const times = 1 - rate / 100;
  if (times >= 2) return t('Gastas {times} veces lo que ingresas', { times: formatNumber(times) });
  return t('Gastas un {formatNumber} % más de lo que ingresas', { formatNumber: formatNumber(-rate) });
}

/** Cómo se calcula cada parte del puntaje (la misma regla del backend, `analytics.service.js`). */
export const PART_FORMULAS = {
  savings:
    t('(Ingresos − gastos) ÷ ingresos. Ahorrar el 20 % o más da 25 puntos (regla 50/30/20); 0 % o menos, 0. Sin ingresos todavía, 12,5. Lo que apartas en Ahorro/Inversión no cuenta como gasto.'),
  budgets: t('Presupuestos del mes que no pasan del 100 %. Todos da 25 puntos; sin presupuestos, 12,5.'),
  stability:
    t('Gasto del mes frente al promedio de tus 3 meses anteriores. Igual o menos da 25 puntos; 30 % más, 0. Sin historial, 12,5.'),
  small_expenses: t('Gastos de $ 20.000 o menos, como parte de tu gasto. 5 % o menos da 25 puntos; 20 % o más, 0.'),
};

/**
 * La acción que más sube el puntaje: mira la parte con menos puntos (las que dependen del usuario
 * primero) y dice qué hacer, cuántos puntos puede ganar y a dónde ir.
 * @param {import('@/services/analyticsService').Analytics} data
 * @returns {{ title: string, detail: string, gain: number, to?: string, cta?: string }|null}
 *   `null` si todas las partes van bien (20 puntos o más).
 */
export function nextAction({ health, projection, smallExpenses, day, daysInMonth }) {
  const order = ['savings', 'small_expenses', 'budgets', 'stability'];
  const weakest = [...health.parts]
    .filter((p) => p.points < 20 && !(p.key === 'stability' && p.value === null))
    .sort((a, b) => a.points - b.points || order.indexOf(a.key) - order.indexOf(b.key))[0];
  if (!weakest) return null;
  const gain = Math.round(25 - weakest.points);
  const projected = projection.available ? projection.projected : projection.spent;

  switch (weakest.key) {
    case 'savings': {
      // Ingresos muy por debajo del gasto: lo más probable es que falte registrarlos.
      if (projection.income < projected * 0.25) {
        return {
          title: t('Registra tus ingresos del mes'),
          detail: t('Llevas {income} en ingresos frente a {projected} de gasto. Si ya te pagaron, regístralo: el ahorro cuenta con lo que ingresas.', { income: formatMoney(projection.income), projected: formatMoney(projected) }),
          gain,
          to: '/app/anotar?tipo=ingreso',
          cta: t('Registrar ingreso'),
        };
      }
      if (projection.balance < 0) {
        const perDay = Math.ceil(-projection.balance / (daysInMonth - day + 1));
        return {
          title: t('Baja el ritmo de gasto'),
          detail: t('Al ritmo actual te faltarían {formatMoney}. Gastar {perDay} menos por día te deja en cero.', { formatMoney: formatMoney(-projection.balance), perDay: formatMoney(perDay) }),
          gain,
        };
      }
      return {
        title: t('Aparta un poco más'),
        detail: t('Ahorrar el 20 % de tus ingresos ({formatMoney}) te da los 25 puntos.', { formatMoney: formatMoney(projection.income * 0.2) }),
        gain,
      };
    }
    case 'small_expenses':
      return {
        title: t('Recorta los gastos hormiga'),
        detail: t('Si bajas a la mitad tus gastos de {threshold} o menos, ahorras {formatMoney} este mes.', { threshold: formatMoney(smallExpenses.threshold), formatMoney: formatMoney(Math.round(smallExpenses.total / 2)) }),
        gain,
      };
    case 'budgets':
      return weakest.value === null
        ? {
            title: t('Crea tu primer presupuesto'),
            detail: t('Ponle un límite a tu mayor gasto: Rinde te avisa al llegar al 80 % y al pasarte.'),
            gain,
            to: '/app/presupuestos',
            cta: t('Crear presupuesto'),
          }
        : {
            title: t('Revisa tus presupuestos'),
            detail: t('Algunos ya se pasaron del límite. Ajusta el monto o frena esos gastos lo que queda del mes.'),
            gain,
            to: '/app/presupuestos',
            cta: t('Ver presupuestos'),
          };
    default:
      return {
        title: t('Vuelve a tu ritmo normal'),
        detail: t('Este mes gastas un {value} % más que tu promedio.', { value: formatNumber(weakest.value) }),
        gain,
      };
  }
}

/**
 * Nombre de cada parte del puntaje y frase con su dato.
 * @param {{ key: string, value: number|null }} part
 * @returns {{ label: string, detail: string }}
 */
export function describePart({ key, value }) {
  switch (key) {
    case 'savings':
      return {
        label: t('Ahorro'),
        detail: savingsDetail(value),
      };
    case 'budgets':
      return {
        label: t('Presupuestos'),
        detail: value === null ? t('Crea presupuestos para sumar aquí') : t('{value} sin pasarse del límite', { value }),
      };
    case 'stability':
      return {
        label: t('Estabilidad'),
        detail:
          value === null
            ? t('Falta historial de meses anteriores')
            : value <= 0
              ? t('Gastas {formatNumber} % menos que tu promedio', { formatNumber: formatNumber(Math.abs(value)) })
              : t('Gastas {value} % más que tu promedio', { value: formatNumber(value) }),
      };
    default:
      return { label: t('Gastos hormiga'), detail: t('{value} % de tu gasto', { value: formatNumber(value) }) };
  }
}

/**
 * Frase de la proyección de fin de mes.
 * @param {import('@/services/analyticsService').Analytics['projection']} projection
 * @returns {string}
 */
export function projectionMessage({ available, projected, income, balance }) {
  if (!available) return t('Desde el día 3 del mes te mostramos cuánto gastarás al cierre.');
  if (income === 0) return t('Al ritmo actual cerrarás el mes con {projected} en gastos.', { projected: formatMoney(projected) });
  if (balance >= 0) {
    return t('Al ritmo actual cerrarás el mes con {projected} en gastos: con lo que ha entrado, te sobrarían {balance}.', { projected: formatMoney(projected), balance: formatMoney(balance) });
  }
  return t('Al ritmo actual cerrarás el mes con {projected} en gastos: con lo que ha entrado, te faltarían {formatMoney}.', { projected: formatMoney(projected), formatMoney: formatMoney(-balance) });
}

/**
 * Frase de los gastos hormiga.
 * @param {import('@/services/analyticsService').Analytics['smallExpenses']} small
 * @returns {string}
 */
export function smallExpensesMessage({ threshold, count, total, share, yearly, flagged }) {
  const limit = formatMoney(threshold);
  if (count === 0) return t('Este mes no tienes gastos de {limit} o menos.', { limit });
  if (!flagged) return t('Solo {count} {v2} de {limit} o menos: vas bien.', { count, v2: count === 1 ? 'gasto' : 'gastos', limit });
  return t('{count} gastos de {limit} o menos suman {total} ({share} % de tu gasto). A este ritmo serían {yearly} en un año.', { count, limit, total: formatMoney(total), share: formatNumber(share), yearly: formatMoney(yearly) });
}

/**
 * Puntos del gráfico de ritmo de gasto: un punto por día del mes con lo gastado acumulado
 * (`real`, hasta hoy) y la proyección (`projection`, de hoy a fin de mes en línea recta hasta el
 * gasto proyectado). Hoy lleva los dos valores para que las líneas se unan.
 * @param {import('@/services/analyticsService').Analytics} data
 * @returns {Array<{ day: number, real?: number, projection?: number }>}
 */
export function paceSeries({ daily, day, daysInMonth, projection }) {
  const today = daily.at(-1)?.total ?? 0;
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    const point = { day: d };
    if (d <= day) point.real = daily[i]?.total ?? today;
    if (projection.available && d >= day) {
      const progress = daysInMonth === day ? 1 : (d - day) / (daysInMonth - day);
      point.projection = Math.round(today + (projection.projected - today) * progress);
    }
    return point;
  });
}

/**
 * Cuánto se puede gastar por día lo que queda del mes sin pasar de los ingresos (hoy incluido).
 * @param {{ projection: { income: number, spent: number }, day: number, daysInMonth: number }} data
 * @returns {number} 0 si ya no queda.
 */
export function dailyAllowance({ projection, day, daysInMonth }) {
  const left = projection.income - projection.spent;
  return Math.max(0, Math.floor(left / (daysInMonth - day + 1)));
}

/**
 * Cambio del puntaje frente al mes pasado.
 * @param {number} score
 * @param {number|null} previousScore
 * @param {string} month AAAA-MM del mes actual.
 * @returns {{ text: string, direction: 'up'|'down'|'same' }|null} `null` sin mes pasado para comparar.
 */
export function scoreChange(score, previousScore, month) {
  if (previousScore === null || previousScore === undefined) return null;
  const [year, m] = month.split('-').map(Number);
  const previousName = new Date(year, m - 2, 1).toLocaleDateString(dateLocale(), { month: 'long' });
  const diff = score - previousScore;
  if (diff === 0) return { text: t('Igual que en {previousName}', { previousName }), direction: 'same' };
  const points = Math.abs(diff) === 1 ? 'punto' : 'puntos';
  return {
    text: t('{v1} {diff} {points} frente a {previousName}', { v1: diff > 0 ? t('Subió') : t('Bajó'), diff: Math.abs(diff), points, previousName }),
    direction: diff > 0 ? 'up' : 'down',
  };
}
