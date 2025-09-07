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
import { ModoRegistro } from "@/interfaces/shared/ModoRegistroPersonal";
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

// =====================================
// CONSTANTES DE CONFIGURACIÓN
// =====================================

/**
 * Control de asistencia de salida (pueden cambiar según configuración)
 */
export const CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA = false;
export const CONTROL_ASISTENCIA_DE_SALIDA_PRIMARIA = false;

/**
 * A partir de cuántas horas antes de la salida se debe consultar asistencias de salida
 */
export const HORAS_ANTES_SALIDA_PARA_CONSULTA: Record<NivelEducativo, number> =
  {
    [NivelEducativo.PRIMARIA]: 1, // 1 hora antes de la salida
    [NivelEducativo.SECUNDARIA]: 1, // 1 hora antes de la salida
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
 * Intervalo de actualización de listas en minutos
 */
export const INTERVALO_ACTUALIZACION_LISTAS_MINUTOS = 10;

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
  AsistenciasEscolaresDeHoy: Record<
    string,
    {
      E?: { DesfaseSegundos: number };
      S?: { DesfaseSegundos: number };
    }
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

// =====================================
// CACHE SIMPLIFICADO BASADO EN FECHA DE ARCHIVO
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
    datos: AsistenciasEscolaresArchivo
  ): Promise<{ estaActualizada: boolean; razon: string }> {
    const ahoraFecha = await obtenerFechaHoraActualPeru();
    const diferenciaMinutos =
      (await calcularDiferenciaMillis(datos.Fecha_Actualizacion, ahoraFecha)) /
      (1000 * 60);

    const estaActualizada =
      diferenciaMinutos <= INTERVALO_ACTUALIZACION_LISTAS_MINUTOS;

    return {
      estaActualizada,
      razon: `Diferencia: ${diferenciaMinutos.toFixed(
        2
      )} min vs límite: ${INTERVALO_ACTUALIZACION_LISTAS_MINUTOS} min`,
    };
  }

  /**
   * Verifica si el cache necesita actualizarse basándose únicamente en la fecha del archivo
   */
  private static async necesitaActualizacion(
    clave: string,
    googleDriveId: string,
    entrada: {
      datos: AsistenciasEscolaresArchivo;
      fechaActualizacionArchivo: number;
    }
  ): Promise<{ necesitaActualizacion: boolean; razon: string }> {
    console.log(
      `[CacheListasAsistencia] 🔍 Verificando necesidad de actualización para: ${clave}`
    );

    // 1. Verificar si hay una versión más nueva del archivo en Google Drive
    const fechaArchivoActual = await this.obtenerFechaArchivoGoogleDrive(
      googleDriveId
    );

    if (
      fechaArchivoActual &&
      fechaArchivoActual > entrada.fechaActualizacionArchivo
    ) {
      const diferenciaMinutos =
        (fechaArchivoActual - entrada.fechaActualizacionArchivo) / (1000 * 60);
      return {
        necesitaActualizacion: true,
        razon: `Archivo más reciente detectado en Google Drive (diferencia: ${diferenciaMinutos.toFixed(
          2
        )} min)`,
      };
    }

    // 2. Verificar si los datos internos están desactualizados
    const datosActualizados = await this.estaActualizadaInternamente(
      entrada.datos
    );
    if (!datosActualizados.estaActualizada) {
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
   */
  static async obtener(
    clave: string,
    googleDriveId?: string
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

    // Si no se proporciona googleDriveId, solo verificar datos internos
    if (!googleDriveId) {
      const datosActualizados = await this.estaActualizadaInternamente(
        entrada.datos
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

    // Verificación completa con fecha de archivo de Google Drive
    const { necesitaActualizacion, razon } = await this.necesitaActualizacion(
      clave,
      googleDriveId,
      entrada
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
      const datosInternos = await this.estaActualizadaInternamente(
        entrada.datos
      );

      stats[clave] = {
        fechaArchivo: entrada.datos.Fecha_Actualizacion,
        cantidadEstudiantes: Object.keys(
          entrada.datos.AsistenciasEscolaresDeHoy || {}
        ).length,
        fechaActualizacionArchivo: entrada.fechaActualizacionArchivo,
        estaActualizada: datosInternos.estaActualizada,
        razonEstado: datosInternos.razon,
      };
    }
    return stats;
  }
}

// =====================================
// REPOSITORIO PRINCIPAL SIN new Date()
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
   */
  private async construirResultadoEstudiante(
    idEstudiante: string,
    asistenciaData: {
      E?: { DesfaseSegundos: number };
      S?: { DesfaseSegundos: number };
    },
    nivel: NivelEducativo
  ): Promise<AsistenciaDiariaEscolarResultado> {
    console.log(
      `${this.logPrefix} 🔨 Construyendo resultado para estudiante: ${idEstudiante}`
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
    datos: AsistenciasEscolaresArchivo
  ): Promise<boolean> {
    const ahoraFecha = await obtenerFechaHoraActualPeru();
    const diferenciaMinutos =
      (await calcularDiferenciaMillis(datos.Fecha_Actualizacion, ahoraFecha)) /
      (1000 * 60);

    const estaActualizada =
      diferenciaMinutos <= INTERVALO_ACTUALIZACION_LISTAS_MINUTOS;

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
      `${this.logPrefix} ⚙️ Intervalo máximo configurado: ${INTERVALO_ACTUALIZACION_LISTAS_MINUTOS} min`
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

      const redisInstance = redisClient(tipoAsistencia);
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
   */
  private async gatillarActualizacionLista(
    nivel: NivelEducativo,
    grado: number
  ): Promise<void> {
    try {
      console.log(
        `${this.logPrefix} 🚀 INICIANDO GATILLADO para ${nivel} grado ${grado}`
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
        },
      };

      console.log(
        `${this.logPrefix} 📦 Payload a enviar:`,
        JSON.stringify(payload, null, 2)
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
        `${this.logPrefix} ✅ GitHub Action gatillado exitosamente para ${nivel} grado ${grado}`
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
      const redisInstance = redisClient(tipoAsistencia);
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
      console.log(
        `${this.logPrefix} 📊 Cantidad de estudiantes en archivo: ${
          Object.keys(datos.AsistenciasEscolaresDeHoy || {}).length
        }`
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

      // Si no se proporciona rol, usar Redis directamente
      if (!rol || !nivel || !grado) {
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
      const redisInstance = redisClient(tipoAsistencia);
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

      // Mostrar estadísticas del cache
      const statsCache = await CacheListasAsistencia.obtenerEstadisticas();
      console.log(
        `${this.logPrefix} 📊 Estado actual del cache:`,
        JSON.stringify(statsCache, null, 2)
      );

      // Obtener datos del cache (con verificación automática de fecha de archivo)
      let datosLista = await CacheListasAsistencia.obtener(
        cacheKey,
        googleDriveId
      );

      if (!datosLista) {
        console.log(
          `${this.logPrefix} 💾 Cache invalidado o vacío, obteniendo desde Google Drive`
        );

        // Verificar si hay job en ejecución
        const jobEnEjecucion = await this.estaJobEnEjecucion(
          nivel,
          grado,
          tipoAsistencia
        );

        if (jobEnEjecucion) {
          console.log(
            `${this.logPrefix} 🔄 Job en ejecución detectado, usando Redis como fallback`
          );
          return await this.consultarDesdeRedis(
            idEstudiante,
            tipoAsistencia,
            nivel,
            grado,
            seccion
          );
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

          const estaActualizada = await this.estaActualizada(datosLista);

          if (!estaActualizada) {
            console.log(`${this.logPrefix} ⚠️ Lista NO está actualizada`);
            console.log(
              `${this.logPrefix} 🚀 Gatillando actualización de lista...`
            );

            // Gatillar actualización pero continuar con los datos actuales
            await this.gatillarActualizacionLista(nivel, grado);
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
            `${this.logPrefix} ⚠️ Error al obtener desde Google Drive, usando Redis:`,
            error
          );
          return await this.consultarDesdeRedis(
            idEstudiante,
            tipoAsistencia,
            nivel,
            grado,
            seccion
          );
        }
      } else {
        console.log(
          `${this.logPrefix} ✅ Datos obtenidos desde cache (verificados automáticamente con Google Drive)`
        );
      }

      // Buscar estudiante en los datos de Google Drive
      const asistenciaEstudiante =
        datosLista.AsistenciasEscolaresDeHoy[idEstudiante];
      console.log(
        `${
          this.logPrefix
        } 🎯 Estudiante ${idEstudiante} encontrado en Google Drive: ${!!asistenciaEstudiante}`
      );

      if (!asistenciaEstudiante) {
        console.log(
          `${this.logPrefix} ❌ Estudiante no encontrado en Google Drive, intentando Redis como fallback`
        );
        return await this.consultarDesdeRedis(
          idEstudiante,
          tipoAsistencia,
          nivel,
          grado,
          seccion
        );
      }

      // Construir resultado
      const resultado = await this.construirResultadoEstudiante(
        idEstudiante,
        asistenciaEstudiante,
        nivel
      );
      console.log(
        `${this.logPrefix} ✅ Resultado construido exitosamente desde Google Drive`
      );

      const estadoActualizacion = await this.estaActualizada(datosLista);

      return {
        datos: resultado,
        mensaje: `Datos desde Google Drive con cache optimizado por disponibilidad (${nivel} grado ${grado}) - Actualizada: ${estadoActualizacion}`,
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
   */
  async consultarPorAula(
    tipoAsistencia: TipoAsistencia,
    nivel: NivelEducativo,
    grado: number,
    seccion: string,
    rol?: RolesSistema
  ): Promise<ResultadoConsulta> {
    try {
      console.log(
        `${this.logPrefix} 🏫 CONSULTANDO AULA: ${nivel} ${grado}° ${seccion}`
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
      const redisInstance = redisClient(tipoAsistencia);
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

      let datosLista = await CacheListasAsistencia.obtener(
        cacheKey,
        googleDriveId
      );

      if (!datosLista) {
        console.log(
          `${this.logPrefix} 💾 No hay datos en cache para aula ${cacheKey}`
        );

        // Verificar si hay job en ejecución
        const jobEnEjecucion = await this.estaJobEnEjecucion(
          nivel,
          grado,
          tipoAsistencia
        );

        if (jobEnEjecucion) {
          console.log(
            `${this.logPrefix} 🔄 Job en ejecución para aula, usando Redis`
          );
          return await this.consultarAulaDesdeRedis(
            tipoAsistencia,
            nivel,
            grado,
            seccion
          );
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

          if (!(await this.estaActualizada(datosLista))) {
            console.log(
              `${this.logPrefix} ⚠️ Lista de aula NO está actualizada, gatillando actualización`
            );
            await this.gatillarActualizacionLista(nivel, grado);
            console.log(
              `${this.logPrefix} ✅ Actualización de aula gatillada, continuando con datos actuales`
            );
          }

          await CacheListasAsistencia.guardar(cacheKey, datosLista);
        } catch (error) {
          console.warn(
            `${this.logPrefix} ⚠️ Error con Google Drive para aula, usando Redis:`,
            error
          );
          return await this.consultarAulaDesdeRedis(
            tipoAsistencia,
            nivel,
            grado,
            seccion
          );
        }
      } else {
        console.log(
          `${this.logPrefix} ✅ Datos de aula obtenidos desde cache (verificados automáticamente)`
        );
      }

      // Procesar datos de Google Drive (nota: Google Drive no filtra por sección)
      const resultados: AsistenciaDiariaEscolarResultado[] = [];
      console.log(
        `${this.logPrefix} 🔍 Procesando datos de Google Drive para aula`
      );

      for (const [idEstudiante, asistencia] of Object.entries(
        datosLista.AsistenciasEscolaresDeHoy
      )) {
        if (asistencia.E || asistencia.S) {
          const resultado = await this.construirResultadoEstudiante(
            idEstudiante,
            asistencia,
            nivel
          );
          resultados.push(resultado);
        }
      }

      console.log(
        `${this.logPrefix} 📊 ${resultados.length} estudiantes procesados desde Google Drive`
      );

      return {
        datos: resultados,
        mensaje: `${resultados.length} estudiantes encontrados desde Google Drive con cache verificado automáticamente (${nivel} grado ${grado})`,
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
    const redisClientInstance = redisClient(tipoAsistencia);

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

    // Construir resultado
    const resultado = await this.construirResultadoEstudiante(
      idEstudiante,
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
    const redisClientInstance = redisClient(tipoAsistencia);

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
