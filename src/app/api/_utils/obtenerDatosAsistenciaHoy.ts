import { NOMBRE_ARCHIVO_CON_DATOS_ASISTENCIA_DIARIOS } from "@/constants/NOMBRE_ARCHIVOS_SISTEMA";
import { DatosAsistenciaHoyIE20935 } from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";
import { redisClient } from "../../../../config/Redis/RedisClient";
import { esContenidoJSON } from "../_helpers/esContenidoJSON";

/**
 * Result of the get attendance data operation
 */
export interface ResultadoObtenerDatosAsistencia {
  datos: DatosAsistenciaHoyIE20935;
  fuente: "cache" | "blob" | "respaldo";
  mensaje?: string;
}

/**
 * Attendance data service configuration
 */
const CONFIG_SERVICIO_DATOS_ASISTENCIA = {
  // Cache duration in milliseconds (2 hours)
  CACHE_DURACION: 2 * 60 * 60 * 1000,

  // Timeout for HTTP requests (10 seconds)
  TIMEOUT_HTTP: 10 * 1000,
} as const;

/**
 * Global cache for attendance data
 */
class CacheDatosAsistencia {
  private static datos: DatosAsistenciaHoyIE20935 | null = null;
  private static ultimaActualizacion = 0;

  static get(duracionCache: number): DatosAsistenciaHoyIE20935 | null {
    const ahora = Date.now();
    if (this.datos && ahora - this.ultimaActualizacion < duracionCache) {
      return this.datos;
    }
    return null;
  }

  static set(datos: DatosAsistenciaHoyIE20935): void {
    this.datos = datos;
    this.ultimaActualizacion = Date.now();
  }

  static limpiar(): void {
    this.datos = null;
    this.ultimaActualizacion = 0;
  }

  static obtenerTiempoRestanteCache(duracionCache: number): number {
    if (!this.datos) return 0;
    const ahora = Date.now();
    const tiempoTranscurrido = ahora - this.ultimaActualizacion;
    return Math.max(0, duracionCache - tiempoTranscurrido);
  }
}

/**
 * Creates a fetch with custom timeout
 */
function fetchConTimeout(url: string, timeout: number): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("HTTP request timeout")), timeout)
    ),
  ]);
}

/**
 * Gets attendance data from the main blob
 */
async function obtenerDatosDesdeBlob(): Promise<DatosAsistenciaHoyIE20935> {
  const url = `${process.env
    .RDP04_THIS_INSTANCE_VERCEL_BLOB_BASE_URL!}/${NOMBRE_ARCHIVO_CON_DATOS_ASISTENCIA_DIARIOS}`;

  console.log("🌐 Getting data from main blob:", url);

  const response = await fetchConTimeout(
    url,
    CONFIG_SERVICIO_DATOS_ASISTENCIA.TIMEOUT_HTTP
  );

  if (!response.ok) {
    throw new Error(
      `Error HTTP en blob: ${response.status} ${response.statusText}`
    );
  }

  if (!(await esContenidoJSON(response))) {
    throw new Error("Blob response does not contain valid JSON");
  }

  const datos = await response.json();
  console.log("✅ Data successfully obtained from main blob");

  return datos;
}

/**
 * Gets attendance data from Google Drive (backup)
 */
async function obtenerDatosDesdeRespaldo(): Promise<DatosAsistenciaHoyIE20935> {
  console.log("📁 Getting data from Google Drive backup...");

  // Get the Google Drive ID from Redis
  const googleDriveId = await redisClient().get(
    NOMBRE_ARCHIVO_CON_DATOS_ASISTENCIA_DIARIOS
  );

  if (!googleDriveId) {
    throw new Error("Backup file ID not found in Redis");
  }

  const url = `https://drive.google.com/uc?export=download&id=${googleDriveId}`;

  const response = await fetchConTimeout(
    url,
    CONFIG_SERVICIO_DATOS_ASISTENCIA.TIMEOUT_HTTP
  );

  if (!response.ok) {
    throw new Error(
      `Error HTTP en respaldo: ${response.status} ${response.statusText}`
    );
  }

  if (!(await esContenidoJSON(response))) {
    throw new Error("Backup response does not contain valid JSON");
  }

  const datos = await response.json();
  console.log("✅ Data successfully obtained from Google Drive backup");

  return datos;
}

