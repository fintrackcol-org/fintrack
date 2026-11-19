import { describe, expect, it } from 'vitest';
import {
  EMOTIONS,
  GESTURES,
  REACTIONS,
  TAPS,
  coverage,
  coverageText,
  currentStepMs,
  daysSince,
  initialRin,
  reactionToChange,
  resolveSituation,
  rinReducer,
  situationView,
  stackLevel,
} from '@/lib/rin';

const money = (value) => `$${value}`;
const plan = (extra = {}) => ({ ready: true, mode: 'daily', days: 9, free: 300000, shortfall: 0, pace: null, dayStatus: 'ok', ...extra });
const notice = (kind) => ({ kind, to: '/app/presupuestos', title: 'Te pasaste en Mercado', detail: 'Llevas $520000 de $450000' });
const run = (state, ...actions) => actions.reduce(rinReducer, state);
const event = (name) => ({ type: 'evento', name });

describe('pila de billetes', () => {
  it('sin datos no hay billetes', () => {
    expect(stackLevel(null)).toBe(0);
    expect(stackLevel(0)).toBe(0);
  });

  it('gana un billete en 1, 4, 8, 15, 22 y 31 días', () => {
    expect([1, 3, 4, 7, 8, 14, 15, 22, 30, 31, 400].map(stackLevel)).toEqual([1, 1, 2, 2, 3, 3, 4, 5, 5, 6, 6]);
  });
});

describe('coverage', () => {
  it('sin plan no concluye nada', () => {
    expect(coverage(null)).toBeNull();
    expect(coverage({ ready: false })).toBeNull();
  });

  it('si la plata no cubre los pagos son cero días', () => {
    expect(coverage(plan({ shortfall: 80000, free: -80000, pace: 20000 }))).toEqual({ days: 0, basis: 'falta' });
  });

  it('con ritmo de gasto divide la plata libre, igual que el servidor', () => {
    expect(coverage(plan({ pace: 25000 }))).toEqual({ days: 12, basis: 'ritmo' });
    expect(coverage({ ready: true, mode: 'runway', runwayDays: 5, shortfall: 0, free: 1, pace: 1 })).toEqual({ days: 5, basis: 'ritmo' });
  });

  it('con fecha de pago y sin historial, cubre hasta el pago y lo dice', () => {
    expect(coverage(plan())).toEqual({ days: 9, basis: 'plan' });
    expect(coverageText(coverage(plan())).label).toBe('Cubierto hasta tu pago');
  });

  it('sin fecha de pago ni historial no inventa días', () => {
    expect(coverage({ ready: true, mode: 'runway', runwayDays: null, shortfall: 0, free: 90000, pace: null })).toBeNull();
    expect(coverageText(null).value).toBe('Sin datos');
  });
});

describe('resolveSituation', () => {
  it('la plata que no cubre los pagos va primero que cualquier aviso', () => {
    expect(resolveSituation({ plan: plan({ shortfall: 1 }), notice: notice('presupuesto_superado') }).kind).toBe('pago_en_riesgo');
  });

  it('un aviso urgente va antes que el límite del día, y una tarjeta lejana después', () => {
    expect(resolveSituation({ plan: plan({ dayStatus: 'over' }), notice: notice('presupuesto_cerca') }).kind).toBe('presupuesto_cerca');
    expect(resolveSituation({ plan: plan({ dayStatus: 'over' }), notice: notice('tarjeta_proxima') }).kind).toBe('dia_superado');
    expect(resolveSituation({ plan: plan(), notice: notice('tarjeta_proxima') }).kind).toBe('tarjeta_proxima');
  });

  it('sin plan y sin avisos son datos insuficientes, no "todo bien"', () => {
    expect(resolveSituation({ plan: null, notice: null }).kind).toBe('sin_datos');
    expect(resolveSituation({ plan: plan(), notice: null }).kind).toBe('en_plan');
  });
});

describe('situationView', () => {
  const view = (data) => situationView(resolveSituation(data), money);

  it('en plan Rin está tranquilo y calla', () => {
    expect(view({ plan: plan() })).toEqual({ emotion: 'tranquilo', say: null, fact: null, action: null });
  });

  it('un presupuesto pasado se explica con el dato y ofrece revisarlo, sin tristeza', () => {
    const result = view({ plan: plan(), notice: notice('presupuesto_superado') });
    expect(result.emotion).toBe('pensativo');
    expect(result.fact).toBe('Llevas $520000 de $450000');
    expect(result.action).toEqual({ to: '/app/presupuestos', label: 'Revisar presupuesto' });
  });

  it('un riesgo siempre lleva texto y acción: la cara no es lo único que avisa', () => {
    const result = view({ plan: plan({ shortfall: 80000 }) });
    expect(result.emotion).toBe('empatico');
    expect(result.fact).toContain('$80000');
    expect(result.action.to).toBe('/app/mi-plata');
  });

  it('sin datos queda neutral y orienta', () => {
    const result = view({ plan: { ready: false } });
    expect(result.emotion).toBe('tranquilo');
    expect(result.action.label).toBe('Configurar Mi plata');
  });
});

