import { describe, expect, it } from 'vitest';
import { chromeIntentUrl, inAppBrowser } from './google';

const UA = {
  whatsappAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E Build/UP1A; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0.0.0 Mobile Safari/537.36 WhatsApp/2.24',
  webviewAndroid:
    'Mozilla/5.0 (Linux; Android 13; Pixel 7; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/129.0.0.0 Mobile Safari/537.36',
  chromeAndroid:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36',
  whatsappIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
  instagramIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0',
  safariIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
  chromeIos:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  desktop:
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
};

describe('inAppBrowser', () => {
  it('detecta los navegadores internos', () => {
    expect(inAppBrowser(UA.whatsappAndroid)).toBe('android');
    expect(inAppBrowser(UA.webviewAndroid)).toBe('android');
    expect(inAppBrowser(UA.whatsappIos)).toBe('ios');
    expect(inAppBrowser(UA.instagramIos)).toBe('ios');
  });

  it('deja pasar los navegadores normales', () => {
    expect(inAppBrowser(UA.chromeAndroid)).toBeNull();
    expect(inAppBrowser(UA.safariIos)).toBeNull();
    expect(inAppBrowser(UA.chromeIos)).toBeNull();
    expect(inAppBrowser(UA.desktop)).toBeNull();
  });
});

describe('chromeIntentUrl', () => {
  it('abre la misma página en Chrome y vuelve a ella si no hay Chrome', () => {
    const url = chromeIntentUrl({ host: 'rinde.app', pathname: '/login', search: '?a=1', href: 'https://rinde.app/login?a=1' });
    expect(url).toBe(
      'intent://rinde.app/login?a=1#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=https%3A%2F%2Frinde.app%2Flogin%3Fa%3D1;end',
    );
  });
});