/**
 * Gets attendance data with cache, main source and backup
 *
 * @param forzarActualizacion - If true, ignores cache and gets fresh data
 * @returns Promise with attendance data and source information
 *
 * @example
 * ```typescript
 * // Basic usage (with cache)
 * const resultado = await obtenerDatosAsistenciaHoy();
 * console.log(resultado.datos, resultado.fuente);
 *
 * // Force update
 * const resultado = await obtenerDatosAsistenciaHoy(true);
 * ```
 */
export async function obtenerDatosAsistenciaHoy(
  forzarActualizacion = false
): Promise<ResultadoObtenerDatosAsistencia> {
  // Check cache first (if update is not forced)
  if (!forzarActualizacion) {
    const datosCache = CacheDatosAsistencia.get(
      CONFIG_SERVICIO_DATOS_ASISTENCIA.CACHE_DURACION
    );
    if (datosCache) {
      const tiempoRestante = CacheDatosAsistencia.obtenerTiempoRestanteCache(
        CONFIG_SERVICIO_DATOS_ASISTENCIA.CACHE_DURACION
      );

      console.log(
        `📋 Usando datos desde cache (válido por ${Math.round(
          tiempoRestante / 1000 / 60
        )} minutos más)`
      );

      return {
        datos: datosCache,
        fuente: "cache",
        mensaje: `Cache válido por ${Math.round(
          tiempoRestante / 1000 / 60
        )} minutos más`,
      };
    }
  }

  // Try to get from main source (blob)
  try {
    const datos = await obtenerDatosDesdeBlob();

    // Update cache with new data
    CacheDatosAsistencia.set(datos);

    return {
      datos,
      fuente: "blob",
      mensaje: "Datos obtenidos desde fuente principal",
    };
  } catch (errorBlob) {
    console.warn(
      "⚠️ Error al obtener datos del blob, intentando respaldo:",
      errorBlob
    );

    // Try to get from backup (Google Drive)
    try {
      const datos = await obtenerDatosDesdeRespaldo();

      // Update cache with backup data
      CacheDatosAsistencia.set(datos);

      return {
        datos,
        fuente: "respaldo",
        mensaje: `Datos obtenidos desde respaldo. Error principal: ${
          (errorBlob as Error).message
        }`,
      };
    } catch (errorRespaldo) {
      console.error("❌ Error en respaldo:", errorRespaldo);

      // If both fail, throw descriptive error
      throw new Error(
        `Falló el acceso principal y el respaldo. ` +
          `Principal: ${(errorBlob as Error).message}. ` +
          `Respaldo: ${(errorRespaldo as Error).message}`
      );
    }
  }
}

/**
 * Clears the attendance data cache
 * Useful for testing or to force a new data fetch
 */
export function limpiarCacheDatosAsistencia(): void {
  CacheDatosAsistencia.limpiar();
  console.log("🧹 Attendance data cache cleared");
}

/**
 * Gets information about the current cache state
 */
export function obtenerEstadoCache(): {
  tieneCache: boolean;
  tiempoRestanteMinutos: number;
  ultimaActualizacion: Date | null;
} {
  const tiempoRestante = CacheDatosAsistencia.obtenerTiempoRestanteCache(
    CONFIG_SERVICIO_DATOS_ASISTENCIA.CACHE_DURACION
  );

  return {
    tieneCache: tiempoRestante > 0,
    tiempoRestanteMinutos: Math.round(tiempoRestante / 1000 / 60),
    ultimaActualizacion:
      CacheDatosAsistencia["ultimaActualizacion"] > 0
        ? new Date(CacheDatosAsistencia["ultimaActualizacion"])
        : null,
  };
}
