import { getRegion, regionFormats } from "@/lib/region";
import { t } from '@/lib/i18n';

/**
 * Utilidades para escribir montos con los separadores de miles del país de la persona.
 *
 * El campo guarda siempre un texto "crudo" con solo dígitos y un punto decimal opcional
 * (por ejemplo `"1234567.5"`), que es lo que entiende `z.coerce.number()` y lo que se envía a
 * la API. Lo que se ve en pantalla (`1.234.567,5` en Colombia, `1,234,567.5` en Estados Unidos)
 * se calcula a partir de ese texto, así que el formato nunca cambia el valor.
 */

/** Monto máximo que acepta la API (numeric(12,2)); coincide con los esquemas de validación. */
export const MAX_AMOUNT = 9_999_999_999.99;
/** A partir de aquí se avisa que el monto es inusualmente grande. */
export const LARGE_AMOUNT = 100_000_000;
/** Dígitos enteros máximos que se dejan escribir (el tope de la API tiene 10). */
const MAX_INTEGER_DIGITS = 10;
const MAX_DECIMALS = 2;

/**
 * Convierte lo que se escribe en el campo en texto crudo. El decimal es el del país (la coma en
 * Colombia); los separadores de miles se ignoran porque los agrega el propio campo. Limita los
 * dígitos a 10 enteros y 2 decimales.
 * @param {string} text Texto del campo (con o sin separadores).
 * @returns {string} Por ejemplo `"1234.5"`, `"12."` (mientras se escribe el decimal) o `""`.
 */
export function parseMoneyInput(text) {
  const { decimal } = regionFormats();
  const cleaned = String(text ?? "").replace(new RegExp(`[^\\d${decimal}]`, "g"), "");
  const [integerPart, ...rest] = cleaned.split(decimal);
  const integer = integerPart
    .replace(/^0+(?=\d)/, "")
    .slice(0, MAX_INTEGER_DIGITS);
  if (rest.length === 0) return integer;
  const decimals = rest.join("").slice(0, MAX_DECIMALS);
  return `${integer || "0"}.${decimals}`;
}

/**
 * Interpreta un texto pegado, donde sí hay que adivinar el separador: en Colombia `1500.50` y
 * `1.500.000` son cosas distintas. Un único separador "del otro sistema" seguido de 1 o 2 dígitos
 * es decimal; en los demás casos es separador de miles.
 * @param {string} text
 * @returns {string} Texto crudo, como en {@link parseMoneyInput}.
 */
export function parsePastedMoney(text) {
  const value = String(text ?? "").trim();
  const { decimal } = regionFormats();
  const other = decimal === "," ? "." : ",";
  if (new RegExp(`^\\d+\\${other}\\d{1,2}$`).test(value))
    return parseMoneyInput(value.replace(other, decimal));
  return parseMoneyInput(value);
}

/**
 * Texto crudo → texto con separadores de miles para mostrar.
 * @param {string} raw Por ejemplo `"1234567.5"`.
 * @returns {string} Por ejemplo `"1.234.567,5"` en Colombia.
 */
export function formatMoneyInput(raw) {
  if (!raw) return "";
  const { group, decimal } = regionFormats();
  const [integer, decimals] = String(raw).split(".");
  const grouped = integer.replace(/\B(?=(\d{3})+(?!\d))/g, group);
  return decimals === undefined ? grouped : `${grouped}${decimal}${decimals}`;
}

/**
 * Describe el monto escrito para dar retroalimentación mientras se teclea.
 * @param {string} raw Texto crudo del campo.
 * @returns {{ level: 'none'|'info'|'warning'|'error', message: string }}
 */
export function describeAmount(raw) {
  const value = Number(raw);
  if (!raw || !Number.isFinite(value) || value <= 0)
    return { level: "none", message: "" };
  // "de pesos" y "menos de $1.000" solo tienen sentido en pesos colombianos.
  const pesos = getRegion().currency === "COP";
  const unit = pesos ? t(' de pesos') : "";
  if (value > MAX_AMOUNT) {
    return {
      level: "error",
      message: t('Supera el máximo permitido ({MAX_AMOUNT}).', { MAX_AMOUNT: regionFormats().money(MAX_AMOUNT) }),
    };
  }
  if (value >= LARGE_AMOUNT) {
    return {
      level: "warning",
      message: t('Monto muy grande ({value}{unit}). Revisa que no sobren ceros.', { value: compact(value), unit }),
    };
  }
  if (value >= 1_000_000)
    return { level: "info", message: `≈ ${compact(value)}${unit}` };
  if (value < 1_000 && pesos) {
    return { level: "info", message: t('Son menos de $1.000. ¿Faltan ceros?') };
  }
  return { level: "none", message: "" };
}

/**
 * Cantidad abreviada en palabras: `1500000` → `"1,5 millones"`.
 * @param {number} value
 * @returns {string}
 */
function compact(value) {
  const compactFormat = new Intl.NumberFormat(regionFormats().locale, { maximumFractionDigits: 1 });
  if (value >= 1_000_000_000)
    return t('{format} mil millones', { format: compactFormat.format(value / 1_000_000_000) });
  const millions = Math.round((value / 1_000_000) * 10) / 10;
  return `${compactFormat.format(millions)} ${millions === 1 ? t('millón') : "millones"}`;
}
