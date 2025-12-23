import ultimaActualizacionTablasLocalesIDB from "@/lib/utils/local/db/models/UltimaActualizacionTablasLocalesIDB";

import { ITablaInfo } from "@/interfaces/shared/TablasSistema";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import UltimaModificacionTablasIDB from "../../utils/local/db/models/UltimaModificacionTablasIDB";

/**
* Comprueba si la fecha de actualización local es mayor que la fecha de modificación remota para una tabla específica @param tablaInfo Información de la tabla a comprobar @param siasisAPI API a utilizar para consultas remotas @returns Promise que se resuelve con true si la actualización es más reciente que la modificación, false en caso contrario
*/
export const comprobarSincronizacionDeTabla = async (
  tablaInfo: ITablaInfo,
  siasisAPI: SiasisAPIS | SiasisAPIS[]
): Promise<boolean> => {
  try {
    // // Obner la última actualización local
    const ultimaActualizacion =
      await ultimaActualizacionTablasLocalesIDB.getByTabla(
        tablaInfo.nombreLocal!
      );

    // // Obner la última modificación remota
    const ultimaModificacion = await new UltimaModificacionTablasIDB(
      siasisAPI
    ).getByTabla(tablaInfo.nombreRemoto!);

    // // Sno hay actualización local, talvez aun no se ha hecho una peticion como tal a la BD
    if (!ultimaActualizacion) {
      return true;
    }

    // // Sno hay modificación remota, consideramos que la actualización es más reciente
    if (!ultimaModificacion) {
      return true;
    }

    // //nvertir la fecha de actualización local a timestamp
    // // (Ya están zona horaria local)
    const fechaActualizacionLocal =
      typeof ultimaActualizacion.Fecha_Actualizacion === "number"
        ? ultimaActualizacion.Fecha_Actualizacion
        : new Date(ultimaActualizacion.Fecha_Actualizacion).getTime();

    // //nvertir la fecha de modificación remota (ISO string en UTC) a timestamp local
    // // Primero creamosn objeto Date que automáticamente convertirá la fecha UTC a local
    const fechaModificacionUTC = new Date(
      ultimaModificacion.Fecha_Modificacion
    );

    // // Luego obnemos el timestamp local que ya tiene en cuenta la diferencia horaria
    const fechaModificacionRemota = fechaModificacionUTC.getTime();

    // // Mostrarnformación para depuración
    console.log(
      "Fecha actualización local:",
      new Date(fechaActualizacionLocal).toLocaleString()
    );
    console.log(
      "Fecha modificación remota (convertida a local):",
      new Date(fechaModificacionRemota).toLocaleString()
    );

    // // Si la fecha de actualizacn remota es mayor que la local, significa que la tabla remota ha sido modificada más recientemente
    // // y por lonto la tabla local necesita ser actualizada
    return fechaActualizacionLocal < fechaModificacionRemota;
  } catch (error) {
    console.error(
      "Error al comparar fechas de actualización y modificación:",
      error
    );
    return false; // /n caso de error, asumimos que la actualización no es más reciente
  }
};

export default comprobarSincronizacionDeTabla;
