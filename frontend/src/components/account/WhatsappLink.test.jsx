import { describe, expect, it } from 'vitest';
import { chatUrl } from '@/components/account/WhatsappLink';
import { monthUsage } from '@/pages/app/WhatsappAdmin';

describe('chatUrl', () => {
  it('abre el chat del bot con el código escrito', () => {
    expect(chatUrl('15551773374', 'FT-AB23CD45')).toBe('https://wa.me/15551773374?text=FT-AB23CD45');
  });
});

describe('monthUsage', () => {
  it('avisa desde el 80 % y se llena al llegar al tope', () => {
    expect(monthUsage({ sent: 100, max: 900 })).toEqual({ percent: 11, left: 800, level: 'ok' });
    expect(monthUsage({ sent: 720, max: 900 }).level).toBe('warn');
    expect(monthUsage({ sent: 950, max: 900 })).toEqual({ percent: 100, left: 0, level: 'full' });
  });
});
