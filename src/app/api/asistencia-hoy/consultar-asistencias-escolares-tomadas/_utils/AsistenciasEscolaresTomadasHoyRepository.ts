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
// CONSTANTES DE CONFIGURACIÓN
// =====================================

/**
 * Activar/desactivar actualización específica por sección en GitHub Actions
 * false = Solo actualiza por grado (comportamiento actual)
 * true = Actualiza específicamente por sección
 */
export const USAR_ACTUALIZACION_POR_SECCION = false;

/**
 * Probabilidad de fallback a Redis por rol (0-100%)
 * 0 = Nunca usar fallback
 * 100 = Siempre usar fallback
 * 50 = 50% de probabilidad de usar fallback
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
 * A partir de cuántas horas antes de la salida se debe consultar asistencias de salida
 */
export const HORAS_ANTES_SALIDA_PARA_CONSULTA: Record<NivelEducativo, number> =
  {
    [NivelEducativo.PRIMARIA]:
      HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_SECUNDARIA, // 1 hora antes de la salida
    [NivelEducativo.SECUNDARIA]:
      HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_PRIMARIA, // 1 hora antes de la salida
  };

/**
 * Configuración de ventanas de tiempo para usar Google Drive
 * [Nivel][Modo]["HorasAntes" | "HorasDespues"]
 */
export const VENTANAS_TIEMPO_GOOGLE_DRIVE = {
  [NivelEducativo.PRIMARIA]: {
    [ModoRegistro.Entrada]: {
      HorasAntes: 1, // 1 hora antes de la hora de entrada
      HorasDespues: 2, // 2 horas después de la hora de entrada
    },
    [ModoRegistro.Salida]: {
      HorasAntes: 1, // 1 hora antes de la hora de salida
      HorasDespues: 2, // 2 horas después de la hora de salida
    },
  },
  [NivelEducativo.SECUNDARIA]: {
    [ModoRegistro.Entrada]: {
      HorasAntes: 1, // 1 hora antes de la hora de entrada
      HorasDespues: 2, // 2 horas después de la hora de entrada
    },
    [ModoRegistro.Salida]: {
      HorasAntes: 1, // 1 hora antes de la hora de salida
      HorasDespues: 2, // 2 horas después de la hora de salida
    },
  },
} as const;

/**
 * Configuración de roles que pueden usar el mecanismo de Google Drive
 */
export const ROLES_CON_GOOGLE_DRIVE: Record<RolesSistema, boolean> = {
  [RolesSistema.Directivo]: true,
  [RolesSistema.ProfesorPrimaria]: true,
  [RolesSistema.Auxiliar]: true,
  [RolesSistema.ProfesorSecundaria]: false, // No tienen acceso a estudiantes
  [RolesSistema.Tutor]: true,
  [RolesSistema.Responsable]: true,
  [RolesSistema.PersonalAdministrativo]: false, // No tienen acceso al endpoint
};

/**
 * Variables de entorno para GitHub Actions
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
  // Nueva estructura: Seccion -> Id_Estudiante -> Asistencia
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
// UTILIDADES DE FECHA SIN new Date()
// =====================================

/**
 * Crea un objeto Date a partir de un string ISO pero usando la referencia de tiempo de Perú
 */
async function crearFechaDesdeString(fechaString: string): Promise<Date> {
  const fechaPeruActual = await obtenerFechaHoraActualPeru();
  const fechaParseada = Date.parse(fechaString);

  if (isNaN(fechaParseada)) {
    console.warn(
      `[FECHA] String de fecha inválido: ${fechaString}, usando fecha actual de Perú`
    );
    return fechaPeruActual;
  }

  return fechaParseada as any;
}

/**
 * Calcula diferencia en milisegundos entre dos fechas usando referencia de Perú
 */
async function calcularDiferenciaMillis(
  fechaString: string,
  fechaReferencia?: Date
): Promise<number> {
  const fechaRef = fechaReferencia || (await obtenerFechaHoraActualPeru());
  const timestampRef = fechaRef.getTime();
  const timestampObjeto = Date.parse(fechaString);

  if (isNaN(timestampObjeto)) {
    console.warn(`[FECHA] No se pudo parsear fecha: ${fechaString}`);
    return 0;
  }

  return timestampRef - timestampObjeto;
}

/**
 * Crea fecha con offset en horas desde la fecha actual de Perú
 */
async function crearFechaConOffset(offsetHoras: number): Promise<Date> {
  const fechaPeruActual = await obtenerFechaHoraActualPeru();
  const timestampConOffset =
    fechaPeruActual.getTime() + offsetHoras * 60 * 60 * 1000;
  return timestampConOffset as any;
}

/**
 * Determina si se debe usar fallback a Redis basado en probabilidad por rol
 * @param rol Rol del usuario que solicita
 * @returns true si debe usar fallback, false si no
 */
function debeUsarFallbackPorProbabilidad(rol: RolesSistema): boolean {
  const probabilidad = PROBABILIDAD_FALLBACK_POR_ROL[rol];
  const numeroAleatorio = Math.floor(Math.random() * 100) + 1; // 1-100

  const usarFallback = numeroAleatorio <= probabilidad;

  console.log(`[FallbackProbabilidad] 🎲 Rol: ${rol}`);
  console.log(
    `[FallbackProbabilidad] 📊 Probabilidad configurada: ${probabilidad}%`
  );
  console.log(`[FallbackProbabilidad] 🎯 Número aleatorio: ${numeroAleatorio}`);
  console.log(`[FallbackProbabilidad] ✅ ¿Usar fallback?: ${usarFallback}`);

  return usarFallback;
}

/**
 * Obtiene el intervalo de actualización según el nivel educativo
 */
function obtenerIntervaloActualizacion(nivel: NivelEducativo): number {
  return nivel === NivelEducativo.PRIMARIA
    ? INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_PRIMARIA
    : INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_SECUNDARIA;
}

// =====================================
// CACHE SIMPLIFICADO BASADO EN FECHA DE ARCHIVO CON NUEVA ESTRUCTURA
// =====================================

class CacheListasAsistencia {
  private static cache = new Map<
    string,
    {
      datos: AsistenciasEscolaresArchivo;
      fechaActualizacionArchivo: number; // Timestamp de Fecha_Actualizacion del archivo
    }
  >();

  /**
   * Obtiene los metadatos del archivo desde Google Drive sin descargarlo completamente
   */
  private static async obtenerFechaArchivoGoogleDrive(
    googleDriveId: string
  ): Promise<number | null> {
    try {
      console.log(
        `[CacheListasAsistencia] 🔍 Obteniendo fecha de archivo: ${googleDriveId}`
      );

      // Intentar obtener solo el header del archivo para verificar su fecha de modificación
      const url = `https://drive.google.com/uc?export=download&id=${googleDriveId}`;

      // Realizar una petición HEAD para obtener headers sin descargar el contenido
      const response = await fetch(url, { method: "HEAD" });

      if (response.ok) {
        const lastModified = response.headers.get("last-modified");
        if (lastModified) {
          const fechaModificacion = Date.parse(lastModified);
          console.log(
            `[CacheListasAsistencia] 📅 Fecha modificación del archivo (header): ${new Date(
              fechaModificacion
            ).toISOString()}`
          );
          return fechaModificacion;
        }
      }

      // Si el método HEAD no funciona, hacer una petición con Range para obtener solo el inicio del archivo
      console.log(
        `[CacheListasAsistencia] ⚠️ HEAD no disponible, intentando con Range...`
      );

      const rangeResponse = await fetch(url, {
        headers: {
          Range: "bytes=0-1023", // Solo los primeros 1024 bytes
        },
      });

      if (rangeResponse.ok || rangeResponse.status === 206) {
        // 206 = Partial Content
        const contenidoParcial = await rangeResponse.text();

        // Buscar la fecha de actualización en el JSON parcial
        const match = contenidoParcial.match(
          /"Fecha_Actualizacion"\s*:\s*"([^"]+)"/
        );
        if (match) {
          const fechaArchivo = Date.parse(match[1]);
          console.log(
            `[CacheListasAsistencia] 📅 Fecha archivo (desde JSON parcial): ${match[1]}`
          );
          return fechaArchivo;
        }
      }

