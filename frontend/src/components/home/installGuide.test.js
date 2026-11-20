import { describe, expect, it } from 'vitest';
import { INSTALL_GUIDES, installPlatform } from './installGuide';

const UA = {
  iphoneSafari:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1',
  iphoneChrome:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1',
  iphoneInstagram:
    'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 350.0',
  ipadAsMac:
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
  androidChrome: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36',
  androidWhatsApp:
    'Mozilla/5.0 (Linux; Android 14; SM-A546E; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/130.0 Mobile Safari/537.36 WhatsApp/2.24',
  macChrome: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36',
  windowsFirefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:132.0) Gecko/20100101 Firefox/132.0',
};

describe('installPlatform', () => {
  it('en iPhone, cualquier navegador de verdad se instala desde Compartir', () => {
    expect(installPlatform(UA.iphoneSafari, 5)).toBe('ios');
    expect(installPlatform(UA.iphoneChrome, 5)).toBe('ios');
  });

  it('el iPad que se presenta como Mac se reconoce por la pantalla táctil', () => {
    expect(installPlatform(UA.ipadAsMac, 5)).toBe('ios');
    expect(installPlatform(UA.ipadAsMac, 0)).toBe('mac-safari');
  });

  it('los navegadores internos de otras apps piden abrir la página en el navegador del sistema', () => {
    expect(installPlatform(UA.iphoneInstagram, 5)).toBe('ios-inapp');
    expect(installPlatform(UA.androidWhatsApp, 5)).toBe('android-inapp');
  });

  it('Android, Chrome en Mac y Firefox en Windows', () => {
    expect(installPlatform(UA.androidChrome, 5)).toBe('android');
    expect(installPlatform(UA.macChrome, 0)).toBe('other');
    expect(installPlatform(UA.windowsFirefox, 0)).toBe('other');
  });

  it('cada caso tiene título y tres pasos', () => {
    for (const key of ['prompt', 'ios', 'ios-inapp', 'android', 'android-inapp', 'mac-safari', 'other']) {
      expect(INSTALL_GUIDES[key].title).toBeTruthy();
      expect(INSTALL_GUIDES[key].steps).toHaveLength(3);
    }
  });
});
