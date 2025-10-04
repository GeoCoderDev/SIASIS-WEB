// lib/utils/local/db/models/AsistenciasEscolares/Para Directivos/AsistenciasEscolaresPorAulaParaDirectivosIDB.ts
import { TablasLocal } from "@/interfaces/shared/TablasSistema";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import { GetAsistenciasMensualesDeUnAulaSuccessResponse } from "@/interfaces/shared/apis/api02/aulas/asistencias-escolares-mensuales/types";
import { Endpoint_Get_Asistencias_Mensuales_Escolares_Por_Aula_API02 } from "@/lib/utils/backend/endpoints/api02/AsistenciasMensualesEscolaresPorAula";
import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";
import { T_Estudiantes } from "@prisma/client";
import { AsistenciaDateHelper } from "@/lib/utils/local/db/models/utils/AsistenciaDateHelper";
import IndexedDBConnection from "@/constants/singleton/IndexedDBConnection";
import { alterarUTCaZonaPeruana } from "@/lib/helpers/alteradores/alterarUTCaZonaPeruana";
import { CustomApiError } from "@/lib/errors/custom/ApiError";

// Constantes de configuración
const INTERVALO_ACTUALIZACION_MINUTOS = 10; // 10 minutos entre consultas (solo para mes actual)
const HORA_DISPONIBILIDAD_MONGODB = 22; // 10 PM - hora a partir de la cual los datos están en MongoDB

// Mapeo de nivel y grado a tabla
const MAPEO_TABLA_ASISTENCIAS: Record<string, TablasLocal> = {
  "P-1": TablasLocal.Tabla_Asistencia_Primaria_1,
  "P-2": TablasLocal.Tabla_Asistencia_Primaria_2,
  "P-3": TablasLocal.Tabla_Asistencia_Primaria_3,
  "P-4": TablasLocal.Tabla_Asistencia_Primaria_4,
  "P-5": TablasLocal.Tabla_Asistencia_Primaria_5,
  "P-6": TablasLocal.Tabla_Asistencia_Primaria_6,
  "S-1": TablasLocal.Tabla_Asistencia_Secundaria_1,
  "S-2": TablasLocal.Tabla_Asistencia_Secundaria_2,
  "S-3": TablasLocal.Tabla_Asistencia_Secundaria_3,
  "S-4": TablasLocal.Tabla_Asistencia_Secundaria_4,
  "S-5": TablasLocal.Tabla_Asistencia_Secundaria_5,
};

// Interfaces
export interface IAsistenciaEstudianteLocal {
  Id_Estudiante: string;
  Mes: number;
  Asistencias_Mensuales: string;
  ultima_fecha_actualizacion: number;
}

export interface AsistenciaAulaOperationResult {
  success: boolean;
  message: string;
  data?: {
    Mes: number;
    Asistencias_Escolares: Record<
      string,
      Record<number, AsistenciaEscolarDeUnDia | null>
    >;
    totalEstudiantes: number;
    estudiantesActualizados: number;
    incluyeDiaActual?: boolean;
  };
  requiereEspera?: boolean;
  minutosEspera?: number;
  origen?: "cache" | "api" | "mixto";
}

interface DatosAsistenciasDiaActual {
  success: boolean;
  asistencias: Record<string, AsistenciaEscolarDeUnDia>;
  mensaje?: string;
}

/**
 * Clase para el manejo de asistencias escolares por aula para directivos
 * VERSIÓN MEJORADA: Manejo robusto de errores y flujo optimizado de consultas
 */
export class AsistenciasEscolaresPorAulaParaDirectivosIDB {
  private dateHelper: AsistenciaDateHelper;

  constructor(
    private setIsSomethingLoading?: (isLoading: boolean) => void,
    private setError?: (error: ErrorResponseAPIBase | null) => void,
    private setSuccessMessage?: (message: MessageProperty | null) => void
  ) {
    this.dateHelper = new AsistenciaDateHelper();
  }

