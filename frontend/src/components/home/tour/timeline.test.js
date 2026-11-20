import { describe, expect, it } from 'vitest';
import {
  FADE_IN,
  FADE_OUT,
  GLIDE,
  GLIDE_LEAD,
  captionAt,
  entryTime,
  jumpFor,
  scrollAt,
  segmentAt,
  segmentForScroll,
  veilAt,
} from './timeline';

// La segunda sección llega bajando de corrido; la tercera, con fundido.
const SEGMENTS = [
  { start: 0, end: 5 },
  { start: 6, end: 10, move: 'glide' },
  { start: 11, end: 15 },
];
const TOPS = [0, 800, 2000];
const FADE = FADE_IN + FADE_OUT;

describe('segmentAt', () => {
  it('cambia de sección cuando empieza su transición, antes de la frase', () => {
    expect(segmentAt(0, SEGMENTS)).toBe(0);
    expect(segmentAt(6 - GLIDE_LEAD - 0.01, SEGMENTS)).toBe(0);
    expect(segmentAt(6 - GLIDE_LEAD, SEGMENTS)).toBe(1);
    expect(segmentAt(11 - FADE, SEGMENTS)).toBe(2);
    expect(segmentAt(99, SEGMENTS)).toBe(2);
  });
});

describe('captionAt', () => {
  it('el subtítulo no se adelanta: sigue la frase anterior durante la transición', () => {
    expect(captionAt(6 - GLIDE_LEAD, SEGMENTS)).toBe(0);
    expect(captionAt(6, SEGMENTS)).toBe(1);
    expect(captionAt(11 - FADE, SEGMENTS)).toBe(1);
  });
});

describe('scrollAt', () => {
  it('se queda arriba durante la primera frase', () => {
    expect(scrollAt(3, SEGMENTS, TOPS)).toBe(0);
  });

  it('bajada de corrido: avanza suave hasta la sección', () => {
    const from = 6 - GLIDE_LEAD;
    const mid = scrollAt(from + GLIDE / 2, SEGMENTS, TOPS);
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(800);
    expect(scrollAt(from + GLIDE, SEGMENTS, TOPS)).toBe(800);
    expect(scrollAt(9, SEGMENTS, TOPS)).toBe(800);
  });

  it('fundido: la página no se mueve hasta que el velo tapa, y ahí salta', () => {
    const from = 11 - FADE;
    expect(scrollAt(from + FADE_IN - 0.01, SEGMENTS, TOPS)).toBe(800);
    expect(scrollAt(from + FADE_IN, SEGMENTS, TOPS)).toBe(2000);
  });

  it('con movimiento reducido nada baja de corrido: todo es fundido', () => {
    expect(scrollAt(6 - FADE + FADE_IN - 0.01, SEGMENTS, TOPS, true)).toBe(0);
    expect(scrollAt(6 - FADE + FADE_IN, SEGMENTS, TOPS, true)).toBe(800);
  });
});

describe('veilAt', () => {
  it('tapa del todo justo en el salto y ya no está cuando empieza la frase', () => {
    const from = 11 - FADE;
    expect(veilAt(from, SEGMENTS)).toBe(0);
    expect(veilAt(from + FADE_IN / 2, SEGMENTS)).toBeCloseTo(0.5);
    expect(veilAt(from + FADE_IN, SEGMENTS)).toBeCloseTo(1);
    expect(veilAt(11, SEGMENTS)).toBeCloseTo(0);
    expect(veilAt(13, SEGMENTS)).toBe(0);
  });

  it('no hay velo en la primera sección ni en las de bajada de corrido', () => {
    expect(veilAt(2, SEGMENTS)).toBe(0);
    expect(veilAt(6 - GLIDE_LEAD + 0.2, SEGMENTS)).toBe(0);
    expect(veilAt(6 - FADE + FADE_IN, SEGMENTS, true)).toBeCloseTo(1);
  });
});

describe('segmentForScroll', () => {
  it('elige la última sección que ya pasó el 30% superior de la pantalla', () => {
    expect(segmentForScroll(0, TOPS, 1000)).toBe(0);
    expect(segmentForScroll(600, TOPS, 1000)).toBe(1);
    expect(segmentForScroll(1800, TOPS, 1000)).toBe(2);
  });
});

describe('entryTime', () => {
  it('entra a cada sección con su transición antes de la frase; el inicio, desde cero', () => {
    expect(entryTime(0, SEGMENTS)).toBe(0);
    expect(entryTime(1, SEGMENTS)).toBe(6 - GLIDE_LEAD);
    expect(entryTime(2, SEGMENTS)).toBe(11 - FADE);
  });
});

describe('jumpFor', () => {
  const NAMED = [{ id: 'inicio' }, { id: 'funcionalidades' }, { id: 'seguridad' }];

  it('un enlace a una sección del recorrido da su índice', () => {
    expect(jumpFor('#seguridad', NAMED)).toBe(2);
    expect(jumpFor('#funcionalidades', NAMED)).toBe(1);
  });

  it('una sección de la que la voz no habla (o el inicio) no salta: se pausa', () => {
    expect(jumpFor('#faq', NAMED)).toBe(-1);
    expect(jumpFor('#contenido', NAMED)).toBe(-1);
    expect(jumpFor('#inicio', NAMED)).toBe(-1);
  });
});
