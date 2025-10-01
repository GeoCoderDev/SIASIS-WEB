// lib/utils/local/db/models/AsistenciasEscolares/Para Directivos/AsistenciasEscolaresPorAulaParaDirectivosIDB.ts
import { TablasLocal } from "@/interfaces/shared/TablasSistema";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import { AsistenciaDateHelper } from "../../utils/AsistenciaDateHelper";
import { GetAsistenciasMensualesDeUnAulaSuccessResponse } from "@/interfaces/shared/apis/api02/aulas/asistencias-escolares-mensuales/types";
import { Endpoint_Get_Asistencias_Mensuales_Escolares_Por_Aula_API02 } from "@/lib/utils/backend/endpoints/api02/AsistenciasMensualesEscolaresPorAula";
import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";
import AllErrorTypes, { SystemErrorTypes } from "@/interfaces/shared/errors";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import IndexedDBConnection from "../../../IndexedDBConnection";
import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";

// Constantes de configuración
const INTERVALO_ACTUALIZACION_MINUTOS = 10; // 10 minutos entre consultas
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
 * Incluye soporte para obtener asistencias del día actual
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
   * Ahora incluye soporte para día actual cuando es necesario
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

      // Para meses anteriores, usar caché sin revalidar
      if (!esConsultaMesActual) {
        const datosCache = await this.obtenerDatosDesdeCache(idAula, mes);
        if (datosCache.success && datosCache.data) {
          return datosCache;
        }
      }

      // LÓGICA ESPECIAL PARA MES ACTUAL
      if (esConsultaMesActual) {
        return await this.consultarMesActualConDiaActual(idAula, mes);
      }

      // Fallback: consultar API normalmente
      return await this.consultarAPIAsistenciasAula(idAula, mes);
    } catch (error) {
      this.handleError(error, "consultar asistencias del aula");
      return this.crearResultadoError(
        "Ocurrió un error al consultar las asistencias. Por favor, inténtelo nuevamente."
      );
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Consulta específica para el mes actual que considera el día actual
   */
  private async consultarMesActualConDiaActual(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      const diaActual = this.dateHelper.obtenerDiaActual();
      const horaActual = new Date().getHours();
      const esPrimerDiaDelMes = diaActual === 1;

      // Determinar si necesitamos consultar el día actual
      const debeConsultarDiaActual = await this.debeConsultarDiaActual(idAula);

      console.log("📅 Consulta mes actual - Debug:", {
        diaActual,
        horaActual,
        esPrimerDiaDelMes,
        debeConsultarDiaActual,
        esAntesDe10PM: horaActual < HORA_DISPONIBILIDAD_MONGODB,
      });

      // CASO 1: Primer día del mes - Solo consultar día actual si corresponde
      if (esPrimerDiaDelMes) {
        if (debeConsultarDiaActual) {
          console.log("📅 Primer día del mes - Consultando solo día actual");
          return await this.consultarSoloDiaActual(idAula, mes);
        } else {
          return this.crearResultadoError(
            "Aún no hay datos disponibles para este mes. Intente más tarde."
          );
        }
      }

      // CASO 2: Día actual antes de las 10 PM - Consultar mes + día actual
      if (horaActual < HORA_DISPONIBILIDAD_MONGODB && debeConsultarDiaActual) {
        console.log(
          "📅 Antes de 10 PM - Consultando datos mensuales + día actual"
        );
        return await this.consultarMesYDiaActual(idAula, mes);
      }

      // CASO 3: Después de las 10 PM - Solo consultar API02 (ya tiene todo)
      if (horaActual >= HORA_DISPONIBILIDAD_MONGODB) {
        console.log("📅 Después de 10 PM - Consultando solo API02");
        return await this.consultarAPIAsistenciasAula(idAula, mes);
      }

      // CASO 4: No debe consultar día actual - Consultar solo históricos
      console.log("📅 Consultando solo datos históricos");
      return await this.consultarAPIAsistenciasAula(idAula, mes);
    } catch (error) {
      console.error("Error en consultarMesActualConDiaActual:", error);
      return this.crearResultadoError(
        "Error al consultar asistencias del mes actual"
      );
    }
  }

  /**
   * Consulta solo el día actual (primer día del mes)
   */
  private async consultarSoloDiaActual(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) {
        return this.crearResultadoError(
          "No se pudo determinar el nivel y grado del aula"
        );
      }

      // Obtener información del aula (incluye sección)
      const infoAula = await this.obtenerInformacionAula(idAula);
      if (!infoAula) {
        return this.crearResultadoError("No se encontró información del aula");
      }

      // Obtener estudiantes del aula
      const { BaseEstudiantesIDB } = await import(
        "../../Estudiantes/EstudiantesBaseIDB"
      );
      const estudiantesIDB = new BaseEstudiantesIDB();
      const todosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
        false
      );
      const estudiantesDelAula = todosEstudiantes.filter(
        (estudiante) => estudiante.Id_Aula === idAula && estudiante.Estado
      );

      // Consultar asistencias del día actual
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

      // Construir estructura mensual con solo el día actual
      const diaActual = this.dateHelper.obtenerDiaActual()!;
      const asistenciasMensuales: Record<
        string,
        Record<number, AsistenciaEscolarDeUnDia | null>
      > = {};

      for (const idEstudiante in datosDiaActual.asistencias) {
        asistenciasMensuales[idEstudiante] = {
          [diaActual]: datosDiaActual.asistencias[idEstudiante],
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
          totalEstudiantes: estudiantesDelAula.length,
          estudiantesActualizados: Object.keys(datosDiaActual.asistencias)
            .length,
          incluyeDiaActual: true,
        },
        origen: "api",
      };
    } catch (error) {
      console.error("Error consultando solo día actual:", error);
      return this.crearResultadoError(
        "Error al consultar asistencias del día actual"
      );
    }
  }

  /**
   * Consulta datos mensuales Y fusiona con día actual
   */
  private async consultarMesYDiaActual(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      // 1. Obtener datos mensuales históricos
      const controlFrecuencia = await this.verificarControlFrecuenciaAula(
        idAula,
        mes
      );
      let datosMensuales: AsistenciaAulaOperationResult;

      if (!controlFrecuencia.puedeConsultar) {
        datosMensuales = await this.obtenerDatosDesdeCache(idAula, mes);
      } else {
        datosMensuales = await this.consultarAPIAsistenciasAula(idAula, mes);
      }

      // Si no hay datos mensuales, crear estructura vacía
      if (!datosMensuales.success || !datosMensuales.data) {
        datosMensuales = {
          success: true,
          message: "Sin datos previos",
          data: {
            Mes: mes,
            Asistencias_Escolares: {},
            totalEstudiantes: 0,
            estudiantesActualizados: 0,
          },
        };
      }

      // 2. Obtener datos del día actual
      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) {
        return datosMensuales; // Devolver solo datos mensuales si no se puede obtener nivel/grado
      }

      const infoAula = await this.obtenerInformacionAula(idAula);
      if (!infoAula) {
        return datosMensuales; // Devolver solo datos mensuales
      }

      const { BaseEstudiantesIDB } = await import(
        "../../Estudiantes/EstudiantesBaseIDB"
      );
      const estudiantesIDB = new BaseEstudiantesIDB();
      const todosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
        false
      );
      const estudiantesDelAula = todosEstudiantes.filter(
        (estudiante) => estudiante.Id_Aula === idAula && estudiante.Estado
      );

      const datosDiaActual = await this.consultarAPIAsistenciasDiaActual(
        nivelGrado.nivel,
        nivelGrado.grado,
        infoAula.seccion,
        estudiantesDelAula.length
      );

      // 3. Fusionar datos mensuales con día actual
      const asistenciasFusionadas =
        this.fusionarAsistenciasMensualesConDiaActual(
          datosMensuales.data!.Asistencias_Escolares,
          datosDiaActual.success ? datosDiaActual.asistencias : {}
        );

      this.handleSuccess(
        `Se obtuvieron las asistencias de ${this.obtenerNombreMes(
          mes
        )} incluyendo el día actual.`
      );

      return {
        success: true,
        message: "Asistencias mensuales con día actual obtenidas exitosamente",
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
      console.error("Error consultando mes y día actual:", error);
      return this.crearResultadoError(
        "Error al fusionar datos mensuales con día actual"
      );
    }
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

    // Para cada estudiante con asistencia del día actual
    for (const idEstudiante in asistenciasDiaActual) {
      if (!resultado[idEstudiante]) {
        resultado[idEstudiante] = {};
      }

      // Sobrescribir/agregar el día actual
      resultado[idEstudiante][diaActual] = asistenciasDiaActual[idEstudiante];
    }

    return resultado;
  }

  /**
   * Determina si debe consultar el día actual según horarios escolares
   */
  private async debeConsultarDiaActual(idAula: string): Promise<boolean> {
    try {
      // Obtener handler de directivo para acceder a horarios
      const { DatosAsistenciaHoyIDB } = await import(
        "../../DatosAsistenciaHoy/DatosAsistenciaHoyIDB"
      );
      const { HandlerDirectivoAsistenciaResponse } = await import(
        "../../DatosAsistenciaHoy/handlers/HandlerDirectivoAsistenciaResponse"
      );

      const handler =
        (await new DatosAsistenciaHoyIDB().getHandler()) as InstanceType<
          typeof HandlerDirectivoAsistenciaResponse
        >;

      if (!handler) {
        console.warn("No se pudo obtener handler de directivo");
        return false;
      }

      // Obtener nivel del aula
      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) {
        return false;
      }

      // Obtener horario escolar según nivel
      const horarioEscolar = handler.getHorarioEscolar(nivelGrado.nivel);
      if (!horarioEscolar) {
        console.warn(`No se encontró horario para nivel ${nivelGrado.nivel}`);
        return false;
      }

      // Verificar si estamos dentro del horario escolar o después
      const fechaHoraActual = handler.getFechaHoraRedux();
      if (!fechaHoraActual) {
        return false;
      }

      const horaInicio = new Date(horarioEscolar.Inicio);
      const horaFin = new Date(horarioEscolar.Fin);

      // Consideramos que se puede consultar si ya empezó el horario escolar
      const yaEmpezo = fechaHoraActual >= horaInicio;

      console.log("🕐 Verificación de horario:", {
        nivel: nivelGrado.nivel,
        horaActual: fechaHoraActual.toISOString(),
        horaInicio: horaInicio.toISOString(),
        horaFin: horaFin.toISOString(),
        yaEmpezo,
      });

      return yaEmpezo;
    } catch (error) {
      console.error("Error verificando si debe consultar día actual:", error);
      return false; // Por seguridad, no consultar si hay error
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
      // Determinar tipo de asistencia
      const tipoAsistencia: TipoAsistencia =
        nivel === NivelEducativo.PRIMARIA
          ? TipoAsistencia.ParaEstudiantesPrimaria
          : TipoAsistencia.ParaEstudiantesSecundaria;

      // Construir URL
      const params = new URLSearchParams({
        TipoAsistencia: tipoAsistencia,
        Nivel: nivel,
        Grado: grado.toString(),
        Seccion: seccion,
        totalEstudiantes: totalEstudiantes.toString(),
      });

      const url = `/api/asistencia-hoy/consultar-asistencias-escolares-tomadas?${params.toString()}`;

      console.log("🌐 Consultando API día actual:", url);

      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error en API día actual:", errorData);
        return {
          success: false,
          asistencias: {},
          mensaje:
            errorData.message || "Error al consultar asistencias del día",
        };
      }

      const data = await response.json();

      console.log("✅ Respuesta API día actual:", {
        totalResultados: data.Resultados?.length || 0,
        dia: data.Dia,
        mes: data.Mes,
      });

      // Procesar resultados
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
      console.error("Error consultando API de día actual:", error);
      return {
        success: false,
        asistencias: {},
        mensaje:
          error instanceof Error
            ? error.message
            : "Error desconocido al consultar día actual",
      };
    }
  }

  /**
   * Obtiene información completa del aula (incluye sección)
   */
  private async obtenerInformacionAula(
    idAula: string
  ): Promise<{ seccion: string; nivel: NivelEducativo; grado: number } | null> {
    try {
      const { BaseAulasIDB } = await import("../../Aulas/AulasBase");
      const aulasIDB = new BaseAulasIDB();
      const todasLasAulas = await aulasIDB.getTodasLasAulas();

      const aula = todasLasAulas.find((a) => a.Id_Aula === idAula);
      if (!aula) {
        return null;
      }

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

  // =====================================================================================
  // MÉTODOS EXISTENTES (sin cambios significativos)
  // =====================================================================================

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

      const { BaseEstudiantesIDB } = await import(
        "../../Estudiantes/EstudiantesBaseIDB"
      );
      const estudiantesIDB = new BaseEstudiantesIDB();
      const todosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
        false
      );
      const estudiantesDelAula = todosEstudiantes.filter(
        (estudiante) => estudiante.Id_Aula === idAula && estudiante.Estado
      );

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
        return {
          success: false,
          message:
            "No se encontraron datos de asistencia en caché para esta aula",
        };
      }

      const asistenciasEscolares: Record<
        string,
        Record<number, AsistenciaEscolarDeUnDia | null>
      > = {};

      for (const registro of registrosFiltrados) {
        try {
          const asistenciasParsed = JSON.parse(registro.Asistencias_Mensuales);
          asistenciasEscolares[registro.Id_Estudiante] = asistenciasParsed;
        } catch (parseError) {
          console.error(
            `Error parseando asistencias del estudiante ${registro.Id_Estudiante}:`,
            parseError
          );
        }
      }

      const totalEstudiantesConDatos = Object.keys(asistenciasEscolares).length;

      if (totalEstudiantesConDatos === 0) {
        return {
          success: false,
          message:
            "No se encontraron asistencias válidas en caché para esta aula",
        };
      }

      this.handleSuccess(
        `Se encontraron las asistencias de ${this.obtenerNombreMes(
          mes
        )} desde los registros guardados.`
      );

      return {
        success: true,
        message: "Asistencias obtenidas desde caché",
        data: {
          Mes: mes,
          Asistencias_Escolares: asistenciasEscolares,
          totalEstudiantes: estudiantesDelAula.length,
          estudiantesActualizados: totalEstudiantesConDatos,
        },
        origen: "cache",
      };
    } catch (error) {
      console.error("Error obteniendo datos desde caché:", error);
      return {
        success: false,
        message: "Error al acceder al caché local",
      };
    }
  }

  private async consultarAPIAsistenciasAula(
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

      const resultadoGuardado = await this.procesarRespuestaAPI(
        response,
        idAula,
        mes
      );

      if (resultadoGuardado.success) {
        this.handleSuccess(
          `Se obtuvieron las asistencias del aula para ${this.obtenerNombreMes(
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
            estudiantesActualizados:
              resultadoGuardado.estudiantesActualizados || 0,
          },
          origen: "api",
        };
      }

      return this.crearResultadoError(
        "No se encontraron registros de asistencia para esta aula."
      );
    } catch (error) {
      console.error("Error en API de asistencias del aula:", error);
      return this.crearResultadoError(
        "No se pudieron obtener las asistencias del servidor. Verifique su conexión."
      );
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
          const asistenciasEstudiante = asistenciasEscolares[idEstudiante];

          const registro: IAsistenciaEstudianteLocal = {
            Id_Estudiante: idEstudiante,
            Mes: mes,
            Asistencias_Mensuales: JSON.stringify(asistenciasEstudiante),
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

      return {
        success: estudiantesActualizados > 0,
        estudiantesActualizados,
      };
    } catch (error) {
      console.error("Error procesando respuesta de API:", error);
      return {
        success: false,
        estudiantesActualizados: 0,
      };
    }
  }

  private async determinarNivelGradoDelAula(
    idAula: string
  ): Promise<{ nivel: NivelEducativo; grado: number } | null> {
    try {
      const { BaseAulasIDB } = await import("../../Aulas/AulasBase");
      const aulasIDB = new BaseAulasIDB();
      const todasLasAulas = await aulasIDB.getTodasLasAulas();

      const aula = todasLasAulas.find((a) => a.Id_Aula === idAula);
      if (!aula) {
        return null;
      }

      return {
        nivel: aula.Nivel as NivelEducativo,
        grado: aula.Grado,
      };
    } catch (error) {
      console.error("Error determinando nivel y grado del aula:", error);
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
      const registroParaGuardar = {
        Id_Estudiante: registro.Id_Estudiante,
        Mes: registro.Mes,
        Asistencias_Mensuales: registro.Asistencias_Mensuales,
        ultima_fecha_actualizacion: registro.ultima_fecha_actualizacion,
      };

      const request = store.put(registroParaGuardar);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        console.error("Error en IndexedDB put:", request.error);
        reject(request.error);
      };
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

        request.onsuccess = () => {
          resolve(request.result as IAsistenciaEstudianteLocal[]);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error obteniendo registros de la tabla ${tabla}:`, error);
      return [];
    }
  }

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

      const registroMasReciente = registros.reduce((mas, actual) =>
        actual.ultima_fecha_actualizacion > mas.ultima_fecha_actualizacion
          ? actual
          : mas
      );

      const fechaActual = this.dateHelper.obtenerTimestampPeruano();
      const tiempoTranscurrido =
        fechaActual - registroMasReciente.ultima_fecha_actualizacion;
      const intervaloMs = INTERVALO_ACTUALIZACION_MINUTOS * 60 * 1000;

      if (tiempoTranscurrido < intervaloMs) {
        const minutosEspera = Math.ceil(
          (intervaloMs - tiempoTranscurrido) / (60 * 1000)
        );
        return { puedeConsultar: false, minutosEspera };
      }

      return { puedeConsultar: true, minutosEspera: 0 };
    } catch (error) {
      console.error("Error verificando control de frecuencia:", error);
      return { puedeConsultar: true, minutosEspera: 0 };
    }
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
    this.setError?.({
      success: false,
      message: mensaje,
    });

    return {
      success: false,
      message: mensaje,
    };
  }

  private handleSuccess(message: string): void {
    this.setSuccessMessage?.({ message });
  }

  private handleError(error: unknown, operacion: string): void {
    console.error(`Error en operación (${operacion}):`, error);

    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = `Error al ${operacion}`;

    if (error instanceof Error) {
      message = error.message || message;
    }

    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
    });
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

  public async obtenerEstadisticasCache(
    nivel: NivelEducativo,
    grado: number
  ): Promise<{
    totalRegistros: number;
    estudiantesConDatos: string[];
    mesesConDatos: number[];
  }> {
    try {
      const tabla = this.obtenerTablaAsistencias(nivel, grado);
      const store = await IndexedDBConnection.getStore(tabla);
      const stats = {
        totalRegistros: 0,
        estudiantesConDatos: new Set<string>(),
        mesesConDatos: new Set<number>(),
      };

      return new Promise((resolve, reject) => {
        const request = store.openCursor();

        request.onsuccess = (event: any) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const registro = cursor.value as IAsistenciaEstudianteLocal;
            stats.totalRegistros++;
            stats.estudiantesConDatos.add(registro.Id_Estudiante);
            stats.mesesConDatos.add(registro.Mes);
            cursor.continue();
          } else {
            resolve({
              totalRegistros: stats.totalRegistros,
              estudiantesConDatos: Array.from(stats.estudiantesConDatos),
              mesesConDatos: Array.from(stats.mesesConDatos).sort(
                (a, b) => a - b
              ),
            });
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error obteniendo estadísticas del caché:", error);
      return {
        totalRegistros: 0,
        estudiantesConDatos: [],
        mesesConDatos: [],
      };
    }
  }
}
