import ultimaActualizacionTablasLocalesIDB from "@/lib/utils/local/db/models/UltimaActualizacionTablasLocalesIDB";

import { ITablaInfo } from "@/interfaces/shared/TablasSistema";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import UltimaModificacionTablasIDB from "../../utils/local/db/models/UltimaModificacionTablasIDB";

/**
 * Checks if the local update date is greater than the remote modification date
 * for a specific table
 *
 * @param tablaInfo Information of the table to check
 * @param siasisAPI API to use for remote queries
 * @returns Promise that resolves to true if the update is more recent than the modification, false otherwise
 */
export const comprobarSincronizacionDeTabla = async (
  tablaInfo: ITablaInfo,
  siasisAPI: SiasisAPIS | SiasisAPIS[]
): Promise<boolean> => {
  try {
    // Get the last local update
    const ultimaActualizacion =
      await ultimaActualizacionTablasLocalesIDB.getByTabla(
        tablaInfo.nombreLocal!
      );

    // Get the last remote modification
    const ultimaModificacion = await new UltimaModificacionTablasIDB(
      siasisAPI
    ).getByTabla(tablaInfo.nombreRemoto!);

    // If there is no local update, maybe a request has not yet been made to the DB as such
    if (!ultimaActualizacion) {
      return true;
    }

    // If there is no remote modification, we consider that the update is more recent
    if (!ultimaModificacion) {
      return true;
    }

    // Convert the local update date to timestamp
    // (It is already in local time zone)
    const fechaActualizacionLocal =
      typeof ultimaActualizacion.Fecha_Actualizacion === "number"
        ? ultimaActualizacion.Fecha_Actualizacion
        : new Date(ultimaActualizacion.Fecha_Actualizacion).getTime();

    // Convert the remote modification date (ISO string in UTC) to local timestamp
    // First we create a Date object that will automatically convert the UTC date to local
    const fechaModificacionUTC = new Date(
      ultimaModificacion.Fecha_Modificacion
    );

    // Then we get the local timestamp that already takes into account the time difference
    const fechaModificacionRemota = fechaModificacionUTC.getTime();

    // Show information for debugging
    console.log(
      "Local update date:",
      new Date(fechaActualizacionLocal).toLocaleString()
    );
    console.log(
      "Remote modification date (converted to local):",
      new Date(fechaModificacionRemota).toLocaleString()
    );

    // If the remote update date is greater than the local one, it means that the remote table has been modified more recently
    // and therefore the local table needs to be updated
    return fechaActualizacionLocal < fechaModificacionRemota;
  } catch (error) {
    console.error(
      "Error comparing update and modification dates:",
      error
    );
    return false; // In case of error, we assume that the update is not more recent
  }
};

export default comprobarSincronizacionDeTabla;
