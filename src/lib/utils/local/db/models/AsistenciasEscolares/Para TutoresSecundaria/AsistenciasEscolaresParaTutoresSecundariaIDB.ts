import { IAsistenciasEscolaresIDB } from "../IAsistenciasEscolaresIDB";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";
import { T_Estudiantes } from "@prisma/client";
import { CustomApiError } from "@/lib/errors/custom/ApiError";
import {
  AsistenciaOperationResult,
  AsistenciasEscolaresBaseIDB,
  IAsistenciaEscolarLocal,
} from "../AsistenciasEscolaresBaseIDB";

import { alterarUTCaZonaPeruana } from "@/lib/helpers/alteradores/alterarUTCaZonaPeruana";
import { Endpoint_Get_Asistencias_Mensuales_Escolares_De_Mi_Aula_API02 } from "@/lib/utils/backend/endpoints/api02/AsistenciasMensualesEscolaresDeMiAula";

// Constantes
const INTERVALO_ACTUALIZACION_MINUTOS = 10;
const HORA_DISPONIBILIDAD_MONGODB = 22;

interface DatosAsistenciasDiaActual {
  success: boolean;
  asistencias: Record<string, AsistenciaEscolarDeUnDia>;
  mensaje?: string;
}

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

/**
 * Clase para Tutores de Secundaria
 *
 * Características:
 * - Solo acceso a SU aula asignada (Secundaria)
 * - Usa endpoint específico /api/mi-aula/asistencias-escolares-mensuales
 * - Control de frecuencia: 10 min días laborales, bloqueo fin de semana
 * - Combina datos mensuales con día actual cuando aplica
 */
