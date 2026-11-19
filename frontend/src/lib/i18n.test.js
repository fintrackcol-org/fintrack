import { afterEach, describe, expect, it } from 'vitest';
import { loadMessages, t } from '@/lib/i18n';

afterEach(() => loadMessages('es'));

describe('textos en el idioma de la persona', () => {
  it('en español el texto sale igual y llena las variables', async () => {
    await loadMessages('es');
    expect(t('Guardar gasto')).toBe('Guardar gasto');
    expect(t('Te quedan {left}', { left: '$ 5' })).toBe('Te quedan $ 5');
  });

  it('en inglés y portugués traduce y lo que falta sale en español', async () => {
    await loadMessages('en');
    expect(t('Guardar gasto')).toBe('Save expense');
    expect(t('Te quedan {left}', { left: '$5' })).toBe('You have $5 left');
    expect(t('Texto que no existe')).toBe('Texto que no existe');
    await loadMessages('pt');
    expect(t('Guardar gasto')).toBe('Salvar gasto');
  });

  it('con dos cambios seguidos queda el último idioma elegido', async () => {
    await Promise.all([loadMessages('en'), loadMessages('pt')]);
    expect(t('Guardar gasto')).toBe('Salvar gasto');
  });
});