  /**
   * Método principal para consultar asistencias mensuales de un aula
   */
  public async consultarAsistenciasMensualesAula(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // Validaciones iniciales
      const validacion = this.validarConsulta(idAula, mes);
      if (!validacion.esValido) {
        return this.crearResultadoError(validacion.mensaje);
      }

      const mesActual = this.dateHelper.obtenerMesActual();
      const esConsultaMesActual = mes === mesActual;

      // ============================================================
      // MESES ANTERIORES: Usar caché indefinidamente (datos inmutables)
      // ============================================================
      if (!esConsultaMesActual) {
        const datosCache = await this.obtenerDatosDesdeCache(idAula, mes);

        // Si hay datos en caché, usarlos (no hay límite de tiempo para meses pasados)
        if (datosCache.success && datosCache.data) {
          return datosCache;
        }

        // Si no hay caché, consultar API y guardar permanentemente
        return await this.consultarYGuardarMesAnterior(idAula, mes);
      }

      // ============================================================
      // MES ACTUAL: Lógica especial con día actual
      // ============================================================
      return await this.consultarMesActualConDiaActual(idAula, mes);
    } catch (error) {
      return this.manejarErrorGeneral(error, idAula, mes);
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Consulta y guarda permanentemente datos de meses anteriores
   */
  private async consultarYGuardarMesAnterior(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      const response =
        await Endpoint_Get_Asistencias_Mensuales_Escolares_Por_Aula_API02.realizarPeticion(
          {
            routeParams: { Id_Aula: idAula },
            queryParams: { Mes: mes },
          }
        );

      // Guardar en caché permanentemente
      await this.procesarRespuestaAPI(response, idAula, mes);

      this.handleSuccess(
        `Se obtuvieron las asistencias de ${this.obtenerNombreMes(
          mes
        )} exitosamente.`
      );

      return {
        success: true,
        message: "Asistencias obtenidas exitosamente",
        data: {
          Mes: mes,
          Asistencias_Escolares: response.data.Asistencias_Escolares,
          totalEstudiantes: Object.keys(response.data.Asistencias_Escolares)
            .length,
          estudiantesActualizados: Object.keys(
            response.data.Asistencias_Escolares
          ).length,
        },
        origen: "api",
      };
    } catch (error) {
      if (error instanceof CustomApiError) {
        return this.manejarCustomApiError(error, idAula, mes);
      }
      throw error;
    }
  }

