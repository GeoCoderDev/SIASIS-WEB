import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";
import { HandlerResponsableAsistenciaResponse } from "../../DatosAsistenciaHoy/handlers/HandlerResponsableAsistenciaResponse";
import {
  AsistenciasEscolaresBaseIDB,
  AsistenciaOperationResult,
  IAsistenciaEscolarLocal,
  AsistenciasPorDia,
} from "../AsistenciasEscolaresBaseIDB";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";
import { MisEstudianteRelacionadoAsistenciasMensualesSuccessResponse } from "@/interfaces/shared/apis/api02/mis-estudiantes-relacionados/asistencias-mensuales/types";
import {
  INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_PRIMARIA,
  INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_SECUNDARIA,
} from "@/constants/INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_RDP01";
import {
  aplicarExtension,
  EXTENSION_ENTRADA_ESTUDIANTES_PRIMARIA,
  EXTENSION_ENTRADA_ESTUDIANTES_SECUNDARIA,
  EXTENSION_SALIDA_ESTUDIANTES_PRIMARIA,
  EXTENSION_SALIDA_ESTUDIANTES_SECUNDARIA,
} from "@/constants/EXTENSION_HORARIOS_ESCOLARES";
import { Endpoint_Get_Asistencias_Mensuales_Escolares_Para_Responsables_API02 } from "@/lib/utils/backend/endpoints/api02/AsistenciasMensualesEscolaresParaResponsables";


// Constantes específicas para responsables
const HORA_CONSOLIDACION_REDIS_A_MONGODB = 22; // 10 PM

interface AsistenciaDiariaResponse {
  success: boolean;
  data?: Record<number, any>;
  message?: string;
}

/**
 * Clase especializada para responsables (padres/apoderados)
 *
 * Características:
 * - Solo puede consultar asistencias de estudiantes vinculados
 * - Usa API específica para responsables
 * - Combina datos mensuales con día actual cuando aplica
 * - Control de frecuencia adaptado a horarios escolares
 */
export class AsistenciasEscolaresParaResponsablesIDB extends AsistenciasEscolaresBaseIDB {
  private handlerAsistencia?: HandlerResponsableAsistenciaResponse;

  constructor(
    setIsSomethingLoading?: (isLoading: boolean) => void,
    setError?: (error: ErrorResponseAPIBase | null) => void,
    setSuccessMessage?: (message: MessageProperty | null) => void,
    handlerAsistencia?: HandlerResponsableAsistenciaResponse
  ) {
    super(setIsSomethingLoading, setError, setSuccessMessage);
    this.handlerAsistencia = handlerAsistencia;
  }

  // =====================================================================================
  // MÉTODO PRINCIPAL PÚBLICO
  // =====================================================================================

  /**
   * Consulta asistencias mensuales de un estudiante específico
   */
  public async consultarAsistenciasMensuales(
    estudiante: EstudianteConAulaYRelacion,
    mes: number
  ): Promise<AsistenciaOperationResult> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      const validacion = this.validarConsultaResponsable(estudiante, mes);
      if (!validacion.esValido) {
        return this.crearResultadoError(validacion.mensaje);
      }

