import {
  obtenerFechaActualPeru,
  obtenerFechaHoraActualPeru,
} from "@/app/api/_helpers/obtenerFechaActualPeru";
import { obtenerDatosAsistenciaHoy } from "@/app/api/_utils/obtenerDatosAsistenciaHoy";
import {
  AsistenciaDiariaEscolarResultado,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { redisClient } from "../../../../../../config/Redis/RedisClient";
import {
  NOMBRE_CLAVE_GOOGLE_DRIVE_IDs_LISTAS_ASISTENCIAS_ESCOLARES_HOY,
  NOMBRE_CLAVE_JOBS_EN_EJECUCION_LISTAS_ASISTENCIAS_ESCOLARES_HOY,
  GoogleDriveIDsListasAsistenciasEscolaresHoy,
  JobsEnEjecucionListasAsistenciasEscolaresHoy,
} from "@/interfaces/shared/Asistencia/ListasAsistenciasEscolaresHoy";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import {
  CONTROL_ASISTENCIA_DE_SALIDA_PRIMARIA,
  CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA,
} from "@/constants/ASISTENCIA_ENTRADA_SALIDA_ESCOLAR";
import { ENTORNO } from "@/constants/ENTORNO";
import { Entorno } from "@/interfaces/shared/Entornos";
import {
  INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_PRIMARIA,
  INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_SECUNDARIA,
} from "@/constants/INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_RDP01";
import {
  HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_PRIMARIA,
  HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_SECUNDARIA,
} from "@/constants/INTERVALOS_ASISTENCIAS_ESCOLARES";
import { GrupoInstaciasDeRedisPorTipoAsistencia } from "../../marcar/route";

// =====================================
// CONFIGURATION CONSTANTS
// =====================================

/**
 * Enable/disable specific update by section in GitHub Actions
 * false = Only updates by grade (current behavior)
 * true = Updates specifically by section
 */
export const USAR_ACTUALIZACION_POR_SECCION = false;

/**
 * Fallback probability to Redis by role (0-100%)
 * 0 = Never use fallback
 * 100 = Always use fallback
 * 50 = 50% probability of using fallback
 */
export const PROBABILIDAD_FALLBACK_POR_ROL: Record<RolesSistema, number> = {
  [RolesSistema.Directivo]: 80,
  [RolesSistema.ProfesorPrimaria]: 60,
  [RolesSistema.Auxiliar]: 40,
  [RolesSistema.ProfesorSecundaria]: 20,
  [RolesSistema.Tutor]: 60,
  [RolesSistema.Responsable]: 30,
  [RolesSistema.PersonalAdministrativo]: 0,
};

/**
 * From how many hours before departure should departure assistance be consulted
 */
export const HORAS_ANTES_SALIDA_PARA_CONSULTA: Record<NivelEducativo, number> =
  {
    [NivelEducativo.PRIMARIA]:
      HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_SECUNDARIA, // 1 hour before departure
    [NivelEducativo.SECUNDARIA]:
      HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_PRIMARIA, // 1 hour before departure
  };

/**
 * Time window configuration for using Google Drive
 * [Level][Mode]["HoursBefore" | "HoursAfter"]
 */
export const VENTANAS_TIEMPO_GOOGLE_DRIVE = {
  [NivelEducativo.PRIMARIA]: {
    [ModoRegistro.Entrada]: {
      HorasAntes: 1, // 1 hour before entry time
      HorasDespues: 2, // 2 hours after entry time
    },
    [ModoRegistro.Salida]: {
      HorasAntes: 1, // 1 hour before departure time
      HorasDespues: 2, // 2 hours after departure time
    },
  },
  [NivelEducativo.SECUNDARIA]: {
    [ModoRegistro.Entrada]: {
      HorasAntes: 1, // 1 hour before entry time
      HorasDespues: 2, // 2 hours after entry time
    },
    [ModoRegistro.Salida]: {
      HorasAntes: 1, // 1 hour before departure time
      HorasDespues: 2, // 2 hours after departure time
    },
  },
} as const;

/**
 * Configuration of roles that can use the Google Drive mechanism
 */
export const ROLES_CON_GOOGLE_DRIVE: Record<RolesSistema, boolean> = {
  [RolesSistema.Directivo]: true,
  [RolesSistema.ProfesorPrimaria]: true,
  [RolesSistema.Auxiliar]: true,
  [RolesSistema.ProfesorSecundaria]: false, // No access to students
  [RolesSistema.Tutor]: true,
  [RolesSistema.Responsable]: true,
  [RolesSistema.PersonalAdministrativo]: false, // No access to endpoint
};

/**
 * GitHub Actions variables
 */
export const GITHUB_CONFIG = {
  TOKEN: process.env.TGSH01_GITHUB_STATIC_PERSONAL_ACCESS_TOKEN,
  REPOSITORY_OWNER: process.env.TGSH01_GITHUB_WEBHOOK_REPOSITORY_OWNER_USERNAME,
  REPOSITORY_NAME: process.env.TGSH01_GITHUB_WEBHOOK_REPOSITORY_NAME,
} as const;

// =====================================
// INTERFACES
// =====================================

interface AsistenciasEscolaresArchivo {
  // New structure: Section -> Student_ID -> Attendance
  AsistenciasEscolaresDeHoy: Record<
    string,
    Record<
      string,
      {
        E?: { DesfaseSegundos: number };
        S?: { DesfaseSegundos: number };
      }
    >
  >;
  Fecha_Actualizacion: string;
}

interface ResultadoConsulta {
  datos:
    | AsistenciaDiariaEscolarResultado
    | AsistenciaDiariaEscolarResultado[]
    | null;
  mensaje: string;
}

// =====================================
// DATE UTILITIES WITHOUT new Date()
// =====================================

/**
 * Creates a Date object from an ISO string but using the Peru time reference
 */
async function crearFechaDesdeString(fechaString: string): Promise<Date> {
  const fechaPeruActual = await obtenerFechaHoraActualPeru();
  const fechaParseada = Date.parse(fechaString);

  if (isNaN(fechaParseada)) {
    console.warn(
      `[DATE] Invalid date string: ${fechaString}, using current date from Peru`
    );
    return fechaPeruActual;
  }

  return new Date(fechaParseada);
}

/**
 * Calculates difference in milliseconds between two dates using Peru reference
 */
async function calcularDiferenciaMillis(
  fechaString: string,
  fechaReferencia?: Date
): Promise<number> {
  const fechaRef = fechaReferencia || (await obtenerFechaHoraActualPeru());
  const timestampRef = fechaRef.getTime();
  const timestampObjeto = Date.parse(fechaString);

  if (isNaN(timestampObjeto)) {
    console.warn(`[DATE] Could not parse date: ${fechaString}`);
    return 0;
  }

  return timestampRef - timestampObjeto;
}

/**
 * Creates date with hour offset from current Peru date
 */
async function crearFechaConOffset(offsetHoras: number): Promise<Date> {
  const fechaPeruActual = await obtenerFechaHoraActualPeru();
  const timestampConOffset =
    fechaPeruActual.getTime() + offsetHoras * 60 * 60 * 1000;
  return new Date(timestampConOffset);
}

/**
 * Determines if fallback to Redis should be used based on role probability
 * @param rol User role making the request
 * @returns true if fallback should be used, false otherwise
 */
function debeUsarFallbackPorProbabilidad(rol: RolesSistema): boolean {
  const probabilidad = PROBABILIDAD_FALLBACK_POR_ROL[rol];
  const numeroAleatorio = Math.floor(Math.random() * 100) + 1; // 1-100

  const usarFallback = numeroAleatorio <= probabilidad;

  console.log(`[FallbackProbability] 🎲 Role: ${rol}`);
  console.log(
    `[FallbackProbability] 📊 Configured probability: ${probabilidad}%`
  );
  console.log(`[FallbackProbability] 🎯 Random number: ${numeroAleatorio}`);
  console.log(`[FallbackProbability] ✅ Use fallback?: ${usarFallback}`);

  return usarFallback;
}

/**
 * Gets the update interval based on the educational level
 */
function obtenerIntervaloActualizacion(nivel: NivelEducativo): number {
  return nivel === NivelEducativo.PRIMARIA
    ? INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_PRIMARIA
    : INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_SECUNDARIA;
}

// =====================================
// SIMPLIFIED CACHE BASED ON FILE DATE WITH NEW STRUCTURE
// =====================================

class CacheListasAsistencia {
  private static cache = new Map<
    string,
    {
      datos: AsistenciasEscolaresArchivo;
      fechaActualizacionArchivo: number; // Timestamp of file's Fecha_Actualizacion
    }
  >();

  /**
   * Gets file metadata from Google Drive without downloading it completely
   */
  private static async obtenerFechaArchivoGoogleDrive(
    googleDriveId: string
  ): Promise<number | null> {
    try {
      console.log(
        `[CacheListasAsistencia] 🔍 Getting file date: ${googleDriveId}`
      );

      // Attempt to get only the file header to verify its modification date
      const url = `https://drive.google.com/uc?export=download&id=${googleDriveId}`;

      // Perform a HEAD request to get headers without downloading content
      const response = await fetch(url, { method: "HEAD" });

      if (response.ok) {
        const lastModified = response.headers.get("last-modified");
        if (lastModified) {
          const fechaModificacion = Date.parse(lastModified);
          console.log(
            `[CacheListasAsistencia] 📅 File modification date (header): ${new Date(
              fechaModificacion
            ).toISOString()}`
          );
          return fechaModificacion;
        }
      }

      // If the HEAD method does not work, make a request with Range to get only the beginning of the file
      console.log(
        `[CacheListasAsistencia] ⚠️ HEAD not available, trying with Range...`
      );

      const rangeResponse = await fetch(url, {
        headers: {
          Range: "bytes=0-1023", // Only the first 1024 bytes
        },
      });

      if (rangeResponse.ok || rangeResponse.status === 206) {
        // 206 = Partial Content
        const contenidoParcial = await rangeResponse.text();

        // Search for the update date in the partial JSON
        const match = contenidoParcial.match(
          /"Fecha_Actualizacion"\s*:\s*"([^"]+)"/
        );
        if (match) {
          const fechaArchivo = Date.parse(match[1]);
          console.log(
            `[CacheListasAsistencia] 📅 File date (from partial JSON): ${match[1]}`
          );
          return fechaArchivo;
        }
      }

      console.log(
        `[CacheListasAsistencia] ❌ Could not get file date`
      );
      return null;
    } catch (error) {
      console.error(
        `[CacheListasAsistencia] ❌ Error getting file date:`,
        error
      );
      return null;
    }
  }

  /**
   * Checks if the data is internally updated
   */
  private static async estaActualizadaInternamente(
    datos: AsistenciasEscolaresArchivo,
    nivel: NivelEducativo
  ): Promise<{ estaActualizada: boolean; razon: string }> {
    const ahoraFecha = await obtenerFechaHoraActualPeru();
    const diferenciaMinutos =
      (await calcularDiferenciaMillis(datos.Fecha_Actualizacion, ahoraFecha)) /
      (1000 * 60);

    const intervaloMaximo = obtenerIntervaloActualizacion(nivel);
    const estaActualizada = diferenciaMinutos <= intervaloMaximo;

    return {
      estaActualizada,
      razon: `Difference: ${diferenciaMinutos.toFixed(
        2
      )} min vs limit (${nivel}): ${intervaloMaximo} min`,
    };
  }

  /**
   * Checks if the specific requested data is available in the cache
   * Updated to work with the new section structure
   */
  private static verificarDisponibilidadDatos(
    datos: AsistenciasEscolaresArchivo,
    idEstudiante: string,
    seccion: string,
    necesitaEntrada: boolean,
    necesitaSalida: boolean
  ): { disponible: boolean; razon: string } {
    // Check if the section exists
    const datosSeccion = datos.AsistenciasEscolaresDeHoy[seccion];
    if (!datosSeccion) {
      return {
        disponible: false,
        razon: `Section ${seccion} not found in data`,
      };
    }

    // Check if the student exists in that section
    const asistenciaEstudiante = datosSeccion[idEstudiante];
    if (!asistenciaEstudiante) {
      return {
        disponible: false,
        razon: `Student ${idEstudiante} not found in section ${seccion}`,
      };
    }

    // Check availability according to what is needed
    const tieneEntrada = !!asistenciaEstudiante.E;
    const tieneSalida = !!asistenciaEstudiante.S;

    if (necesitaEntrada && !tieneEntrada) {
      return {
        disponible: false,
        razon: `Missing entry for student ${idEstudiante} in section ${seccion}`,
      };
    }

    if (necesitaSalida && !tieneSalida) {
      return {
        disponible: false,
        razon: `Missing exit for student ${idEstudiante} in section ${seccion}`,
      };
    }

    return {
      disponible: true,
      razon: `Data available in section ${seccion}: entry=${tieneEntrada}, exit=${tieneSalida}`,
    };
  }

  /**
   * Checks availability for classroom query
   * Compares with the total number of expected students
   */
  private static verificarDisponibilidadAula(
    datos: AsistenciasEscolaresArchivo,
    seccion: string,
    totalEstudiantesEsperados: number,
    necesitaEntrada: boolean,
    necesitaSalida: boolean
  ): { disponible: boolean; razon: string } {
    // Check if the section exists
    const datosSeccion = datos.AsistenciasEscolaresDeHoy[seccion];
    if (!datosSeccion) {
      return {
        disponible: false,
        razon: `Section ${seccion} not found in data`,
      };
    }

    const estudiantesEncontrados = Object.keys(datosSeccion);
    const cantidadEncontrados = estudiantesEncontrados.length;

    // Check if we have the expected number of students
    if (cantidadEncontrados < totalEstudiantesEsperados) {
      return {
        disponible: false,
        razon: `Missing students in section ${seccion}: found ${cantidadEncontrados}/${totalEstudiantesEsperados}`,
      };
    }

    // Check data availability according to what is needed
    let estudiantesConEntrada = 0;
    let estudiantesConSalida = 0;

    for (const [idEstudiante, asistencia] of Object.entries(datosSeccion)) {
      if (asistencia.E) estudiantesConEntrada++;
      if (asistencia.S) estudiantesConSalida++;
    }

    // For classroom queries, verify that at least some students have the necessary data
    const porcentajeMinimo = 0.8; // 80% of students must have the data
    const minimoRequerido = Math.ceil(cantidadEncontrados * porcentajeMinimo);

    if (necesitaEntrada && estudiantesConEntrada < minimoRequerido) {
      return {
        disponible: false,
        razon: `Insufficient entries in section ${seccion}: ${estudiantesConEntrada}/${minimoRequerido} required`,
      };
    }

    if (necesitaSalida && estudiantesConSalida < minimoRequerido) {
      return {
        disponible: false,
        razon: `Insufficient exits in section ${seccion}: ${estudiantesConSalida}/${minimoRequerido} required`,
      };
    }

    return {
      disponible: true,
      razon: `Sufficient data in section ${seccion}: ${cantidadEncontrados}/${totalEstudiantesEsperados} students, entries=${estudiantesConEntrada}, exits=${estudiantesConSalida}`,
    };
  }

  /**
   * Checks if the cache needs to be updated considering specific data availability
   * OPTIMIZED: Only fetches from Google Drive if really necessary
   * UPDATED: Support for new section structure and classroom queries
   */
  private static async necesitaActualizacion(
    clave: string,
    googleDriveId: string,
    entrada: {
      datos: AsistenciasEscolaresArchivo;
      fechaActualizacionArchivo: number;
    },
    nivel: NivelEducativo,
    consultaEspecifica?: {
      idEstudiante: string;
      seccion: string;
      necesitaEntrada: boolean;
      necesitaSalida: boolean;
    },
    consultaAula?: {
      seccion: string;
      totalEstudiantesEsperados: number;
      necesitaEntrada: boolean;
      necesitaSalida: boolean;
    }
  ): Promise<{ necesitaActualizacion: boolean; razon: string }> {
    console.log(
      `[CacheListasAsistencia] 🔍 Checking for update necessity for: ${clave}`
    );

    // 1. FIRST PRIORITY: If there is a specific student query, check availability BEFORE fetching
    if (consultaEspecifica) {
      const { disponible, razon: razonDisponibilidad } =
        this.verificarDisponibilidadDatos(
          entrada.datos,
          consultaEspecifica.idEstudiante,
          consultaEspecifica.seccion,
          consultaEspecifica.necesitaEntrada,
          consultaEspecifica.necesitaSalida
        );

      console.log(
        `[CacheListasAsistencia] 📊 Student data availability: ${razonDisponibilidad}`
      );

      // If specific data is available, do not update - DO NOT FETCH
      if (disponible) {
        console.log(
          `[CacheListasAsistencia] ✅ STUDENT DATA AVAILABLE - Not updating, avoiding fetch`
        );
        return {
          necesitaActualizacion: false,
          razon: `Student data available (${razonDisponibilidad}) - No fetch to Google Drive`,
        };
      }

      console.log(
        `[CacheListasAsistencia] ❌ MISSING STUDENT DATA - Checking update`
      );
    }

    // 2. SECOND PRIORITY: If there is a classroom query, check availability BEFORE fetching
    if (consultaAula) {
      const { disponible, razon: razonDisponibilidad } =
        this.verificarDisponibilidadAula(
          entrada.datos,
          consultaAula.seccion,
          consultaAula.totalEstudiantesEsperados,
          consultaAula.necesitaEntrada,
          consultaAula.necesitaSalida
        );

      console.log(
        `[CacheListasAsistencia] 📊 Classroom data availability: ${razonDisponibilidad}`
      );

      // For classroom queries, ALWAYS update if expired (as requested by the user)
      const datosActualizados = await this.estaActualizadaInternamente(
        entrada.datos,
        nivel
      );
      const datosInternosDesactualizados = !datosActualizados.estaActualizada;

      if (datosInternosDesactualizados) {
        console.log(
          `[CacheListasAsistencia] ⚠️ CLASSROOM QUERY + EXPIRED DATA - Must update`
        );

        // Fetch to check if there is a newer version
        const fechaArchivoActual = await this.obtenerFechaArchivoGoogleDrive(
          googleDriveId
        );
        const hayVersionMasNueva =
          fechaArchivoActual &&
          fechaArchivoActual > entrada.fechaActualizacionArchivo;

        if (hayVersionMasNueva) {
          const diferenciaMinutos =
            (fechaArchivoActual - entrada.fechaActualizacionArchivo) /
            (1000 * 60);
          return {
            necesitaActualizacion: true,
            razon: `Classroom query + newer file (difference: ${diferenciaMinutos.toFixed(
              2
            )} min)`,
          };
        }

        return {
          necesitaActualizacion: true,
          razon: `Classroom query + outdated internal data: ${datosActualizados.razon}`,
        };
      }

      // If data is updated and sufficient, do not update
      if (disponible) {
        console.log(
          `[CacheListasAsistencia] ✅ SUFFICIENT AND UPDATED CLASSROOM DATA - Not updating`
        );
        return {
          necesitaActualizacion: false,
          razon: `Sufficient and updated classroom data (${razonDisponibilidad})`,
        };
      }

      // If data is missing but updated, update
      console.log(
        `[CacheListasAsistencia] ❌ INSUFFICIENT CLASSROOM DATA - Updating`
      );
      return {
        necesitaActualizacion: true,
        razon: `Insufficient classroom data: ${razonDisponibilidad}`,
      };
    }

    // 3. Check if internal data is outdated (without fetch)
    const datosActualizados = await this.estaActualizadaInternamente(
      entrada.datos,
      nivel
    );
    const datosInternosDesactualizados = !datosActualizados.estaActualizada;

    // 4. ONLY if internal data is outdated AND specific data is missing, fetch from Google Drive
    if (consultaEspecifica && datosInternosDesactualizados) {
      console.log(
        `[CacheListasAsistencia] 🌐 Outdated internal data and missing specific data - Fetching from Google Drive`
      );

      const fechaArchivoActual = await this.obtenerFechaArchivoGoogleDrive(
        googleDriveId
      );
      const hayVersionMasNueva =
        fechaArchivoActual &&
        fechaArchivoActual > entrada.fechaActualizacionArchivo;

      if (hayVersionMasNueva) {
        const diferenciaMinutos =
          (fechaArchivoActual - entrada.fechaActualizacionArchivo) /
          (1000 * 60);
        return {
          necesitaActualizacion: true,
          razon: `Missing data + newer file in Google Drive (difference: ${diferenciaMinutos.toFixed(
            2
          )} min)`,
        };
      }

      return {
        necesitaActualizacion: true,
        razon: `Specific data not available + outdated internal data: ${datosActualizados.razon}`,
      };
    }

    // 5. For specific queries with updated internal data, do not update
    if (consultaEspecifica && !datosInternosDesactualizados) {
      return {
        necesitaActualizacion: true,
        razon: `Specific data not available but internal data still valid - Update to get missing data`,
      };
    }

    // 6. Without specific query, apply traditional logic (fetch)
    console.log(
      `[CacheListasAsistencia] 🌐 Without specific query - Traditional verification with fetch`
    );

    const fechaArchivoActual = await this.obtenerFechaArchivoGoogleDrive(
      googleDriveId
    );
    const hayVersionMasNueva =
      fechaArchivoActual &&
      fechaArchivoActual > entrada.fechaActualizacionArchivo;

    if (hayVersionMasNueva) {
      const diferenciaMinutos =
        (fechaArchivoActual - entrada.fechaActualizacionArchivo) / (1000 * 60);
      return {
        necesitaActualizacion: true,
        razon: `Newer file detected in Google Drive (difference: ${diferenciaMinutos.toFixed(
          2
        )} min)`,
      };
    }

    if (datosInternosDesactualizados) {
      return {
        necesitaActualizacion: true,
        razon: `Outdated internal data: ${datosActualizados.razon}`,
      };
    }

    return {
      necesitaActualizacion: false,
      razon: "Valid cache - updated file and internal data",
    };
  }

  /**
   * Gets data from cache, automatically checking for newer versions
   * OPTIMIZATION: Prioritizes data availability over update
   * UPDATED: Support for new section structure and classroom queries
   */
  static async obtener(
    clave: string,
    nivel: NivelEducativo,
    googleDriveId?: string,
    consultaEspecifica?: {
      idEstudiante: string;
      seccion: string;
      necesitaEntrada: boolean;
      necesitaSalida: boolean;
    },
    consultaAula?: {
      seccion: string;
      totalEstudiantesEsperados: number;
      necesitaEntrada: boolean;
      necesitaSalida: boolean;
    }
  ): Promise<AsistenciasEscolaresArchivo | null> {
    const entrada = this.cache.get(clave);
    if (!entrada) {
      console.log(
        `[CacheListasAsistencia] ❌ No cache entry for: ${clave}`
      );
      return null;
    }

    console.log(`[CacheListasAsistencia] 📊 Checking cache for: ${clave}`);
    console.log(
      `[CacheListasAsistencia] 📅 File date in cache: ${entrada.datos.Fecha_Actualizacion}`
    );

    // If there is a specific query, print what is being searched
    if (consultaEspecifica) {
      console.log(
        `[CacheListasAsistencia] 🎯 Specific query: student=${consultaEspecifica.idEstudiante}, section=${consultaEspecifica.seccion}, entry=${consultaEspecifica.necesitaEntrada}, exit=${consultaEspecifica.necesitaSalida}`
      );
    }

    if (consultaAula) {
      console.log(
        `[CacheListasAsistencia] 🏫 Classroom query: section=${consultaAula.seccion}, expectedTotal=${consultaAula.totalEstudiantesEsperados}, entry=${consultaAula.necesitaEntrada}, exit=${consultaAula.necesitaSalida}`
      );
    }

    // If googleDriveId is not provided, only check internal data
    if (!googleDriveId) {
      const datosActualizados = await this.estaActualizadaInternamente(
        entrada.datos,
        nivel
      );

      if (!datosActualizados.estaActualizada) {
        console.log(
          `[CacheListasAsistencia] 🗑️ Cache invalidated by internal data: ${datosActualizados.razon}`
        );
        this.cache.delete(clave);
        return null;
      }

      console.log(
        `[CacheListasAsistencia] ✅ Valid cache (internal verification): ${clave}`
      );
      return entrada.datos;
    }

    // Full verification with data availability optimization
    const { necesitaActualizacion, razon } = await this.necesitaActualizacion(
      clave,
      googleDriveId,
      entrada,
      nivel,
      consultaEspecifica,
      consultaAula
    );

    console.log(`[CacheListasAsistencia] 🎯 Verification result: ${razon}`);

    if (necesitaActualizacion) {
      console.log(
        `[CacheListasAsistencia] 🗑️ Invalidating cache: ${clave} - ${razon}`
      );
      this.cache.delete(clave);
      return null;
    }

    console.log(`[CacheListasAsistencia] ✅ Valid cache: ${clave}`);
    return entrada.datos;
  }

  static async guardar(
    clave: string,
    datos: AsistenciasEscolaresArchivo
  ): Promise<void> {
    const fechaActualizacionArchivo = Date.parse(datos.Fecha_Actualizacion);

    console.log(`[CacheListasAsistencia] 💾 Saving to cache: ${clave}`);
    console.log(
      `[CacheListasAsistencia] 📅 File update date: ${datos.Fecha_Actualizacion}`
    );

    this.cache.set(clave, {
      datos,
      fechaActualizacionArchivo,
    });
  }

  static limpiar(clave?: string): void {
    if (clave) {
      console.log(
        `[CacheListasAsistencia] 🧹 Clearing specific cache: ${clave}`
      );
      this.cache.delete(clave);
    } else {
      console.log(`[CacheListasAsistencia] 🧹 Clearing entire cache`);
      this.cache.clear();
    }
  }

  static async obtenerEstadisticas(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const [clave, entrada] of this.cache.entries()) {
      // For statistics, use PRIMARY as default since we don't have the level in the key
      const nivelDefault = NivelEducativo.PRIMARIA;
      const datosInternos = await this.estaActualizadaInternamente(
        entrada.datos,
        nivelDefault
      );

      // Count total students in all sections
      let totalEstudiantes = 0;
      for (const seccion of Object.values(
        entrada.datos.AsistenciasEscolaresDeHoy || {}
      )) {
        totalEstudiantes += Object.keys(seccion as Record<string, any>).length;
      }

      stats[clave] = {
        fechaArchivo: entrada.datos.Fecha_Actualizacion,
        cantidadEstudiantes: totalEstudiantes,
        secciones: Object.keys(entrada.datos.AsistenciasEscolaresDeHoy || {})
          .length,
        fechaActualizacionArchivo: entrada.fechaActualizacionArchivo,
        estaActualizada: datosInternos.estaActualizada,
        razonEstado: datosInternos.razon,
      };
    }
    return stats;
  }
}