  /**
   * Consulta específica para el mes actual con lógica mejorada
   */
  private async consultarMesActualConDiaActual(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      const diaActual = this.dateHelper.obtenerDiaActual();
      const horaActual = new Date().getHours();
      const esDiaEscolar = this.esDiaEscolar();

      // Obtener información del aula
      const infoAula = await this.obtenerInformacionAula(idAula);
      if (!infoAula) {
        return this.crearResultadoError(
          "No se encontró información del aula seleccionada."
        );
      }

      const nivelGrado = { nivel: infoAula.nivel, grado: infoAula.grado };

      // Obtener estudiantes del aula
      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(idAula);
      if (estudiantesDelAula.length === 0) {
        return this.crearResultadoError(
          "No se encontraron estudiantes activos en esta aula."
        );
      }

      // Verificar si es el primer día laboral del mes
      const esPrimerDiaLaboralDelMes = await this.esPrimerDiaLaboralDelMes(mes);

      console.log("📅 Consulta mes actual - Debug:", {
        diaActual,
        horaActual,
        esDiaEscolar,
        esPrimerDiaLaboralDelMes,
        esAntesDe10PM: horaActual < HORA_DISPONIBILIDAD_MONGODB,
      });

      // ============================================================
      // CASO 1: Primer día laboral del mes - Solo día actual
      // ============================================================
      if (esPrimerDiaLaboralDelMes && esDiaEscolar) {
        const debeConsultar = await this.debeConsultarDiaActual(idAula);

        if (debeConsultar) {
          console.log(
            "📅 Primer día laboral del mes - Consultando solo día actual"
          );
          return await this.consultarSoloDiaActual(
            idAula,
            mes,
            nivelGrado,
            infoAula,
            estudiantesDelAula
          );
        } else {
          return this.crearResultadoError(
            "Aún no hay datos disponibles para este mes. Intente más tarde."
          );
        }
      }

      // ============================================================
      // CASO 2: Fin de semana - Solo API02 (sin día actual)
      // ============================================================
      if (!esDiaEscolar) {
        console.log("📅 Fin de semana - Consultando solo API02");
        return await this.consultarSoloAPI02(idAula, mes);
      }

      // ============================================================
      // CASO 3: Después de 10 PM - Todo está en API02
      // ============================================================
      if (horaActual >= HORA_DISPONIBILIDAD_MONGODB) {
        console.log("📅 Después de 10 PM - Consultando solo API02");
        return await this.consultarSoloAPI02(idAula, mes);
      }

      // ============================================================
      // CASO 4: Día laboral normal - Paralelo API02 + Día actual
      // ============================================================
      const debeConsultar = await this.debeConsultarDiaActual(idAula);

      if (debeConsultar) {
        console.log(
          "📅 Día laboral - Consultando API02 + día actual en paralelo"
        );
        return await this.consultarAPI02YDiaActualParalelo(
          idAula,
          mes,
          nivelGrado,
          infoAula,
          estudiantesDelAula
        );
      } else {
        // Fuera de horario escolar, solo API02
        console.log("📅 Fuera de horario escolar - Solo API02");
        return await this.consultarSoloAPI02(idAula, mes);
      }
    } catch (error) {
      console.error("Error en consultarMesActualConDiaActual:", error);
      return this.manejarErrorGeneral(error, idAula, mes);
    }
  }

  /**
   * Consulta solo la API02 (sin día actual)
   */
  private async consultarSoloAPI02(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      // Verificar control de frecuencia (solo para mes actual)
      const controlFrecuencia = await this.verificarControlFrecuenciaAula(
        idAula,
        mes
      );

      if (!controlFrecuencia.puedeConsultar) {
        // Usar datos del caché
        const datosCache = await this.obtenerDatosDesdeCache(idAula, mes);
        if (datosCache.success && datosCache.data) {
          return datosCache;
        }
      }

      // Consultar API02
      const response =
        await Endpoint_Get_Asistencias_Mensuales_Escolares_Por_Aula_API02.realizarPeticion(
          {
            routeParams: { Id_Aula: idAula },
            queryParams: { Mes: mes },
          }
        );

      // Guardar en caché (con timestamp para control de frecuencia)
      await this.procesarRespuestaAPI(response, idAula, mes);

      this.handleSuccess(
        `Se obtuvieron las asistencias de ${this.obtenerNombreMes(
          mes
        )} exitosamente.`
      );

      return {
        success: true,
        message: "Asistencias obtenidas exitosamente",
        data: {
          Mes: mes,
          Asistencias_Escolares: response.data.Asistencias_Escolares,
          totalEstudiantes: Object.keys(response.data.Asistencias_Escolares)
            .length,
          estudiantesActualizados: Object.keys(
            response.data.Asistencias_Escolares
          ).length,
        },
        origen: "api",
      };
    } catch (error) {
      if (error instanceof CustomApiError) {
        return this.manejarCustomApiError(error, idAula, mes);
      }
      throw error;
    }
  }

  /**
   * Consulta API02 y día actual en paralelo
   */
  private async consultarAPI02YDiaActualParalelo(
    idAula: string,
    mes: number,
    nivelGrado: { nivel: NivelEducativo; grado: number },
    infoAula: { seccion: string; nivel: NivelEducativo; grado: number },
    estudiantesDelAula: T_Estudiantes[]
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      // Consultas en paralelo
      const [resultadoAPI02, datosDiaActual] = await Promise.all([
        this.consultarSoloAPI02(idAula, mes),
        this.consultarAPIAsistenciasDiaActual(
          nivelGrado.nivel,
          nivelGrado.grado,
          infoAula.seccion,
          estudiantesDelAula.length
        ),
      ]);

      // Si API02 falló, devolver solo día actual
      if (!resultadoAPI02.success || !resultadoAPI02.data) {
        if (datosDiaActual.success) {
          return await this.crearResultadoSoloDiaActual(
            mes,
            datosDiaActual.asistencias,
            estudiantesDelAula.length
          );
        }
        return resultadoAPI02; // Devolver el error de API02
      }

      // Fusionar datos
      const asistenciasFusionadas =
        this.fusionarAsistenciasMensualesConDiaActual(
          resultadoAPI02.data.Asistencias_Escolares,
          datosDiaActual.success ? datosDiaActual.asistencias : {}
        );

      this.handleSuccess(
        `Se obtuvieron las asistencias de ${this.obtenerNombreMes(
          mes
        )} incluyendo el día actual.`
      );

      return {
        success: true,
        message: "Asistencias obtenidas con día actual",
        data: {
          Mes: mes,
          Asistencias_Escolares: asistenciasFusionadas,
          totalEstudiantes: estudiantesDelAula.length,
          estudiantesActualizados: Object.keys(asistenciasFusionadas).length,
          incluyeDiaActual: datosDiaActual.success,
        },
        origen: "mixto",
      };
    } catch (error) {
      console.error("Error consultando en paralelo:", error);
      throw error;
    }
  }

  /**
   * Consulta solo el día actual (primer día laboral del mes)
   */
  private async consultarSoloDiaActual(
    idAula: string,
    mes: number,
    nivelGrado: { nivel: NivelEducativo; grado: number },
    infoAula: { seccion: string; nivel: NivelEducativo; grado: number },
    estudiantesDelAula: T_Estudiantes[]
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      const datosDiaActual = await this.consultarAPIAsistenciasDiaActual(
        nivelGrado.nivel,
        nivelGrado.grado,
        infoAula.seccion,
        estudiantesDelAula.length
      );

      if (!datosDiaActual.success) {
        return this.crearResultadoError(
          datosDiaActual.mensaje ||
            "No se pudieron obtener las asistencias del día actual"
        );
      }

      return await this.crearResultadoSoloDiaActual(
        mes,
        datosDiaActual.asistencias,
        estudiantesDelAula.length
      );
    } catch (error) {
      console.error("Error consultando solo día actual:", error);
      throw error;
    }
  }

  /**
   * Crea resultado con solo día actual
   */
  private async crearResultadoSoloDiaActual(
    mes: number,
    asistenciasDiaActual: Record<string, AsistenciaEscolarDeUnDia>,
    totalEstudiantes: number
  ): Promise<AsistenciaAulaOperationResult> {
    const diaActual = this.dateHelper.obtenerDiaActual()!;
    const asistenciasMensuales: Record<
      string,
      Record<number, AsistenciaEscolarDeUnDia | null>
    > = {};

    for (const idEstudiante in asistenciasDiaActual) {
      asistenciasMensuales[idEstudiante] = {
        [diaActual]: asistenciasDiaActual[idEstudiante],
      };
    }

    this.handleSuccess(
      `Se obtuvieron las asistencias del día actual (${this.obtenerNombreMes(
        mes
      )} ${diaActual}).`
    );

    return {
      success: true,
      message: "Asistencias del día actual obtenidas exitosamente",
      data: {
        Mes: mes,
        Asistencias_Escolares: asistenciasMensuales,
        totalEstudiantes: totalEstudiantes,
        estudiantesActualizados: Object.keys(asistenciasDiaActual).length,
        incluyeDiaActual: true,
      },
      origen: "api",
    };
  }

  /**
   * Verifica si es el primer día laboral del mes
   */
  private async esPrimerDiaLaboralDelMes(mes: number): Promise<boolean> {
    const año = new Date().getFullYear();
    const mesActual = new Date().getMonth() + 1;
    const diaActual = new Date().getDate();

    if (mes !== mesActual) {
      return false;
    }

    // Buscar el primer día laboral del mes
    for (let dia = 1; dia <= 31; dia++) {
      const fecha = new Date(año, mes - 1, dia);
      if (fecha.getMonth() !== mes - 1) break; // Salir si pasamos de mes

      const diaSemana = fecha.getDay();
      if (diaSemana >= 1 && diaSemana <= 5) {
        // Es el primer día laboral
        return dia === diaActual;
      }
    }

    return false;
  }

  /**
   * Verifica si el día actual es un día escolar (lunes a viernes)
   */
  private esDiaEscolar(): boolean {
    const diaSemana = new Date().getDay();
    return diaSemana >= 1 && diaSemana <= 5;
  }

  /**
   * Fusiona asistencias mensuales con las del día actual
   */
  private fusionarAsistenciasMensualesConDiaActual(
    asistenciasMensuales: Record<
      string,
      Record<number, AsistenciaEscolarDeUnDia | null>
    >,
    asistenciasDiaActual: Record<string, AsistenciaEscolarDeUnDia>
  ): Record<string, Record<number, AsistenciaEscolarDeUnDia | null>> {
    const diaActual = this.dateHelper.obtenerDiaActual()!;
    const resultado = { ...asistenciasMensuales };

    for (const idEstudiante in asistenciasDiaActual) {
      if (!resultado[idEstudiante]) {
        resultado[idEstudiante] = {};
      }
      resultado[idEstudiante][diaActual] = asistenciasDiaActual[idEstudiante];
    }

    return resultado;
  }

  /**
   * Determina si debe consultar el día actual según horarios escolares
   */
  private async debeConsultarDiaActual(idAula: string): Promise<boolean> {
    try {
      if (!this.esDiaEscolar()) {
        return false;
      }

      const { DatosAsistenciaHoyIDB } = await import(
        "@/lib/utils/local/db/models/DatosAsistenciaHoy/DatosAsistenciaHoyIDB"
      );
      const { HandlerDirectivoAsistenciaResponse } = await import(
        "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerDirectivoAsistenciaResponse"
      );

      const handler =
        (await new DatosAsistenciaHoyIDB().getHandler()) as InstanceType<
          typeof HandlerDirectivoAsistenciaResponse
        >;

      if (!handler) {
        return false;
      }

      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) {
        return false;
      }

      const horarioEscolar = handler.getHorarioEscolar(nivelGrado.nivel);
      if (!horarioEscolar) {
        return false;
      }

      const fechaHoraActual = handler.getFechaHoraRedux();
      if (!fechaHoraActual) {
        return false;
      }

      const horaInicio = new Date(
        alterarUTCaZonaPeruana(horarioEscolar.Inicio)
      );
      const yaEmpezo = fechaHoraActual >= horaInicio;

      console.log("🕐 Verificación de horario:", {
        nivel: nivelGrado.nivel,
        horaActual: fechaHoraActual.toISOString(),
        horaInicio: horaInicio.toISOString(),
        yaEmpezo,
      });

      return yaEmpezo;
    } catch (error) {
      console.error("Error verificando horario:", error);
      return false;
    }
  }

  /**
   * Consulta la API del día actual
   */
  private async consultarAPIAsistenciasDiaActual(
    nivel: NivelEducativo,
    grado: number,
    seccion: string,
    totalEstudiantes: number
  ): Promise<DatosAsistenciasDiaActual> {
    try {
      const tipoAsistencia: TipoAsistencia =
        nivel === NivelEducativo.PRIMARIA
          ? TipoAsistencia.ParaEstudiantesPrimaria
          : TipoAsistencia.ParaEstudiantesSecundaria;

      const params = new URLSearchParams({
        TipoAsistencia: tipoAsistencia,
        Nivel: nivel,
        Grado: grado.toString(),
        Seccion: seccion,
        totalEstudiantes: totalEstudiantes.toString(),
      });

      const url = `/api/asistencia-hoy/consultar-asistencias-escolares-tomadas?${params.toString()}`;

      const response = await fetch(url, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        const errorData = await response.json();
        return {
          success: false,
          asistencias: {},
          mensaje:
            errorData.message ||
            "Error al consultar asistencias del día actual",
        };
      }

      const data = await response.json();
      const asistencias: Record<string, AsistenciaEscolarDeUnDia> = {};

      if (data.Resultados && Array.isArray(data.Resultados)) {
        for (const resultado of data.Resultados) {
          if (resultado.AsistenciaMarcada && resultado.Asistencia) {
            asistencias[resultado.Id_Estudiante] = resultado.Asistencia;
          }
        }
      }

      return {
        success: true,
        asistencias,
        mensaje: `Se obtuvieron ${
          Object.keys(asistencias).length
        } asistencias del día actual`,
      };
    } catch (error) {
      console.error("Error en API día actual:", error);
      return {
        success: false,
        asistencias: {},
        mensaje: error instanceof Error ? error.message : "Error desconocido",
      };
    }
  }

  // =====================================================================================
  // MANEJO DE ERRORES MEJORADO
  // =====================================================================================

  /**
   * Maneja errores de CustomApiError con mensajes amigables
   */
  private manejarCustomApiError(
    error: CustomApiError,
    idAula: string,
    mes: number
  ): AsistenciaAulaOperationResult {
    const { statusCode, statusText } = error.payload;
    let mensajeAmigable: string;

    switch (statusCode) {
      case 404:
        mensajeAmigable = `No hay datos de asistencia disponibles para ${this.obtenerNombreMes(
          mes
        )} en esta aula. Es posible que aún no se hayan registrado asistencias para este período.`;
        break;

      case 500:
      case 502:
      case 503:
        mensajeAmigable = `El servidor está presentando problemas en este momento. Por favor, intente nuevamente en unos minutos.`;
        break;

      case 400:
        mensajeAmigable = `La solicitud no pudo procesarse. Verifique que el aula y el mes seleccionados sean válidos.`;
        break;

      case 401:
      case 403:
        mensajeAmigable = `No tiene permisos para acceder a esta información. Por favor, contacte al administrador.`;
        break;

      case 408:
        mensajeAmigable = `La conexión con el servidor tardó demasiado. Verifique su conexión a internet e intente nuevamente.`;
        break;

      default:
        mensajeAmigable = `Ocurrió un error al obtener las asistencias (Código: ${statusCode}). Por favor, intente nuevamente.`;
    }

    console.error("Error CustomApiError:", {
      statusCode,
      statusText,
      mensaje: error.message,
      idAula,
      mes,
    });

    return this.crearResultadoError(mensajeAmigable);
  }

  /**
   * Maneja errores generales
   */
  private manejarErrorGeneral(
    error: unknown,
    idAula: string,
    mes: number
  ): AsistenciaAulaOperationResult {
    if (error instanceof CustomApiError) {
      return this.manejarCustomApiError(error, idAula, mes);
    }

    console.error("Error general:", error);

    let mensaje = "Ocurrió un error inesperado al consultar las asistencias.";

    if (error instanceof Error) {
      if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError")
      ) {
        mensaje =
          "No se pudo conectar con el servidor. Verifique su conexión a internet e intente nuevamente.";
      } else if (error.message.includes("timeout")) {
        mensaje =
          "La consulta tardó demasiado tiempo. Por favor, intente nuevamente en unos momentos.";
      }
    }

    return this.crearResultadoError(mensaje);
  }

  // =====================================================================================
  // MÉTODOS AUXILIARES
  // =====================================================================================

  private async obtenerInformacionAula(
    idAula: string
  ): Promise<{ seccion: string; nivel: NivelEducativo; grado: number } | null> {
    try {
      const { BaseAulasIDB } = await import(
        "@/lib/utils/local/db/models/Aulas/AulasBase"
      );
      const aulasIDB = new BaseAulasIDB();
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aula = todasLasAulas.find((a) => a.Id_Aula === idAula);

      if (!aula) return null;

      return {
        seccion: aula.Seccion,
        nivel: aula.Nivel as NivelEducativo,
        grado: aula.Grado,
      };
    } catch (error) {
      console.error("Error obteniendo información del aula:", error);
      return null;
    }
  }

  private async obtenerEstudiantesDelAula(
    idAula: string
  ): Promise<T_Estudiantes[]> {
    try {
      const { BaseEstudiantesIDB } = await import(
        "@/lib/utils/local/db/models/Estudiantes/EstudiantesBaseIDB"
      );
      const estudiantesIDB = new BaseEstudiantesIDB();
      const todosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
        false
      );
      return todosEstudiantes.filter(
        (estudiante) => estudiante.Id_Aula === idAula && estudiante.Estado
      );
    } catch (error) {
      console.error("Error obteniendo estudiantes:", error);
      return [];
    }
  }

  private async obtenerDatosDesdeCache(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) {
        return {
          success: false,
          message: "No se pudo determinar el nivel y grado del aula",
        };
      }

      const tabla = this.obtenerTablaAsistencias(
        nivelGrado.nivel,
        nivelGrado.grado
      );
      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(idAula);

      if (estudiantesDelAula.length === 0) {
        return {
          success: false,
          message: "No se encontraron estudiantes activos en esta aula",
        };
      }

      const idsEstudiantesAula = estudiantesDelAula.map((e) => e.Id_Estudiante);
      const registrosDelMes = await this.obtenerRegistrosEstudiantesDelMes(
        tabla,
        mes
      );
      const registrosFiltrados = registrosDelMes.filter((registro) =>
        idsEstudiantesAula.includes(registro.Id_Estudiante)
      );

      if (registrosFiltrados.length === 0) {
        return { success: false, message: "No se encontraron datos en caché" };
      }

      const asistenciasEscolares: Record<
        string,
        Record<number, AsistenciaEscolarDeUnDia | null>
      > = {};

      for (const registro of registrosFiltrados) {
        try {
          asistenciasEscolares[registro.Id_Estudiante] = JSON.parse(
            registro.Asistencias_Mensuales
          );
        } catch (parseError) {
          console.error(`Error parseando asistencias:`, parseError);
        }
      }

      if (Object.keys(asistenciasEscolares).length === 0) {
        return {
          success: false,
          message: "No se encontraron asistencias válidas en caché",
        };
      }

      this.handleSuccess(
        `Se encontraron las asistencias de ${this.obtenerNombreMes(
          mes
        )} guardadas localmente.`
      );

      return {
        success: true,
        message: "Asistencias obtenidas desde caché",
        data: {
          Mes: mes,
          Asistencias_Escolares: asistenciasEscolares,
          totalEstudiantes: estudiantesDelAula.length,
          estudiantesActualizados: Object.keys(asistenciasEscolares).length,
        },
        origen: "cache",
      };
    } catch (error) {
      console.error("Error obteniendo datos desde caché:", error);
      return { success: false, message: "Error al acceder al caché local" };
    }
  }

  private async procesarRespuestaAPI(
    response: GetAsistenciasMensualesDeUnAulaSuccessResponse,
    idAula: string,
    mes: number
  ): Promise<{ success: boolean; estudiantesActualizados: number }> {
    try {
      const asistenciasEscolares = response.data.Asistencias_Escolares;
      const idsEstudiantes = Object.keys(asistenciasEscolares);
      let estudiantesActualizados = 0;

      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) {
        throw new Error("No se pudo determinar el nivel y grado del aula");
      }

      const tabla = this.obtenerTablaAsistencias(
        nivelGrado.nivel,
        nivelGrado.grado
      );

      for (const idEstudiante of idsEstudiantes) {
        try {
          const registro: IAsistenciaEstudianteLocal = {
            Id_Estudiante: idEstudiante,
            Mes: mes,
            Asistencias_Mensuales: JSON.stringify(
              asistenciasEscolares[idEstudiante]
            ),
            ultima_fecha_actualizacion:
              this.dateHelper.obtenerTimestampPeruano(),
          };

          await this.guardarRegistroEstudiante(tabla, registro);
          estudiantesActualizados++;
        } catch (errorEstudiante) {
          console.error(
            `Error guardando estudiante ${idEstudiante}:`,
            errorEstudiante
          );
        }
      }

      return { success: estudiantesActualizados > 0, estudiantesActualizados };
    } catch (error) {
      console.error("Error procesando respuesta de API:", error);
      return { success: false, estudiantesActualizados: 0 };
    }
  }

  private async determinarNivelGradoDelAula(
    idAula: string
  ): Promise<{ nivel: NivelEducativo; grado: number } | null> {
    try {
      const { BaseAulasIDB } = await import(
        "@/lib/utils/local/db/models/Aulas/AulasBase"
      );
      const aulasIDB = new BaseAulasIDB();
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aula = todasLasAulas.find((a) => a.Id_Aula === idAula);

      if (!aula) return null;

      return {
        nivel: aula.Nivel as NivelEducativo,
        grado: aula.Grado,
      };
    } catch (error) {
      console.error("Error determinando nivel y grado:", error);
      return null;
    }
  }

  private obtenerTablaAsistencias(
    nivel: NivelEducativo,
    grado: number
  ): TablasLocal {
    const clave = `${nivel}-${grado}`;
    const tabla = MAPEO_TABLA_ASISTENCIAS[clave];

    if (!tabla) {
      throw new Error(
        `No se encontró tabla para nivel ${nivel} y grado ${grado}`
      );
    }

    return tabla;
  }

  private async guardarRegistroEstudiante(
    tabla: TablasLocal,
    registro: IAsistenciaEstudianteLocal
  ): Promise<void> {
    const store = await IndexedDBConnection.getStore(tabla, "readwrite");

    return new Promise<void>((resolve, reject) => {
      const request = store.put(registro);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  private async obtenerRegistrosEstudiantesDelMes(
    tabla: TablasLocal,
    mes: number
  ): Promise<IAsistenciaEstudianteLocal[]> {
    try {
      const store = await IndexedDBConnection.getStore(tabla);
      const index = store.index("por_mes");

      return new Promise<IAsistenciaEstudianteLocal[]>((resolve, reject) => {
        const request = index.getAll(mes);
        request.onsuccess = () =>
          resolve(request.result as IAsistenciaEstudianteLocal[]);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error obteniendo registros:`, error);
      return [];
    }
  }

  /**
   * Verifica control de frecuencia específico para el aula (solo mes actual)
   * - Lunes a Viernes: 10 minutos entre consultas
   * - Sábado/Domingo: Una consulta por todo el fin de semana (hasta lunes)
   */
  private async verificarControlFrecuenciaAula(
    idAula: string,
    mes: number
  ): Promise<{ puedeConsultar: boolean; minutosEspera: number }> {
    try {
      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) {
        return { puedeConsultar: true, minutosEspera: 0 };
      }

      const tabla = this.obtenerTablaAsistencias(
        nivelGrado.nivel,
        nivelGrado.grado
      );
      const registros = await this.obtenerRegistrosEstudiantesDelMes(
        tabla,
        mes
      );

      if (registros.length === 0) {
        return { puedeConsultar: true, minutosEspera: 0 };
      }

      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(idAula);
      const idsEstudiantesAula = new Set(
        estudiantesDelAula.map((e) => e.Id_Estudiante)
      );
      const registrosDelAula = registros.filter((registro) =>
        idsEstudiantesAula.has(registro.Id_Estudiante)
      );

      if (registrosDelAula.length === 0) {
        return { puedeConsultar: true, minutosEspera: 0 };
      }

      const registroMasReciente = registrosDelAula.reduce((mas, actual) =>
        actual.ultima_fecha_actualizacion > mas.ultima_fecha_actualizacion
          ? actual
          : mas
      );

      const fechaActual = this.dateHelper.obtenerTimestampPeruano();
      const tiempoTranscurrido =
        fechaActual - registroMasReciente.ultima_fecha_actualizacion;

      // Obtener día de semana actual y del último registro
      const diaActual = new Date().getDay(); // 0=Domingo, 1=Lunes, ..., 6=Sábado
      const fechaUltimoRegistro = new Date(
        registroMasReciente.ultima_fecha_actualizacion
      );
      const diaUltimoRegistro = fechaUltimoRegistro.getDay();

      const esFinDeSemanaActual = diaActual === 0 || diaActual === 6; // Domingo o Sábado
      const eraFinDeSemana = diaUltimoRegistro === 0 || diaUltimoRegistro === 6;

      console.log("⏳ Control de frecuencia:", {
        idAula,
        diaActual: this.obtenerNombreDia(diaActual),
        diaUltimoRegistro: this.obtenerNombreDia(diaUltimoRegistro),
        esFinDeSemanaActual,
        eraFinDeSemana,
        tiempoTranscurridoMinutos: Math.floor(tiempoTranscurrido / (60 * 1000)),
      });

      // CASO 1: Estamos en FIN DE SEMANA
      if (esFinDeSemanaActual) {
        // Si el último registro fue en fin de semana (sábado o domingo)
        // bloquear hasta el lunes
        if (eraFinDeSemana) {
          // Calcular cuánto falta para el lunes
          const minutosHastaLunes = this.calcularMinutosHastaLunes(diaActual);

          console.log(
            "🚫 Ya se consultó en fin de semana. Bloqueado hasta el lunes."
          );

          return {
            puedeConsultar: false,
            minutosEspera: minutosHastaLunes,
          };
        }

        // Si el último registro fue en día laboral, permitir una consulta en fin de semana
        return { puedeConsultar: true, minutosEspera: 0 };
      }

      // CASO 2: Estamos en DÍA LABORAL (Lunes-Viernes)
      // Si el último registro fue en fin de semana, permitir consulta (es lunes ahora)
      if (eraFinDeSemana) {
        console.log(
          "✅ Último registro fue en fin de semana. Permitiendo consulta en día laboral."
        );
        return { puedeConsultar: true, minutosEspera: 0 };
      }

      // Aplicar control de 10 minutos para días laborales
      const intervaloMs = INTERVALO_ACTUALIZACION_MINUTOS * 60 * 1000;

      if (tiempoTranscurrido < intervaloMs) {
        const minutosEspera = Math.ceil(
          (intervaloMs - tiempoTranscurrido) / (60 * 1000)
        );

        console.log(
          `⏰ Día laboral: Debe esperar ${minutosEspera} minutos antes de consultar nuevamente.`
        );

        return { puedeConsultar: false, minutosEspera };
      }

      return { puedeConsultar: true, minutosEspera: 0 };
    } catch (error) {
      console.error("Error verificando control de frecuencia:", error);
      return { puedeConsultar: true, minutosEspera: 0 };
    }
  }

  /**
   * Calcula minutos restantes hasta el próximo lunes a las 00:00
   */
  private calcularMinutosHastaLunes(diaActual: number): number {
    // diaActual: 0=Domingo, 6=Sábado
    const ahora = new Date();
    const proximoLunes = new Date(ahora);

    // Días hasta el lunes
    let diasHastaLunes: number;
    if (diaActual === 6) {
      // Sábado
      diasHastaLunes = 2;
    } else if (diaActual === 0) {
      // Domingo
      diasHastaLunes = 1;
    } else {
      // No debería llegar aquí, pero por si acaso
      return 0;
    }

    // Establecer al próximo lunes a las 00:00
    proximoLunes.setDate(ahora.getDate() + diasHastaLunes);
    proximoLunes.setHours(0, 0, 0, 0);

    // Calcular diferencia en minutos
    const diferenciaMilisegundos = proximoLunes.getTime() - ahora.getTime();
    const minutos = Math.ceil(diferenciaMilisegundos / (60 * 1000));

    return minutos > 0 ? minutos : 0;
  }

  /**
   * Obtiene nombre del día de la semana
   */
  private obtenerNombreDia(dia: number): string {
    const dias = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    return dias[dia] || "Desconocido";
  }

  private validarConsulta(
    idAula: string,
    mes: number
  ): { esValido: boolean; mensaje: string } {
    if (!idAula || idAula.trim() === "") {
      return { esValido: false, mensaje: "Debe seleccionar un aula válida." };
    }

    if (mes < 1 || mes > 12) {
      return { esValido: false, mensaje: "Debe seleccionar un mes válido." };
    }

    const mesActual = this.dateHelper.obtenerMesActual()!;
    if (mes > mesActual) {
      return {
        esValido: false,
        mensaje: "No se pueden consultar asistencias de meses futuros.",
      };
    }

    return { esValido: true, mensaje: "" };
  }

  private crearResultadoError(mensaje: string): AsistenciaAulaOperationResult {
    this.setError?.({ success: false, message: mensaje });
    return { success: false, message: mensaje };
  }

  private handleSuccess(message: string): void {
    this.setSuccessMessage?.({ message });
  }

  private obtenerNombreMes(mes: number): string {
    const nombres = [
      "",
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];
    return nombres[mes] || "mes desconocido";
  }
}
