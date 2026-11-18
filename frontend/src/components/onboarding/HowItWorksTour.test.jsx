import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import HowItWorksTour, { TOUR_LENGTH, tourSteps } from '@/components/onboarding/HowItWorksTour';
import WelcomeIntro from '@/components/onboarding/WelcomeIntro';

const noop = () => {};

describe('saludo de la bienvenida', () => {
  it('saluda por el nombre y ofrece empezar o dejarlo para después', () => {
    const html = renderToStaticMarkup(<WelcomeIntro name="Ana" onStart={noop} onLater={noop} />);
    expect(html).toContain('Hola, Ana');
    expect(html).toContain('Tu plata tiene una historia.');
    expect(html).toContain('Empezar');
    expect(html).toContain('Ahora no');
  });

  it('sin nombre no deja un saludo a medias', () => {
    expect(renderToStaticMarkup(<WelcomeIntro name="" onStart={noop} onLater={noop} />)).not.toContain('Hola,');
  });
});

describe('HowItWorksTour (FT-0048)', () => {
  it('el primer paso pide la plata de hoy (FT-0057) y se muestran voz, vacas y WhatsApp', () => {
    const steps = tourSteps();
    expect(steps).toHaveLength(TOUR_LENGTH);
    expect(steps[0].text).toContain('cuánta plata tienes hoy');
    const titles = steps.map((s) => s.title).join(' ');
    expect(titles).toMatch(/hablando/);
    expect(titles).toMatch(/Vacas/);
    expect(titles).toMatch(/WhatsApp/);
  });

  it('cada paso se rotula como ejemplo y dice por cuál va', () => {
    const html = renderToStaticMarkup(<HowItWorksTour index={1} onNext={noop} onBack={noop} />);
    expect(html).toContain('Ejemplo');
    expect(html).toContain('Cómo funciona · 2 de 5');
    expect(html).toContain('Anota hablando');
    // En pesos colombianos el ejemplo habla en miles y lo anotado coincide con lo dicho.
    expect(html).toContain('“gasolina 40 mil”');
    expect(html).toMatch(/\$\s40\.000/);
  });
});