// =====================================
// MAIN UPDATED REPOSITORY
// =====================================

export class AsistenciasEscolaresHoyRepository {
  private logPrefix = "[AttendancesRepo]";

  /**
   * Gets the current date in YYYY-MM-DD format
   */
  async obtenerFechaActual(): Promise<string> {
    const fecha = await obtenerFechaActualPeru();
    console.log(`${this.logPrefix} 📅 Current date obtained: ${fecha}`);
    return fecha;
  }

  /**
   * Checks if departure attendances should be consulted
   */
  private async debeConsultarSalidas(nivel: NivelEducativo): Promise<boolean> {
    console.log(
      `${this.logPrefix} 🚪 Checking if departure attendances should be consulted for ${nivel}`
    );

    // Check control constants
    const controlarSalidas =
      nivel === NivelEducativo.PRIMARIA
        ? CONTROL_ASISTENCIA_DE_SALIDA_PRIMARIA
        : CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA;

    console.log(
      `${this.logPrefix} ⚙️ Departure control for ${nivel}: ${controlarSalidas}`
    );

    if (!controlarSalidas) {
      console.log(
        `${this.logPrefix} ❌ Departure control disabled for ${nivel}`
      );
      return false;
    }

    try {
      // Get system schedules
      const { datos: datosAsistencia } = await obtenerDatosAsistenciaHoy();

      const ahora = await obtenerFechaHoraActualPeru();
      const horasAntes = HORAS_ANTES_SALIDA_PARA_CONSULTA[nivel];

      console.log(
        `${this.logPrefix} ⏰ Configured hours before: ${horasAntes}`
      );
      console.log(
        `${this.logPrefix} 🕐 Current time (Peru): ${ahora.toISOString()}`
      );

      // Get departure time according to level and create timestamp
      let horaSalidaString: string;

      if (nivel === NivelEducativo.PRIMARIA) {
        const horarioPrimaria =
          datosAsistencia.HorariosEscolares[NivelEducativo.PRIMARIA];
        horaSalidaString = String(horarioPrimaria.Fin);
      } else {
        const horarioSecundaria =
          datosAsistencia.HorariosEscolares[NivelEducativo.SECUNDARIA];
        horaSalidaString = String(horarioSecundaria.Fin);
      }

      // Calculate limit using timestamps
      const horaSalidaTimestamp = Date.parse(horaSalidaString);
      const limiteTiempoTimestamp =
        horaSalidaTimestamp - horasAntes * 60 * 60 * 1000;
      const ahoraTimestamp = ahora.getTime();

      const debeConsultar = ahoraTimestamp >= limiteTiempoTimestamp;

      console.log(
        `${this.logPrefix} 🚪 Departure time ${nivel}: ${horaSalidaString}`
      );
      console.log(
        `${this.logPrefix} ⏰ Time limit (timestamp): ${limiteTiempoTimestamp}`
      );
      console.log(`${this.logPrefix} 🕐 Now (timestamp): ${ahoraTimestamp}`);
      console.log(
        `${this.logPrefix} ✅ Should consult departures?: ${debeConsultar}`
      );

      return debeConsultar;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error checking if departure attendances should be consulted:`,
        error
      );
      return false;
    }
  }

  /**
   * Checks if we are in the time window to use Google Drive
   */
  private async estaEnVentanaTiempo(
    nivel: NivelEducativo,
    modo: ModoRegistro
  ): Promise<boolean> {
    try {
      console.log(
        `${this.logPrefix} 🕐 Checking time window for ${nivel} - ${modo}`
      );

      // Get system schedules
      const { datos: datosAsistencia } = await obtenerDatosAsistenciaHoy();
      console.log(`${this.logPrefix} ✅ Attendance data obtained`);

      const ahora = await obtenerFechaHoraActualPeru();
      const ventana = VENTANAS_TIEMPO_GOOGLE_DRIVE[nivel][modo];

      console.log(
        `${this.logPrefix} 📊 Window configuration: ${ventana.HorasAntes}h before, ${ventana.HorasDespues}h after`
      );
      console.log(
        `${this.logPrefix} 🕐 Current time (Peru): ${ahora.toISOString()}`
      );

      // Get target time according to level and mode
      let horaObjetivoString: string;

      if (nivel === NivelEducativo.PRIMARIA) {
        const horarioPrimaria =
          datosAsistencia.HorariosEscolares[NivelEducativo.PRIMARIA];
        horaObjetivoString =
          modo === ModoRegistro.Entrada
            ? String(horarioPrimaria.Inicio)
            : String(horarioPrimaria.Fin);
      } else {
        const horarioSecundaria =
          datosAsistencia.HorariosEscolares[NivelEducativo.SECUNDARIA];
        horaObjetivoString =
          modo === ModoRegistro.Entrada
            ? String(horarioSecundaria.Inicio)
            : String(horarioSecundaria.Fin);
      }

      // Calculate time window using timestamps
      const horaObjetivoTimestamp = Date.parse(horaObjetivoString);
      const inicioVentanaTimestamp =
        horaObjetivoTimestamp - ventana.HorasAntes * 60 * 60 * 1000;
      const finVentanaTimestamp =
        horaObjetivoTimestamp + ventana.HorasDespues * 60 * 60 * 1000;
      const ahoraTimestamp = ahora.getTime();

      const estaEnVentana =
        ahoraTimestamp >= inicioVentanaTimestamp &&
        ahoraTimestamp <= finVentanaTimestamp;

      console.log(
        `${this.logPrefix} 🎯 Target time (${modo}): ${horaObjetivoString}`
      );
      console.log(
        `${this.logPrefix} 🎯 Target time (timestamp): ${horaObjetivoTimestamp}`
      );
      console.log(
        `${this.logPrefix} 🟢 Window start (timestamp): ${inicioVentanaTimestamp}`
      );
      console.log(
        `${this.logPrefix} 🔴 Window end (timestamp): ${finVentanaTimestamp}`
      );
      console.log(`${this.logPrefix} 🕐 Now (timestamp): ${ahoraTimestamp}`);
      console.log(
        `${this.logPrefix} ✨ In window? (using Peru time): ${estaEnVentana}`
      );

      return estaEnVentana;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error checking time window:`,
        error
      );
      return false;
    }
  }

  /**
   * Checks if the Google Drive mechanism should be used
   */
  private async debeUsarGoogleDrive(
    rol: RolesSistema,
    nivel: NivelEducativo,
    modo: ModoRegistro
  ): Promise<boolean> {
    console.log(
      `${this.logPrefix} 🔍 Checking if Google Drive should be used for role: ${rol}`
    );

    // Check if the role is allowed to use Google Drive
    const rolPermitido = ROLES_CON_GOOGLE_DRIVE[rol];
    console.log(`${this.logPrefix} 👤 Role ${rol} allowed?: ${rolPermitido}`);

    if (!rolPermitido) {
      console.log(
        `${this.logPrefix} ❌ Role ${rol} does not have Google Drive permissions`
      );
      return false;
    }

    // Check time window
    const enVentana = await this.estaEnVentanaTiempo(nivel, modo);
    console.log(`${this.logPrefix} 🕐 In time window?: ${enVentana}`);

    const resultado = rolPermitido && enVentana;
    console.log(
      `${this.logPrefix} 🎯 Final result mustUseGoogleDrive: ${resultado}`
    );

    return resultado;
  }

  /**
   * Builds the result for an individual student
   * UPDATED: To work with new section structure
   */
  private async construirResultadoEstudiante(
    idEstudiante: string,
    seccion: string,
    asistenciaData: {
      E?: { DesfaseSegundos: number };
      S?: { DesfaseSegundos: number };
    },
    nivel: NivelEducativo
  ): Promise<AsistenciaDiariaEscolarResultado> {
    console.log(
      `${this.logPrefix} 🔨 Building result for student: ${idEstudiante} in section ${seccion}`
    );

    const asistencia: AsistenciaEscolarDeUnDia = {} as AsistenciaEscolarDeUnDia;

    // Always include entry if it exists
    if (asistenciaData.E) {
      console.log(
        `${this.logPrefix} ✅ Entry found for ${idEstudiante}: ${asistenciaData.E.DesfaseSegundos}s`
      );
      asistencia[ModoRegistro.Entrada] = {
        DesfaseSegundos: asistenciaData.E.DesfaseSegundos,
      };
    } else {
      console.log(`${this.logPrefix} ❌ No entry for ${idEstudiante}`);
      asistencia[ModoRegistro.Entrada] = null;
    }

    // Include exit only if it should be consulted and exists
    const debeConsultar = await this.debeConsultarSalidas(nivel);
    if (debeConsultar && asistenciaData.S) {
      console.log(
        `${this.logPrefix} 🚪 Exit found for ${idEstudiante}: ${asistenciaData.S.DesfaseSegundos}s`
      );
      asistencia[ModoRegistro.Salida] = {
        DesfaseSegundos: asistenciaData.S.DesfaseSegundos,
      };
    } else if (debeConsultar) {
      console.log(
        `${this.logPrefix} ❌ No exit for ${idEstudiante} (must consult but does not exist)`
      );
    }

    const tieneAsistencia = Object.keys(asistencia).some(
      (key) => asistencia[key as keyof AsistenciaEscolarDeUnDia] !== null
    );

    console.log(
      `${this.logPrefix} 📊 Result for ${idEstudiante}: hasAttendance=${tieneAsistencia}`
    );

    return {
      Id_Estudiante: idEstudiante,
      AsistenciaMarcada: tieneAsistencia,
      Asistencia: tieneAsistencia ? asistencia : null,
    };
  }

  /**
   * Checks if a list is updated
   */
  private async estaActualizada(
    datos: AsistenciasEscolaresArchivo,
    nivel: NivelEducativo
  ): Promise<boolean> {
    const ahoraFecha = await obtenerFechaHoraActualPeru();
    let diferenciaMinutos =
      (await calcularDiferenciaMillis(datos.Fecha_Actualizacion, ahoraFecha)) /
      (1000 * 60);

    if (ENTORNO !== Entorno.PRODUCCION) {
      diferenciaMinutos = Math.abs(diferenciaMinutos);
    }

    const intervaloMaximo = obtenerIntervaloActualizacion(nivel);
    const estaActualizada = diferenciaMinutos <= intervaloMaximo;

    console.log(
      `${this.logPrefix} 📅 File update date: ${datos.Fecha_Actualizacion}`
    );
    console.log(
      `${this.logPrefix} 🕐 Current time (Peru): ${ahoraFecha.toISOString()}`
    );
    console.log(
      `${this.logPrefix} ⏱️ Difference in minutes: ${diferenciaMinutos.toFixed(
        2
      )}`
    );
    console.log(
      `${this.logPrefix} ⚙️ Max interval configured for ${nivel}: ${intervaloMaximo} min`
    );
    console.log(
      `${this.logPrefix} ✅ Is it updated? (using Peru time): ${estaActualizada}`
    );

    return estaActualizada;
  }

  /**
   * Checks if a job is running
   */
  private async estaJobEnEjecucion(
    nivel: NivelEducativo,
    grado: number,
    tipoAsistencia: TipoAsistencia
  ): Promise<boolean> {
    try {
      console.log(
        `${this.logPrefix} 🔄 Checking running job for ${nivel} grade ${grado}`
      );

      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
      );
      
      console.log(
        `${this.logPrefix} 🔗 Redis client obtained for: ${tipoAsistencia}`
      );
      const jobsString = await redisInstance.get(
        NOMBRE_CLAVE_JOBS_EN_EJECUCION_LISTAS_ASISTENCIAS_ESCOLARES_HOY
      );

      console.log(
        `${this.logPrefix} 📦 Jobs string obtained from Redis: ${
          jobsString ? "Exists" : "Does not exist"
        }`
      );

      if (!jobsString) {
        console.log(
          `${this.logPrefix} ✅ No jobs running (Redis empty)`
        );
        return false;
      }

      const jobs: JobsEnEjecucionListasAsistenciasEscolaresHoy = JSON.parse(
        jobsString as string
      );
      const jobEnEjecucion = jobs[nivel]?.[grado] === true;

      console.log(
        `${this.logPrefix} 📋 Parsed jobs:`,
        JSON.stringify(jobs, null, 2)
      );
      console.log(
        `${this.logPrefix} 🎯 Specific job (${nivel} grade ${grado}): ${jobEnEjecucion}`
      );

      return jobEnEjecucion;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error checking running jobs:`,
        error
      );
      return false;
    }
  }

  /**
   * Triggers the update of a specific list via GitHub Actions
   * UPDATED: Support for section update
   */
  private async gatillarActualizacionLista(
    nivel: NivelEducativo,
    grado: number,
    seccion?: string
  ): Promise<void> {
    try {
      console.log(
        `${this.logPrefix} 🚀 STARTING TRIGGER for ${nivel} grade ${grado}${
          seccion ? ` section ${seccion}` : ""
        }`
      );

      // Verify GitHub configuration
      console.log(
        `${this.logPrefix} 🔑 GitHub Token exists: ${!!GITHUB_CONFIG.TOKEN}`
      );
      console.log(
        `${this.logPrefix} 👤 Repository Owner: ${GITHUB_CONFIG.REPOSITORY_OWNER}`
      );
      console.log(
        `${this.logPrefix} 📁 Repository Name: ${GITHUB_CONFIG.REPOSITORY_NAME}`
      );

      if (!GITHUB_CONFIG.TOKEN) {
        throw new Error("GitHub TOKEN not configured");
      }

      if (!GITHUB_CONFIG.REPOSITORY_OWNER || !GITHUB_CONFIG.REPOSITORY_NAME) {
        throw new Error("Incomplete GitHub repository configuration");
      }

      const url = `https://api.github.com/repos/${GITHUB_CONFIG.REPOSITORY_OWNER}/${GITHUB_CONFIG.REPOSITORY_NAME}/dispatches`;
      console.log(`${this.logPrefix} 🌐 GitHub Actions URL: ${url}`);

      const payload = {
        event_type: "update-attendance-lists-today",
        client_payload: {
          nivel: nivel,
          grado: grado.toString(),
          ...(USAR_ACTUALIZACION_POR_SECCION && seccion ? { seccion } : {}),
        },
      };

      console.log(
        `${this.logPrefix} 📦 Payload to send:`,
        JSON.stringify(payload, null, 2)
      );
      console.log(
        `${this.logPrefix} ⚙️ Section update enabled: ${USAR_ACTUALIZACION_POR_SECCION}`
      );

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `token ${GITHUB_CONFIG.TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log(
        `${this.logPrefix} 📡 GitHub Actions Response - Status: ${response.status}`
      );
      console.log(
        `${this.logPrefix} 📡 GitHub Actions Response - StatusText: ${response.statusText}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${this.logPrefix} ❌ Error response body:`, errorText);
        throw new Error(
          `Error triggering GitHub Action: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      console.log(
        `${
          this.logPrefix
        } ✅ GitHub Action triggered successfully for ${nivel} grade ${grado}${
          seccion ? ` section ${seccion}` : ""
        }`
      );
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error triggering GitHub Action:`,
        error
      );
      throw error;
    }
  }

  /**
   * Gets a list of attendances from Google Drive
   */
  private async obtenerListaDesdeGoogleDrive(
    nivel: NivelEducativo,
    grado: number,
    tipoAsistencia: TipoAsistencia
  ): Promise<AsistenciasEscolaresArchivo> {
    try {
      console.log(
        `${this.logPrefix} 📥 Getting list from Google Drive: ${nivel} grade ${grado}`
      );

      // Get Redis instance based on attendance type
      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
      );
      console.log(
        `${this.logPrefix} 🔗 Redis client obtained for: ${tipoAsistencia}`
      );
      console.log(
        `${this.logPrefix} 🔗 Redis client obtained for: ${tipoAsistencia}`
      );

      // Get Google Drive IDs
      const idsString = await redisInstance.get(
        NOMBRE_CLAVE_GOOGLE_DRIVE_IDs_LISTAS_ASISTENCIAS_ESCOLARES_HOY
      );

      console.log(
        `${this.logPrefix} 🔑 IDs string obtained from Redis: ${
          idsString ? "Exists" : "Does not exist"
        }`
      );

      if (!idsString) {
        throw new Error("Google Drive IDs not found in Redis");
      }

      const ids: GoogleDriveIDsListasAsistenciasEscolaresHoy = JSON.parse(
        idsString as string
      );
      console.log(
        `${this.logPrefix} 📋 Parsed IDs:`,
        JSON.stringify(ids, null, 2)
      );

      const googleDriveId = ids[nivel]?.[grado];
      console.log(
        `${this.logPrefix} 🎯 Specific ID for ${nivel} grade ${grado}: ${googleDriveId}`
      );

      if (!googleDriveId) {
        throw new Error(
          `Google Drive ID not found for ${nivel} grade ${grado}`
        );
      }

      // Download file from Google Drive
      const url = `https://drive.google.com/uc?export=download&id=${googleDriveId}`;
      console.log(`${this.logPrefix} 🌐 Google Drive URL: ${url}`);

      const response = await fetch(url);
      console.log(
        `${this.logPrefix} 📡 Google Drive Response - Status: ${response.status}`
      );

      if (!response.ok) {
        throw new Error(
          `Error downloading from Google Drive: ${response.status} ${response.statusText}`
        );
      }

      const datos = await response.json();
      console.log(
        `${this.logPrefix} 📄 Data obtained - Update date: ${datos.Fecha_Actualizacion}`
      );

      // Count students in new section structure
      let totalEstudiantes = 0;
      for (const seccion of Object.values(
        datos.AsistenciasEscolaresDeHoy || {}
      )) {
        totalEstudiantes += Object.keys(seccion as Record<string, any>).length;
      }

      console.log(
        `${
          this.logPrefix
        } 📊 Total students in file: ${totalEstudiantes} distributed in ${
          Object.keys(datos.AsistenciasEscolaresDeHoy || {}).length
        } sections`
      );

      return datos;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error getting list from Google Drive:`,
        error
      );
      throw error;
    }
  }

  /**
   * Queries the attendance of a specific student by their ID
   * UPDATED: New section structure and fallback probability system
   */
  async consultarPorIdEstudiante(
    idEstudiante: string,
    tipoAsistencia: TipoAsistencia,
    nivel?: NivelEducativo,
    grado?: number,
    seccion?: string,
    rol?: RolesSistema
  ): Promise<ResultadoConsulta> {
    try {
      console.log(
        `${this.logPrefix} 🔍 CONSULTING STUDENT: ${idEstudiante}`
      );
      console.log(
        `${this.logPrefix} 📋 Parameters: role=${rol}, level=${nivel}, grade=${grado}, section=${seccion}`
      );

      // If role or section is not provided, use Redis directly
      if (!rol || !nivel || !grado || !seccion) {
        console.log(
          `${this.logPrefix} 🔄 Using Redis directly (missing parameters for Google Drive)`
        );
        return await this.consultarDesdeRedis(
          idEstudiante,
          tipoAsistencia,
          nivel,
          grado,
          seccion
        );
      }

      // Determine if Google Drive should be used
      const usarGoogleDrive = await this.debeUsarGoogleDrive(
        rol,
        nivel,
        ModoRegistro.Entrada
      );
      console.log(
        `${this.logPrefix} 🎯 Use Google Drive?: ${usarGoogleDrive}`
      );

      if (!usarGoogleDrive) {
        console.log(
          `${this.logPrefix} 🔄 Using Redis (Google Drive conditions not met)`
        );
        return await this.consultarDesdeRedis(
          idEstudiante,
          tipoAsistencia,
          nivel,
          grado,
          seccion
        );
      }

      // Use Google Drive
      console.log(`${this.logPrefix} ☁️ USING GOOGLE DRIVE for query`);
      const cacheKey = `${nivel}_${grado}`;

      // Get the Google Drive ID for date verification
      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
      );
      console.log(
        `${this.logPrefix} 🔗 Redis client obtained for: ${tipoAsistencia}`
      );
      const idsString = await redisInstance.get(
        NOMBRE_CLAVE_GOOGLE_DRIVE_IDs_LISTAS_ASISTENCIAS_ESCOLARES_HOY
      );

      let googleDriveId: string | undefined;
      if (idsString) {
        const ids: GoogleDriveIDsListasAsistenciasEscolaresHoy = JSON.parse(
          idsString as string
        );
        googleDriveId = ids[nivel]?.[grado];
      }

      // Determine what specific data we need to apply the optimization
      const necesitaEntrada = true; // Always need entry
      const necesitaSalida = await this.debeConsultarSalidas(nivel); // Only if enabled and it's time

      console.log(
        `${this.logPrefix} 🎯 Required data: entry=${necesitaEntrada}, exit=${necesitaSalida}`
      );

      const consultaEspecifica = {
        idEstudiante,
        seccion,
        necesitaEntrada,
        necesitaSalida,
      };

      // Show cache statistics
      const statsCache = await CacheListasAsistencia.obtenerEstadisticas();
      console.log(
        `${this.logPrefix} 📊 Current cache status:`,
        JSON.stringify(statsCache, null, 2)
      );

      // Get data from cache (with automatic optimization checking availability)
      let datosLista = await CacheListasAsistencia.obtener(
        cacheKey,
        nivel,
        googleDriveId,
        consultaEspecifica
      );

      if (!datosLista) {
        console.log(
          `${this.logPrefix} 💾 Cache invalidated or empty (specific data not available)`
        );

        // Check if job is running
        const jobEnEjecucion = await this.estaJobEnEjecucion(
          nivel,
          grado,
          tipoAsistencia
        );

        if (jobEnEjecucion) {
          console.log(`${this.logPrefix} 🔄 Job running detected`);

          // Apply fallback probability
          const usarFallback = debeUsarFallbackPorProbabilidad(rol);
          if (usarFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probability allows fallback to Redis`
            );
            return await this.consultarDesdeRedis(
              idEstudiante,
              tipoAsistencia,
              nivel,
              grado,
              seccion
            );
          } else {
            console.log(
              `${this.logPrefix} 🚫 Probability does not allow fallback - No data error`
            );
            return {
              datos: null,
              mensaje: `Student ${idEstudiante} not available - system updating and fallback not allowed for role ${rol}`,
            };
          }
        }

        console.log(
          `${this.logPrefix} 🟢 No job running, proceeding to get from Google Drive`
        );

        try {
          datosLista = await this.obtenerListaDesdeGoogleDrive(
            nivel,
            grado,
            tipoAsistencia
          );

          const estaActualizada = await this.estaActualizada(datosLista, nivel);

          if (!estaActualizada) {
            console.log(`${this.logPrefix} ⚠️ List NOT updated`);
            console.log(
              `${this.logPrefix} 🚀 Triggering list update...`
            );

            // Trigger update but continue with current data
            await this.gatillarActualizacionLista(nivel, grado, seccion);
            console.log(
              `${this.logPrefix} ✅ Update triggered successfully`
            );

            // CONTINUE WITH CURRENT GOOGLE DRIVE DATA (do not fallback to Redis)
            console.log(
              `${this.logPrefix} 📋 Continuing with current Google Drive data`
            );
          } else {
            console.log(`${this.logPrefix} ✅ List is updated`);
          }

          console.log(`${this.logPrefix} 💾 Saving data to cache`);
          await CacheListasAsistencia.guardar(cacheKey, datosLista);
        } catch (error) {
          console.warn(
            `${this.logPrefix} ⚠️ Error getting from Google Drive`,
            error
          );

          // Apply fallback probability
          const usarFallback = debeUsarFallbackPorProbabilidad(rol);
          if (usarFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probability allows fallback to Redis after error`
            );
            return await this.consultarDesdeRedis(
              idEstudiante,
              tipoAsistencia,
              nivel,
              grado,
              seccion
            );
          } else {
            console.log(
              `${this.logPrefix} 🚫 Probability does not allow fallback after error`
            );
            return {
              datos: null,
              mensaje: `Error getting data for ${idEstudiante} and fallback not allowed for role ${rol}`,
            };
          }
        }
      } else {
        console.log(
          `${this.logPrefix} ✅ Data obtained from cache (optimized: availability > update)`
        );
      }

      // Search student in Google Drive data with new structure
      const datosSeccion = datosLista.AsistenciasEscolaresDeHoy[seccion];
      if (!datosSeccion) {
        console.log(
          `${this.logPrefix} ❌ Section ${seccion} not found in Google Drive`
        );

        // Apply fallback probability
        const usarFallback = debeUsarFallbackPorProbabilidad(rol);
        if (usarFallback) {
          console.log(
            `${this.logPrefix} 🎲 Probability allows fallback to Redis for missing section`
          );
          return await this.consultarDesdeRedis(
            idEstudiante,
            tipoAsistencia,
            nivel,
            grado,
            seccion
          );
        } else {
          console.log(
            `${this.logPrefix} 🚫 Probability does not allow fallback for missing section`
          );
          return {
            datos: null,
            mensaje: `Section ${seccion} not found and fallback not allowed for role ${rol}`,
          };
        }
      }

      const asistenciaEstudiante = datosSeccion[idEstudiante];
      console.log(
        `${
          this.logPrefix
        } 🎯 Student ${idEstudiante} found in section ${seccion}: ${!!asistenciaEstudiante}`
      );

      if (!asistenciaEstudiante) {
        console.log(
          `${this.logPrefix} ❌ Student ${idEstudiante} not found in section ${seccion}`
        );

        // Apply fallback probability
        const usarFallback = debeUsarFallbackPorProbabilidad(rol);
        if (usarFallback) {
          console.log(
            `${this.logPrefix} 🎲 Probability allows fallback to Redis for missing student`
          );
          return await this.consultarDesdeRedis(
            idEstudiante,
            tipoAsistencia,
            nivel,
            grado,
            seccion
          );
        } else {
          console.log(
            `${this.logPrefix} 🚫 Probability does not allow fallback for missing student`
          );
          return {
            datos: null,
            mensaje: `Student ${idEstudiante} not found in section ${seccion} and fallback not allowed for role ${rol}`,
          };
        }
      }

      // Build result
      const resultado = await this.construirResultadoEstudiante(
        idEstudiante,
        seccion,
        asistenciaEstudiante,
        nivel
      );
      console.log(
        `${this.logPrefix} ✅ Result successfully built from Google Drive`
      );

      const estadoActualizacion = await this.estaActualizada(datosLista, nivel);

      return {
        datos: resultado,
        mensaje: `Data from Google Drive with cache optimized by availability (${nivel} grade ${grado} section ${seccion}) - Updated: ${estadoActualizacion}`,
      };
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error querying student ${idEstudiante}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Queries attendances for all students in a specific classroom
   * UPDATED: New section structure and mandatory totalEstudiantes parameter
   */
  async consultarPorAula(
    tipoAsistencia: TipoAsistencia,
    nivel: NivelEducativo,
    grado: number,
    seccion: string,
    totalEstudiantes: number,
    rol?: RolesSistema
  ): Promise<ResultadoConsulta> {
    try {
      console.log(
        `${this.logPrefix} 🏫 CONSULTING CLASSROOM: ${nivel} ${grado}° ${seccion} (${totalEstudiantes} expected students)`
      );
      console.log(
        `${this.logPrefix} 📋 Parameters: role=${rol}, type=${tipoAsistencia}`
      );

      // If role is not provided, use Redis directly
      if (!rol) {
        console.log(
          `${this.logPrefix} 🔄 Using Redis directly (no role provided)`
        );
        return await this.consultarAulaDesdeRedis(
          tipoAsistencia,
          nivel,
          grado,
          seccion
        );
      }

      // Determine if Google Drive should be used
      const usarGoogleDrive = await this.debeUsarGoogleDrive(
        rol,
        nivel,
        ModoRegistro.Entrada
      );
      console.log(
        `${this.logPrefix} 🎯 Use Google Drive for classroom?: ${usarGoogleDrive}`
      );

      if (!usarGoogleDrive) {
        console.log(
          `${this.logPrefix} 🔄 Using Redis for classroom (Google Drive conditions not met)`
        );
        return await this.consultarAulaDesdeRedis(
          tipoAsistencia,
          nivel,
          grado,
          seccion
        );
      }

      // Use Google Drive
      console.log(
        `${this.logPrefix} ☁️ USING GOOGLE DRIVE for classroom query`
      );
      const cacheKey = `${nivel}_${grado}`;

      // Get the Google Drive ID for date verification
      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
      );
      console.log(
        `${this.logPrefix} 🔗 Redis client obtained for: ${tipoAsistencia}`
      );
      const idsString = await redisInstance.get(
        NOMBRE_CLAVE_GOOGLE_DRIVE_IDs_LISTAS_ASISTENCIAS_ESCOLARES_HOY
      );

      let googleDriveId: string | undefined;
      if (idsString) {
        const ids: GoogleDriveIDsListasAsistenciasEscolaresHoy = JSON.parse(
          idsString as string
        );
        googleDriveId = ids[nivel]?.[grado];
      }

      // Determine what data we need for the classroom query
      const necesitaEntrada = true;
      const necesitaSalida = await this.debeConsultarSalidas(nivel);

      console.log(
        `${this.logPrefix} 🎯 Required data for classroom: entry=${necesitaEntrada}, exit=${necesitaSalida}`
      );

      const consultaAula = {
        seccion,
        totalEstudiantesEsperados: totalEstudiantes,
        necesitaEntrada,
        necesitaSalida,
      };

      let datosLista = await CacheListasAsistencia.obtener(
        cacheKey,
        nivel,
        googleDriveId,
        undefined,
        consultaAula
      );

      if (!datosLista) {
        console.log(
          `${this.logPrefix} 💾 No data in cache for classroom ${cacheKey} or insufficient`
        );

        // Check if job is running
        const jobEnEjecucion = await this.estaJobEnEjecucion(
          nivel,
          grado,
          tipoAsistencia
        );

        if (jobEnEjecucion) {
          console.log(`${this.logPrefix} 🔄 Job running for classroom`);

          // Apply fallback probability
          const usarFallback = debeUsarFallbackPorProbabilidad(rol);
          if (usarFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probability allows fallback to Redis for classroom`
            );
            return await this.consultarAulaDesdeRedis(
              tipoAsistencia,
              nivel,
              grado,
              seccion
            );
          } else {
            console.log(
              `${this.logPrefix} 🚫 Probability does not allow fallback for classroom`
            );
            return {
              datos: [],
              mensaje: `Classroom ${nivel} ${grado}° ${seccion} not available - system updating and fallback not allowed for role ${rol}`,
            };
          }
        }

        console.log(
          `${this.logPrefix} 🟢 No job running for classroom, getting from Google Drive`
        );

        try {
          datosLista = await this.obtenerListaDesdeGoogleDrive(
            nivel,
            grado,
            tipoAsistencia
          );

          if (!(await this.estaActualizada(datosLista, nivel))) {
            console.log(
              `${this.logPrefix} ⚠️ Classroom list NOT updated, triggering update`
            );
            await this.gatillarActualizacionLista(nivel, grado, seccion);
            console.log(
              `${this.logPrefix} ✅ Classroom update triggered, continuing with current data`
            );
          }

          await CacheListasAsistencia.guardar(cacheKey, datosLista);
        } catch (error) {
          console.warn(
            `${this.logPrefix} ⚠️ Error with Google Drive for classroom`,
            error
          );

          // Apply fallback probability
          const usarFallback = debeUsarFallbackPorProbabilidad(rol);
          if (usarFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probability allows fallback to Redis after classroom error`
            );
            return await this.consultarAulaDesdeRedis(
              tipoAsistencia,
              nivel,
              grado,
              seccion
            );
          } else {
            console.log(
              `${this.logPrefix} 🚫 Probability does not allow fallback after classroom error`
            );
            return {
              datos: [],
              mensaje: `Error getting classroom data and fallback not allowed for role ${rol}`,
            };
          }
        }
      } else {
        console.log(
          `${this.logPrefix} ✅ Classroom data obtained from cache (automatically verified)`
        );
      }

      // Process Google Drive data with new structure
      const datosSeccion = datosLista.AsistenciasEscolaresDeHoy[seccion];
      if (!datosSeccion) {
        console.log(
          `${this.logPrefix} ❌ Section ${seccion} not found in Google Drive`
        );

        // Apply fallback probability
        const usarFallback = debeUsarFallbackPorProbabilidad(rol);
        if (usarFallback) {
          console.log(
            `${this.logPrefix} 🎲 Probability allows fallback to Redis for missing classroom section`
          );
          return await this.consultarAulaDesdeRedis(
            tipoAsistencia,
            nivel,
            grado,
            seccion
          );
        } else {
          console.log(
            `${this.logPrefix} 🚫 Probability does not allow fallback for missing classroom section`
          );
          return {
            datos: [],
            mensaje: `Section ${seccion} not found in classroom and fallback not allowed for role ${rol}`,
          };
        }
      }

      const resultados: AsistenciaDiariaEscolarResultado[] = [];
      console.log(
        `${this.logPrefix} 🔍 Processing Google Drive data for classroom section ${seccion}`
      );

      for (const [idEstudiante, asistencia] of Object.entries(datosSeccion)) {
        if (asistencia.E || asistencia.S) {
          const resultado = await this.construirResultadoEstudiante(
            idEstudiante,
            seccion,
            asistencia,
            nivel
          );
          resultados.push(resultado);
        }
      }

      console.log(
        `${this.logPrefix} 📊 ${resultados.length}/${totalEstudiantes} students processed from Google Drive`
      );

      return {
        datos: resultados,
        mensaje: `${resultados.length}/${totalEstudiantes} students found from Google Drive with automatically verified cache (${nivel} grade ${grado} section ${seccion})`,
      };
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error querying classroom ${nivel} ${grado}° ${seccion}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Queries directly from Redis
   */
  private async consultarDesdeRedis(
    idEstudiante: string,
    tipoAsistencia: TipoAsistencia,
    nivel?: NivelEducativo,
    grado?: number,
    seccion?: string
  ): Promise<ResultadoConsulta> {
    console.log(
      `${this.logPrefix} 🗄️ CONSULTING FROM REDIS: ${idEstudiante}`
    );

    const fechaActual = await this.obtenerFechaActual();
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
    );
    console.log(
      `${this.logPrefix} 🔗 Redis client obtained for: ${tipoAsistencia}`
    );
    // Determine level if not provided
    const nivelDeducido =
      nivel ||
      (tipoAsistencia === TipoAsistencia.ParaEstudiantesPrimaria
        ? NivelEducativo.PRIMARIA
        : NivelEducativo.SECUNDARIA);

    console.log(
      `${this.logPrefix} 📊 Deduced level for Redis: ${nivelDeducido}`
    );

    // Query entry
    let patronBusquedaEntrada: string;
    if (nivel && grado && seccion) {
      patronBusquedaEntrada = `${fechaActual}:${ModoRegistro.Entrada}:${ActoresSistema.Estudiante}:${nivel}:${grado}:${seccion}:${idEstudiante}`;
    } else {
      patronBusquedaEntrada = `${fechaActual}:${ModoRegistro.Entrada}:${ActoresSistema.Estudiante}:*:*:*:${idEstudiante}`;
    }

    console.log(
      `${this.logPrefix} 🔍 Entry search pattern: ${patronBusquedaEntrada}`
    );

    let clavesEntrada: string[];
    if (nivel && grado && seccion) {
      const existeEntrada = await redisClientInstance.exists(
        patronBusquedaEntrada
      );
      clavesEntrada = existeEntrada ? [patronBusquedaEntrada] : [];
    } else {
      clavesEntrada = await redisClientInstance.keys(patronBusquedaEntrada);
    }

    console.log(
      `${this.logPrefix} 📋 Found entry keys: ${clavesEntrada.length}`
    );

    // Build attendance data
    const asistenciaData: {
      E?: { DesfaseSegundos: number };
      S?: { DesfaseSegundos: number };
    } = {};

    // Process entry
    if (clavesEntrada.length > 0) {
      const claveEntrada = clavesEntrada[0];
      console.log(
        `${this.logPrefix} 📥 Processing entry key: ${claveEntrada}`
      );

      const valorEntrada = await redisClientInstance.get(claveEntrada);

      if (
        valorEntrada &&
        Array.isArray(valorEntrada) &&
        valorEntrada.length >= 1
      ) {
        asistenciaData.E = {
          DesfaseSegundos: parseInt(valorEntrada[0] as string),
        };
        console.log(
          `${this.logPrefix} ✅ Entry processed: ${asistenciaData.E.DesfaseSegundos}s`
        );
      }
    }

    // Query exit if applicable
    const debeConsultar = await this.debeConsultarSalidas(nivelDeducido);
    if (debeConsultar) {
      console.log(`${this.logPrefix} 🚪 Must consult exits, searching...`);

      let patronBusquedaSalida: string;
      if (nivel && grado && seccion) {
        patronBusquedaSalida = `${fechaActual}:${ModoRegistro.Salida}:${ActoresSistema.Estudiante}:${nivel}:${grado}:${seccion}:${idEstudiante}`;
      } else {
        patronBusquedaSalida = `${fechaActual}:${ModoRegistro.Salida}:${ActoresSistema.Estudiante}:*:*:*:${idEstudiante}`;
      }

      console.log(
        `${this.logPrefix} 🔍 Exit search pattern: ${patronBusquedaSalida}`
      );

      let clavesSalida: string[];
      if (nivel && grado && seccion) {
        const existeSalida = await redisClientInstance.exists(
          patronBusquedaSalida
        );
        clavesSalida = existeSalida ? [patronBusquedaSalida] : [];
      } else {
        clavesSalida = await redisClientInstance.keys(patronBusquedaSalida);
      }

      console.log(
        `${this.logPrefix} 📋 Found exit keys: ${clavesSalida.length}`
      );

      // Process exit
      if (clavesSalida.length > 0) {
        const claveSalida = clavesSalida[0];
        console.log(
          `${this.logPrefix} 📤 Processing exit key: ${claveSalida}`
        );

        const valorSalida = await redisClientInstance.get(claveSalida);

        if (
          valorSalida &&
          Array.isArray(valorSalida) &&
          valorSalida.length >= 1
        ) {
          asistenciaData.S = {
            DesfaseSegundos: parseInt(valorSalida[0] as string),
          };
          console.log(
            `${this.logPrefix} ✅ Exit processed: ${asistenciaData.S.DesfaseSegundos}s`
          );
        }
      }
    }

    // Check if anything was found
    if (!asistenciaData.E && !asistenciaData.S) {
      console.log(
        `${this.logPrefix} ❌ No data found in Redis for ${idEstudiante}`
      );
      return {
        datos: null,
        mensaje: `Student ${idEstudiante} not found in Redis`,
      };
    }

    // Build result (we need to get section somehow or use generic)
    const seccionParaResultado = seccion || "UNKNOWN";
    const resultado = await this.construirResultadoEstudiante(
      idEstudiante,
      seccionParaResultado,
      asistenciaData,
      nivelDeducido
    );
    console.log(`${this.logPrefix} ✅ Result built from Redis`);

    return {
      datos: resultado,
      mensaje: `Data obtained from Redis`,
    };
  }

  /**
   * Queries classroom directly from Redis
   */
  private async consultarAulaDesdeRedis(
    tipoAsistencia: TipoAsistencia,
    nivel: NivelEducativo,
    grado: number,
    seccion: string
  ): Promise<ResultadoConsulta> {
    console.log(
      `${this.logPrefix} 🗄️ CONSULTING CLASSROOM FROM REDIS: ${nivel} ${grado}° ${seccion}`
    );

    const fechaActual = await this.obtenerFechaActual();
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
    );
    console.log(
      `${this.logPrefix} 🔗 Redis client obtained for: ${tipoAsistencia}`
    );

    // Query entries
    const patronBusquedaEntrada = `${fechaActual}:${ModoRegistro.Entrada}:${ActoresSistema.Estudiante}:${nivel}:${grado}:${seccion}:*`;
    console.log(
      `${this.logPrefix} 🔍 Classroom entry search pattern: ${patronBusquedaEntrada}`
    );

    const clavesEntrada = await redisClientInstance.keys(patronBusquedaEntrada);
    console.log(
      `${this.logPrefix} 📋 Found classroom entry keys: ${clavesEntrada.length}`
    );

    // Create map of students with their attendances
    const estudiantesMap = new Map<
      string,
      { E?: { DesfaseSegundos: number }; S?: { DesfaseSegundos: number } }
    >();

    // Process entries
    for (const clave of clavesEntrada) {
      const valor = await redisClientInstance.get(clave);

      if (valor && Array.isArray(valor) && valor.length >= 1) {
        const partes = clave.split(":");
        if (partes.length >= 7) {
          const idEstudiante = partes[6];
          const desfaseSegundos = parseInt(valor[0] as string);

          if (!estudiantesMap.has(idEstudiante)) {
            estudiantesMap.set(idEstudiante, {});
          }
          estudiantesMap.get(idEstudiante)!.E = {
            DesfaseSegundos: desfaseSegundos,
          };

          console.log(
            `${this.logPrefix} 📥 Entry processed for ${idEstudiante}: ${desfaseSegundos}s`
          );
        }
      }
    }

    // Query exits if applicable
    const debeConsultar = await this.debeConsultarSalidas(nivel);
    if (debeConsultar) {
      console.log(`${this.logPrefix} 🚪 Consulting exits for classroom...`);

      const patronBusquedaSalida = `${fechaActual}:${ModoRegistro.Salida}:${ActoresSistema.Estudiante}:${nivel}:${grado}:${seccion}:*`;
      console.log(
        `${this.logPrefix} 🔍 Classroom exit search pattern: ${patronBusquedaSalida}`
      );

      const clavesSalida = await redisClientInstance.keys(patronBusquedaSalida);
      console.log(
        `${this.logPrefix} 📋 Found classroom exit keys: ${clavesSalida.length}`
      );

      // Process exits
      for (const clave of clavesSalida) {
        const valor = await redisClientInstance.get(clave);

        if (valor && Array.isArray(valor) && valor.length >= 1) {
          const partes = clave.split(":");
          if (partes.length >= 7) {
            const idEstudiante = partes[6];
            const desfaseSegundos = parseInt(valor[0] as string);

            if (!estudiantesMap.has(idEstudiante)) {
              estudiantesMap.set(idEstudiante, {});
            }
            estudiantesMap.get(idEstudiante)!.S = {
              DesfaseSegundos: desfaseSegundos,
            };

            console.log(
              `${this.logPrefix} 📤 Exit processed for ${idEstudiante}: ${desfaseSegundos}s`
            );
          }
        }
      }
    }

    // Build results
    const resultados: AsistenciaDiariaEscolarResultado[] = [];

    for (const [idEstudiante, asistenciaData] of estudiantesMap.entries()) {
      const resultado = await this.construirResultadoEstudiante(
        idEstudiante,
        seccion,
        asistenciaData,
        nivel
      );
      resultados.push(resultado);
    }

    console.log(
      `${this.logPrefix} ✅ ${resultados.length} students processed from Redis`
    );

    return {
      datos: resultados,
      mensaje: `${resultados.length} students found from Redis`,
    };
  }
}