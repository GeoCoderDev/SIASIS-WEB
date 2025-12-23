import userStorage from "@/lib/utils/local/db/models/UserStorage";

/**
* Comprueba si debe realizarse una sincronización basado en un intervalo de tiempo aleatorio @param minSegundos Tiempo mínimo en segundos que debe pasar antes de sincronizar (por defecto 180 - 3 minutos) @param maxSegundos Tiempo máximo en segundos que debe pasar antes de sincronizar (por defecto 360 - 6 minutos) @param forzarSincronizacion Si es true, devuelve true sin importar el tiempo transcurrido @returns Promise que se resuelve con true si se debe sincronizar, false en caso contrario
*/
export const comprobarSincronizacion = async (
  minSegundos: number = 180,
  maxSegundos: number = 360,
  forzarSincronizacion: boolean = false
): Promise<boolean> => {
  try {
    // // Si se debe forzar lancronización, simplemente regresamos true
    if (forzarSincronizacion) {
      // // Actualizamos la marca de tiempontes de retornar
      await userStorage.guardarUltimaSincronizacion(Date.now());
      return true;
    }

    // // Obner última sincronización almacenada
    const ultimaSincronizacion =
      await userStorage.obtenerUltimaSincronizacion();

    // // Sno hay registro previo, debemos sincronizar
    if (!ultimaSincronizacion) {
      // // Guardamos la hora actual como últimancronización
      await userStorage.guardarUltimaSincronizacion(Date.now());
      return true;
    }

    // //nvertir segundos a milisegundos
    const minInterval = minSegundos * 1000;
    const maxInterval = maxSegundos * 1000;

    // // Calcularn intervalo aleatorio entre minInterval y maxInterval
    const randomInterval =
      Math.floor(Math.random() * (maxInterval - minInterval + 1)) + minInterval;

    // // Calcular si ya pasó el tiempnecesario
    const tiempoTranscurrido = Date.now() - ultimaSincronizacion;
    const debeSincronizar = tiempoTranscurrido >= randomInterval;

    // // Si debencronizar, actualizamos la última hora de sincronización
    if (debeSincronizar) {
      await userStorage.guardarUltimaSincronizacion(Date.now());
    }

    return debeSincronizar;
  } catch (error) {
    console.error("Error al comprobar si se debe sincronizar:", error);
    return false; // /n caso de error, no sincronizamos
  }
};

export default comprobarSincronizacion;