describe('lo que Rin puede decir', () => {
  const kinds = ['pago_en_riesgo', 'dia_superado', 'dia_cerca', 'sin_datos', 'en_plan'];
  const lines = [
    ...Object.values(REACTIONS).map((reaction) => reaction.say),
    ...kinds.map((kind) => situationView({ kind, plan: plan({ shortfall: 1, overBy: 1, leftToday: 1 }) }, money).say),
  ].filter(Boolean);

  it('nunca culpa, reprocha la ausencia ni promete', () => {
    const banned = /abandon|triste|culpa|decepci|mal hecho|deber[ií]as|no volviste|seguro que|garantiz|fracas/i;
    for (const line of lines) expect(line).not.toMatch(banned);
  });

  it('usa emociones y gestos que existen', () => {
    for (const { steps } of Object.values(REACTIONS)) {
      for (const [emotion, gesture, ms] of steps) {
        if (emotion) expect(EMOTIONS).toContain(emotion);
        if (gesture) expect(GESTURES).toContain(gesture);
        expect(ms).toBeGreaterThan(0);
      }
    }
  });

  it('las manías, el toque y los billetes no hablan', () => {
    for (const name of ['acomodar', 'tambalear', 'billete_llega', 'billete_sale', ...TAPS]) expect(REACTIONS[name].say).toBeUndefined();
  });
});

describe('reactionToChange', () => {
  const at = (kind, level = 2) => ({ kind, level });

  it('un gasto dentro del plan se celebra aunque baje la pila', () => {
    expect(reactionToChange({ before: at('en_plan', 3), after: at('en_plan', 2), saved: 'gasto' })).toBe('gasto_en_plan');
  });

  it('un gasto sin datos de plan no afirma que va según el plan', () => {
    expect(reactionToChange({ before: at('sin_datos', 0), after: at('sin_datos', 0), saved: 'gasto' })).toBeNull();
  });

  it('pasarse de un presupuesto gana sobre lo demás, solo la primera vez', () => {
    expect(reactionToChange({ before: at('en_plan'), after: at('presupuesto_superado'), saved: 'gasto' })).toBe('presupuesto_superado');
    expect(reactionToChange({ before: at('presupuesto_superado'), after: at('presupuesto_superado'), saved: 'gasto' })).toBeNull();
  });

  it('la pila que sube o baja se nota', () => {
    expect(reactionToChange({ before: at('en_plan', 2), after: at('en_plan', 3), saved: 'ingreso' })).toBe('billete_llega');
    expect(reactionToChange({ before: at('en_plan', 3), after: at('en_plan', 2) })).toBe('billete_sale');
  });
});

describe('máquina de estados', () => {
  it('recorre los pasos de una reacción y vuelve a la emoción de la situación', () => {
    let state = run(initialRin('tranquilo'), event('meta_cumplida'));
    expect(state).toMatchObject({ emotion: 'sorprendido', gesture: null, priority: 5, say: REACTIONS.meta_cumplida.say });
    expect(currentStepMs(state)).toBe(550);
    state = rinReducer(state, { type: 'paso', seq: state.seq });
    expect(state).toMatchObject({ emotion: 'emocionado', gesture: 'celebrar' });
    state = rinReducer(state, { type: 'paso', seq: state.seq });
    state = rinReducer(state, { type: 'paso', seq: state.seq });
    expect(state).toMatchObject({ emotion: 'tranquilo', gesture: null, priority: 0, steps: [] });
    expect(currentStepMs(state)).toBeNull();
  });

  it('una reacción menor no interrumpe a una mayor; una mayor sí', () => {
    const celebrating = run(initialRin(), event('meta_cumplida'));
    expect(run(celebrating, event('toque'))).toBe(celebrating);
    const tapped = run(initialRin(), event('toque'));
    expect(run(tapped, event('presupuesto_superado')).emotion).toBe('sorprendido');
  });

  it('ignora el temporizador de una reacción ya interrumpida', () => {
    const first = run(initialRin(), event('toque'));
    const second = run(first, event('regreso'));
    expect(rinReducer(second, { type: 'paso', seq: first.seq })).toBe(second);
  });

  it('si la situación cambia en plena reacción, la toma al terminar', () => {
    let state = run(initialRin('tranquilo'), event('toque'), { type: 'base', emotion: 'empatico' });
    expect(state.emotion).toBe('feliz');
    state = rinReducer(state, { type: 'paso', seq: state.seq });
    expect(state.emotion).toBe('empatico');
  });

  it('lo dicho se queda hasta el silencio, y un silencio viejo no lo borra', () => {
    let state = run(initialRin(), event('gasto_en_plan'));
    const stale = state.seq;
    state = rinReducer(state, { type: 'paso', seq: state.seq });
    state = rinReducer(state, { type: 'paso', seq: state.seq });
    expect(state.say).toBe('Todo va según tu plan.');
    expect(rinReducer(state, { type: 'silencio', seq: stale }).say).toBe('Todo va según tu plan.');
    expect(rinReducer(state, { type: 'silencio', seq: state.seq }).say).toBeNull();
  });

  it('duerme solo en reposo, y un toque lo despierta sin sobresalto', () => {
    const busy = run(initialRin(), event('regreso'));
    expect(rinReducer(busy, { type: 'dormir' })).toBe(busy);
    const asleep = rinReducer(initialRin(), { type: 'dormir' });
    expect(asleep).toMatchObject({ emotion: 'dormido', asleep: true });
    expect(run(asleep, event('toque_guino'))).toMatchObject({ emotion: 'curioso', asleep: false });
  });

  it('un evento desconocido no hace nada', () => {
    const state = initialRin();
    expect(run(state, event('no_existe'))).toBe(state);
  });
});

describe('daysSince', () => {
  it('cuenta días completos entre fechas', () => {
    expect(daysSince('2026-11-09', '2026-11-12')).toBe(3);
    expect(daysSince('2026-10-30', '2026-11-02')).toBe(3);
  });
});
