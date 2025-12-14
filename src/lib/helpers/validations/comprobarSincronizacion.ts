import userStorage from "@/lib/utils/local/db/models/UserStorage";

/**
 * Checks if a synchronization should be performed based on a random time interval
 * @param minSegundos Minimum time in seconds that must pass before synchronizing (default 180 - 3 minutes)
 * @param maxSegundos Maximum time in seconds that must pass before synchronizing (default 360 - 6 minutes)
 * @param forzarSincronizacion If true, returns true regardless of the time elapsed
 * @returns Promise that resolves to true if it should synchronize, false otherwise
 */
export const comprobarSincronizacion = async (
  minSegundos: number = 180,
  maxSegundos: number = 360,
  forzarSincronizacion: boolean = false
): Promise<boolean> => {
  try {
    // If synchronization should be forced, we simply return true
    if (forzarSincronizacion) {
      // We update the timestamp before returning
      await userStorage.guardarUltimaSincronizacion(Date.now());
      return true;
    }

    // Get the last stored synchronization
    const ultimaSincronizacion =
      await userStorage.obtenerUltimaSincronizacion();

    // If there is no previous record, we must synchronize
    if (!ultimaSincronizacion) {
      // We save the current time as the last synchronization
      await userStorage.guardarUltimaSincronizacion(Date.now());
      return true;
    }

    // Convert seconds to milliseconds
    const minInterval = minSegundos * 1000;
    const maxInterval = maxSegundos * 1000;

    // Calculate a random interval between minInterval and maxInterval
    const randomInterval =
      Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;

    // Calculate if the necessary time has passed
    const tiempoTranscurrido = Date.now() - ultimaSincronizacion;
    const debeSincronizar = tiempoTranscurrido >= randomInterval;

    // If it should synchronize, we update the last synchronization time
    if (debeSincronizar) {
      await userStorage.guardarUltimaSincronizacion(Date.now());
    }

    return debeSincronizar;
  } catch (error) {
    console.error("Error checking if it should synchronize:", error);
    return false; // In case of error, we do not synchronize
  }
};

export default comprobarSincronizacion;
