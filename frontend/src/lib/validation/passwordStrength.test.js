import { describe, expect, it } from 'vitest';
import { passwordStrength, registerSchema } from '@/lib/validation/auth';

describe('passwordStrength', () => {
  it('sube con largo, letras y números, y mayúscula o símbolo', () => {
    expect(passwordStrength('')).toMatchObject({ score: 0 });
    expect(passwordStrength('abc')).toMatchObject({ score: 0, label: 'Débil' });
    expect(passwordStrength('rinde2026')).toEqual({ score: 2, label: 'Media', tips: ['agrega una mayúscula o un símbolo'] });
    expect(passwordStrength('Rinde2026')).toEqual({ score: 3, label: 'Fuerte', tips: [] });
  });

  it('el registro pide nombre que no sea solo espacios, y ya no pide repetir la contraseña', () => {
    const ok = { name: 'Nico', email: 'a@b.co', password: 'rinde2026', acceptTerms: true };
    expect(registerSchema.safeParse(ok).success).toBe(true);
    expect(registerSchema.safeParse({ ...ok, name: '   ' }).error.issues[0].path).toEqual(['name']);
  });
});
