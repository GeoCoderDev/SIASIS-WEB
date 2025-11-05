/**
 * Codifica un día del 1..31 a un único carácter según la regla:
 * - 1..9  -> '1'..'9'
 * - 10 -> 'A', 11 -> 'B', ..., 31 -> 'V'
 *
 * Si el valor está fuera de 1..31 o no es entero, devuelve cadena vacía.
 */
export const codificarNumerosACaracteres = (dia: number): string => {
  if (!Number.isInteger(dia) || dia < 1 || dia > 31) return "";

  if (dia >= 1 && dia <= 9) return String(dia);

  // 10 => 'A' (char code 65), 11 => 'B', ..., 31 => 'V'
  const offset = dia - 10; // 0-based
  return String.fromCharCode(65 + offset);
};
