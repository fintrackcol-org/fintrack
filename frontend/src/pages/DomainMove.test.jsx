import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import DomainMove from './DomainMove';

// La lógica (enviar, limpiar y redirigir) se prueba en lib/domainMove.test.js.
describe('<DomainMove />', () => {
  it('avisa la mudanza, a dónde va y que está guardando lo pendiente', () => {
    const html = renderToStaticMarkup(
      <DomainMove deps={{ location: { pathname: '/app/vacas/unirse/ABC123', search: '', hash: '' } }} />,
    );
    expect(html).toContain('Rinde se mudó');
    expect(html).toContain('www.rindecol.online');
    expect(html).toContain('vuelve a iniciar sesión');
    expect(html).toContain('Guardando lo pendiente');
    expect(html).toContain('www.rindecol.online/app/vacas/unirse/ABC123');
  });
});
