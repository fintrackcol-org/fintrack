import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import DashboardEmpty from '@/components/dashboard/DashboardEmpty';

const render = () =>
  renderToStaticMarkup(
    <MemoryRouter>
      <DashboardEmpty />
    </MemoryRouter>,
  );

describe('DashboardEmpty (FT-0004, Rinde v2)', () => {
  it('invita a anotar lo primero del mes', () => {
    const html = render();
    expect(html).toContain('Todavía no has anotado nada este mes');
    expect(html).toContain('Anotar mi primer gasto');
  });

  it('lleva a anotar con el tipo ya elegido, o a conectar WhatsApp', () => {
    const html = render();
    expect(html).toContain('href="/app/anotar?tipo=gasto"');
    expect(html).toContain('href="/app/anotar?tipo=ingreso"');
    expect(html).toContain('href="/app/cuenta#whatsapp"');
  });
});
