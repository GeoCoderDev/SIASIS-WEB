/**
 * Encodes a day from 1..31 to a single character according to the rule:
 * - 1..9  -> '1'..'9'
 * - 10 -> 'A', 11 -> 'B', ..., 31 -> 'V'
 *
 * If the value is outside of 1..31 or is not an integer, it returns an empty string.
 */
export const codificarNumerosACaracteres = (dia: number): string => {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return "";

  if (dia >= 1 && dia <= 9) return String(dia);

  // 10 => 'A' (char code 65), 11 => 'B', ..., 31 => 'V'
  const offset = dia - 10; // 0-based
  return String.fromCharCode(65 + offset);
};
