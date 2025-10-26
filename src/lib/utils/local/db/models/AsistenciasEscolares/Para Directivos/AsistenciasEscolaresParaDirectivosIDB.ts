import {
  AsistenciasEscolaresBaseIDB,
  AsistenciaOperationResult,
  IAsistenciaEscolarLocal,
} from "../AsistenciasEscolaresBaseIDB";
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
import { CustomApiError } from "@/lib/errors/custom/ApiError";
import { alterarUTCaZonaPeruana } from "@/lib/helpers/alteradores/alterarUTCaZonaPeruana";

// Constantes específicas para directivos
const INTERVALO_ACTUALIZACION_MINUTOS = 10; // Entre consultas en días laborales
const HORA_DISPONIBILIDAD_MONGODB = 22; // 10 PM

// Interfaces específicas
export interface AsistenciaAulaOperationResult
  extends AsistenciaOperationResult {
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
}

interface DatosAsistenciasDiaActual {
  success: boolean;
  asistencias: Record<string, AsistenciaEscolarDeUnDia>;
  mensaje?: string;
}

/**
 * Clase especializada para Directivos
 *
 * Características:
 * - Acceso completo a todas las aulas del colegio
 * - Puede consultar asistencias por aula completa o por estudiante individual
 * - Maneja eventos escolares
 * - Control de frecuencia adaptado (10 min días laborales, bloqueo fin de semana)
 */
export class AsistenciasEscolaresParaDirectivosIDB extends AsistenciasEscolaresBaseIDB {
  constructor(
    setIsSomethingLoading?: (isLoading: boolean) => void,
    setError?: (error: ErrorResponseAPIBase | null) => void,
    setSuccessMessage?: (message: MessageProperty | null) => void
  ) {
    super(setIsSomethingLoading, setError, setSuccessMessage);
  }

  // =====================================================================================
  // MÉTODOS PÚBLICOS
  // =====================================================================================

