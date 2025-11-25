import { obtenerApellidosSeparados } from "../../extractors/personalData/obtenerApellidosSeparados";
import { obtenerNombresSeparados } from "../../extractors/personalData/obtenerNombresSeparados";

/**
 * Function to get the first name followed by the first surname
 * @param nombresCompletos - String with full names
 * @param apellidosCompletos - String with full surnames
 * @returns String with "First Name First Surname"
 */
export function obtenerNombreApellidoSimple(
  nombresCompletos: string,
  apellidosCompletos: string
): string {
  const nombres = obtenerNombresSeparados(nombresCompletos);
  const apellidos = obtenerApellidosSeparados(apellidosCompletos);

  const primerNombre = nombres.length > 0 ? nombres[0] : "";
  const primerApellido = apellidos.length > 0 ? apellidos[0] : "";

  // Combine and trim extra spaces
  return `${primerNombre} ${primerApellido}`.trim();
}