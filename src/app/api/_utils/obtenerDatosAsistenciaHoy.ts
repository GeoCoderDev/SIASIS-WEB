import { NOMBRE_ARCHIVO_CON_DATOS_ASISTENCIA_DIARIOS } from "@/constants/NOMBRE_ARCHIVOS_SISTEMA";
import { DatosAsistenciaHoyIE20935 } from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";
import { redisClient } from "../../../../config/Redis/RedisClient";
import { esContenidoJSON } from "../_helpers/esContenidoJSON";

/**
 * Resultado de la operación de obtener datos de asistencia
 */
export interface ResultadoObtenerDatosAsistencia {
  datos: DatosAsistenciaHoyIE20935;
  fuente: "cache" | "blob" | "respaldo";
  mensaje?: string;
}

/**
 * Configuración del servicio de datos de asistencia
 */
const CONFIG_SERVICIO_DATOS_ASISTENCIA = {
  // Duración del cache en milisegundos (2 horas)
  CACHE_DURACION: 2 * 60 * 60 * 1000,

  // Timeout para las peticiones HTTP (10 segundos)
  TIMEOUT_HTTP: 10 * 1000,
} as const;

/**
 * Cache global para los datos de asistencia
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
 * Crea un fetch con timeout personalizado
 */
function fetchConTimeout(url: string, timeout: number): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Timeout de petición HTTP")), timeout)
    ),
  ]);
}

/**
 * Obtiene los datos de asistencia desde el blob principal
 */
async function obtenerDatosDesdeBlob(): Promise<DatosAsistenciaHoyIE20935> {
  const url = `${process.env
    .RDP04_THIS_INSTANCE_VERCEL_BLOB_BASE_URL!}/${NOMBRE_ARCHIVO_CON_DATOS_ASISTENCIA_DIARIOS}`;

  console.log("🌐 Obteniendo datos desde blob principal:", url);

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
    throw new Error("La respuesta del blob no contiene JSON válido");
  }

  const datos = await response.json();
  console.log("✅ Datos obtenidos exitosamente desde blob principal");

  return datos;
}

/**
 * Obtiene los datos de asistencia desde Google Drive (respaldo)
 */
async function obtenerDatosDesdeRespaldo(): Promise<DatosAsistenciaHoyIE20935> {
  console.log("📁 Obteniendo datos desde respaldo Google Drive...");

  // Obtener el ID de Google Drive desde Redis
  const googleDriveId = await redisClient().get(
    NOMBRE_ARCHIVO_CON_DATOS_ASISTENCIA_DIARIOS
  );

  if (!googleDriveId) {
    throw new Error("No se encontró el ID del archivo de respaldo en Redis");
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
    throw new Error("La respuesta del respaldo no contiene JSON válido");
  }

  const datos = await response.json();
  console.log("✅ Datos obtenidos exitosamente desde respaldo Google Drive");

  return datos;
}

/**
 * Obtiene los datos de asistencia con cache, fuente principal y respaldo
 *
 * @param forzarActualizacion - Si es true, ignora el cache y obtiene datos frescos
 * @returns Promesa con los datos de asistencia y información sobre la fuente
 *
 * @example
 * ```typescript
 * // Uso básico (con cache)
 * const resultado = await obtenerDatosAsistenciaHoy();
 * console.log(resultado.datos, resultado.fuente);
 *
 * // Forzar actualización
 * const resultado = await obtenerDatosAsistenciaHoy(true);
 * ```
 */
export async function obtenerDatosAsistenciaHoy(
  forzarActualizacion = false
): Promise<ResultadoObtenerDatosAsistencia> {
  // Verificar cache primero (si no se fuerza actualización)
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

  // Intentar obtener desde fuente principal (blob)
  try {
    const datos = await obtenerDatosDesdeBlob();

    // Actualizar cache con los nuevos datos
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

    // Intentar obtener desde respaldo (Google Drive)
    try {
      const datos = await obtenerDatosDesdeRespaldo();

      // Actualizar cache con los datos del respaldo
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

      // Si ambos fallan, lanzar error descriptivo
      throw new Error(
        `Falló el acceso principal y el respaldo. ` +
          `Principal: ${(errorBlob as Error).message}. ` +
          `Respaldo: ${(errorRespaldo as Error).message}`
      );
    }
  }
}

/**
 * Limpia el cache de datos de asistencia
 * Útil para testing o para forzar una nueva obtención de datos
 */
export function limpiarCacheDatosAsistencia(): void {
  CacheDatosAsistencia.limpiar();
  console.log("🧹 Cache de datos de asistencia limpiado");
}

/**
 * Obtiene información sobre el estado actual del cache
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
