
import { t } from '@/lib/i18n';/**
 * Rin, la mascota de Rinde: toda su lógica, sin React ni pantalla.
 *
 * Cuatro cosas distintas que nunca comparten variable:
 * 1. **Situación financiera** del usuario (`resolveSituation`): sale de reglas fijas sobre datos reales.
 * 2. **Evento** de interacción (`REACTIONS`): algo que acaba de pasar (anotó un gasto, volvió, lo tocó).
 * 3. **Emoción** de Rin (`EMOTIONS`): la cara y la postura con que acompaña.
 * 4. **Gesto** (`GESTURES`): la animación corta que está haciendo ahora.
 *
 * Rin solo representa: aquí no se calcula ni se cambia plata. Los días de cobertura salen del plan
 * de Mi plata (`money-plan.service.js`).
 */

/** Emociones de Rin. `tranquilo` es la neutral. */
export const EMOTIONS = [
  'tranquilo',
  'feliz',
  'sorprendido',
  'pensativo',
  'preocupado',
  'emocionado',
  'conmovido',
  'dormido',
  'curioso',
  'empatico',
];

/** Gestos: animaciones cortas, una a la vez. */
export const GESTURES = ['asentir', 'acomodarse', 'saltar', 'celebrar', 'saludar', 'senalar', 'acomodar', 'tambalear', 'toque', 'crecer', 'guinar', 'mirarmano'];

/** Días de cobertura desde los que la pila gana cada billete: 1, 4, 8, 15, 22 y 31 días. */
export const STACK_STEPS = [1, 4, 8, 15, 22, 31];

/** Días sin abrir la app desde los que Rin saluda al volver. */
export const RETURN_DAYS = 3;

/**
 * Billetes de la pila para unos días de cobertura.
 * @param {number|null|undefined} days
 * @returns {number} De 0 a `STACK_STEPS.length`.
 */
export function stackLevel(days) {
  if (days === null || days === undefined) return 0;
  return STACK_STEPS.filter((step) => days >= step).length;
}

/**
 * Para cuántos días alcanza la plata, según el plan de Mi plata.
 * `basis` dice de dónde sale: `ritmo` (plata libre ÷ gasto normal por día, la misma cuenta del
 * servidor), `plan` (con fecha de pago y sin historial: repartida hasta el pago) o `falta`.
 *
 * @param {object|null|undefined} plan Respuesta de `GET /money-profile/plan`.
 * @returns {{ days: number, basis: 'ritmo'|'plan'|'falta' }|null} `null` si faltan datos.
 */
export function coverage(plan) {
  if (!plan?.ready) return null;
  if (plan.shortfall > 0) return { days: 0, basis: 'falta' };
  if (plan.mode === 'runway' && typeof plan.runwayDays === 'number') return { days: plan.runwayDays, basis: 'ritmo' };
  if (plan.pace > 0) return { days: Math.floor(Math.max(0, plan.free) / plan.pace), basis: 'ritmo' };
  if (plan.mode === 'daily') return { days: plan.days, basis: 'plan' };
  return null;
}

const daysText = (days) => (days === 1 ? t('1 día') : t('{days} días', { days }));

/**
 * El indicador de cobertura en palabras.
 * @param {ReturnType<typeof coverage>} cover
 * @returns {{ label: string, value: string, note: string }}
 */
export function coverageText(cover) {
  if (!cover) return { label: t('Días de cobertura'), value: 'Sin datos', note: t('Aún no sé para cuántos días te alcanza') };
  if (cover.basis === 'falta') return { label: t('Tu plata hoy'), value: 'No cubre tus pagos', note: t('Contando los pagos que tienes pendientes') };
  if (cover.basis === 'plan') return { label: t('Cubierto hasta tu pago'), value: daysText(cover.days), note: t('Repartiendo tu plata libre día a día') };
  return { label: t('Tu plata te alcanza para'), value: daysText(cover.days), note: t('A tu ritmo de gasto de los últimos 30 días') };
}

/** Avisos del inicio que no dan espera: van antes que el límite del día. */
const URGENT_NOTICES = ['tarjeta_atrasada', 'presupuesto_superado', 'tarjeta_por_vencer', 'pago_pendiente', 'presupuesto_cerca'];