      return await this.consultarAsistenciasImplementacion(estudiante, mes);
    } catch (error) {
      this.handleIndexedDBError(error, "consultar asistencias mensuales");
      return this.crearResultadoError(
        "Ocurrió un error inesperado. Por favor, inténtelo nuevamente."
      );
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  // =====================================================================================
  // IMPLEMENTACIÓN DE MÉTODOS ABSTRACTOS
  // =====================================================================================

  protected async consultarAsistenciasImplementacion(
    estudiante: EstudianteConAulaYRelacion,
    mes: number
  ): Promise<AsistenciaOperationResult> {
    const { nivel, grado } = this.extraerDatosAula(estudiante.aula!);
    const mesActual = this.dateHelper.obtenerMesActual();
    const esConsultaMesActual = mes === mesActual;

    // Obtener registro existente
    const registroExistente = await this.obtenerRegistroPorClave(
      nivel,
      grado,
      estudiante.Id_Estudiante,
      mes
    );

    // Meses anteriores: usar caché si existe, sino consultar API
    if (!esConsultaMesActual) {
      return await this.manejarMesAnterior(
        estudiante.Id_Estudiante,
        mes,
        nivel,
        grado,
        registroExistente
      );
    }

    // Mes actual: lógica compleja
    return await this.manejarMesActual(
      estudiante,
      mes,
      nivel,
      grado,
      registroExistente
    );
  }

  protected verificarControlFrecuenciaRol(
    registro: IAsistenciaEscolarLocal,
    nivel: NivelEducativo
  ): { puedeConsultar: boolean; minutosEspera: number } {
    const fechaActual = this.dateHelper.obtenerTimestampPeruano();
    const tiempoTranscurrido =
      fechaActual - registro.ultima_fecha_actualizacion;

    const intervaloMinutos =
      nivel === NivelEducativo.PRIMARIA
        ? INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_PRIMARIA -
          1
        : INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_SECUNDARIA -
          1;

    const intervaloMs = intervaloMinutos * 60 * 1000;

    if (tiempoTranscurrido < intervaloMs) {
      const minutosEspera = Math.ceil(
        (intervaloMs - tiempoTranscurrido) / (60 * 1000)
      );
      return { puedeConsultar: false, minutosEspera };
    }

    return { puedeConsultar: true, minutosEspera: 0 };
  }

  protected async determinarEstrategiaConsulta(
    mes: number,
    estudiante: EstudianteConAulaYRelacion
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
    const diaActual = fechaActual.getDate();
    const esPrimerDiaLaboralDelMes =
      diaActual === 1 || !this.hayDiasEscolaresAnteriores();

    // Después de 10 PM - solo API mensual
    if (horaActual >= HORA_CONSOLIDACION_REDIS_A_MONGODB) {
      return {
        estrategia: "solo_api_mensual",
        razon: "Después de 10 PM, datos consolidados en MongoDB",
      };
    }

    // Primer día del mes
    if (esPrimerDiaLaboralDelMes) {
      if (!this.esDiaEscolar()) {
        return {
          estrategia: "solo_cache",
          razon: "Primer día es fin de semana",
        };
      }

      const { nivel } = this.extraerDatosAula(estudiante.aula!);
      if (this.estaEnHorarioEscolarExtendido(estudiante.aula!, nivel)) {
        return {
          estrategia: "solo_api_diaria",
          razon: "Primer día laboral en horario escolar",
        };
      }

      return {
        estrategia: "solo_cache",
        razon: "Primer día laboral fuera de horario",
      };
    }

    // Días posteriores del mes
    if (!this.esDiaEscolar()) {
      return {
        estrategia: "solo_api_mensual",
        razon: "Fin de semana",
      };
    }

    const { nivel } = this.extraerDatosAula(estudiante.aula!);
    if (this.estaEnHorarioEscolarExtendido(estudiante.aula!, nivel)) {
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
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number,
    registroExistente: IAsistenciaEscolarLocal | null
  ): Promise<AsistenciaOperationResult> {
    if (registroExistente) {
      const asistenciasParsed = this.parsearAsistenciasMensuales(
        registroExistente.Asistencias_Mensuales
      );

      this.handleSuccess(
        `Se encontraron las asistencias de ${this.obtenerNombreMes(mes)}.`
      );

      return {
        success: true,
        message: "Asistencias obtenidas desde caché",
        data: {
          Mes: mes,
          Asistencias: asistenciasParsed,
          registroCompleto: registroExistente,
        },
        origen: "cache",
        ultimaActualizacion: registroExistente.ultima_fecha_actualizacion,
      };
    }

    return await this.consultarAPIAsistenciasMensuales(
      idEstudiante,
      mes,
      nivel,
      grado
    );
  }

  private async manejarMesActual(
    estudiante: EstudianteConAulaYRelacion,
    mes: number,
    nivel: NivelEducativo,
    grado: number,
    registroExistente: IAsistenciaEscolarLocal | null
  ): Promise<AsistenciaOperationResult> {
    // Control de frecuencia
    if (registroExistente) {
      const control = this.verificarControlFrecuenciaRol(
        registroExistente,
        nivel
      );
      if (!control.puedeConsultar) {
        const asistenciasParsed = this.parsearAsistenciasMensuales(
          registroExistente.Asistencias_Mensuales
        );

        return {
          success: false,
          message: `Debe esperar ${control.minutosEspera} minutos antes de consultar nuevamente.`,
          data: {
            Mes: mes,
            Asistencias: asistenciasParsed,
            registroCompleto: registroExistente,
          },
          requiereEspera: true,
          minutosEspera: control.minutosEspera,
          origen: "cache",
        };
      }
    }

    // Determinar estrategia
    const { estrategia } = await this.determinarEstrategiaConsulta(
      mes,
      estudiante
    );

    switch (estrategia) {
      case "solo_api_mensual":
        return await this.consultarAPIAsistenciasMensuales(
          estudiante.Id_Estudiante,
          mes,
          nivel,
          grado
        );

      case "solo_api_diaria":
        return await this.consultarAPIAsistenciasDiarias(
          estudiante,
          mes,
          nivel,
          grado
        );

      case "api_paralelo":
        return await this.consultarAmbasAPIsEnParalelo(
          estudiante,
          mes,
          nivel,
          grado
        );

      default:
        return this.obtenerDatosDesdeCache(
          nivel,
          grado,
          estudiante.Id_Estudiante,
          mes
        );
    }
  }

  private async consultarAPIAsistenciasMensuales(
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    try {
      const response =
        await Endpoint_Get_Asistencias_Mensuales_Escolares_Para_Responsables_API02.realizarPeticion(
          {
            routeParams: { Id_Estudiante: idEstudiante },
            queryParams: { Mes: mes.toString() },
          }
        );

      await this.procesarRespuestaAPIMensual(
        response,
        idEstudiante,
        mes,
        nivel,
        grado
      );

      const registroCompleto = await this.obtenerRegistroPorClave(
        nivel,
        grado,
        idEstudiante,
        mes
      );

      this.handleSuccess(
        `Se obtuvieron las asistencias de ${this.obtenerNombreMes(mes)}.`
      );

      return {
        success: true,
        message: "Asistencias obtenidas exitosamente",
        data: {
          Mes: mes,
          Asistencias: response.data.Asistencias,
          registroCompleto: registroCompleto,
        },
        origen: "api",
        ultimaActualizacion: registroCompleto?.ultima_fecha_actualizacion,
      };
    } catch (error) {
      console.error("Error en API mensual:", error);
      await this.actualizarTimestampSinModificarDatos(
        nivel,
        grado,
        idEstudiante,
        mes
      );
      return this.crearResultadoError(
        "No se pudieron obtener las asistencias. Verifique su conexión."
      );
    }
  }

  private async consultarAPIAsistenciasDiarias(
    estudiante: EstudianteConAulaYRelacion,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    try {
      const aula = estudiante.aula!;
      const tipoAsistencia =
        nivel === NivelEducativo.PRIMARIA
          ? TipoAsistencia.ParaEstudiantesPrimaria
          : TipoAsistencia.ParaEstudiantesSecundaria;

      const endpoint = `/api/asistencia-hoy/consultar-asistencias-escolares-tomadas?TipoAsistencia=${tipoAsistencia}&Nivel=${aula.Nivel}&Grado=${aula.Grado}&Seccion=${aula.Seccion}&idEstudiante=${estudiante.Id_Estudiante}`;

      const response = await fetch(endpoint);
      const data: AsistenciaDiariaResponse = await response.json();

      await this.procesarRespuestaAPIDiaria(
        data,
        estudiante.Id_Estudiante,
        mes,
        nivel,
        grado
      );

      const registroCompleto = await this.obtenerRegistroPorClave(
        nivel,
        grado,
        estudiante.Id_Estudiante,
        mes
      );

      const asistenciasParsed = registroCompleto
        ? this.parsearAsistenciasMensuales(
            registroCompleto.Asistencias_Mensuales
          )
        : {};

      if (data.success) {
        this.handleSuccess("Se obtuvieron las asistencias del día actual.");
      }

      return {
        success: data.success,
        message: data.success
          ? "Asistencias del día obtenidas"
          : "No hay asistencias nuevas",
        data: {
          Mes: mes,
          Asistencias: asistenciasParsed,
          registroCompleto: registroCompleto,
        },
        origen: "api",
        ultimaActualizacion: registroCompleto?.ultima_fecha_actualizacion,
      };
    } catch (error) {
      console.error("Error en API diaria:", error);
      await this.actualizarTimestampSinModificarDatos(
        nivel,
        grado,
        estudiante.Id_Estudiante,
        mes
      );
      return this.crearResultadoError(
        "No se pudieron obtener las asistencias del día actual."
      );
    }
  }

  private async consultarAmbasAPIsEnParalelo(
    estudiante: EstudianteConAulaYRelacion,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    try {
      const [resultadoMensual, resultadoDiario] = await Promise.all([
        this.consultarAPIAsistenciasMensuales(
          estudiante.Id_Estudiante,
          mes,
          nivel,
          grado
        ),
        this.consultarAPIAsistenciasDiarias(estudiante, mes, nivel, grado),
      ]);

      if (!resultadoMensual.success) {
        return resultadoDiario.success ? resultadoDiario : resultadoMensual;
      }

      this.handleSuccess(
        `Asistencias de ${this.obtenerNombreMes(mes)} incluyendo el día actual.`
      );

      return {
        success: true,
        message: "Asistencias actualizadas con día actual",
        data: resultadoDiario.data || resultadoMensual.data,
        origen: "mixto",
      };
    } catch (error) {
      console.error("Error en consulta paralela:", error);
      return this.crearResultadoError(
        "Error al consultar asistencias en paralelo."
      );
    }
  }

  private async procesarRespuestaAPIMensual(
    response: MisEstudianteRelacionadoAsistenciasMensualesSuccessResponse,
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<void> {
    const registro: Omit<
      IAsistenciaEscolarLocal,
      "ultima_fecha_actualizacion"
    > = {
      Id_Estudiante: idEstudiante,
      Mes: mes,
      Asistencias_Mensuales: JSON.stringify(response.data.Asistencias),
    };

    await this.guardarRegistroAsistencia(nivel, grado, registro);
  }

  private async procesarRespuestaAPIDiaria(
    response: AsistenciaDiariaResponse,
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<void> {
    let registroExistente = await this.obtenerRegistroPorClave(
      nivel,
      grado,
      idEstudiante,
      mes
    );

    let asistenciasActuales: AsistenciasPorDia = registroExistente
      ? this.parsearAsistenciasMensuales(
          registroExistente.Asistencias_Mensuales
        )
      : {};

    if (response.success && response.data) {
      Object.assign(asistenciasActuales, response.data);
    }

    const registro: Omit<
      IAsistenciaEscolarLocal,
      "ultima_fecha_actualizacion"
    > = {
      Id_Estudiante: idEstudiante,
      Mes: mes,
      Asistencias_Mensuales:
        this.stringificarAsistenciasMensuales(asistenciasActuales),
    };

    await this.guardarRegistroAsistencia(nivel, grado, registro);
  }

  // =====================================================================================
  // MÉTODOS AUXILIARES
  // =====================================================================================

  private validarConsultaResponsable(
    estudiante: EstudianteConAulaYRelacion,
    mes: number
  ): { esValido: boolean; mensaje: string } {
    if (!estudiante.aula) {
      return {
        esValido: false,
        mensaje: "El estudiante no tiene un aula asignada.",
      };
    }

    return this.validarMesConsulta(mes);
  }

  private extraerDatosAula(aula: any): {
    nivel: NivelEducativo;
    grado: number;
  } {
    const nivel =
      aula.Nivel === "P" ? NivelEducativo.PRIMARIA : NivelEducativo.SECUNDARIA;
    return { nivel, grado: aula.Grado };
  }

  private estaEnHorarioEscolarExtendido(
    aula: any,
    nivel: NivelEducativo
  ): boolean {
    if (!this.handlerAsistencia) return false;

    const horario = this.handlerAsistencia.getHorarioEscolar(nivel);
    if (!horario) return false;

    const fechaActual = this.dateHelper.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) return false;

    const extensionEntrada =
      nivel === NivelEducativo.PRIMARIA
        ? EXTENSION_ENTRADA_ESTUDIANTES_PRIMARIA
        : EXTENSION_ENTRADA_ESTUDIANTES_SECUNDARIA;

    const extensionSalida =
      nivel === NivelEducativo.PRIMARIA
        ? EXTENSION_SALIDA_ESTUDIANTES_PRIMARIA
        : EXTENSION_SALIDA_ESTUDIANTES_SECUNDARIA;

    const inicio = aplicarExtension(
      new Date(horario.Inicio),
      -extensionEntrada
    );
    const fin = aplicarExtension(new Date(horario.Fin), extensionSalida);

    return fechaActual >= inicio && fechaActual <= fin;
  }

  private hayDiasEscolaresAnteriores(): boolean {
    const diasEscolares = this.dateHelper.obtenerUltimosDiasEscolares(30);
    return diasEscolares.length > 0;
  }
}
