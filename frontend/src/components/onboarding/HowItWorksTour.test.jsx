import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HowItWorksTour, { TOUR_STEPS } from '@/components/onboarding/HowItWorksTour';

describe('HowItWorksTour (FT-0048)', () => {
  it('empieza con el saludo y los dos caminos', () => {
    const html = renderToStaticMarkup(<HowItWorksTour name="Ana" onDone={() => {}} />);
    expect(html).toContain('Hola, Ana');
    expect(html).toContain('Ver cómo funciona');
    expect(html).toContain('Saltar, ya me ubico');
  });

  it('el primer paso pide la plata de hoy (FT-0057) y se muestran voz, vacas y WhatsApp', () => {
    expect(TOUR_STEPS[0].text).toContain('cuánta plata tienes hoy');
    const titles = TOUR_STEPS.map((s) => s.title).join(' ');
    expect(titles).toMatch(/hablando/);
    expect(titles).toMatch(/Vacas/);
    expect(titles).toMatch(/WhatsApp/);
  });
});