/**
 * Situación financiera del usuario, la más importante primero. Reglas fijas sobre datos reales:
 * plata que no cubre los pagos, el aviso del inicio (`pickHomeNotice`), el límite del día y, si no
 * hay nada, `en_plan`. Sin plan y sin avisos no se concluye nada: `sin_datos`.
 *
 * @param {{ plan?: object|null, notice?: { kind: string, to: string, title: string, detail: string }|null }} data
 * @returns {{ kind: string, plan?: object, notice?: object }}
 */
export function resolveSituation({ plan, notice }) {
  const ready = Boolean(plan?.ready);
  if (ready && plan.shortfall > 0) return { kind: 'pago_en_riesgo', plan };
  if (notice && URGENT_NOTICES.includes(notice.kind)) return { kind: notice.kind, notice };
  if (ready && plan.dayStatus === 'over') return { kind: 'dia_superado', plan };
  if (ready && plan.dayStatus === 'near') return { kind: 'dia_cerca', plan };
  if (notice) return { kind: notice.kind, notice };
  return { kind: ready ? 'en_plan' : 'sin_datos' };
}

/**
 * Cómo acompaña Rin una situación: emoción, lo que dice, el dato que lo explica y la acción.
 * Situación → expresión → explicación → acción. En `en_plan` Rin calla: el indicador basta.
 *
 * @param {{ kind: string, plan?: object, notice?: object }} situation
 * @param {(value: number) => string} money Formatea un monto (o lo oculta).
 * @returns {{ emotion: string, say: string|null, fact: string|null, action: { to: string, label: string }|null }}
 */
export function situationView({ kind, plan, notice }, money) {
  const fromNotice = (emotion, label, say = notice.title) => ({ emotion, say, fact: notice.detail, action: { to: notice.to, label } });
  switch (kind) {
    case 'pago_en_riesgo':
      return {
        emotion: 'empatico',
        say: t('Puede faltar dinero para algunos pagos. Miremos qué opciones tienes.'),
        fact: t('Te faltan {shortfall} para lo pendiente', { shortfall: money(plan.shortfall) }),
        action: { to: '/app/mi-plata', label: t('Ver mis pagos') },
      };
    case 'tarjeta_atrasada':
      return fromNotice('preocupado', t('Ver la tarjeta'));
    case 'presupuesto_superado':
      return fromNotice('pensativo', t('Revisar presupuesto'), t('Nos pasamos de lo previsto. ¿Revisamos cómo ajustar el resto?'));
    case 'tarjeta_por_vencer':
      return fromNotice('curioso', t('Ver la tarjeta'));
    case 'pago_pendiente':
      return fromNotice('curioso', t('Ver mis pagos'));
    case 'presupuesto_cerca':
      return fromNotice('curioso', t('Ver presupuestos'));
    case 'tarjeta_proxima':
      return fromNotice('tranquilo', t('Ver la tarjeta'));
    case 'dia_superado':
      return {
        emotion: 'pensativo',
        say: t('Hoy gastamos más de lo del día. Mañana tu plan se reparte de nuevo.'),
        fact: t('Te pasaste {overBy} hoy', { overBy: money(plan.overBy) }),
        action: { to: '/app/mi-plata', label: t('Ver Mi plata') },
      };
    case 'dia_cerca':
      return { emotion: 'curioso', say: t('Ya casi llegas a lo de hoy.'), fact: t('Te quedan {leftToday}', { leftToday: money(plan.leftToday) }), action: null };
    case 'sin_datos':
      return {
        emotion: 'tranquilo',
        say: t('Cuéntame cuánta plata tienes y cómo te entra, y te digo para cuántos días te alcanza.'),
        fact: null,
        action: { to: '/app/mi-plata', label: t('Configurar Mi plata') },
      };
    default:
      return { emotion: 'tranquilo', say: null, fact: null, action: null };
  }
}

/**
 * Reacciones a eventos. Cada paso es `[emoción, gesto, milisegundos]`; emoción `null` mantiene la
 * de la situación. Una reacción interrumpe a otra de prioridad igual o menor; una menor se descarta.
 * 0 manías de reposo · 1 toque · 2 billetes · 3 hábitos y saludos · 4 avisos · 5 logros.
 * Solo hablan las que tienen `say`; las manías, el toque y los billetes nunca.
 */
