import { obtenerApellidosSeparados } from "../../extractors/personalData/obtenerApellidosSeparados";
import { obtenerNombresSeparados } from "../../extractors/personalData/obtenerNombresSeparados";

/**
 * Función para obtener el primer nombre seguido del primer apellido
 * @param nombresCompletos - String con los nombres completos
 * @param apellidosCompletos - String con los apellidos completos
 * @returns String con "Primer Nombre Primer Apellido"
 */
export function obtenerNombreApellidoSimple(
  nombresCompletos: string,
  apellidosCompletos: string
): string {
  const nombres = obtenerNombresSeparados(nombresCompletos);
  const apellidos = obtenerApellidosSeparados(apellidosCompletos);

  const primerNombre = nombres.length > 0 ? nombres[0] : "";
  const primerApellido = apellidos.length > 0 ? apellidos[0] : "";

  // Combinar y limpiar espacios extra
  return `${primerNombre} ${primerApellido}`.trim();
}
