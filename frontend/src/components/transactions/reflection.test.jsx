import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { EMOTIONS, KAKEIBO, emotionOf, kakeiboOf, toggle } from './reflection';
import { EmotionPicker, KakeiboPicker } from './ReflectionPickers';
import { kakeiboSegments, weekRange } from '@/components/insights/WeeklyReflection';

describe('emociones y Kakeibo (FT-0070)', () => {
  it('usa las mismas claves que la API, en orden', () => {
    expect(EMOTIONS.map((e) => e.key)).toEqual(['valio_la_pena', 'normal', 'no_lo_necesitaba', 'me_arrepiento']);
    expect(KAKEIBO.map((k) => k.key)).toEqual(['necesidad', 'deseo', 'cultura', 'imprevisto']);
  });

  it('tocar la opción elegida la quita; tocar otra la cambia', () => {
    expect(toggle(null, 'normal')).toBe('normal');
    expect(toggle('normal', 'normal')).toBeNull();
    expect(toggle('normal', 'me_arrepiento')).toBe('me_arrepiento');
  });

  it('una clave desconocida o vacía no tiene etiqueta', () => {
    expect(emotionOf('inventada')).toBeNull();
    expect(kakeiboOf(null)).toBeNull();
    expect(emotionOf('valio_la_pena').label).toBe('Valió la pena');
  });

  it('las caras marcan la elegida con aria-pressed', () => {
    const html = renderToStaticMarkup(<EmotionPicker value="normal" onChange={() => {}} />);
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    expect(html).toContain('Me arrepiento');
  });

  it('el Kakeibo muestra la pista del grupo elegido', () => {
    const html = renderToStaticMarkup(<KakeiboPicker value="cultura" onChange={() => {}} />);
    expect(html).toContain('Lo que te hace crecer');
  });
});

describe('reflexión de la semana (FT-0070)', () => {
  it('nombra la semana en una línea', () => {
    expect(weekRange('2026-11-09', '2026-11-15')).toBe('Del 9 al 15 de noviembre');
    expect(weekRange('2026-11-30', '2026-12-06')).toBe('Del 30 de noviembre al 6 de diciembre');
  });

  it('reparte el total entre los grupos y "Sin grupo"', () => {
    const segments = kakeiboSegments({
      expenses: { count: 3, total: 100000 },
      kakeibo: [
        { key: 'necesidad', count: 1, total: 50000 },
        { key: 'deseo', count: 1, total: 25000 },
        { key: 'cultura', count: 0, total: 0 },
        { key: 'imprevisto', count: 0, total: 0 },
      ],
      withoutKakeibo: { count: 1, total: 25000 },
    });
    expect(segments.map((s) => [s.key, s.share])).toEqual([
      ['necesidad', 50],
      ['deseo', 25],
      ['cultura', 0],
      ['imprevisto', 0],
      ['sin_grupo', 25],
    ]);
  });

  it('sin gastos todo queda en 0 %', () => {
    const empty = { count: 0, total: 0 };
    const segments = kakeiboSegments({ expenses: empty, kakeibo: [], withoutKakeibo: empty });
    expect(segments.every((s) => s.share === 0)).toBe(true);
  });
});