export const REACTIONS = {
  // Reposo: pequeñas manías, sin mensaje.
  acomodar: { priority: 0, steps: [[null, 'acomodar', 1400]] },
  tambalear: { priority: 0, steps: [[null, 'tambalear', 1200]] },
  mirar_mano: { priority: 0, steps: [['curioso', 'mirarmano', 1900]] },
  despertar: { priority: 1, steps: [['curioso', null, 700]] },
  // Tocarlo: tres respuestas que se turnan, para que no sea siempre la misma.
  toque: { priority: 1, steps: [['feliz', 'toque', 800]] },
  toque_guino: { priority: 1, steps: [['feliz', 'guinar', 1000]] },
  toque_saludo: { priority: 1, steps: [['feliz', 'saludar', 1500]] },
  explorar: { priority: 1, steps: [['curioso', null, 1800]] },
  // La pila cambió.
  // Rin da un saltito, el billete entra debajo y aterriza con un rebote.
  billete_llega: { priority: 2, steps: [['feliz', 'crecer', 1600], ['feliz', null, 700]] },
  billete_sale: { priority: 2, steps: [[null, 'acomodarse', 1000]] },
  // A. Gasto dentro del plan: no se pone triste porque bajó el saldo.
  gasto_en_plan: { priority: 3, say: t('Todo va según tu plan.'), steps: [['tranquilo', 'asentir', 900], ['tranquilo', 'acomodarse', 1000]] },
  // B. Se pasó un presupuesto: sorpresa moderada y luego piensa. El texto lo pone la situación.
  presupuesto_superado: { priority: 4, steps: [['sorprendido', null, 1000], ['pensativo', null, 1600]] },
  // C. ¿Puedo gastar esto?
  evaluando_compra: { priority: 3, steps: [['pensativo', null, 2200]] },
  compra_cabe: { priority: 3, say: t('Parece que cabe en tu presupuesto.'), steps: [['tranquilo', 'asentir', 1000], ['feliz', null, 1200]] },
  compra_riesgo: { priority: 4, say: t('Esta compra podría dejarte corto para tu próximo pago.'), steps: [['preocupado', null, 1400], ['empatico', null, 1400]] },
  compra_sin_datos: { priority: 3, say: t('Me faltan datos para decirte si cabe.'), steps: [['tranquilo', null, 1200]] },
  // D. Meta de ahorro cumplida: la celebración propia de Rin, lanzar su moneda.
  meta_cumplida: { priority: 5, say: t('¡Lo logramos! Mira hasta dónde llegaste.'), steps: [['sorprendido', null, 550], ['emocionado', 'celebrar', 1700], ['feliz', null, 1500]] },
  objetivo_personal: { priority: 5, say: t('Esto era importante para ti, y lo cumpliste.'), steps: [['conmovido', null, 2800]] },
  meta_creada: { priority: 3, say: t('Meta creada. Vamos paso a paso.'), steps: [['curioso', null, 700], ['feliz', 'asentir', 1000]] },
  aporte_meta: { priority: 3, say: t('Un paso más cerca.'), steps: [['feliz', 'asentir', 1100]] },
  bolsillos_repartidos: { priority: 3, say: t('Cada peso con su lugar.'), steps: [[null, 'acomodar', 1400], ['tranquilo', null, 800]] },
  // E. Los pagos próximos superan la plata: atención y luego señala, sin desplomarse.
  pago_en_riesgo: { priority: 4, steps: [['preocupado', null, 1100], ['empatico', 'senalar', 1900]] },
  // Entra a ver a Rin: un saludo corto.
  saludo: { priority: 3, say: t('¡Hola! Qué bueno verte.'), steps: [['feliz', 'saludar', 1600]] },
  // F. Volvió después de varios días: saludo cálido, nunca reproche.
  regreso: { priority: 3, say: t('¡Qué bueno verte! Revisemos cómo va todo.'), steps: [['curioso', null, 500], ['empatico', 'saludar', 1700]] },
  // G. Revisó sus finanzas: se premia el hábito de mirar, no el saldo.
  revision_hecha: { priority: 3, say: t('¡Bien! Ahora tienes más claro cómo va tu dinero.'), steps: [['tranquilo', 'acomodar', 1400], ['feliz', null, 1300]] },
};

/**
 * Qué reacción toca cuando los datos cambian. Se compara lo que había con lo que hay.
 * @param {{ before: { kind: string, level: number }, after: { kind: string, level: number }, saved?: string|null }} change
 *   `saved`: tipo del movimiento recién anotado (`gasto`, `ingreso`) o `null`.
 * @returns {string|null} Nombre en `REACTIONS`.
 */
