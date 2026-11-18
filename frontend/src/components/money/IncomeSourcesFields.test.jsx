import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import IncomeSourcesFields from '@/components/money/IncomeSourcesFields';
import { emptyForm } from '@/lib/incomeSources';

describe('IncomeSourcesFields (FT-0060)', () => {
  it('cada fuente es una casilla: se anuncia que se pueden marcar varias', () => {
    const html = renderToStaticMarkup(<IncomeSourcesFields forms={{ sueldo: emptyForm('sueldo'), mesada: emptyForm('mesada') }} onChange={() => {}} />);
    expect(html.match(/role="checkbox"/g)).toHaveLength(5);
    expect(html.match(/aria-checked="true"/g)).toHaveLength(2);
    expect(html).toContain('puedes elegir varias');
  });

  it('solo las fuentes marcadas muestran sus preguntas de monto', () => {
    const none = renderToStaticMarkup(<IncomeSourcesFields forms={{}} onChange={() => {}} />);
    expect(none).not.toContain('¿Cuánto te pagan al mes?');
    const salary = renderToStaticMarkup(<IncomeSourcesFields forms={{ sueldo: emptyForm('sueldo') }} onChange={() => {}} />);
    expect(salary).toContain('¿Cuánto te pagan al mes?');
    expect(salary).not.toContain('¿Cuánto te dan cada vez?');
  });
});
