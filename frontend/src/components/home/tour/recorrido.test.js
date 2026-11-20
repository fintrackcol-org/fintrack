import { describe, expect, it } from 'vitest';
import script from './recorrido.json';
import { FADE_IN, FADE_OUT } from './timeline';

// Guarda del guion: se rehace cada vez que se regraba la voz (scripts/tour-words.mjs).
describe('recorrido.json', () => {
  const { duration, segments } = script;

  it('las secciones van en orden, sin encimarse, y caben en el audio', () => {
    segments.forEach((s, i) => {
      expect(s.end).toBeGreaterThan(s.start);
      if (i > 0) expect(s.start).toBeGreaterThan(segments[i - 1].end);
    });
    expect(duration).toBeGreaterThanOrEqual(segments.at(-1).end);
    expect(new Set(segments.map((s) => s.id)).size).toBe(segments.length);
  });

  it('cada sección empieza con su primera frase y las frases van en orden dentro de ella', () => {
    for (const s of segments) {
      expect(s.lines[0].start).toBe(s.start);
      s.lines.forEach((line, i) => {
        expect(line.start).toBeLessThan(s.end);
        if (i > 0) expect(line.start).toBeGreaterThan(s.lines[i - 1].start);
      });
    }
  });

  it('cada subtítulo cabe en el reproductor del celular (3 renglones)', () => {
    for (const line of segments.flatMap((s) => s.lines)) expect(line.text.length).toBeLessThanOrEqual(130);
  });

  it('el fundido entre secciones no empieza antes de la mitad de la frase anterior', () => {
    segments.slice(1).forEach((s, i) => {
      const previous = segments[i];
      expect(s.start - (FADE_IN + FADE_OUT)).toBeGreaterThan((previous.start + previous.end) / 2);
    });
  });
});
