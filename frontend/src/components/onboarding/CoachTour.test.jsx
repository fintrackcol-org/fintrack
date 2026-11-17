import { describe, expect, it } from 'vitest';
import { TOUR_STEPS } from '@/components/onboarding/CoachTour';

describe('CoachTour (FT-0071)', () => {
  it('recorrido corto de 5, una pregunta y el largo después', () => {
    const tramos = TOUR_STEPS.map((s) => s.tramo);
    expect(tramos.filter((t) => t === 'corto')).toHaveLength(5);
    expect(tramos.indexOf('pregunta')).toBe(5);
    expect(tramos.slice(6).every((t) => t === 'largo')).toBe(true);
  });

  it('cada paso tiene título corto y una frase', () => {
    for (const s of TOUR_STEPS) {
      expect(s.title.length).toBeLessThanOrEqual(40);
      expect(s.text.length).toBeGreaterThan(20);
    }
  });
});
