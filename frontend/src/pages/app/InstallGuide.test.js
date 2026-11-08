import { describe, expect, it } from 'vitest';
import { detectPlatform } from '@/pages/app/InstallGuide';

describe('detectPlatform (FT-0049)', () => {
  it('iPhone y iPad abren la pestaña de iPhone', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari')).toBe('ios');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari', 5)).toBe('ios');
  });

  it('Android y el computador abren la de Android', () => {
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/130')).toBe('android');
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/130', 0)).toBe('android');
  });
});
