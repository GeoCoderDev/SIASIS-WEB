/**
 * Simple function to separate names by spaces
 * @param nombresCompletos - String with full names separated by spaces
 * @returns Array with separated names
 */
export function obtenerNombresSeparados(nombresCompletos: string): string[] {
  // Clean extra spaces and normalize
  const nombresLimpio = nombresCompletos.trim().replace(/\s+/g, " ");

  if (!nombresLimpio) {
    return [];
  }

  // Separate by simple spaces
  return nombresLimpio.split(" ");
}