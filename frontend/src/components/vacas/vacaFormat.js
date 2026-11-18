/**
 * Textos y estilos compartidos de La Vaca Inteligente (FT-0014/FT-0015).
 */
import { formatDate, formatMoney } from '@/components/transactions/format';
import { t as tr } from '@/lib/i18n';
import { numberLocale } from '@/lib/region';

const percent = new Intl.NumberFormat(numberLocale(), { maximumFractionDigits: 1 });

/**
 * @param {number} value
 * @returns {string} p. ej. `62,5 %`.
 */
export function formatPercent(value) {
  return `${percent.format(value)} %`;
}

/**
 * Monto en pesos sin centavos: al repartir una meta entre varios quedan cuotas como
 * $ 4.166.666,67, que no ayudan a leer. Los totales exactos siguen en el servidor.
 * @param {number} value
 * @returns {string} p. ej. `$ 4.166.667`.
 */
export function formatPesos(value) {
  return formatMoney(Math.round(value));
}

/** Etiqueta y colores de cada estado de un miembro. */
export const MEMBER_STATUS = {
  cumplido: { label: tr('Cumplió'), chip: 'bg-positive/15 text-positive', bar: 'bg-positive' },
  al_dia: { label: tr('Al día'), chip: 'bg-brand-soft text-brand', bar: 'bg-brand' },
  atrasado: { label: tr('Atrasado'), chip: 'bg-caution/15 text-caution', bar: 'bg-caution' },
  pendiente: { label: tr('Le falta'), chip: 'bg-ink/10 text-ink/70', bar: 'bg-brand' },
};

/** Etiqueta y colores del estado de la vaca. */
export const VACA_STATUS = {
  activa: { label: tr('Activa'), chip: 'bg-brand-soft text-brand', bar: 'bg-brand' },
  completada: { label: tr('Meta cumplida'), chip: 'bg-positive/15 text-positive', bar: 'bg-positive' },
  vencida: { label: tr('Venció'), chip: 'bg-negative/15 text-negative', bar: 'bg-negative' },
};

/**
 * Dominio público de la app para los enlaces que se comparten (`VITE_APP_URL`, p. ej.
 * `https://fintrackcol.online`). Sin la variable, el dominio en el que se abrió la app.
 * @returns {string} Sin barra final.
 */
export function appOrigin() {
  const configured = import.meta.env.VITE_APP_URL?.trim();
  return (configured || window.location.origin).replace(/\/+$/, '');
}

/**
 * Enlace para invitar a la vaca (lo abre la PWA; si no hay sesión, pasa por el login y vuelve).
 * @param {string} code
 * @param {string} [origin]
 * @returns {string}
 */
export function inviteLink(code, origin = appOrigin()) {
  return `${origin}/app/vacas/unirse/${code}`;
}

/**
 * Hoy en el dispositivo, AAAA-MM-DD (sin pasar por UTC).
 * @param {Date} [now]
 * @returns {string}
 */
export function todayIso(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Frase corta sobre el plazo: días que faltan, si ya venció o que no tiene fecha.
 * @param {{ deadline: string|null, projection: import('@/services/vacaService').VacaProjection, status: string }} vaca
 * @param {{ withDate?: boolean }} [options] Sin la fecha (`withDate: false`) cabe en tarjetas y cifras.
 * @returns {string}
 */
export function deadlineText({ deadline, projection, status }, { withDate = true } = {}) {
  if (!deadline) return tr('Sin fecha límite');
  const date = formatDate(deadline);
  if (status === 'completada') return withDate ? tr('Fecha límite: {date}', { date }) : tr('Cumplida');
  const days = projection.daysLeft;
  if (days < 0) return withDate ? tr('Venció el {date}', { date }) : tr('Venció');
  if (days === 0) return withDate ? tr('Vence hoy ({date})', { date }) : tr('Vence hoy');
  const left = days === 1 ? tr('Falta 1 día') : tr('Faltan {days} días', { days });
  return withDate ? `${left} · ${date}` : left;
}

/** Textos de la lectura del ritmo: al grupo (vaca) o a una persona (meta personal). */
const GROUP = {
  done: tr('¡Meta cumplida! Ya juntaron toda la plata.'),
  empty: tr('Aún no hay aportes. Con el primero calculamos el ritmo del grupo.'),
  complete: 'completan',
  keep: tr('Sigan aportando para ver cuándo completan la meta.'),
  onTime: tr('Van a tiempo'),
  late: 'no llegan',
  would: tr('terminarían'),
  need: tr('Necesitan'),
  each: tr(' entre todos'),
};
const SOLO = {
  done: tr('¡Meta cumplida! Ya tienes toda la plata.'),
  empty: tr('Aún no has apartado nada. Con el primer aporte calculamos tu ritmo.'),
  complete: 'completas',
  keep: tr('Sigue aportando para ver cuándo completas la meta.'),
  onTime: tr('Vas a tiempo'),
  late: 'no llegas',
  would: tr('terminarías'),
  need: tr('Necesitas'),
  each: '',
};

/**
 * Lectura "inteligente" del ritmo: si llegan a tiempo, cuánto hace falta por semana y la fecha
 * estimada. Sale de la proyección que calcula el servidor.
 * @param {{ deadline: string|null, projection: import('@/services/vacaService').VacaProjection, status: string, total: number, personal?: boolean }} vaca
 * @returns {{ tone: 'positive'|'caution'|'neutral', text: string }}
 */
export function projectionText({ deadline, projection, status, total, personal = false }) {
  // A una meta personal se le habla en singular; a una vaca, al grupo.
  const t = personal ? SOLO : GROUP;
  if (status === 'completada') return { tone: 'positive', text: t.done };
  if (total === 0) return { tone: 'neutral', text: t.empty };
  const estimated = projection.estimatedDate ? formatDate(projection.estimatedDate) : null;
  if (status === 'vencida') {
    return { tone: 'caution', text: tr('Pasó la fecha límite y faltan {remaining}.', { remaining: formatPesos(projection.remaining) }) };
  }
  if (!deadline) {
    return {
      tone: 'neutral',
      text: estimated
        ? tr('A este ritmo ({averagePerDay} por día) {complete} la meta hacia el {estimated}.', { averagePerDay: formatPesos(projection.averagePerDay), complete: t.complete, estimated })
        : t.keep,
    };
  }
  if (projection.onTrack) {
    return {
      tone: 'positive',
      text: tr('{onTime}: a este ritmo {complete} la meta hacia el {estimated}.', { onTime: t.onTime, complete: t.complete, estimated }),
    };
  }
  return {
    tone: 'caution',
    text: tr('A este ritmo {late}{v2}. {need} {formatPesos} por semana{each}.', { late: t.late, v2: estimated ? ` (${t.would} hacia el ${estimated})` : '', need: t.need, formatPesos: formatPesos(projection.neededPerWeek ?? projection.remaining), each: t.each }),
  };
}
