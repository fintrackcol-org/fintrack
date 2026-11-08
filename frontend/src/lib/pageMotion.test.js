import { describe, expect, it } from 'vitest';
import { PAGE_SPRING, pageVariants } from '@/lib/pageMotion';

describe('pageVariants (FT-0050)', () => {
  const phone = pageVariants({ reduced: false, wide: false });

  it('al avanzar, la nueva entra por la derecha y la anterior se corre a la izquierda', () => {
    expect(phone.enter(1).x).toBe('100%');
    expect(phone.exit(1).x).toBe('-28%');
  });

  it('al volver, el mismo camino al revés', () => {
    expect(phone.enter(-1).x).toBe('-28%');
    expect(phone.exit(-1).x).toBe('100%');
  });

  it('resorte sin rebote', () => {
    expect(PAGE_SPRING.bounce).toBe(0);
  });

  it('con movimiento reducido solo hay fundido, sin desplazamientos', () => {
    const reduced = pageVariants({ reduced: true, wide: false });
    expect(JSON.stringify(reduced)).not.toContain('"x"');
  });
});