  /**
   * Consulta asistencias mensuales de un aula completa
   */
  public async consultarAsistenciasMensualesAula(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      const validacion = this.validarConsultaAula(idAula, mes);
      if (!validacion.esValido) {
        return this.crearResultadoError(validacion.mensaje);
      }

      return await this.consultarAsistenciasImplementacion(idAula, mes);
    } catch (error) {
      return this.manejarErrorGeneral(error, idAula, mes);
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Consulta asistencias mensuales de un estudiante individual
   * FLUJO UNIFICADO: Sigue exactamente la misma lógica que consultarAsistenciasMensualesAula
   */
  public async consultarAsistenciasMensualesEstudiante(
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // 1. Validar mes
      const validacion = this.validarMesConsulta(mes);
      if (!validacion.esValido) {
        return this.crearResultadoError(validacion.mensaje);
      }

      // 2. Validar nivel y grado
      if (!this.validarNivelYGrado(nivel, grado)) {
        return this.crearResultadoError(
          `Nivel ${nivel} y grado ${grado} no son válidos`
        );
      }

      // 3. Seguir el mismo flujo que consultarAsistenciasMensualesAula
      return await this.consultarAsistenciasImplementacionEstudiante(
        idEstudiante,
        mes,
        nivel,
        grado
      );
    } catch (error) {
      return this.manejarErrorGeneral(error, idEstudiante, mes);
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Implementación del flujo unificado para estudiante individual
   * Idéntico a consultarAsistenciasImplementacion pero para un estudiante
   */
  private async consultarAsistenciasImplementacionEstudiante(
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    const mesActual = this.dateHelper.obtenerMesActual();
    const esConsultaMesActual = mes === mesActual;

    if (!esConsultaMesActual) {
      return await this.manejarMesAnteriorEstudiante(
        idEstudiante,
        mes,
        nivel,
        grado
      );
    }

    return await this.manejarMesActualEstudiante(
      idEstudiante,
      mes,
      nivel,
      grado
    );
  }

  /**
   * Maneja consulta de mes anterior para estudiante
   */
  private async manejarMesAnteriorEstudiante(
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    // Intentar desde caché
    const datosCache = await this.obtenerDatosDesdeCache(
      nivel,
      grado,
      idEstudiante,
      mes
    );

    if (datosCache.success) {
      return datosCache;
    }

    // Consultar API y guardar
    return await this.consultarYGuardarMesAnteriorEstudiante(
      idEstudiante,
      mes,
      nivel,
      grado
    );
  }

  /**
   * Consulta y guarda datos de mes anterior para estudiante
   */
  private async consultarYGuardarMesAnteriorEstudiante(
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    try {
      // Obtener información del aula del estudiante
      const infoEstudiante = await this.obtenerInfoEstudiante(idEstudiante);
      if (!infoEstudiante) {
        return this.crearResultadoError(
          "No se pudo determinar el aula del estudiante"
        );
      }

      // Consultar a API02 con parámetros del estudiante
      const response =
        await Endpoint_Get_Asistencias_Mensuales_Escolares_Por_Aula_API02.realizarPeticion(
          {
            routeParams: { Id_Aula: infoEstudiante.idAula },
            queryParams: { Mes: mes },
          }
        );

      // Guardar TODOS los estudiantes del aula (incluyendo el consultado)
      await this.procesarRespuestaAPI(response, infoEstudiante.idAula, mes);

      // Extraer solo los datos del estudiante consultado
      const asistenciasEstudiante =
        response.data.Asistencias_Escolares[idEstudiante];

      if (!asistenciasEstudiante) {
        return this.crearResultadoError(
          `Estudiante ${idEstudiante} no encontrado en la respuesta del servidor`
        );
      }

      this.handleSuccess(
        `Asistencias de ${this.obtenerNombreMes(mes)} obtenidas exitosamente.`
      );

      return {
        success: true,
        message: "Asistencias obtenidas exitosamente",
        data: {
          Mes: mes,
          Asistencias: asistenciasEstudiante,
          Id_Estudiante: idEstudiante,
        },
        origen: "api",
      };
    } catch (error) {
      if (error instanceof CustomApiError) {
        return this.manejarCustomApiError(error, idEstudiante, mes);
      }
      throw error;
    }
  }

  /**
   * Maneja consulta de mes actual para estudiante
   */
  private async manejarMesActualEstudiante(
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    // Obtener información del aula
    const infoEstudiante = await this.obtenerInfoEstudiante(idEstudiante);
    if (!infoEstudiante) {
      return this.crearResultadoError(
        "No se pudo determinar el aula del estudiante"
      );
    }

    // Determinar estrategia (igual que para aula)
    const { estrategia } = await this.determinarEstrategiaConsulta(
      mes,
      infoEstudiante.idAula
    );

    switch (estrategia) {
      case "solo_api_mensual":
        return await this.consultarSoloAPI02Estudiante(
          idEstudiante,
          mes,
          nivel,
          grado
        );

      case "solo_api_diaria":
        return await this.consultarSoloDiaActualEstudiante(
          idEstudiante,
          mes,
          nivel,
          grado
        );

      case "api_paralelo":
        return await this.consultarAPI02YDiaActualParaleloEstudiante(
          idEstudiante,
          mes,
          nivel,
          grado
        );

      default:
        const datosCache = await this.obtenerDatosDesdeCache(
          nivel,
          grado,
          idEstudiante,
          mes
        );
        return datosCache.success
          ? datosCache
          : this.crearResultadoError("No hay datos disponibles.");
    }
  }

  /**
   * Consulta solo API02 para estudiante
   */
  private async consultarSoloAPI02Estudiante(
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    try {
      // Verificar control de frecuencia
      const registroExistente = await this.obtenerRegistroPorClave(
        nivel,
        grado,
        idEstudiante,
        mes
      );

      if (registroExistente) {
        const controlFrecuencia =
          this.verificarControlFrecuenciaRol(registroExistente);

        if (!controlFrecuencia.puedeConsultar) {
          const datosCache = await this.obtenerDatosDesdeCache(
            nivel,
            grado,
            idEstudiante,
            mes
          );
          if (datosCache.success) {
            return {
              ...datosCache,
              requiereEspera: true,
              minutosEspera: controlFrecuencia.minutosEspera,
            };
          }
        }
      }

      // Obtener información del aula
      const infoEstudiante = await this.obtenerInfoEstudiante(idEstudiante);
      if (!infoEstudiante) {
        return this.crearResultadoError(
          "No se pudo determinar el aula del estudiante"
        );
      }

      // Consultar API02
      const response =
        await Endpoint_Get_Asistencias_Mensuales_Escolares_Por_Aula_API02.realizarPeticion(
          {
            routeParams: { Id_Aula: infoEstudiante.idAula },
            queryParams: { Mes: mes },
          }
        );

      // Guardar todos los datos
      await this.procesarRespuestaAPI(response, infoEstudiante.idAula, mes);

      // Extraer datos del estudiante
      const asistenciasEstudiante =
        response.data.Asistencias_Escolares[idEstudiante];

      if (!asistenciasEstudiante) {
        return this.crearResultadoError(
          `Estudiante ${idEstudiante} no encontrado en respuesta`
        );
      }

      this.handleSuccess(
        `Asistencias de ${this.obtenerNombreMes(mes)} obtenidas.`
      );

      return {
        success: true,
        message: "Asistencias obtenidas exitosamente",
        data: {
          Mes: mes,
          Asistencias: asistenciasEstudiante,
          Id_Estudiante: idEstudiante,
        },
        origen: "api",
      };
    } catch (error) {
      if (error instanceof CustomApiError) {
        return this.manejarCustomApiError(error, idEstudiante, mes);
      }
      throw error;
    }
  }

  /**
   * Consulta solo día actual para estudiante
   */
  private async consultarSoloDiaActualEstudiante(
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    try {
      const infoEstudiante = await this.obtenerInfoEstudiante(idEstudiante);
      if (!infoEstudiante) {
        return this.crearResultadoError(
          "No se pudo determinar el aula del estudiante"
        );
      }

      const infoAula = await this.obtenerInformacionAula(infoEstudiante.idAula);
      if (!infoAula) {
        return this.crearResultadoError("No se encontró información del aula.");
      }

      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(
        infoEstudiante.idAula
      );

      const datosDiaActual = await this.consultarAPIAsistenciasDiaActual(
        infoAula.nivel,
        infoAula.grado,
        infoAula.seccion,
        estudiantesDelAula.length
      );

      if (!datosDiaActual.success) {
        return this.crearResultadoError(
          datosDiaActual.mensaje || "No hay asistencias del día actual"
        );
      }

      // Extraer solo el estudiante consultado
      const asistenciaDiaActual = datosDiaActual.asistencias[idEstudiante];
      if (!asistenciaDiaActual) {
        return this.crearResultadoError(
          "Estudiante no tiene asistencia registrada hoy"
        );
      }

      const diaActual = this.dateHelper.obtenerDiaActual()!;
      const asistenciaMensual = {
        [diaActual]: asistenciaDiaActual,
      };

      this.handleSuccess(
        `Asistencia del día ${diaActual} de ${this.obtenerNombreMes(mes)}.`
      );

      return {
        success: true,
        message: "Asistencia del día actual obtenida",
        data: {
          Mes: mes,
          Asistencias: asistenciaMensual,
          Id_Estudiante: idEstudiante,
          incluyeDiaActual: true,
        },
        origen: "api",
      };
    } catch (error) {
      console.error("Error consultando día actual:", error);
      throw error;
    }
  }

  /**
   * Consulta API02 y día actual en paralelo para estudiante
   */
  private async consultarAPI02YDiaActualParaleloEstudiante(
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    try {
      const infoEstudiante = await this.obtenerInfoEstudiante(idEstudiante);
      if (!infoEstudiante) {
        return this.crearResultadoError(
          "No se pudo determinar el aula del estudiante"
        );
      }

      const infoAula = await this.obtenerInformacionAula(infoEstudiante.idAula);
      if (!infoAula) {
        return this.crearResultadoError("No se encontró información del aula.");
      }

      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(
        infoEstudiante.idAula
      );

      const [resultadoAPI02, datosDiaActual] = await Promise.all([
        this.consultarSoloAPI02Estudiante(idEstudiante, mes, nivel, grado),
        this.consultarAPIAsistenciasDiaActual(
          infoAula.nivel,
          infoAula.grado,
          infoAula.seccion,
          estudiantesDelAula.length
        ),
      ]);

      if (!resultadoAPI02.success || !resultadoAPI02.data) {
        if (
          datosDiaActual.success &&
          datosDiaActual.asistencias[idEstudiante]
        ) {
          return await this.consultarSoloDiaActualEstudiante(
            idEstudiante,
            mes,
            nivel,
            grado
          );
        }
        return resultadoAPI02;
      }

      // Fusionar datos
      const asistenciasMensuales = resultadoAPI02.data.Asistencias;
      const asistenciaDiaActual = datosDiaActual.success
        ? datosDiaActual.asistencias[idEstudiante]
        : null;

      if (asistenciaDiaActual) {
        const diaActual = this.dateHelper.obtenerDiaActual()!;
        asistenciasMensuales[diaActual] = asistenciaDiaActual;
      }

      this.handleSuccess(
        `Asistencias de ${this.obtenerNombreMes(mes)} incluyendo el día actual.`
      );

      return {
        success: true,
        message: "Asistencias con día actual obtenidas",
        data: {
          Mes: mes,
          Asistencias: asistenciasMensuales,
          Id_Estudiante: idEstudiante,
          incluyeDiaActual: datosDiaActual.success && !!asistenciaDiaActual,
        },
        origen: "mixto",
      };
    } catch (error) {
      console.error("Error en consulta paralela:", error);
      throw error;
    }
  }

  // =====================================================================================
  // IMPLEMENTACIÓN DE MÉTODOS ABSTRACTOS
  // =====================================================================================

  protected async consultarAsistenciasImplementacion(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    const mesActual = this.dateHelper.obtenerMesActual();
    const esConsultaMesActual = mes === mesActual;

    // Meses anteriores: datos inmutables, usar caché indefinidamente
    if (!esConsultaMesActual) {
      return await this.manejarMesAnterior(idAula, mes);
    }

    // Mes actual: lógica compleja
    return await this.manejarMesActual(idAula, mes);
  }

  protected verificarControlFrecuenciaRol(registro: IAsistenciaEscolarLocal): {
    puedeConsultar: boolean;
    minutosEspera: number;
  } {
    // Esta implementación no se usa directamente en esta clase
    // ya que el control de frecuencia es por aula, no por estudiante individual
    return { puedeConsultar: true, minutosEspera: 0 };
  }

  protected async determinarEstrategiaConsulta(
    mes: number,
    idAula: string
  ): Promise<{
    estrategia:
      | "solo_cache"
      | "solo_api_mensual"
      | "solo_api_diaria"
      | "api_paralelo";
    razon: string;
  }> {
    const fechaActual = this.dateHelper.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) {
      return { estrategia: "solo_cache", razon: "No hay fecha actual" };
    }

    const horaActual = fechaActual.getHours();
    const esPrimerDiaLaboralDelMes = await this.esPrimerDiaLaboralDelMes(mes);

    // Después de 10 PM
    if (horaActual >= HORA_DISPONIBILIDAD_MONGODB) {
      return {
        estrategia: "solo_api_mensual",
        razon: "Después de 10 PM, datos consolidados",
      };
    }

    // Primer día laboral del mes
    if (esPrimerDiaLaboralDelMes && this.esDiaEscolar()) {
      const debeConsultar = await this.debeConsultarDiaActual(idAula);
      if (debeConsultar) {
        return {
          estrategia: "solo_api_diaria",
          razon: "Primer día laboral en horario escolar",
        };
      }
      return {
        estrategia: "solo_cache",
        razon: "Primer día fuera de horario",
      };
    }

    // Fin de semana
    if (!this.esDiaEscolar()) {
      return { estrategia: "solo_api_mensual", razon: "Fin de semana" };
    }

    // Día laboral normal
    const debeConsultar = await this.debeConsultarDiaActual(idAula);
    if (debeConsultar) {
      return {
        estrategia: "api_paralelo",
        razon: "Día laboral en horario escolar",
      };
    }

    return {
      estrategia: "solo_api_mensual",
      razon: "Día laboral fuera de horario",
    };
  }

  // =====================================================================================
  // MÉTODOS ESPECÍFICOS DEL ROL
  // =====================================================================================

  private async manejarMesAnterior(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    // Intentar desde caché
    const datosCache = await this.obtenerDatosAulaDesdeCache(idAula, mes);
    if (datosCache.success && datosCache.data) {
      return datosCache;
    }

    // Consultar API y guardar permanentemente
    return await this.consultarYGuardarMesAnterior(idAula, mes);
  }

  private async manejarMesActual(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    const { estrategia } = await this.determinarEstrategiaConsulta(mes, idAula);

    switch (estrategia) {
      case "solo_api_mensual":
        return await this.consultarSoloAPI02(idAula, mes);

      case "solo_api_diaria":
        return await this.consultarSoloDiaActual(idAula, mes);

      case "api_paralelo":
        return await this.consultarAPI02YDiaActualParalelo(idAula, mes);

      default:
        const datosCache = await this.obtenerDatosAulaDesdeCache(idAula, mes);
        return datosCache.success
          ? datosCache
          : this.crearResultadoError("No hay datos disponibles.");
    }
  }

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

      await this.procesarRespuestaAPI(response, idAula, mes);

      this.handleSuccess(
        `Asistencias de ${this.obtenerNombreMes(mes)} obtenidas exitosamente.`
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

  private async consultarSoloAPI02(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      // Verificar control de frecuencia por aula
      const controlFrecuencia = await this.verificarControlFrecuenciaAula(
        idAula,
        mes
      );

      if (!controlFrecuencia.puedeConsultar) {
        const datosCache = await this.obtenerDatosAulaDesdeCache(idAula, mes);
        if (datosCache.success && datosCache.data) {
          return {
            ...datosCache,
            requiereEspera: true,
            minutosEspera: controlFrecuencia.minutosEspera,
          };
        }
      }

      const response =
        await Endpoint_Get_Asistencias_Mensuales_Escolares_Por_Aula_API02.realizarPeticion(
          {
            routeParams: { Id_Aula: idAula },
            queryParams: { Mes: mes },
          }
        );

      await this.procesarRespuestaAPI(response, idAula, mes);

      this.handleSuccess(
        `Asistencias de ${this.obtenerNombreMes(mes)} obtenidas.`
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

  private async consultarSoloDiaActual(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      const infoAula = await this.obtenerInformacionAula(idAula);
      if (!infoAula) {
        return this.crearResultadoError("No se encontró información del aula.");
      }

      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(idAula);
      if (estudiantesDelAula.length === 0) {
        return this.crearResultadoError(
          "No hay estudiantes activos en esta aula."
        );
      }

      const datosDiaActual = await this.consultarAPIAsistenciasDiaActual(
        infoAula.nivel,
        infoAula.grado,
        infoAula.seccion,
        estudiantesDelAula.length
      );

      if (!datosDiaActual.success) {
        return this.crearResultadoError(
          datosDiaActual.mensaje || "No hay asistencias del día actual"
        );
      }

      return await this.crearResultadoSoloDiaActual(
        mes,
        datosDiaActual.asistencias,
        estudiantesDelAula.length
      );
    } catch (error) {
      console.error("Error consultando día actual:", error);
      throw error;
    }
  }

  private async consultarAPI02YDiaActualParalelo(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      const infoAula = await this.obtenerInformacionAula(idAula);
      if (!infoAula) {
        return this.crearResultadoError("No se encontró información del aula.");
      }

      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(idAula);
      if (estudiantesDelAula.length === 0) {
        return this.crearResultadoError(
          "No hay estudiantes activos en esta aula."
        );
      }

      const [resultadoAPI02, datosDiaActual] = await Promise.all([
        this.consultarSoloAPI02(idAula, mes),
        this.consultarAPIAsistenciasDiaActual(
          infoAula.nivel,
          infoAula.grado,
          infoAula.seccion,
          estudiantesDelAula.length
        ),
      ]);

      if (!resultadoAPI02.success || !resultadoAPI02.data) {
        if (datosDiaActual.success) {
          return await this.crearResultadoSoloDiaActual(
            mes,
            datosDiaActual.asistencias,
            estudiantesDelAula.length
          );
        }
        return resultadoAPI02;
      }

      const asistenciasFusionadas =
        this.fusionarAsistenciasMensualesConDiaActual(
          resultadoAPI02.data.Asistencias_Escolares,
          datosDiaActual.success ? datosDiaActual.asistencias : {}
        );

      this.handleSuccess(
        `Asistencias de ${this.obtenerNombreMes(mes)} incluyendo el día actual.`
      );

      return {
        success: true,
        message: "Asistencias con día actual obtenidas",
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
      console.error("Error en consulta paralela:", error);
      throw error;
    }
  }

  private async procesarRespuestaAPI(
    response: GetAsistenciasMensualesDeUnAulaSuccessResponse,
    idAula: string,
    mes: number
  ): Promise<void> {
    try {
      const asistenciasEscolares = response.data.Asistencias_Escolares;
      const idsEstudiantes = Object.keys(asistenciasEscolares);

      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) {
        throw new Error("No se pudo determinar nivel y grado del aula");
      }

      for (const idEstudiante of idsEstudiantes) {
        try {
          const registro: Omit<
            IAsistenciaEscolarLocal,
            "ultima_fecha_actualizacion"
          > = {
            Id_Estudiante: idEstudiante,
            Mes: mes,
            Asistencias_Mensuales: JSON.stringify(
              asistenciasEscolares[idEstudiante]
            ),
          };

          await this.guardarRegistroAsistencia(
            nivelGrado.nivel,
            nivelGrado.grado,
            registro
          );
        } catch (error) {
          console.error(`Error guardando estudiante ${idEstudiante}:`, error);
        }
      }
    } catch (error) {
      console.error("Error procesando respuesta API:", error);
    }
  }

  private async consultarAPIAsistenciasDiaActual(
    nivel: NivelEducativo,
    grado: number,
    seccion: string,
    totalEstudiantes: number
  ): Promise<DatosAsistenciasDiaActual> {
    try {
      const tipoAsistencia =
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
          mensaje: errorData.message || "Error al consultar día actual",
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
        mensaje: `${
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
  // MÉTODOS AUXILIARES
  // =====================================================================================

  private validarConsultaAula(
    idAula: string,
    mes: number
  ): { esValido: boolean; mensaje: string } {
    if (!idAula || idAula.trim() === "") {
      return { esValido: false, mensaje: "Debe seleccionar un aula válida." };
    }

    return this.validarMesConsulta(mes);
  }

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

  private async determinarNivelGradoDelAula(
    idAula: string
  ): Promise<{ nivel: NivelEducativo; grado: number } | null> {
    const infoAula = await this.obtenerInformacionAula(idAula);
    return infoAula ? { nivel: infoAula.nivel, grado: infoAula.grado } : null;
  }

  private async obtenerDatosAulaDesdeCache(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) {
        return { success: false, message: "Aula no encontrada" };
      }

      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(idAula);
      if (estudiantesDelAula.length === 0) {
        return { success: false, message: "No hay estudiantes en el aula" };
      }

      const idsEstudiantesAula = estudiantesDelAula.map((e) => e.Id_Estudiante);
      const registrosDelMes = await this.obtenerRegistrosEstudiantesDelMes(
        nivelGrado.nivel,
        nivelGrado.grado,
        mes
      );

      const registrosFiltrados = registrosDelMes.filter((registro) =>
        idsEstudiantesAula.includes(registro.Id_Estudiante)
      );

      if (registrosFiltrados.length === 0) {
        return { success: false, message: "No hay datos en caché" };
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
        } catch (error) {
          console.error("Error parseando asistencias:", error);
        }
      }

      if (Object.keys(asistenciasEscolares).length === 0) {
        return { success: false, message: "No hay asistencias válidas" };
      }

      this.handleSuccess(
        `Asistencias de ${this.obtenerNombreMes(mes)} desde caché.`
      );

      return {
        success: true,
        message: "Asistencias desde caché",
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
      return { success: false, message: "Error al acceder al caché" };
    }
  }

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
      `Asistencias del día ${diaActual} de ${this.obtenerNombreMes(mes)}.`
    );

    return {
      success: true,
      message: "Asistencias del día actual obtenidas",
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

  private async esPrimerDiaLaboralDelMes(mes: number): Promise<boolean> {
    const año = new Date().getFullYear();
    const mesActual = new Date().getMonth() + 1;
    const diaActual = new Date().getDate();

    if (mes !== mesActual) return false;

    for (let dia = 1; dia <= 31; dia++) {
      const fecha = new Date(año, mes - 1, dia);
      if (fecha.getMonth() !== mes - 1) break;

      const diaSemana = fecha.getDay();
      if (diaSemana >= 1 && diaSemana <= 5) {
        return dia === diaActual;
      }
    }

    return false;
  }

  private async debeConsultarDiaActual(idAula: string): Promise<boolean> {
    try {
      if (!this.esDiaEscolar()) return false;

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

      if (!handler) return false;

      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) return false;

      const horarioEscolar = handler.getHorarioEscolar(nivelGrado.nivel);
      if (!horarioEscolar) return false;

      const fechaHoraActual = handler.getFechaHoraRedux();
      if (!fechaHoraActual) return false;

      const horaInicio = new Date(
        alterarUTCaZonaPeruana(horarioEscolar.Inicio)
      );
      return fechaHoraActual >= horaInicio;
    } catch (error) {
      console.error("Error verificando horario:", error);
      return false;
    }
  }

  /**
   * Verifica el control de frecuencia para consultas de asistencias por aula
   * Implementa lógica especial para fines de semana
   */
  private async verificarControlFrecuenciaAula(
    idAula: string,
    mes: number
  ): Promise<{ puedeConsultar: boolean; minutosEspera: number }> {
    try {
      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) return { puedeConsultar: true, minutosEspera: 0 };

      const registros = await this.obtenerRegistrosEstudiantesDelMes(
        nivelGrado.nivel,
        nivelGrado.grado,
        mes
      );

      if (registros.length === 0)
        return { puedeConsultar: true, minutosEspera: 0 };

      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(idAula);
      const idsEstudiantesAula = new Set(
        estudiantesDelAula.map((e) => e.Id_Estudiante)
      );

      const registrosDelAula = registros.filter((r) =>
        idsEstudiantesAula.has(r.Id_Estudiante)
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

      const ahora = new Date(fechaActual);
      const diaActual = ahora.getDay();
      const fechaUltimoRegistro = new Date(
        registroMasReciente.ultima_fecha_actualizacion
      );
      const diaUltimoRegistro = fechaUltimoRegistro.getDay();

      const esFinDeSemanaActual = diaActual === 0 || diaActual === 6;
      const eraFinDeSemana = diaUltimoRegistro === 0 || diaUltimoRegistro === 6;

      // === LÓGICA ESPECIAL PARA FIN DE SEMANA ===
      if (esFinDeSemanaActual && eraFinDeSemana) {
        // Calcular la fecha límite de consolidación (último día laboral a la hora configurada)
        const fechaLimiteConsolidacion =
          this.calcularFechaLimiteConsolidacionDatos(ahora);

        // Si el registro es anterior a la consolidación, los datos están desactualizados
        if (
          registroMasReciente.ultima_fecha_actualizacion <
          fechaLimiteConsolidacion.getTime()
        ) {
          return {
            puedeConsultar: true,
            minutosEspera: 0,
          };
        }

        // Si el registro es posterior a la consolidación, ya tiene datos actualizados
        const minutosHastaProximoDiaLaboral =
          this.calcularMinutosHastaProximoDiaLaboral(diaActual);
        return {
          puedeConsultar: false,
          minutosEspera: minutosHastaProximoDiaLaboral,
        };
      }

      // === LÓGICA PARA DÍAS LABORALES ===
      if (!esFinDeSemanaActual && !eraFinDeSemana) {
        const intervaloMs = INTERVALO_ACTUALIZACION_MINUTOS * 60 * 1000;
        if (tiempoTranscurrido < intervaloMs) {
          const minutosEspera = Math.ceil(
            (intervaloMs - tiempoTranscurrido) / (60 * 1000)
          );
          return { puedeConsultar: false, minutosEspera };
        }
      }

      return { puedeConsultar: true, minutosEspera: 0 };
    } catch (error) {
      console.error("Error en control de frecuencia:", error);
      return { puedeConsultar: true, minutosEspera: 0 };
    }
  }

  /**
   * Calcula la fecha límite de consolidación de datos
   * Esto es el último día laboral (viernes) a la hora configurada en HORA_DISPONIBILIDAD_MONGODB
   * @param fechaReferencia Fecha actual desde la cual calcular
   * @returns Date objeto representando la fecha límite de consolidación
   */
  private calcularFechaLimiteConsolidacionDatos(fechaReferencia: Date): Date {
    const ultimoDiaLaboral = new Date(fechaReferencia);
    const diaActual = ultimoDiaLaboral.getDay();

    // Calcular cuántos días retroceder hasta el último día laboral
    let diasRetroceso: number;

    if (diaActual === 0) {
      // Domingo
      diasRetroceso = 2; // Retroceder al viernes
    } else if (diaActual === 6) {
      // Sábado
      diasRetroceso = 1; // Retroceder al viernes
    } else if (diaActual === 5) {
      // Último día laboral de la semana
      // Si es el último día laboral, verificar si ya pasó la hora de consolidación
      const horaActual = fechaReferencia.getHours();
      diasRetroceso = horaActual >= HORA_DISPONIBILIDAD_MONGODB ? 0 : 7;
    } else {
      // Lunes a Jueves
      // Calcular días hasta el último día laboral anterior
      diasRetroceso = diaActual + 2; // L(1)+2=3, M(2)+2=4, Mi(3)+2=5, J(4)+2=6
    }

    ultimoDiaLaboral.setDate(ultimoDiaLaboral.getDate() - diasRetroceso);
    ultimoDiaLaboral.setHours(HORA_DISPONIBILIDAD_MONGODB, 0, 0, 0);

    return ultimoDiaLaboral;
  }

  /**
   * Calcula los minutos que faltan hasta el próximo día laboral (lunes) a las 00:00
   * @param diaActual Día de la semana actual (0 = domingo, 6 = sábado)
   * @returns Minutos hasta el inicio del próximo día laboral
   */
  private calcularMinutosHastaProximoDiaLaboral(diaActual: number): number {
    const ahora = new Date();
    const proximoDiaLaboral = new Date(ahora);

    // Calcular días hasta el lunes
    const diasHastaProximoDiaLaboral =
      diaActual === 6 ? 2 : diaActual === 0 ? 1 : 0;
    proximoDiaLaboral.setDate(ahora.getDate() + diasHastaProximoDiaLaboral);
    proximoDiaLaboral.setHours(0, 0, 0, 0);

    const diferenciaMilisegundos =
      proximoDiaLaboral.getTime() - ahora.getTime();
    const minutos = Math.ceil(diferenciaMilisegundos / (60 * 1000));

    return minutos > 0 ? minutos : 0;
  }

  private manejarCustomApiError(
    error: CustomApiError,
    idAula: string,
    mes: number
  ): AsistenciaAulaOperationResult {
    const { statusCode } = error.payload;
    let mensajeAmigable: string;

    switch (statusCode) {
      case 404:
        mensajeAmigable = `No hay datos de asistencia para ${this.obtenerNombreMes(
          mes
        )} en esta aula.`;
        break;
      case 500:
      case 502:
      case 503:
        mensajeAmigable =
          "El servidor está presentando problemas. Intente en unos minutos.";
        break;
      default:
        mensajeAmigable = `Error al obtener asistencias (Código: ${statusCode}).`;
    }

    console.error("Error CustomApiError:", {
      statusCode,
      mensaje: error.message,
      idAula,
      mes,
    });

    return this.crearResultadoError(mensajeAmigable);
  }

  // Sobrescribir el método de manejo de errores para estudiantes
  private manejarErrorGeneral(
    error: unknown,
    idEstudianteOrAula: string,
    mes: number
  ): AsistenciaOperationResult {
    if (error instanceof CustomApiError) {
      return this.manejarCustomApiError(error, idEstudianteOrAula, mes);
    }

    console.error("Error general:", error);

    let mensaje = "Ocurrió un error inesperado al consultar las asistencias.";

    if (error instanceof Error) {
      if (
        error.message.includes("Failed to fetch") ||
        error.message.includes("NetworkError")
      ) {
        mensaje = "No se pudo conectar con el servidor. Verifique su conexión.";
      }
    }

    return this.crearResultadoError(mensaje);
  }
}
