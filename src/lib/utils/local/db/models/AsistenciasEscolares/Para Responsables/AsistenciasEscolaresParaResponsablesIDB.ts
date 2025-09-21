import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";
import { HandlerResponsableAsistenciaResponse } from "../../DatosAsistenciaHoy/handlers/HandlerResponsableAsistenciaResponse";
import {
  AsistenciaOperationResult,
  AsistenciasEscolaresBaseIDB,
  AsistenciasResponsableData,
  IAsistenciaEscolarLocal,
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

// Constantes específicas para esta clase
const HORA_CONSOLIDACION_REDIS_A_MONGODB = 22; // 22:00 hora de Perú

// Interfaces para las respuestas de las APIs
interface AsistenciaDiariaResponse {
  success: boolean;
  data?: AsistenciasResponsableData;
  message?: string;
}

// Resultado específico para responsables
export interface ConsultaAsistenciasResponsableResult
  extends AsistenciaOperationResult {
  origen?: "cache" | "api_mensual" | "api_diaria" | "ambas_apis";
  ultimaActualizacion?: number;
  requiereEspera?: boolean;
  minutosEspera?: number;
}

/**
 * Clase especializada para el manejo de asistencias escolares para responsables
 * Implementa lógica compleja de consulta con dos APIs y control de horarios
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

  /**
   * Método principal para consultar asistencias mensuales de un estudiante
   * Implementa toda la lógica de decisión entre APIs y controles de tiempo
   */
  public async consultarAsistenciasMensuales(
    estudiante: EstudianteConAulaYRelacion,
    mes: number
  ): Promise<ConsultaAsistenciasResponsableResult> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // Validaciones iniciales
      const validacion = this.validarConsulta(estudiante, mes);
      if (!validacion.esValido) {
        return this.crearResultadoError(validacion.mensaje);
      }

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

      // Consulta para mes anterior (datos históricos)
      if (!esConsultaMesActual) {
        return await this.manejarConsultaMesAnterior(
          estudiante,
          mes,
          nivel,
          grado,
          registroExistente
        );
      }

      // Consulta para mes actual (lógica compleja)
      return await this.manejarConsultaMesActual(
        estudiante,
        mes,
        nivel,
        grado,
        registroExistente
      );
    } catch (error) {
      this.handleIndexedDBError(error, "consultar asistencias mensuales");
      return this.crearResultadoError(
        "Ocurrió un error al consultar las asistencias. Por favor, inténtelo nuevamente."
      );
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Maneja la consulta para meses anteriores (datos históricos)
   */
  private async manejarConsultaMesAnterior(
    estudiante: EstudianteConAulaYRelacion,
    mes: number,
    nivel: NivelEducativo,
    grado: number,
    registroExistente: IAsistenciaEscolarLocal | null
  ): Promise<ConsultaAsistenciasResponsableResult> {
    // Si ya existe el registro, devolverlo (no se vuelve a consultar)
    if (registroExistente) {
      // CORRECCIÓN: Parsear las asistencias antes de devolverlas
      const asistenciasParsed = this.parsearAsistenciasMensuales(
        registroExistente.Asistencias_Mensuales
      );

      this.handleSuccess(
        `Se encontraron las asistencias de ${this.obtenerNombreMes(
          mes
        )} desde los registros guardados.`
      );

      return {
        success: true,
        message: "Asistencias obtenidas exitosamente",
        data: {
          Mes: mes,
          Asistencias: asistenciasParsed,
          registroCompleto: registroExistente,
        },
        origen: "cache",
        ultimaActualizacion: registroExistente.ultima_fecha_actualizacion,
      };
    }

    // No existe, consultar API mensual
    return await this.consultarAPIAsistenciasMensuales(
      estudiante.Id_Estudiante,
      mes,
      nivel,
      grado
    );
  }

  /**
   * Maneja la consulta para el mes actual (lógica compleja)
   */
  private async manejarConsultaMesActual(
    estudiante: EstudianteConAulaYRelacion,
    mes: number,
    nivel: NivelEducativo,
    grado: number,
    registroExistente: IAsistenciaEscolarLocal | null
  ): Promise<ConsultaAsistenciasResponsableResult> {
    // Control de frecuencia de consultas (solo para mes actual)
    if (registroExistente) {
      const controlFrecuencia = this.verificarControlFrecuencia(
        registroExistente,
        nivel
      );
      if (!controlFrecuencia.puedeConsultar) {
        // CORRECCIÓN: Devolver datos del cache incluso cuando hay que esperar
        const asistenciasParsed = this.parsearAsistenciasMensuales(
          registroExistente.Asistencias_Mensuales
        );

        return {
          success: false,
          message: `Debe esperar ${controlFrecuencia.minutosEspera} minutos antes de consultar nuevamente las asistencias de este mes.`,
          data: {
            Mes: mes,
            Asistencias: asistenciasParsed,
            registroCompleto: registroExistente,
          },
          requiereEspera: true,
          minutosEspera: controlFrecuencia.minutosEspera,
          origen: "cache",
          ultimaActualizacion: registroExistente.ultima_fecha_actualizacion,
        };
      }
    }

    const fechaActual = this.dateHelper.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) {
      return this.crearResultadoError(
        "No se pudo obtener la hora actual del sistema."
      );
    }

    const horaActual = fechaActual.getHours();
    const diaActual = fechaActual.getDate();

    // Determinar estrategia según la hora y día actual
    if (horaActual >= HORA_CONSOLIDACION_REDIS_A_MONGODB) {
      // Después de 22:00 - Solo consultar API mensual
      return await this.consultarAPIAsistenciasMensuales(
        estudiante.Id_Estudiante,
        mes,
        nivel,
        grado
      );
    }

    // Antes de 22:00 - Lógica compleja según el día del mes
    if (diaActual === 1 || !this.hayDiasEscolaresAnteriores()) {
      // Primer día del mes o no hay días escolares anteriores
      return await this.manejarPrimerDiaOMes(estudiante, mes, nivel, grado);
    }

    // Ya han pasado días del mes - Consultar ambas APIs si es necesario
    return await this.manejarDiasPosterioresMes(estudiante, mes, nivel, grado);
  }

  /**
   * Maneja el primer día del mes o cuando no hay días escolares anteriores
   */
  private async manejarPrimerDiaOMes(
    estudiante: EstudianteConAulaYRelacion,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<ConsultaAsistenciasResponsableResult> {
    // CORRECCIÓN: Verificar si es día escolar antes de verificar horarios
    if (!this.esDiaEscolar()) {
      // En fin de semana, solo consultar API mensual para datos históricos
      return await this.consultarAPIAsistenciasMensuales(
        estudiante.Id_Estudiante,
        mes,
        nivel,
        grado
      );
    }

    // Solo consultar API diaria si estamos en horario escolar extendido
    if (this.estaEnHorarioEscolarExtendido(estudiante.aula!, nivel)) {
      return await this.consultarAPIAsistenciasDiarias(
        estudiante,
        mes,
        nivel,
        grado
      );
    } else {
      return this.crearResultadoError(
        "Las asistencias del día se pueden consultar solo durante el horario escolar."
      );
    }
  }

  /**
   * Maneja días posteriores del mes (consulta ambas APIs si es necesario)
   */
  private async manejarDiasPosterioresMes(
    estudiante: EstudianteConAulaYRelacion,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<ConsultaAsistenciasResponsableResult> {
    // Primero consultar API mensual
    const resultadoMensual = await this.consultarAPIAsistenciasMensuales(
      estudiante.Id_Estudiante,
      mes,
      nivel,
      grado
    );

    if (!resultadoMensual.success) {
      return resultadoMensual;
    }

    // CORRECCIÓN: Verificar si es día escolar antes de consultar API diaria
    if (!this.esDiaEscolar()) {
      // En fin de semana, solo devolver datos mensuales
      return {
        ...resultadoMensual,
        origen: "api_mensual",
      };
    }

    // Si es día escolar y estamos en horario escolar, también consultar API diaria
    if (this.estaEnHorarioEscolarExtendido(estudiante.aula!, nivel)) {
      try {
        const resultadoDiario = await this.consultarAPIAsistenciasDiarias(
          estudiante,
          mes,
          nivel,
          grado
        );

        if (resultadoDiario.success) {
          // Combinar ambos resultados
          return {
            success: true,
            message:
              "Asistencias actualizadas con datos del mes y del día actual",
            data: resultadoDiario.data,
            origen: "ambas_apis",
          };
        }
      } catch (error) {
        console.error(
          "Error en API diaria (continuando con datos mensuales):",
          error
        );
      }
    }

    return {
      ...resultadoMensual,
      origen: "api_mensual",
    };
  }

  /**
   * Consulta la API de asistencias mensuales
   */
  private async consultarAPIAsistenciasMensuales(
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<ConsultaAsistenciasResponsableResult> {
    try {
      const response =
        await Endpoint_Get_Asistencias_Mensuales_Escolares_Para_Responsables_API02.realizarPeticion(
          {
            routeParams: { Id_Estudiante: idEstudiante },
            queryParams: { Mes: mes.toString() },
          }
        );

      // Procesar la respuesta pero devolver los datos de asistencia parseados
      const resultadoGuardado = await this.procesarRespuestaAPIMensual(
        response,
        idEstudiante,
        mes,
        nivel,
        grado
      );

      if (resultadoGuardado.success) {
        this.handleSuccess(
          `Se obtuvieron las asistencias de ${this.obtenerNombreMes(
            mes
          )} exitosamente.`
        );

        // Obtener el registro recién guardado
        const registroCompleto = await this.obtenerRegistroPorClave(
          nivel,
          grado,
          idEstudiante,
          mes
        );

        return {
          success: true,
          message: "Asistencias obtenidas exitosamente",
          data: {
            Mes: mes,
            Asistencias: response.data.Asistencias, // Datos originales de la API
            registroCompleto: registroCompleto!, // Puede ser null
          },
          origen: "api_mensual",
          ultimaActualizacion: registroCompleto?.ultima_fecha_actualizacion,
        };
      }

      return this.crearResultadoError(
        "No se encontraron registros de asistencia para este mes."
      );
    } catch (error) {
      console.error("Error en API mensual:", error);

      // CORRECCIÓN: Manejar casos donde la API falla pero debemos actualizar timestamp
      // Intentar actualizar con datos vacíos para mantener el timestamp
      try {
        const registroVacio: Omit<
          IAsistenciaEscolarLocal,
          "ultima_fecha_actualizacion"
        > = {
          Id_Estudiante: idEstudiante,
          Mes: mes,
          Asistencias_Mensuales: JSON.stringify({}),
        };

        await this.guardarRegistroAsistencia(nivel, grado, registroVacio);
      } catch (guardarError) {
        console.error("Error al guardar timestamp de fallo:", guardarError);
      }

      return this.crearResultadoError(
        "No se pudieron obtener las asistencias del servidor. Verifique su conexión."
      );
    }
  }

  /**
   * Consulta la API de asistencias diarias (Next.js)
   */
  private async consultarAPIAsistenciasDiarias(
    estudiante: EstudianteConAulaYRelacion,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<ConsultaAsistenciasResponsableResult> {
    try {
      const aula = estudiante.aula!;
      const tipoAsistencia =
        nivel === NivelEducativo.PRIMARIA
          ? TipoAsistencia.ParaEstudiantesPrimaria
          : TipoAsistencia.ParaEstudiantesSecundaria;

      const endpoint = `/api/asistencia-hoy/consultar-asistencias-escolares-tomadas?TipoAsistencia=${tipoAsistencia}&Nivel=${aula.Nivel}&Grado=${aula.Grado}&Seccion=${aula.Seccion}&idEstudiante=${estudiante.Id_Estudiante}`;

      const response = await fetch(endpoint);
      const data: AsistenciaDiariaResponse = await response.json();

      // SIEMPRE procesar la respuesta para actualizar timestamp
      const resultadoGuardado = await this.procesarRespuestaAPIDiaria(
        data,
        estudiante.Id_Estudiante,
        mes,
        nivel,
        grado
      );

      // Obtener el registro actualizado
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

      if (
        resultadoGuardado.success &&
        (data.success || Object.keys(asistenciasParsed).length > 0)
      ) {
        this.handleSuccess("Se obtuvieron las asistencias del día actual.");

        return {
          success: true,
          message: "Asistencias del día obtenidas exitosamente",
          data: {
            Mes: mes,
            Asistencias: asistenciasParsed,
            registroCompleto: registroCompleto!, // Puede ser null
          },
          origen: "api_diaria",
          ultimaActualizacion: registroCompleto?.ultima_fecha_actualizacion,
        };
      }

      // CORRECCIÓN: Incluso si no hay datos nuevos, devolver lo que tenemos
      return {
        success: false,
        message: "No se encontraron asistencias nuevas para el día actual.",
        data: {
          Mes: mes,
          Asistencias: asistenciasParsed,
          registroCompleto: registroCompleto!, // Puede ser null
        },
        origen: "api_diaria",
        ultimaActualizacion: registroCompleto?.ultima_fecha_actualizacion,
      };
    } catch (error) {
      console.error("Error en API diaria:", error);

      // CORRECCIÓN: Manejar error pero actualizar timestamp
      try {
        // Obtener registro existente o crear uno vacío
        let registroExistente = await this.obtenerRegistroPorClave(
          nivel,
          grado,
          estudiante.Id_Estudiante,
          mes
        );

        if (!registroExistente) {
          const registroVacio: Omit<
            IAsistenciaEscolarLocal,
            "ultima_fecha_actualizacion"
          > = {
            Id_Estudiante: estudiante.Id_Estudiante,
            Mes: mes,
            Asistencias_Mensuales: JSON.stringify({}),
          };

          await this.guardarRegistroAsistencia(nivel, grado, registroVacio);
          registroExistente = await this.obtenerRegistroPorClave(
            nivel,
            grado,
            estudiante.Id_Estudiante,
            mes
          );
        } else {
          // Solo actualizar timestamp
          const registroActualizado: Omit<
            IAsistenciaEscolarLocal,
            "ultima_fecha_actualizacion"
          > = {
            Id_Estudiante: registroExistente.Id_Estudiante,
            Mes: registroExistente.Mes,
            Asistencias_Mensuales: registroExistente.Asistencias_Mensuales,
          };

          await this.guardarRegistroAsistencia(
            nivel,
            grado,
            registroActualizado
          );
        }

        const asistenciasParsed = registroExistente
          ? this.parsearAsistenciasMensuales(
              registroExistente.Asistencias_Mensuales
            )
          : {};

        return {
          success: false,
          message: "No se pudieron obtener las asistencias del día actual.",
          data: {
            Mes: mes,
            Asistencias: asistenciasParsed,
            registroCompleto: registroExistente!, // Puede ser null
          },
          origen: "api_diaria",
          ultimaActualizacion: registroExistente?.ultima_fecha_actualizacion,
        };
      } catch (guardarError) {
        console.error("Error al manejar fallo de API diaria:", guardarError);

        return this.crearResultadoError(
          "No se pudieron obtener las asistencias del día actual."
        );
      }
    }
  }

  /**
   * Procesa la respuesta de la API mensual y actualiza IndexedDB
   */
  private async procesarRespuestaAPIMensual(
    response: MisEstudianteRelacionadoAsistenciasMensualesSuccessResponse,
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    const registro: Omit<
      IAsistenciaEscolarLocal,
      "ultima_fecha_actualizacion"
    > = {
      Id_Estudiante: idEstudiante,
      Mes: mes,
      Asistencias_Mensuales: JSON.stringify(response.data.Asistencias),
    };

    return await this.guardarRegistroAsistencia(nivel, grado, registro);
  }

  /**
   * Procesa la respuesta de la API diaria y actualiza IndexedDB
   */
  private async procesarRespuestaAPIDiaria(
    response: AsistenciaDiariaResponse,
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult> {
    // Obtener registro existente o crear uno nuevo
    let registroExistente = await this.obtenerRegistroPorClave(
      nivel,
      grado,
      idEstudiante,
      mes
    );

    let asistenciasActuales = {};
    if (registroExistente) {
      asistenciasActuales = this.parsearAsistenciasMensuales(
        registroExistente.Asistencias_Mensuales
      );
    }

    // Si la API diaria tiene datos, integrarlos
    if (response.success && response.data) {
      // Aquí integrarías los datos del día actual con los datos existentes
      // La lógica específica depende de la estructura exacta de response.data
      Object.assign(asistenciasActuales, response.data);
    }

    const registro: Omit<
      IAsistenciaEscolarLocal,
      "ultima_fecha_actualizacion"
    > = {
      Id_Estudiante: idEstudiante,
      Mes: mes,
      Asistencias_Mensuales: JSON.stringify(asistenciasActuales),
    };

    return await this.guardarRegistroAsistencia(nivel, grado, registro);
  }

  /**
   * Verifica el control de frecuencia para evitar consultas excesivas
   */
  private verificarControlFrecuencia(
    registro: IAsistenciaEscolarLocal,
    nivel: NivelEducativo
  ): { puedeConsultar: boolean; minutosEspera: number } {
    const fechaActual = this.dateHelper.obtenerTimestampPeruano();
    const tiempoTranscurrido =
      fechaActual - registro.ultima_fecha_actualizacion;

    // Obtener intervalo según el nivel (restando 1 minuto como especificaste)
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

  /**
   * Verifica si estamos en horario escolar extendido
   */
  private estaEnHorarioEscolarExtendido(
    aula: any,
    nivel: NivelEducativo
  ): boolean {
    if (!this.handlerAsistencia) return false;

    const horario = this.handlerAsistencia.getHorarioEscolar(nivel);
    if (!horario) return false;

    const fechaActual = this.dateHelper.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) return false;

    // Aplicar extensiones según el nivel
    const extensionEntrada =
      nivel === NivelEducativo.PRIMARIA
        ? EXTENSION_ENTRADA_ESTUDIANTES_PRIMARIA
        : EXTENSION_ENTRADA_ESTUDIANTES_SECUNDARIA;

    const extensionSalida =
      nivel === NivelEducativo.PRIMARIA
        ? EXTENSION_SALIDA_ESTUDIANTES_PRIMARIA
        : EXTENSION_SALIDA_ESTUDIANTES_SECUNDARIA;

    const inicio = new Date(horario.Inicio);
    const fin = new Date(horario.Fin);

    const inicioExtendido = aplicarExtension(inicio, -extensionEntrada);
    const finExtendido = aplicarExtension(fin, extensionSalida);

    return fechaActual >= inicioExtendido && fechaActual <= finExtendido;
  }

  /**
   * NUEVO: Verifica si el día actual es un día escolar (lunes a viernes)
   */
  private esDiaEscolar(): boolean {
    const fechaActual = this.dateHelper.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) return false;

    const diaSemana = fechaActual.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
    return diaSemana >= 1 && diaSemana <= 5; // Solo lunes a viernes
  }

  /**
   * Verifica si hay días escolares anteriores en el mes actual
   */
  private hayDiasEscolaresAnteriores(): boolean {
    const fechaActual = this.dateHelper.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) return false;

    const diasEscolares = this.dateHelper.obtenerUltimosDiasEscolares(30);
    return diasEscolares.length > 0;
  }

  /**
   * Validaciones iniciales para la consulta
   */
  private validarConsulta(
    estudiante: EstudianteConAulaYRelacion,
    mes: number
  ): { esValido: boolean; mensaje: string } {
    if (!estudiante.aula) {
      return {
        esValido: false,
        mensaje: "El estudiante no tiene un aula asignada.",
      };
    }

    if (mes < 1 || mes > 12) {
      return {
        esValido: false,
        mensaje: "Debe seleccionar un mes válido.",
      };
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

  /**
   * Extrae datos del aula del estudiante
   */
  private extraerDatosAula(aula: any): {
    nivel: NivelEducativo;
    grado: number;
  } {
    const nivel =
      aula.Nivel === "P" ? NivelEducativo.PRIMARIA : NivelEducativo.SECUNDARIA;
    return { nivel, grado: aula.Grado };
  }

  /**
   * Crea un resultado de error consistente
   */
  private crearResultadoError(
    mensaje: string
  ): ConsultaAsistenciasResponsableResult {
    this.setError?.({
      success: false,
      message: mensaje,
    });

    return {
      success: false,
      message: mensaje,
    };
  }

  /**
   * Obtiene el nombre del mes en español
   */
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

export const asistenciasEscolaresParaResponsablesIDB =
  new AsistenciasEscolaresParaResponsablesIDB();
