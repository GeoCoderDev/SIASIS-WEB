/**
 * Decodes a character to its corresponding number 1..31 according to the inverse rule:
 * - '1'..'9' -> 1..9
 * - 'A'..'V' (or 'a'..'v') -> 10..31
 *
 * Returns `number` in 1..31 for valid inputs or `null` for invalid inputs.
 */
export const decodificarCaracterANumero = (caracter: string): number | null => {
  if (!caracter || typeof caracter !== "string") return null;

  const char = caracter.trim();
  if (char.length === 0) return null;

  const c = char[0];

  // Digits 1..9
  if (c >= "1" && c <= "9") return parseInt(c, 10);

  // Letters A..V (we accept uppercase and lowercase)
  const upper = c.toUpperCase();
  if (upper >= "A" && upper <= "V") {
    const code = upper.charCodeAt(0); // 'A' = 65
    const number = 10 + (code - 65);
    // safety check
    if (number >= 10 && number <= 31) return number;
  }

  return null;
};