export function reactionToChange({ before, after, saved = null }) {
  if (after.kind !== before.kind && (after.kind === 'presupuesto_superado' || after.kind === 'pago_en_riesgo')) return after.kind;
  // Solo se dice "va según tu plan" cuando hay plan y nada pendiente: sin datos no se afirma.
  if (saved === 'gasto' && after.kind === 'en_plan') return 'gasto_en_plan';
  if (after.level > before.level) return 'billete_llega';
  if (after.level < before.level) return 'billete_sale';
  return null;
}

/**
 * Días completos entre dos fechas AAAA-MM-DD.
 * @returns {number}
 */
export function daysSince(from, to) {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/**
 * Estado inicial de la máquina de Rin.
 * @param {string} [base] Emoción de la situación.
 */
export function initialRin(base = 'tranquilo') {
  return { base, emotion: base, gesture: null, priority: 0, steps: [], say: null, asleep: false, seq: 0 };
}

const applyStep = (state, [emotion, gesture]) => ({ ...state, emotion: emotion ?? state.base, gesture });

/**
 * Máquina de estados de Rin. Acciones:
 * - `{ type: 'base', emotion }` cambió la situación financiera. Durante una reacción se guarda para después.
 * - `{ type: 'evento', name }` pasó algo. Interrumpe solo si su prioridad es igual o mayor.
 * - `{ type: 'paso', seq }` terminó el paso actual. Un `seq` viejo (reacción interrumpida) se ignora.
 * - `{ type: 'silencio', seq }` Rin ya dijo lo suyo.
 * - `{ type: 'dormir' }` descanso tras un rato sin actividad. Cualquier evento lo despierta.
 *
 * `seq` cambia en cada paso: quien pone los temporizadores (`useRin`) lo usa para no cruzarlos.
 */
export function rinReducer(state, action) {
  switch (action.type) {
    case 'base': {
      if (action.emotion === state.base) return state;
      if (state.steps.length || state.gesture) return { ...state, base: action.emotion };
      return { ...state, base: action.emotion, emotion: action.emotion, asleep: false };
    }
    case 'evento': {
      const name = state.asleep && action.name.startsWith('toque') ? 'despertar' : action.name;
      const reaction = REACTIONS[name];
      if (!reaction || reaction.priority < state.priority) return state;
      const [first, ...rest] = reaction.steps;
      return {
        ...applyStep(state, first),
        steps: [first, ...rest],
        priority: reaction.priority,
        say: reaction.say ?? null,
        asleep: false,
        seq: state.seq + 1,
      };
    }
    case 'paso': {
      if (action.seq !== state.seq || state.steps.length === 0) return state;
      const rest = state.steps.slice(1);
      if (rest.length) return { ...applyStep(state, rest[0]), steps: rest, seq: state.seq + 1 };
      // `say` se queda un momento más: lo apaga `silencio`.
      return { ...state, emotion: state.base, gesture: null, steps: [], priority: 0, seq: state.seq + 1 };
    }
    case 'silencio':
      return action.seq === state.seq && state.say ? { ...state, say: null } : state;
    case 'dormir':
      return state.steps.length || state.asleep ? state : { ...state, emotion: 'dormido', asleep: true, say: null };
    default:
      return state;
  }
}

/** Respuestas al toque, en el orden en que se turnan. */
export const TAPS = ['toque', 'toque_guino', 'toque', 'toque_saludo'];

/**
 * Entradas de la máquina, con los mismos tipos que usa una máquina de estados de Rive (número,
 * booleano y disparador). Un archivo `.riv` con estas entradas reemplaza el dibujo sin tocar la lógica.
 */
export const RIVE_INPUTS = [
  { name: 'nivel', type: 'número', values: `0 a ${STACK_STEPS.length}`, drives: t('Billetes de la pila') },
  { name: 'emocion', type: 'número', values: `0 a ${EMOTIONS.length - 1}`, drives: t('Postura y cara (capa base)') },
  { name: 'gesto', type: 'disparador', values: t('{length} disparadores', { length: GESTURES.length }), drives: t('Animación corta (capa de gestos)') },
  { name: 'mirarX, mirarY', type: 'número', values: '-1 a 1', drives: t('Hacia dónde miran las pupilas') },
  { name: 'animado', type: 'booleano', values: t('sí o no'), drives: t('Reposo y gestos, o solo cambio de cara') },
];

/** Milisegundos del paso actual, o `null` si Rin está en reposo. */
export const currentStepMs = (state) => state.steps[0]?.[2] ?? null;
