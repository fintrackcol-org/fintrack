import { useMemo } from 'react';
import { Select } from '@/components/ui/select';
import { COUNTRIES, countryName, getRegion } from '@/lib/region';

/**
 * Lista de países con su nombre en el idioma de la persona, en orden alfabético. Es el `<select>`
 * del navegador: en el celular abre la rueda del sistema y se puede buscar tecleando.
 * @param {{ id: string, value: string, onChange: (code: string) => void } & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'onChange'>} props
 */
export default function CountrySelect({ id, value, onChange, ...props }) {
  const { language } = getRegion();
  const options = useMemo(
    () =>
      COUNTRIES.map(({ code }) => ({ code, name: countryName(code, language) })).sort((a, b) =>
        a.name.localeCompare(b.name, language),
      ),
    [language],
  );
  return (
    <Select id={id} value={value} onChange={(event) => onChange(event.target.value)} {...props}>
      {options.map(({ code, name }) => (
        <option key={code} value={code}>
          {name}
        </option>
      ))}
    </Select>
  );
}
