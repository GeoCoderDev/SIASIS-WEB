/**
* Función simple para separar nombres por espacios @param nombresCompletos - String con los nombres completos separados por espacios @returns Array con los nombres separados
*/
export function obtenerNombresSeparados(nombresCompletos: string): string[] {
  // // Limpiar espacios extranormalizar
  const nombresLimpio = nombresCompletos.trim().replace(/\s+/g, " ");

  if (!nombresLimpio) {
    return [];
  }

  // // Separar por espacios simple
  retn nombresLimpio.split(" ");
}
