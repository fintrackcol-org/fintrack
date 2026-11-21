import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import InstallAppButton from '@/components/home/InstallAppButton';

const renderOn = ({ standalone = false } = {}) => {
  vi.stubGlobal('window', { matchMedia: () => ({ matches: standalone }) });
  return renderToStaticMarkup(<InstallAppButton />);
};

afterEach(() => vi.unstubAllGlobals());

describe('InstallAppButton', () => {
  it('sin instalador del navegador (iPhone, otra app) lleva a la guía de "App instalable", solo en celular', () => {
    const html = renderOn();
    expect(html).toContain('href="#app"');
    expect(html).toContain('Instalar app');
    expect(html).toContain('md:hidden');
  });

  it('no sale si ya está instalada', () => {
    expect(renderOn({ standalone: true })).toBe('');
  });
});
