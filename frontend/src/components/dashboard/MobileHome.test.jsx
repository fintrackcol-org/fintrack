import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import MobileHome from '@/components/dashboard/MobileHome';

vi.mock('@/auth/AuthContext', () => ({ useAuth: () => ({ user: { name: 'Nico' } }) }));
vi.mock('@/components/layout/NotificationsProvider', () => ({ useNotifications: () => ({ unread: 0 }) }));

const plan = {
  ready: true,
  mode: 'daily',
  money: 412300,
  pendingTotal: 273000,
  free: 139300,
  shortfall: 0,
  perDay: 13900,
  nextPay: '2026-11-20',
  pending: [
    { id: 'pila', name: 'PILA', amount: 228000, date: '2026-11-13' },
    { id: 'cel', name: 'Plan celular', amount: 45000, date: '2026-11-15' },
    { id: 'visa', name: 'Visa', amount: 180000, date: '2026-11-25' },
  ],
};

const render = (props) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <MobileHome
        balance={412300}
        totals={{ income: 700000, expense: 287700 }}
        names={{}}
        monthLabel="noviembre"
        empty={false}
        hidden={false}
        onToggleHidden={() => {}}
        {...props}
      />
    </MemoryRouter>,
  );

describe('MobileHome (Rinde v5)', () => {
  it('con el plan listo: la cifra libre, lo próximo (2 pagos) y este mes', () => {
    const html = render({ plan });
    expect(html).toContain('Libre para gastar · estimado');
    expect(html).toContain('¿De dónde sale?');
    expect(html).toContain('Lo próximo');
    expect(html).toContain('PILA');
    expect(html).toContain('Plan celular');
    expect(html).not.toContain('Visa');
    expect(html).toContain('Este mes');
    expect(html).toContain('href="/app/ingresos"');
    expect(html).toContain('href="/app/gastos"');
  });

  it('si no alcanza, dice cuánto falta en vez de la cifra libre', () => {
    const html = render({ plan: { ...plan, free: -180700, shortfall: 180700 } });
    expect(html).toContain('Te faltan · estimado');
    expect(html).not.toContain('Libre para gastar');
  });

  it('sin plan (sin conexión o sin configurar) vuelve a la tarjeta de Mi plata', () => {
    const html = render({ plan: null });
    expect(html).not.toContain('Libre para gastar');
    expect(html).not.toContain('Lo próximo');
    expect(html).toContain('Este mes');
  });

  it('muestra «Por confirmar» solo si hay pagos esperando', () => {
    expect(render({ plan, toConfirm: 3 })).toContain('3 pagos que llegaron solos');
    expect(render({ plan, toConfirm: 0 })).not.toContain('Por confirmar');
  });
});