export class AsistenciasEscolaresParaTutoresIDB
  extends AsistenciasEscolaresBaseIDB
  implements IAsistenciasEscolaresIDB
{
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

  public async consultarAsistenciasMensualesAula(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      const validacion = this.validarConsulta(idAula, mes);
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
      if (nivel !== NivelEducativo.SECUNDARIA) {
        return this.crearResultadoError(
          "No tiene permisos para consultar asistencias de Primaria."
        );
      }

      const validacion = this.validarMesConsulta(mes);
      if (!validacion.esValido) {
        return this.crearResultadoError(validacion.mensaje);
      }

      const cacheResult = await this.obtenerDatosDesdeCache(
        nivel,
        grado,
        idEstudiante,
        mes
      );

      if (cacheResult.success) {
        this.handleSuccess(
          `Asistencias de ${this.obtenerNombreMes(mes)} obtenidas.`
        );
        return cacheResult;
      }

      return this.crearResultadoError(
        "No hay datos disponibles. Intente consultar por aula primero."
      );
    } catch (error) {
      this.handleIndexedDBError(error, "consultar asistencias de estudiante");
      return this.crearResultadoError("Error al consultar asistencias.");
    } finally {
      this.setIsSomethingLoading?.(false);
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

    if (!esConsultaMesActual) {
      return await this.manejarMesAnterior(idAula, mes);
    }

    return await this.manejarMesActual(idAula, mes);
  }

  protected verificarControlFrecuenciaRol(registro: IAsistenciaEscolarLocal): {
    puedeConsultar: boolean;
    minutosEspera: number;
  } {
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

    if (horaActual >= HORA_DISPONIBILIDAD_MONGODB) {
      return { estrategia: "solo_api_mensual", razon: "Después de 10 PM" };
    }

    if (esPrimerDiaLaboralDelMes && this.esDiaEscolar()) {
      const debeConsultar = await this.debeConsultarDiaActual(idAula);
      if (debeConsultar) {
        return { estrategia: "solo_api_diaria", razon: "Primer día laboral" };
      }
      return { estrategia: "solo_cache", razon: "Primer día fuera de horario" };
    }

    if (!this.esDiaEscolar()) {
      return { estrategia: "solo_api_mensual", razon: "Fin de semana" };
    }

    const debeConsultar = await this.debeConsultarDiaActual(idAula);
    if (debeConsultar) {
      return { estrategia: "api_paralelo", razon: "Día laboral en horario" };
    }

    return { estrategia: "solo_api_mensual", razon: "Fuera de horario" };
  }

  // =====================================================================================
  // MÉTODOS ESPECÍFICOS (IDÉNTICOS A PROFESORES PRIMARIA excepto TipoAsistencia)
  // =====================================================================================

  private async manejarMesAnterior(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    const datosCache = await this.obtenerDatosAulaDesdeCache(idAula, mes);
    if (datosCache.success && datosCache.data) {
      return datosCache;
    }
    return await this.consultarYGuardarMesAnterior(idAula, mes);
  }

  private async manejarMesActual(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    const { estrategia } = await this.determinarEstrategiaConsulta(mes, idAula);

    switch (estrategia) {
      case "solo_api_mensual":
        return await this.consultarSoloAPIMiAula(idAula, mes);
      case "solo_api_diaria":
        return await this.consultarSoloDiaActual(idAula, mes);
      case "api_paralelo":
        return await this.consultarAPIMiAulaYDiaActualParalelo(idAula, mes);
      default:
        const datosCache = await this.obtenerDatosAulaDesdeCache(idAula, mes);
        return datosCache.success
          ? datosCache
          : this.crearResultadoError("No hay datos.");
    }
  }

  private async consultarYGuardarMesAnterior(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      const response =
        await Endpoint_Get_Asistencias_Mensuales_Escolares_De_Mi_Aula_API02.realizarPeticion(
          {
            queryParams: { Mes: mes.toString() },
          }
        );

      await this.procesarRespuestaAPI(
        response.data.Asistencias_Escolares,
        idAula,
        mes
      );
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

  private async consultarSoloAPIMiAula(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
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
        await Endpoint_Get_Asistencias_Mensuales_Escolares_De_Mi_Aula_API02.realizarPeticion(
          {
            queryParams: { Mes: mes.toString() },
          }
        );

      await this.procesarRespuestaAPI(
        response.data.Asistencias_Escolares,
        idAula,
        mes
      );
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
      if (!infoAula)
        return this.crearResultadoError("No se encontró información del aula.");

      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(idAula);
      if (estudiantesDelAula.length === 0)
        return this.crearResultadoError("No hay estudiantes activos.");

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

  private async consultarAPIMiAulaYDiaActualParalelo(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      const infoAula = await this.obtenerInformacionAula(idAula);
      if (!infoAula)
        return this.crearResultadoError("No se encontró información del aula.");

      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(idAula);
      if (estudiantesDelAula.length === 0)
        return this.crearResultadoError("No hay estudiantes activos.");

      const [resultadoAPI, datosDiaActual] = await Promise.all([
        this.consultarSoloAPIMiAula(idAula, mes),
        this.consultarAPIAsistenciasDiaActual(
          infoAula.nivel,
          infoAula.grado,
          infoAula.seccion,
          estudiantesDelAula.length
        ),
      ]);

      if (!resultadoAPI.success || !resultadoAPI.data) {
        if (datosDiaActual.success) {
          return await this.crearResultadoSoloDiaActual(
            mes,
            datosDiaActual.asistencias,
            estudiantesDelAula.length
          );
        }
        return resultadoAPI;
      }

      const asistenciasFusionadas =
        this.fusionarAsistenciasMensualesConDiaActual(
          resultadoAPI.data.Asistencias_Escolares,
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
    asistenciasEscolares: Record<
      string,
      Record<number, AsistenciaEscolarDeUnDia | null>
    >,
    idAula: string,
    mes: number
  ): Promise<void> {
    try {
      const idsEstudiantes = Object.keys(asistenciasEscolares);
      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) throw new Error("No se pudo determinar nivel y grado");

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
      // DIFERENCIA CLAVE: ParaEstudiantesSecundaria en lugar de Primaria
      const tipoAsistencia = TipoAsistencia.ParaEstudiantesSecundaria;

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

  // Métodos auxiliares (idénticos a Profesores Primaria)
  private validarConsulta(
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
      return todosEstudiantes.filter((e) => e.Id_Aula === idAula && e.Estado);
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
      if (!nivelGrado) return { success: false, message: "Aula no encontrada" };

      const estudiantesDelAula = await this.obtenerEstudiantesDelAula(idAula);
      if (estudiantesDelAula.length === 0)
        return { success: false, message: "No hay estudiantes" };

      const idsEstudiantesAula = estudiantesDelAula.map((e) => e.Id_Estudiante);
      const registrosDelMes = await this.obtenerRegistrosEstudiantesDelMes(
        nivelGrado.nivel,
        nivelGrado.grado,
        mes
      );
      const registrosFiltrados = registrosDelMes.filter((r) =>
        idsEstudiantesAula.includes(r.Id_Estudiante)
      );

      if (registrosFiltrados.length === 0)
        return { success: false, message: "No hay datos en caché" };

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

      if (Object.keys(asistenciasEscolares).length === 0)
        return { success: false, message: "No hay asistencias válidas" };

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
      if (!resultado[idEstudiante]) resultado[idEstudiante] = {};
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
      if (diaSemana >= 1 && diaSemana <= 5) return dia === diaActual;
    }
    return false;
  }

  private async debeConsultarDiaActual(idAula: string): Promise<boolean> {
    try {
      if (!this.esDiaEscolar()) return false;
      const { DatosAsistenciaHoyIDB } = await import(
        "@/lib/utils/local/db/models/DatosAsistenciaHoy/DatosAsistenciaHoyIDB"
      );
      // DIFERENCIA CLAVE: HandlerTutorAsistenciaResponse en lugar de HandlerProfesorPrimariaAsistenciaResponse
      const { HandlerProfesorTutorSecundariaAsistenciaResponse } = await import(
        "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerProfesorTutorSecundariaAsistenciaResponse"
      );
      const handler =
        (await new DatosAsistenciaHoyIDB().getHandler()) as InstanceType<
          typeof HandlerProfesorTutorSecundariaAsistenciaResponse
        >;
      if (!handler) return false;

      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) return false;

      const horarioEscolar = handler.getHorarioEscolarSecundaria();
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
      if (registrosDelAula.length === 0)
        return { puedeConsultar: true, minutosEspera: 0 };

      const registroMasReciente = registrosDelAula.reduce((mas, actual) =>
        actual.ultima_fecha_actualizacion > mas.ultima_fecha_actualizacion
          ? actual
          : mas
      );

      const fechaActual = this.dateHelper.obtenerTimestampPeruano();
      const tiempoTranscurrido =
        fechaActual - registroMasReciente.ultima_fecha_actualizacion;
      const diaActual = new Date().getDay();
      const fechaUltimoRegistro = new Date(
        registroMasReciente.ultima_fecha_actualizacion
      );
      const diaUltimoRegistro = fechaUltimoRegistro.getDay();

      const esFinDeSemanaActual = diaActual === 0 || diaActual === 6;
      const eraFinDeSemana = diaUltimoRegistro === 0 || diaUltimoRegistro === 6;

      if (esFinDeSemanaActual && eraFinDeSemana) {
        const minutosHastaLunes = this.calcularMinutosHastaLunes(diaActual);
        return { puedeConsultar: false, minutosEspera: minutosHastaLunes };
      }

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

  private calcularMinutosHastaLunes(diaActual: number): number {
    const ahora = new Date();
    const proximoLunes = new Date(ahora);
    const diasHastaLunes = diaActual === 6 ? 2 : diaActual === 0 ? 1 : 0;
    proximoLunes.setDate(ahora.getDate() + diasHastaLunes);
    proximoLunes.setHours(0, 0, 0, 0);
    const diferenciaMilisegundos = proximoLunes.getTime() - ahora.getTime();
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
        )}.`;
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
        mensaje = "No se pudo conectar con el servidor. Verifique su conexión.";
      }
    }

    return this.crearResultadoError(mensaje);
  }
}