      console.log(
        `[CacheListasAsistencia] ❌ No se pudo obtener fecha del archivo`
      );
      return null;
    } catch (error) {
      console.error(
        `[CacheListasAsistencia] ❌ Error al obtener fecha de archivo:`,
        error
      );
      return null;
    }
  }

  /**
   * Verifica si los datos están actualizados internamente
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
      razon: `Diferencia: ${diferenciaMinutos.toFixed(
        2
      )} min vs límite (${nivel}): ${intervaloMaximo} min`,
    };
  }

  /**
   * Verifica si los datos específicos solicitados están disponibles en el cache
   * Actualizado para trabajar con la nueva estructura por sección
   */
  private static verificarDisponibilidadDatos(
    datos: AsistenciasEscolaresArchivo,
    idEstudiante: string,
    seccion: string,
    necesitaEntrada: boolean,
    necesitaSalida: boolean
  ): { disponible: boolean; razon: string } {
    // Verificar si existe la sección
    const datosSeccion = datos.AsistenciasEscolaresDeHoy[seccion];
    if (!datosSeccion) {
      return {
        disponible: false,
        razon: `Sección ${seccion} no encontrada en datos`,
      };
    }

    // Verificar si existe el estudiante en esa sección
    const asistenciaEstudiante = datosSeccion[idEstudiante];
    if (!asistenciaEstudiante) {
      return {
        disponible: false,
        razon: `Estudiante ${idEstudiante} no encontrado en sección ${seccion}`,
      };
    }

    // Verificar disponibilidad según lo que se necesita
    const tieneEntrada = !!asistenciaEstudiante.E;
    const tieneSalida = !!asistenciaEstudiante.S;

    if (necesitaEntrada && !tieneEntrada) {
      return {
        disponible: false,
        razon: `Falta entrada para estudiante ${idEstudiante} en sección ${seccion}`,
      };
    }

    if (necesitaSalida && !tieneSalida) {
      return {
        disponible: false,
        razon: `Falta salida para estudiante ${idEstudiante} en sección ${seccion}`,
      };
    }

    return {
      disponible: true,
      razon: `Datos disponibles en sección ${seccion}: entrada=${tieneEntrada}, salida=${tieneSalida}`,
    };
  }

  /**
   * Verifica disponibilidad para consulta por aula
   * Compara con el total de estudiantes esperados
   */
  private static verificarDisponibilidadAula(
    datos: AsistenciasEscolaresArchivo,
    seccion: string,
    totalEstudiantesEsperados: number,
    necesitaEntrada: boolean,
    necesitaSalida: boolean
  ): { disponible: boolean; razon: string } {
    // Verificar si existe la sección
    const datosSeccion = datos.AsistenciasEscolaresDeHoy[seccion];
    if (!datosSeccion) {
      return {
        disponible: false,
        razon: `Sección ${seccion} no encontrada en datos`,
      };
    }

    const estudiantesEncontrados = Object.keys(datosSeccion);
    const cantidadEncontrados = estudiantesEncontrados.length;

    // Verificar si tenemos el número esperado de estudiantes
    if (cantidadEncontrados < totalEstudiantesEsperados) {
      return {
        disponible: false,
        razon: `Faltan estudiantes en sección ${seccion}: encontrados ${cantidadEncontrados}/${totalEstudiantesEsperados}`,
      };
    }

    // Verificar disponibilidad de datos según lo que se necesita
    let estudiantesConEntrada = 0;
    let estudiantesConSalida = 0;

    for (const [idEstudiante, asistencia] of Object.entries(datosSeccion)) {
      if (asistencia.E) estudiantesConEntrada++;
      if (asistencia.S) estudiantesConSalida++;
    }

    // Para consultas de aula, verificar que al menos algunos estudiantes tengan los datos necesarios
    const porcentajeMinimo = 0.8; // 80% de los estudiantes deben tener los datos
    const minimoRequerido = Math.ceil(cantidadEncontrados * porcentajeMinimo);

    if (necesitaEntrada && estudiantesConEntrada < minimoRequerido) {
      return {
        disponible: false,
        razon: `Insuficientes entradas en sección ${seccion}: ${estudiantesConEntrada}/${minimoRequerido} requeridos`,
      };
    }

    if (necesitaSalida && estudiantesConSalida < minimoRequerido) {
      return {
        disponible: false,
        razon: `Insuficientes salidas en sección ${seccion}: ${estudiantesConSalida}/${minimoRequerido} requeridos`,
      };
    }

    return {
      disponible: true,
      razon: `Datos suficientes en sección ${seccion}: ${cantidadEncontrados}/${totalEstudiantesEsperados} estudiantes, entradas=${estudiantesConEntrada}, salidas=${estudiantesConSalida}`,
    };
  }

  /**
   * Verifica si el cache necesita actualizarse considerando disponibilidad de datos específicos
   * OPTIMIZADO: Solo hace fetch a Google Drive si realmente es necesario
   * ACTUALIZADO: Trabajar con nueva estructura por sección
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
      `[CacheListasAsistencia] 🔍 Verificando necesidad de actualización para: ${clave}`
    );

    // 1. PRIMERA PRIORIDAD: Si hay consulta específica de estudiante, verificar disponibilidad ANTES de hacer fetch
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
        `[CacheListasAsistencia] 📊 Disponibilidad datos estudiante: ${razonDisponibilidad}`
      );

      // Si los datos específicos están disponibles, no actualizar - NO HACER FETCH
      if (disponible) {
        console.log(
          `[CacheListasAsistencia] ✅ DATOS ESTUDIANTE DISPONIBLES - No actualizar, evitando fetch`
        );
        return {
          necesitaActualizacion: false,
          razon: `Datos estudiante disponibles (${razonDisponibilidad}) - Sin fetch a Google Drive`,
        };
      }

      console.log(
        `[CacheListasAsistencia] ❌ DATOS ESTUDIANTE FALTANTES - Verificando actualización`
      );
    }

    // 2. SEGUNDA PRIORIDAD: Si hay consulta de aula, verificar disponibilidad ANTES de hacer fetch
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
        `[CacheListasAsistencia] 📊 Disponibilidad datos aula: ${razonDisponibilidad}`
      );

      // Para consultas de aula, SIEMPRE actualizar si está vencido (como solicitó el usuario)
      const datosActualizados = await this.estaActualizadaInternamente(
        entrada.datos,
        nivel
      );
      const datosInternosDesactualizados = !datosActualizados.estaActualizada;

      if (datosInternosDesactualizados) {
        console.log(
          `[CacheListasAsistencia] ⚠️ CONSULTA AULA + DATOS VENCIDOS - Actualizar obligatoriamente`
        );

        // Hacer fetch para verificar si hay versión más nueva
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
            razon: `Consulta aula + archivo más reciente (diferencia: ${diferenciaMinutos.toFixed(
              2
            )} min)`,
          };
        }

        return {
          necesitaActualizacion: true,
          razon: `Consulta aula + datos internos desactualizados: ${datosActualizados.razon}`,
        };
      }

      // Si los datos están actualizados y suficientes, no actualizar
      if (disponible) {
        console.log(
          `[CacheListasAsistencia] ✅ DATOS AULA SUFICIENTES Y ACTUALIZADOS - No actualizar`
        );
        return {
          necesitaActualizacion: false,
          razon: `Datos aula suficientes y actualizados (${razonDisponibilidad})`,
        };
      }

      // Si faltan datos pero están actualizados, actualizar
      console.log(
        `[CacheListasAsistencia] ❌ DATOS AULA INSUFICIENTES - Actualizar`
      );
      return {
        necesitaActualizacion: true,
        razon: `Datos aula insuficientes: ${razonDisponibilidad}`,
      };
    }

    // 3. Verificar si los datos internos están desactualizados (sin fetch)
    const datosActualizados = await this.estaActualizadaInternamente(
      entrada.datos,
      nivel
    );
    const datosInternosDesactualizados = !datosActualizados.estaActualizada;

    // 4. SOLO si los datos internos están desactualizados Y faltan datos específicos, hacer fetch a Google Drive
    if (consultaEspecifica && datosInternosDesactualizados) {
      console.log(
        `[CacheListasAsistencia] 🌐 Datos internos desactualizados y faltan datos específicos - Haciendo fetch a Google Drive`
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
          razon: `Datos faltantes + archivo más reciente en Google Drive (diferencia: ${diferenciaMinutos.toFixed(
            2
          )} min)`,
        };
      }

      return {
        necesitaActualizacion: true,
        razon: `Datos específicos no disponibles + datos internos desactualizados: ${datosActualizados.razon}`,
      };
    }

    // 5. Para consultas específicas con datos internos actualizados, no actualizar
    if (consultaEspecifica && !datosInternosDesactualizados) {
      return {
        necesitaActualizacion: true,
        razon: `Datos específicos no disponibles pero datos internos aún válidos - Actualizar para obtener datos faltantes`,
      };
    }

    // 6. Sin consulta específica, aplicar lógica tradicional (hacer fetch)
    console.log(
      `[CacheListasAsistencia] 🌐 Sin consulta específica - Verificación tradicional con fetch`
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
        razon: `Archivo más reciente detectado en Google Drive (diferencia: ${diferenciaMinutos.toFixed(
          2
        )} min)`,
      };
    }

    if (datosInternosDesactualizados) {
      return {
        necesitaActualizacion: true,
        razon: `Datos internos desactualizados: ${datosActualizados.razon}`,
      };
    }

    return {
      necesitaActualizacion: false,
      razon: "Cache válido - archivo y datos internos actualizados",
    };
  }

  /**
   * Obtiene datos del cache, verificando automáticamente si hay versiones más nuevas
   * OPTIMIZACIÓN: Prioriza disponibilidad de datos sobre actualización
   * ACTUALIZADO: Soporte para nueva estructura por sección y consultas de aula
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
        `[CacheListasAsistencia] ❌ No hay entrada en cache para: ${clave}`
      );
      return null;
    }

    console.log(`[CacheListasAsistencia] 📊 Verificando cache para: ${clave}`);
    console.log(
      `[CacheListasAsistencia] 📅 Fecha archivo en cache: ${entrada.datos.Fecha_Actualizacion}`
    );

    // Si hay consulta específica, imprimir lo que se busca
    if (consultaEspecifica) {
      console.log(
        `[CacheListasAsistencia] 🎯 Consulta específica: estudiante=${consultaEspecifica.idEstudiante}, sección=${consultaEspecifica.seccion}, entrada=${consultaEspecifica.necesitaEntrada}, salida=${consultaEspecifica.necesitaSalida}`
      );
    }

    if (consultaAula) {
      console.log(
        `[CacheListasAsistencia] 🏫 Consulta aula: sección=${consultaAula.seccion}, totalEsperados=${consultaAula.totalEstudiantesEsperados}, entrada=${consultaAula.necesitaEntrada}, salida=${consultaAula.necesitaSalida}`
      );
    }

    // Si no se proporciona googleDriveId, solo verificar datos internos
    if (!googleDriveId) {
      const datosActualizados = await this.estaActualizadaInternamente(
        entrada.datos,
        nivel
      );

      if (!datosActualizados.estaActualizada) {
        console.log(
          `[CacheListasAsistencia] 🗑️ Cache invalidado por datos internos: ${datosActualizados.razon}`
        );
        this.cache.delete(clave);
        return null;
      }

      console.log(
        `[CacheListasAsistencia] ✅ Cache válido (verificación interna): ${clave}`
      );
      return entrada.datos;
    }

    // Verificación completa con optimización de disponibilidad de datos
    const { necesitaActualizacion, razon } = await this.necesitaActualizacion(
      clave,
      googleDriveId,
      entrada,
      nivel,
      consultaEspecifica,
      consultaAula
    );

    console.log(`[CacheListasAsistencia] 🎯 Resultado verificación: ${razon}`);

    if (necesitaActualizacion) {
      console.log(
        `[CacheListasAsistencia] 🗑️ Invalidando cache: ${clave} - ${razon}`
      );
      this.cache.delete(clave);
      return null;
    }

    console.log(`[CacheListasAsistencia] ✅ Cache válido: ${clave}`);
    return entrada.datos;
  }

  static async guardar(
    clave: string,
    datos: AsistenciasEscolaresArchivo
  ): Promise<void> {
    const fechaActualizacionArchivo = Date.parse(datos.Fecha_Actualizacion);

    console.log(`[CacheListasAsistencia] 💾 Guardando en cache: ${clave}`);
    console.log(
      `[CacheListasAsistencia] 📅 Fecha actualización archivo: ${datos.Fecha_Actualizacion}`
    );

    this.cache.set(clave, {
      datos,
      fechaActualizacionArchivo,
    });
  }

  static limpiar(clave?: string): void {
    if (clave) {
      console.log(
        `[CacheListasAsistencia] 🧹 Limpiando cache específico: ${clave}`
      );
      this.cache.delete(clave);
    } else {
      console.log(`[CacheListasAsistencia] 🧹 Limpiando todo el cache`);
      this.cache.clear();
    }
  }

  static async obtenerEstadisticas(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const [clave, entrada] of this.cache.entries()) {
      // Para estadísticas, usar PRIMARIA como default ya que no tenemos el nivel en la clave
      const nivelDefault = NivelEducativo.PRIMARIA;
      const datosInternos = await this.estaActualizadaInternamente(
        entrada.datos,
        nivelDefault
      );

      // Contar total de estudiantes en todas las secciones
      let totalEstudiantes = 0;
      for (const seccion of Object.values(
        entrada.datos.AsistenciasEscolaresDeHoy || {}
      )) {
        totalEstudiantes += Object.keys(seccion).length;
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
// REPOSITORIO PRINCIPAL ACTUALIZADO
// =====================================

export class AsistenciasEscolaresHoyRepository {
  private logPrefix = "[AsistenciasRepo]";

  /**
   * Obtiene la fecha actual en formato YYYY-MM-DD
   */
  async obtenerFechaActual(): Promise<string> {
    const fecha = await obtenerFechaActualPeru();
    console.log(`${this.logPrefix} 📅 Fecha actual obtenida: ${fecha}`);
    return fecha;
  }

  /**
   * Verifica si debe consultar asistencias de salida
   */
  private async debeConsultarSalidas(nivel: NivelEducativo): Promise<boolean> {
    console.log(
      `${this.logPrefix} 🚪 Verificando si debe consultar salidas para ${nivel}`
    );

    // Verificar constantes de control
    const controlarSalidas =
      nivel === NivelEducativo.PRIMARIA
        ? CONTROL_ASISTENCIA_DE_SALIDA_PRIMARIA
        : CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA;

    console.log(
      `${this.logPrefix} ⚙️ Control de salidas ${nivel}: ${controlarSalidas}`
    );

    if (!controlarSalidas) {
      console.log(
        `${this.logPrefix} ❌ Control de salidas deshabilitado para ${nivel}`
      );
      return false;
    }

    try {
      // Obtener horarios del sistema
      const { datos: datosAsistencia } = await obtenerDatosAsistenciaHoy();

      const ahora = await obtenerFechaHoraActualPeru();
      const horasAntes = HORAS_ANTES_SALIDA_PARA_CONSULTA[nivel];

      console.log(
        `${this.logPrefix} ⏰ Horas antes configuradas: ${horasAntes}`
      );
      console.log(
        `${this.logPrefix} 🕐 Hora actual (Perú): ${ahora.toISOString()}`
      );

      // Obtener hora de salida según el nivel y crear timestamp
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

      // Calcular límite usando timestamps
      const horaSalidaTimestamp = Date.parse(horaSalidaString);
      const limiteTiempoTimestamp =
        horaSalidaTimestamp - horasAntes * 60 * 60 * 1000;
      const ahoraTimestamp = ahora.getTime();

      const debeConsultar = ahoraTimestamp >= limiteTiempoTimestamp;

      console.log(
        `${this.logPrefix} 🚪 Hora salida ${nivel}: ${horaSalidaString}`
      );
      console.log(
        `${this.logPrefix} ⏰ Límite tiempo (timestamp): ${limiteTiempoTimestamp}`
      );
      console.log(`${this.logPrefix} 🕐 Ahora (timestamp): ${ahoraTimestamp}`);
      console.log(
        `${this.logPrefix} ✅ ¿Debe consultar salidas?: ${debeConsultar}`
      );

      return debeConsultar;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error al verificar si debe consultar salidas:`,
        error
      );
      return false;
    }
  }

  /**
   * Verifica si estamos en la ventana de tiempo para usar Google Drive
   */
  private async estaEnVentanaTiempo(
    nivel: NivelEducativo,
    modo: ModoRegistro
  ): Promise<boolean> {
    try {
      console.log(
        `${this.logPrefix} 🕐 Verificando ventana de tiempo para ${nivel} - ${modo}`
      );

      // Obtener horarios del sistema
      const { datos: datosAsistencia } = await obtenerDatosAsistenciaHoy();
      console.log(`${this.logPrefix} ✅ Datos de asistencia obtenidos`);

      const ahora = await obtenerFechaHoraActualPeru();
      const ventana = VENTANAS_TIEMPO_GOOGLE_DRIVE[nivel][modo];

      console.log(
        `${this.logPrefix} 📊 Configuración ventana: ${ventana.HorasAntes}h antes, ${ventana.HorasDespues}h después`
      );
      console.log(
        `${this.logPrefix} 🕐 Hora actual (Perú): ${ahora.toISOString()}`
      );

      // Obtener hora objetivo según el nivel y modo
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

      // Calcular ventana de tiempo usando timestamps
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
        `${this.logPrefix} 🎯 Hora objetivo (${modo}): ${horaObjetivoString}`
      );
      console.log(
        `${this.logPrefix} 🎯 Hora objetivo (timestamp): ${horaObjetivoTimestamp}`
      );
      console.log(
        `${this.logPrefix} 🟢 Inicio ventana (timestamp): ${inicioVentanaTimestamp}`
      );
      console.log(
        `${this.logPrefix} 🔴 Fin ventana (timestamp): ${finVentanaTimestamp}`
      );
      console.log(`${this.logPrefix} 🕐 Ahora (timestamp): ${ahoraTimestamp}`);
      console.log(
        `${this.logPrefix} ✨ ¿Está en ventana? (usando hora Perú): ${estaEnVentana}`
      );

      return estaEnVentana;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error al verificar ventana de tiempo:`,
        error
      );
      return false;
    }
  }

  /**
   * Verifica si debe usar el mecanismo de Google Drive
   */
  private async debeUsarGoogleDrive(
    rol: RolesSistema,
    nivel: NivelEducativo,
    modo: ModoRegistro
  ): Promise<boolean> {
    console.log(
      `${this.logPrefix} 🔍 Verificando si debe usar Google Drive para rol: ${rol}`
    );

    // Verificar si el rol puede usar Google Drive
    const rolPermitido = ROLES_CON_GOOGLE_DRIVE[rol];
    console.log(`${this.logPrefix} 👤 ¿Rol ${rol} permitido?: ${rolPermitido}`);

    if (!rolPermitido) {
      console.log(
        `${this.logPrefix} ❌ Rol ${rol} no tiene permisos para Google Drive`
      );
      return false;
    }

    // Verificar ventana de tiempo
    const enVentana = await this.estaEnVentanaTiempo(nivel, modo);
    console.log(`${this.logPrefix} 🕐 ¿En ventana de tiempo?: ${enVentana}`);

    const resultado = rolPermitido && enVentana;
    console.log(
      `${this.logPrefix} 🎯 Resultado final debeUsarGoogleDrive: ${resultado}`
    );

    return resultado;
  }

  /**
   * Construye el resultado para un estudiante individual
   * ACTUALIZADO: Trabajar con nueva estructura por sección
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
      `${this.logPrefix} 🔨 Construyendo resultado para estudiante: ${idEstudiante} en sección ${seccion}`
    );

    const asistencia: AsistenciaEscolarDeUnDia = {} as AsistenciaEscolarDeUnDia;

    // Siempre incluir entrada si existe
    if (asistenciaData.E) {
      console.log(
        `${this.logPrefix} ✅ Entrada encontrada para ${idEstudiante}: ${asistenciaData.E.DesfaseSegundos}s`
      );
      asistencia[ModoRegistro.Entrada] = {
        DesfaseSegundos: asistenciaData.E.DesfaseSegundos,
      };
    } else {
      console.log(`${this.logPrefix} ❌ Sin entrada para ${idEstudiante}`);
      asistencia[ModoRegistro.Entrada] = null;
    }

    // Incluir salida solo si debe consultarla y existe
    const debeConsultar = await this.debeConsultarSalidas(nivel);
    if (debeConsultar && asistenciaData.S) {
      console.log(
        `${this.logPrefix} 🚪 Salida encontrada para ${idEstudiante}: ${asistenciaData.S.DesfaseSegundos}s`
      );
      asistencia[ModoRegistro.Salida] = {
        DesfaseSegundos: asistenciaData.S.DesfaseSegundos,
      };
    } else if (debeConsultar) {
      console.log(
        `${this.logPrefix} ❌ Sin salida para ${idEstudiante} (debe consultar pero no existe)`
      );
    }

    const tieneAsistencia = Object.keys(asistencia).some(
      (key) => asistencia[key as keyof AsistenciaEscolarDeUnDia] !== null
    );

    console.log(
      `${this.logPrefix} 📊 Resultado para ${idEstudiante}: tieneAsistencia=${tieneAsistencia}`
    );

    return {
      Id_Estudiante: idEstudiante,
      AsistenciaMarcada: tieneAsistencia,
      Asistencia: tieneAsistencia ? asistencia : null,
    };
  }

  /**
   * Verifica si una lista está actualizada
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
      `${this.logPrefix} 📅 Fecha actualización archivo: ${datos.Fecha_Actualizacion}`
    );
    console.log(
      `${this.logPrefix} 🕐 Hora actual (Perú): ${ahoraFecha.toISOString()}`
    );
    console.log(
      `${this.logPrefix} ⏱️ Diferencia en minutos: ${diferenciaMinutos.toFixed(
        2
      )}`
    );
    console.log(
      `${this.logPrefix} ⚙️ Intervalo máximo configurado para ${nivel}: ${intervaloMaximo} min`
    );
    console.log(
      `${this.logPrefix} ✅ ¿Está actualizada? (usando hora Perú): ${estaActualizada}`
    );

    return estaActualizada;
  }

  /**
   * Verifica si un job está en ejecución
   */
  private async estaJobEnEjecucion(
    nivel: NivelEducativo,
    grado: number,
    tipoAsistencia: TipoAsistencia
  ): Promise<boolean> {
    try {
      console.log(
        `${this.logPrefix} 🔄 Verificando job en ejecución para ${nivel} grado ${grado}`
      );

      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
      );
      
      console.log(
        `${this.logPrefix} 🔗 Cliente Redis obtenido para: ${tipoAsistencia}`
      );
      const jobsString = await redisInstance.get(
        NOMBRE_CLAVE_JOBS_EN_EJECUCION_LISTAS_ASISTENCIAS_ESCOLARES_HOY
      );

      console.log(
        `${this.logPrefix} 📦 Jobs string obtenido de Redis: ${
          jobsString ? "Existe" : "No existe"
        }`
      );

      if (!jobsString) {
        console.log(
          `${this.logPrefix} ✅ No hay jobs en ejecución (Redis vacío)`
        );
        return false;
      }

      const jobs: JobsEnEjecucionListasAsistenciasEscolaresHoy = JSON.parse(
        jobsString as string
      );
      const jobEnEjecucion = jobs[nivel]?.[grado] === true;

      console.log(
        `${this.logPrefix} 📋 Jobs parseados:`,
        JSON.stringify(jobs, null, 2)
      );
      console.log(
        `${this.logPrefix} 🎯 Job específico (${nivel} grado ${grado}): ${jobEnEjecucion}`
      );

      return jobEnEjecucion;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error al verificar jobs en ejecución:`,
        error
      );
      return false;
    }
  }

  /**
   * Gatilla la actualización de una lista específica via GitHub Actions
   * ACTUALIZADO: Soporte para actualización por sección
   */
  private async gatillarActualizacionLista(
    nivel: NivelEducativo,
    grado: number,
    seccion?: string
  ): Promise<void> {
    try {
      console.log(
        `${this.logPrefix} 🚀 INICIANDO GATILLADO para ${nivel} grado ${grado}${
          seccion ? ` sección ${seccion}` : ""
        }`
      );

      // Verificar configuración de GitHub
      console.log(
        `${this.logPrefix} 🔑 GitHub Token existe: ${!!GITHUB_CONFIG.TOKEN}`
      );
      console.log(
        `${this.logPrefix} 👤 Repository Owner: ${GITHUB_CONFIG.REPOSITORY_OWNER}`
      );
      console.log(
        `${this.logPrefix} 📁 Repository Name: ${GITHUB_CONFIG.REPOSITORY_NAME}`
      );

      if (!GITHUB_CONFIG.TOKEN) {
        throw new Error("TOKEN de GitHub no configurado");
      }

      if (!GITHUB_CONFIG.REPOSITORY_OWNER || !GITHUB_CONFIG.REPOSITORY_NAME) {
        throw new Error("Configuración de repositorio de GitHub incompleta");
      }

      const url = `https://api.github.com/repos/${GITHUB_CONFIG.REPOSITORY_OWNER}/${GITHUB_CONFIG.REPOSITORY_NAME}/dispatches`;
      console.log(`${this.logPrefix} 🌐 URL GitHub Actions: ${url}`);

      const payload = {
        event_type: "actualizar-listas-asistencia-hoy",
        client_payload: {
          nivel: nivel,
          grado: grado.toString(),
          ...(USAR_ACTUALIZACION_POR_SECCION && seccion ? { seccion } : {}),
        },
      };

      console.log(
        `${this.logPrefix} 📦 Payload a enviar:`,
        JSON.stringify(payload, null, 2)
      );
      console.log(
        `${this.logPrefix} ⚙️ Actualización por sección habilitada: ${USAR_ACTUALIZACION_POR_SECCION}`
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
        `${this.logPrefix} 📡 Respuesta GitHub Actions - Status: ${response.status}`
      );
      console.log(
        `${this.logPrefix} 📡 Respuesta GitHub Actions - StatusText: ${response.statusText}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${this.logPrefix} ❌ Error response body:`, errorText);
        throw new Error(
          `Error al gatillar GitHub Action: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      console.log(
        `${
          this.logPrefix
        } ✅ GitHub Action gatillado exitosamente para ${nivel} grado ${grado}${
          seccion ? ` sección ${seccion}` : ""
        }`
      );
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error al gatillar GitHub Action:`,
        error
      );
      throw error;
    }
  }

  /**
   * Obtiene una lista de asistencias desde Google Drive
   */
  private async obtenerListaDesdeGoogleDrive(
    nivel: NivelEducativo,
    grado: number,
    tipoAsistencia: TipoAsistencia
  ): Promise<AsistenciasEscolaresArchivo> {
    try {
      console.log(
        `${this.logPrefix} 📥 Obteniendo lista desde Google Drive: ${nivel} grado ${grado}`
      );

      // Obtener instancia de Redis según el tipo de asistencia
      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
      );
      console.log(
        `${this.logPrefix} 🔗 Cliente Redis obtenido para: ${tipoAsistencia}`
      );
      console.log(
        `${this.logPrefix} 🔗 Cliente Redis obtenido para: ${tipoAsistencia}`
      );

      // Obtener IDs de Google Drive
      const idsString = await redisInstance.get(
        NOMBRE_CLAVE_GOOGLE_DRIVE_IDs_LISTAS_ASISTENCIAS_ESCOLARES_HOY
      );

      console.log(
        `${this.logPrefix} 🔑 IDs string obtenido de Redis: ${
          idsString ? "Existe" : "No existe"
        }`
      );

      if (!idsString) {
        throw new Error("No se encontraron IDs de Google Drive en Redis");
      }

      const ids: GoogleDriveIDsListasAsistenciasEscolaresHoy = JSON.parse(
        idsString as string
      );
      console.log(
        `${this.logPrefix} 📋 IDs parseados:`,
        JSON.stringify(ids, null, 2)
      );

      const googleDriveId = ids[nivel]?.[grado];
      console.log(
        `${this.logPrefix} 🎯 ID específico para ${nivel} grado ${grado}: ${googleDriveId}`
      );

      if (!googleDriveId) {
        throw new Error(
          `No se encontró ID de Google Drive para ${nivel} grado ${grado}`
        );
      }

      // Descargar archivo desde Google Drive
      const url = `https://drive.google.com/uc?export=download&id=${googleDriveId}`;
      console.log(`${this.logPrefix} 🌐 URL Google Drive: ${url}`);

      const response = await fetch(url);
      console.log(
        `${this.logPrefix} 📡 Respuesta Google Drive - Status: ${response.status}`
      );

      if (!response.ok) {
        throw new Error(
          `Error al descargar desde Google Drive: ${response.status} ${response.statusText}`
        );
      }

      const datos = await response.json();
      console.log(
        `${this.logPrefix} 📄 Datos obtenidos - Fecha actualización: ${datos.Fecha_Actualizacion}`
      );

      // Contar estudiantes en nueva estructura por sección
      let totalEstudiantes = 0;
      for (const seccion of Object.values(
        datos.AsistenciasEscolaresDeHoy || {}
      )) {
        totalEstudiantes += Object.keys(seccion as Record<string, any>).length;
      }

      console.log(
        `${
          this.logPrefix
        } 📊 Total estudiantes en archivo: ${totalEstudiantes} distribuidos en ${
          Object.keys(datos.AsistenciasEscolaresDeHoy || {}).length
        } secciones`
      );

      return datos;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error al obtener lista desde Google Drive:`,
        error
      );
      throw error;
    }
  }

  /**
   * Consulta la asistencia de un estudiante específico por su ID
   * ACTUALIZADO: Nueva estructura por sección y sistema de probabilidad de fallback
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
        `${this.logPrefix} 🔍 CONSULTANDO ESTUDIANTE: ${idEstudiante}`
      );
      console.log(
        `${this.logPrefix} 📋 Parámetros: rol=${rol}, nivel=${nivel}, grado=${grado}, sección=${seccion}`
      );

      // Si no se proporciona rol o seccion, usar Redis directamente
      if (!rol || !nivel || !grado || !seccion) {
        console.log(
          `${this.logPrefix} 🔄 Usando Redis directamente (faltan parámetros para Google Drive)`
        );
        return await this.consultarDesdeRedis(
          idEstudiante,
          tipoAsistencia,
          nivel,
          grado,
          seccion
        );
      }

      // Determinar si debe usar Google Drive
      const usarGoogleDrive = await this.debeUsarGoogleDrive(
        rol,
        nivel,
        ModoRegistro.Entrada
      );
      console.log(
        `${this.logPrefix} 🎯 ¿Usar Google Drive?: ${usarGoogleDrive}`
      );

      if (!usarGoogleDrive) {
        console.log(
          `${this.logPrefix} 🔄 Usando Redis (no se cumplen condiciones para Google Drive)`
        );
        return await this.consultarDesdeRedis(
          idEstudiante,
          tipoAsistencia,
          nivel,
          grado,
          seccion
        );
      }

      // Usar Google Drive
      console.log(`${this.logPrefix} ☁️ USANDO GOOGLE DRIVE para consulta`);
      const cacheKey = `${nivel}_${grado}`;

      // Obtener el Google Drive ID para verificación de fecha
      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
      );
      console.log(
        `${this.logPrefix} 🔗 Cliente Redis obtenido para: ${tipoAsistencia}`
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

      // Determinar qué datos específicos necesitamos para aplicar la optimización
      const necesitaEntrada = true; // Siempre necesitamos entrada
      const necesitaSalida = await this.debeConsultarSalidas(nivel); // Solo si está habilitada y es la hora

      console.log(
        `${this.logPrefix} 🎯 Datos requeridos: entrada=${necesitaEntrada}, salida=${necesitaSalida}`
      );

      const consultaEspecifica = {
        idEstudiante,
        seccion,
        necesitaEntrada,
        necesitaSalida,
      };

      // Mostrar estadísticas del cache
      const statsCache = await CacheListasAsistencia.obtenerEstadisticas();
      console.log(
        `${this.logPrefix} 📊 Estado actual del cache:`,
        JSON.stringify(statsCache, null, 2)
      );

      // Obtener datos del cache (con verificación automática optimizada por disponibilidad)
      let datosLista = await CacheListasAsistencia.obtener(
        cacheKey,
        nivel,
        googleDriveId,
        consultaEspecifica
      );

      if (!datosLista) {
        console.log(
          `${this.logPrefix} 💾 Cache invalidado o vacío (datos específicos no disponibles)`
        );

        // Verificar si hay job en ejecución
        const jobEnEjecucion = await this.estaJobEnEjecucion(
          nivel,
          grado,
          tipoAsistencia
        );

        if (jobEnEjecucion) {
          console.log(`${this.logPrefix} 🔄 Job en ejecución detectado`);

          // Aplicar probabilidad de fallback
          const usarFallback = debeUsarFallbackPorProbabilidad(rol);
          if (usarFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probabilidad permite fallback a Redis`
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
              `${this.logPrefix} 🚫 Probabilidad no permite fallback - Error sin datos`
            );
            return {
              datos: null,
              mensaje: `Estudiante ${idEstudiante} no disponible - sistema en actualización y fallback no permitido para rol ${rol}`,
            };
          }
        }

        console.log(
          `${this.logPrefix} 🟢 No hay job en ejecución, procediendo a obtener desde Google Drive`
        );

        try {
          datosLista = await this.obtenerListaDesdeGoogleDrive(
            nivel,
            grado,
            tipoAsistencia
          );

          const estaActualizada = await this.estaActualizada(datosLista, nivel);

          if (!estaActualizada) {
            console.log(`${this.logPrefix} ⚠️ Lista NO está actualizada`);
            console.log(
              `${this.logPrefix} 🚀 Gatillando actualización de lista...`
            );

            // Gatillar actualización pero continuar con los datos actuales
            await this.gatillarActualizacionLista(nivel, grado, seccion);
            console.log(
              `${this.logPrefix} ✅ Actualización gatillada exitosamente`
            );

            // CONTINUAR CON LOS DATOS ACTUALES DE GOOGLE DRIVE (no hacer fallback a Redis)
            console.log(
              `${this.logPrefix} 📋 Continuando con datos actuales de Google Drive`
            );
          } else {
            console.log(`${this.logPrefix} ✅ Lista está actualizada`);
          }

          console.log(`${this.logPrefix} 💾 Guardando datos en cache`);
          await CacheListasAsistencia.guardar(cacheKey, datosLista);
        } catch (error) {
          console.warn(
            `${this.logPrefix} ⚠️ Error al obtener desde Google Drive`,
            error
          );

          // Aplicar probabilidad de fallback
          const usarFallback = debeUsarFallbackPorProbabilidad(rol);
          if (usarFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probabilidad permite fallback a Redis tras error`
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
              `${this.logPrefix} 🚫 Probabilidad no permite fallback tras error`
            );
            return {
              datos: null,
              mensaje: `Error al obtener datos de ${idEstudiante} y fallback no permitido para rol ${rol}`,
            };
          }
        }
      } else {
        console.log(
          `${this.logPrefix} ✅ Datos obtenidos desde cache (optimizado: disponibilidad > actualización)`
        );
      }

      // Buscar estudiante en los datos de Google Drive con nueva estructura
      const datosSeccion = datosLista.AsistenciasEscolaresDeHoy[seccion];
      if (!datosSeccion) {
        console.log(
          `${this.logPrefix} ❌ Sección ${seccion} no encontrada en Google Drive`
        );

        // Aplicar probabilidad de fallback
        const usarFallback = debeUsarFallbackPorProbabilidad(rol);
        if (usarFallback) {
          console.log(
            `${this.logPrefix} 🎲 Probabilidad permite fallback a Redis por sección faltante`
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
            `${this.logPrefix} 🚫 Probabilidad no permite fallback por sección faltante`
          );
          return {
            datos: null,
            mensaje: `Sección ${seccion} no encontrada y fallback no permitido para rol ${rol}`,
          };
        }
      }

      const asistenciaEstudiante = datosSeccion[idEstudiante];
      console.log(
        `${
          this.logPrefix
        } 🎯 Estudiante ${idEstudiante} encontrado en sección ${seccion}: ${!!asistenciaEstudiante}`
      );

      if (!asistenciaEstudiante) {
        console.log(
          `${this.logPrefix} ❌ Estudiante ${idEstudiante} no encontrado en sección ${seccion}`
        );

        // Aplicar probabilidad de fallback
        const usarFallback = debeUsarFallbackPorProbabilidad(rol);
        if (usarFallback) {
          console.log(
            `${this.logPrefix} 🎲 Probabilidad permite fallback a Redis por estudiante faltante`
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
            `${this.logPrefix} 🚫 Probabilidad no permite fallback por estudiante faltante`
          );
          return {
            datos: null,
            mensaje: `Estudiante ${idEstudiante} no encontrado en sección ${seccion} y fallback no permitido para rol ${rol}`,
          };
        }
      }

      // Construir resultado
      const resultado = await this.construirResultadoEstudiante(
        idEstudiante,
        seccion,
        asistenciaEstudiante,
        nivel
      );
      console.log(
        `${this.logPrefix} ✅ Resultado construido exitosamente desde Google Drive`
      );

      const estadoActualizacion = await this.estaActualizada(datosLista, nivel);

      return {
        datos: resultado,
        mensaje: `Datos desde Google Drive con cache optimizado por disponibilidad (${nivel} grado ${grado} sección ${seccion}) - Actualizada: ${estadoActualizacion}`,
      };
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error al consultar estudiante ${idEstudiante}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Consulta las asistencias de todos los estudiantes de un aula específica
   * ACTUALIZADO: Nueva estructura por sección y parámetro totalEstudiantes obligatorio
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
        `${this.logPrefix} 🏫 CONSULTANDO AULA: ${nivel} ${grado}° ${seccion} (${totalEstudiantes} estudiantes esperados)`
      );
      console.log(
        `${this.logPrefix} 📋 Parámetros: rol=${rol}, tipo=${tipoAsistencia}`
      );

      // Si no se proporciona rol, usar Redis directamente
      if (!rol) {
        console.log(
          `${this.logPrefix} 🔄 Usando Redis directamente (sin rol proporcionado)`
        );
        return await this.consultarAulaDesdeRedis(
          tipoAsistencia,
          nivel,
          grado,
          seccion
        );
      }

      // Determinar si debe usar Google Drive
      const usarGoogleDrive = await this.debeUsarGoogleDrive(
        rol,
        nivel,
        ModoRegistro.Entrada
      );
      console.log(
        `${this.logPrefix} 🎯 ¿Usar Google Drive para aula?: ${usarGoogleDrive}`
      );

      if (!usarGoogleDrive) {
        console.log(
          `${this.logPrefix} 🔄 Usando Redis para aula (no se cumplen condiciones para Google Drive)`
        );
        return await this.consultarAulaDesdeRedis(
          tipoAsistencia,
          nivel,
          grado,
          seccion
        );
      }

      // Usar Google Drive
      console.log(
        `${this.logPrefix} ☁️ USANDO GOOGLE DRIVE para consulta de aula`
      );
      const cacheKey = `${nivel}_${grado}`;

      // Obtener el Google Drive ID para verificación de fecha
      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
      );
      console.log(
        `${this.logPrefix} 🔗 Cliente Redis obtenido para: ${tipoAsistencia}`
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

      // Determinar qué datos necesitamos para la consulta de aula
      const necesitaEntrada = true;
      const necesitaSalida = await this.debeConsultarSalidas(nivel);

      console.log(
        `${this.logPrefix} 🎯 Datos requeridos para aula: entrada=${necesitaEntrada}, salida=${necesitaSalida}`
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
          `${this.logPrefix} 💾 No hay datos en cache para aula ${cacheKey} o son insuficientes`
        );

        // Verificar si hay job en ejecución
        const jobEnEjecucion = await this.estaJobEnEjecucion(
          nivel,
          grado,
          tipoAsistencia
        );

        if (jobEnEjecucion) {
          console.log(`${this.logPrefix} 🔄 Job en ejecución para aula`);

          // Aplicar probabilidad de fallback
          const usarFallback = debeUsarFallbackPorProbabilidad(rol);
          if (usarFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probabilidad permite fallback a Redis para aula`
            );
            return await this.consultarAulaDesdeRedis(
              tipoAsistencia,
              nivel,
              grado,
              seccion
            );
          } else {
            console.log(
              `${this.logPrefix} 🚫 Probabilidad no permite fallback para aula`
            );
            return {
              datos: [],
              mensaje: `Aula ${nivel} ${grado}° ${seccion} no disponible - sistema en actualización y fallback no permitido para rol ${rol}`,
            };
          }
        }

        console.log(
          `${this.logPrefix} 🟢 No hay job en ejecución para aula, obteniendo desde Google Drive`
        );

        try {
          datosLista = await this.obtenerListaDesdeGoogleDrive(
            nivel,
            grado,
            tipoAsistencia
          );

          if (!(await this.estaActualizada(datosLista, nivel))) {
            console.log(
              `${this.logPrefix} ⚠️ Lista de aula NO está actualizada, gatillando actualización`
            );
            await this.gatillarActualizacionLista(nivel, grado, seccion);
            console.log(
              `${this.logPrefix} ✅ Actualización de aula gatillada, continuando con datos actuales`
            );
          }

          await CacheListasAsistencia.guardar(cacheKey, datosLista);
        } catch (error) {
          console.warn(
            `${this.logPrefix} ⚠️ Error con Google Drive para aula`,
            error
          );

          // Aplicar probabilidad de fallback
          const usarFallback = debeUsarFallbackPorProbabilidad(rol);
          if (usarFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probabilidad permite fallback a Redis tras error en aula`
            );
            return await this.consultarAulaDesdeRedis(
              tipoAsistencia,
              nivel,
              grado,
              seccion
            );
          } else {
            console.log(
              `${this.logPrefix} 🚫 Probabilidad no permite fallback tras error en aula`
            );
            return {
              datos: [],
              mensaje: `Error al obtener datos de aula y fallback no permitido para rol ${rol}`,
            };
          }
        }
      } else {
        console.log(
          `${this.logPrefix} ✅ Datos de aula obtenidos desde cache (verificados automáticamente)`
        );
      }

      // Procesar datos de Google Drive con nueva estructura
      const datosSeccion = datosLista.AsistenciasEscolaresDeHoy[seccion];
      if (!datosSeccion) {
        console.log(
          `${this.logPrefix} ❌ Sección ${seccion} no encontrada en Google Drive`
        );

        // Aplicar probabilidad de fallback
        const usarFallback = debeUsarFallbackPorProbabilidad(rol);
        if (usarFallback) {
          console.log(
            `${this.logPrefix} 🎲 Probabilidad permite fallback a Redis por sección faltante en aula`
          );
          return await this.consultarAulaDesdeRedis(
            tipoAsistencia,
            nivel,
            grado,
            seccion
          );
        } else {
          console.log(
            `${this.logPrefix} 🚫 Probabilidad no permite fallback por sección faltante en aula`
          );
          return {
            datos: [],
            mensaje: `Sección ${seccion} no encontrada en aula y fallback no permitido para rol ${rol}`,
          };
        }
      }

      const resultados: AsistenciaDiariaEscolarResultado[] = [];
      console.log(
        `${this.logPrefix} 🔍 Procesando datos de Google Drive para aula sección ${seccion}`
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
        `${this.logPrefix} 📊 ${resultados.length}/${totalEstudiantes} estudiantes procesados desde Google Drive`
      );

      return {
        datos: resultados,
        mensaje: `${resultados.length}/${totalEstudiantes} estudiantes encontrados desde Google Drive con cache verificado automáticamente (${nivel} grado ${grado} sección ${seccion})`,
      };
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error al consultar aula ${nivel} ${grado}° ${seccion}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Consulta directamente desde Redis
   */
  private async consultarDesdeRedis(
    idEstudiante: string,
    tipoAsistencia: TipoAsistencia,
    nivel?: NivelEducativo,
    grado?: number,
    seccion?: string
  ): Promise<ResultadoConsulta> {
    console.log(
      `${this.logPrefix} 🗄️ CONSULTANDO DESDE REDIS: ${idEstudiante}`
    );

    const fechaActual = await this.obtenerFechaActual();
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
    );
    console.log(
      `${this.logPrefix} 🔗 Cliente Redis obtenido para: ${tipoAsistencia}`
    );

    // Determinar nivel si no se proporciona
    const nivelDeducido =
      nivel ||
      (tipoAsistencia === TipoAsistencia.ParaEstudiantesPrimaria
        ? NivelEducativo.PRIMARIA
        : NivelEducativo.SECUNDARIA);

    console.log(
      `${this.logPrefix} 📊 Nivel deducido para Redis: ${nivelDeducido}`
    );

    // Consultar entrada
    let patronBusquedaEntrada: string;
    if (nivel && grado && seccion) {
      patronBusquedaEntrada = `${fechaActual}:${ModoRegistro.Entrada}:${ActoresSistema.Estudiante}:${nivel}:${grado}:${seccion}:${idEstudiante}`;
    } else {
      patronBusquedaEntrada = `${fechaActual}:${ModoRegistro.Entrada}:${ActoresSistema.Estudiante}:*:*:*:${idEstudiante}`;
    }

    console.log(
      `${this.logPrefix} 🔍 Patrón búsqueda entrada: ${patronBusquedaEntrada}`
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
      `${this.logPrefix} 📋 Claves entrada encontradas: ${clavesEntrada.length}`
    );

    // Construir datos de asistencia
    const asistenciaData: {
      E?: { DesfaseSegundos: number };
      S?: { DesfaseSegundos: number };
    } = {};

    // Procesar entrada
    if (clavesEntrada.length > 0) {
      const claveEntrada = clavesEntrada[0];
      console.log(
        `${this.logPrefix} 📥 Procesando clave entrada: ${claveEntrada}`
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
          `${this.logPrefix} ✅ Entrada procesada: ${asistenciaData.E.DesfaseSegundos}s`
        );
      }
    }

    // Consultar salida si corresponde
    const debeConsultar = await this.debeConsultarSalidas(nivelDeducido);
    if (debeConsultar) {
      console.log(`${this.logPrefix} 🚪 Debe consultar salidas, buscando...`);

      let patronBusquedaSalida: string;
      if (nivel && grado && seccion) {
        patronBusquedaSalida = `${fechaActual}:${ModoRegistro.Salida}:${ActoresSistema.Estudiante}:${nivel}:${grado}:${seccion}:${idEstudiante}`;
      } else {
        patronBusquedaSalida = `${fechaActual}:${ModoRegistro.Salida}:${ActoresSistema.Estudiante}:*:*:*:${idEstudiante}`;
      }

      console.log(
        `${this.logPrefix} 🔍 Patrón búsqueda salida: ${patronBusquedaSalida}`
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
        `${this.logPrefix} 📋 Claves salida encontradas: ${clavesSalida.length}`
      );

      // Procesar salida
      if (clavesSalida.length > 0) {
        const claveSalida = clavesSalida[0];
        console.log(
          `${this.logPrefix} 📤 Procesando clave salida: ${claveSalida}`
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
            `${this.logPrefix} ✅ Salida procesada: ${asistenciaData.S.DesfaseSegundos}s`
          );
        }
      }
    }

    // Verificar si se encontró algo
    if (!asistenciaData.E && !asistenciaData.S) {
      console.log(
        `${this.logPrefix} ❌ No se encontraron datos en Redis para ${idEstudiante}`
      );
      return {
        datos: null,
        mensaje: `Estudiante ${idEstudiante} no encontrado en Redis`,
      };
    }

    // Construir resultado (necesitamos obtener sección de alguna forma o usar genérica)
    const seccionParaResultado = seccion || "DESCONOCIDA";
    const resultado = await this.construirResultadoEstudiante(
      idEstudiante,
      seccionParaResultado,
      asistenciaData,
      nivelDeducido
    );
    console.log(`${this.logPrefix} ✅ Resultado construido desde Redis`);

    return {
      datos: resultado,
      mensaje: `Datos obtenidos desde Redis`,
    };
  }

  /**
   * Consulta aula directamente desde Redis
   */
  private async consultarAulaDesdeRedis(
    tipoAsistencia: TipoAsistencia,
    nivel: NivelEducativo,
    grado: number,
    seccion: string
  ): Promise<ResultadoConsulta> {
    console.log(
      `${this.logPrefix} 🗄️ CONSULTANDO AULA DESDE REDIS: ${nivel} ${grado}° ${seccion}`
    );

    const fechaActual = await this.obtenerFechaActual();
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
    );
    console.log(
      `${this.logPrefix} 🔗 Cliente Redis obtenido para: ${tipoAsistencia}`
    );

    // Consultar entradas
    const patronBusquedaEntrada = `${fechaActual}:${ModoRegistro.Entrada}:${ActoresSistema.Estudiante}:${nivel}:${grado}:${seccion}:*`;
    console.log(
      `${this.logPrefix} 🔍 Patrón búsqueda entradas aula: ${patronBusquedaEntrada}`
    );

    const clavesEntrada = await redisClientInstance.keys(patronBusquedaEntrada);
    console.log(
      `${this.logPrefix} 📋 Entradas encontradas para aula: ${clavesEntrada.length}`
    );

    // Crear mapa de estudiantes con sus asistencias
    const estudiantesMap = new Map<
      string,
      { E?: { DesfaseSegundos: number }; S?: { DesfaseSegundos: number } }
    >();

    // Procesar entradas
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
            `${this.logPrefix} 📥 Entrada procesada para ${idEstudiante}: ${desfaseSegundos}s`
          );
        }
      }
    }

    // Consultar salidas si corresponde
    const debeConsultar = await this.debeConsultarSalidas(nivel);
    if (debeConsultar) {
      console.log(`${this.logPrefix} 🚪 Consultando salidas para aula...`);

      const patronBusquedaSalida = `${fechaActual}:${ModoRegistro.Salida}:${ActoresSistema.Estudiante}:${nivel}:${grado}:${seccion}:*`;
      console.log(
        `${this.logPrefix} 🔍 Patrón búsqueda salidas aula: ${patronBusquedaSalida}`
      );

      const clavesSalida = await redisClientInstance.keys(patronBusquedaSalida);
      console.log(
        `${this.logPrefix} 📋 Salidas encontradas para aula: ${clavesSalida.length}`
      );

      // Procesar salidas
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
              `${this.logPrefix} 📤 Salida procesada para ${idEstudiante}: ${desfaseSegundos}s`
            );
          }
        }
      }
    }

    // Construir resultados
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
      `${this.logPrefix} ✅ ${resultados.length} estudiantes procesados desde Redis`
    );

    return {
      datos: resultados,
      mensaje: `${resultados.length} estudiantes encontrados desde Redis`,
    };
  }
}
