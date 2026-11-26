const NUMERIC_OR_COORDINATES = /^[+-]?\d+(\.\d+)?(, [+-]?\d+(\.\d+)?)?$/;
const FORMULA_START = /^[=+\-@\t\r]/;

/**
 * Antepone "'" si el texto podría interpretarse como fórmula en Excel.
 * Una cadena puramente numérica o de coordenadas queda intacta (no puede ser
 * una fórmula); por eso "+34600123456" no cambia.
 *
 * Cubre: RF-OUT-12, CA-OUT-05
 */
export function neutralizeFormula(text: string): string {
  if (!FORMULA_START.test(text)) return text;
  if (NUMERIC_OR_COORDINATES.test(text)) return text;
  return `'${text}`;
}
