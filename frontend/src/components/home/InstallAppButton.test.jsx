import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import InstallAppButton from '@/components/home/InstallAppButton';

// La hoja usa un portal al documento, que no existe en estas pruebas.
vi.mock('@/components/common/Sheet', () => ({ default: () => null }));

const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/130.0 Mobile Safari/537.36';

const renderOn = (userAgent, { standalone = false } = {}) => {
  vi.stubGlobal('navigator', { userAgent, platform: '', maxTouchPoints: 5 });
  vi.stubGlobal('window', { matchMedia: () => ({ matches: standalone }) });
  return renderToStaticMarkup(<InstallAppButton />);
};

afterEach(() => vi.unstubAllGlobals());

describe('InstallAppButton', () => {
  it('en iPhone sale siempre (Safari no avisa que se puede instalar) y solo en celular', () => {
    const html = renderOn(IPHONE);
    expect(html).toContain('Instalar app');
    expect(html).toContain('md:hidden');
  });

  it('no sale si ya está instalada', () => {
    expect(renderOn(IPHONE, { standalone: true })).toBe('');
  });

  it('en Android espera a que el navegador permita instalar', () => {
    expect(renderOn(ANDROID)).toBe('');
  });
});
