// lib/utils/local/db/models/AsistenciasEscolares/Para Directivos/AsistenciasEscolaresPorAulaIDB.ts
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

// Constantes de configuración
const INTERVALO_ACTUALIZACION_MINUTOS = 10; // 10 minutos entre consultas

// Mapeo de nivel y grado a tabla
const MAPEO_TABLA_ASISTENCIAS: Record<string, TablasLocal> = {
  // Primaria
  "P-1": TablasLocal.Tabla_Asistencia_Primaria_1,
  "P-2": TablasLocal.Tabla_Asistencia_Primaria_2,
  "P-3": TablasLocal.Tabla_Asistencia_Primaria_3,
  "P-4": TablasLocal.Tabla_Asistencia_Primaria_4,
  "P-5": TablasLocal.Tabla_Asistencia_Primaria_5,
  "P-6": TablasLocal.Tabla_Asistencia_Primaria_6,
  // Secundaria
  "S-1": TablasLocal.Tabla_Asistencia_Secundaria_1,
  "S-2": TablasLocal.Tabla_Asistencia_Secundaria_2,
  "S-3": TablasLocal.Tabla_Asistencia_Secundaria_3,
  "S-4": TablasLocal.Tabla_Asistencia_Secundaria_4,
  "S-5": TablasLocal.Tabla_Asistencia_Secundaria_5,
};

// Interfaces
export interface IAsistenciaEstudianteLocal {
  Id_Estudiante: string; // Parte de la clave compuesta
  Mes: number; // Parte de la clave compuesta
  Asistencias_Mensuales: string; // JSON string
  ultima_fecha_actualizacion: number; // Timestamp
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
  };
  requiereEspera?: boolean;
  minutosEspera?: number;
  origen?: "cache" | "api";
}

/**
 * Clase para el manejo de asistencias escolares por aula para directivos
 * Almacena registro por estudiante individual usando las tablas de asistencias escolares
 */
export class AsistenciasEscolaresPorAulaIDB {
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

      // Para meses anteriores, usar caché sin revalidar
      if (!esConsultaMesActual) {
        const datosCache = await this.obtenerDatosDesdeCache(idAula, mes);
        if (datosCache.success && datosCache.data) {
          return datosCache;
        }
      }

      // Para mes actual, verificar frecuencia de consultas
      if (esConsultaMesActual) {
        const controlFrecuencia = await this.verificarControlFrecuenciaAula(
          idAula,
          mes
        );
        if (!controlFrecuencia.puedeConsultar) {
          const datosCache = await this.obtenerDatosDesdeCache(idAula, mes);
          if (datosCache.success) {
            return {
              success: false,
              message: `Debe esperar ${controlFrecuencia.minutosEspera} minutos antes de consultar nuevamente las asistencias de esta aula.`,
              data: datosCache.data,
              requiereEspera: true,
              minutosEspera: controlFrecuencia.minutosEspera,
              origen: "cache",
            };
          }
        }
      }

      // Consultar API
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
   * Obtiene datos desde el caché (múltiples estudiantes del aula)
   */
  private async obtenerDatosDesdeCache(
    idAula: string,
    mes: number
  ): Promise<AsistenciaAulaOperationResult> {
    try {
      // Obtener información del aula para determinar tabla correcta
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

      // Obtener estudiantes del aula específica usando BaseEstudiantesIDB
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

      // Obtener asistencias solo de los estudiantes de esta aula
      const idsEstudiantesAula = estudiantesDelAula.map((e) => e.Id_Estudiante);
      const registrosDelMes = await this.obtenerRegistrosEstudiantesDelMes(
        tabla,
        mes
      );

      // Filtrar solo registros de estudiantes de esta aula
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

      // Construir objeto de asistencias
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
          // Continuar con el siguiente registro
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

  /**
   * Consulta la API de asistencias del aula
   */
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

      // Procesar y guardar respuesta (múltiples estudiantes)
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

  /**
   * Procesa la respuesta de la API y actualiza IndexedDB (múltiples estudiantes)
   */
  private async procesarRespuestaAPI(
    response: GetAsistenciasMensualesDeUnAulaSuccessResponse,
    idAula: string,
    mes: number
  ): Promise<{ success: boolean; estudiantesActualizados: number }> {
    try {
      const asistenciasEscolares = response.data.Asistencias_Escolares;
      const idsEstudiantes = Object.keys(asistenciasEscolares);
      let estudiantesActualizados = 0;

      // Necesitamos determinar nivel y grado del aula para usar la tabla correcta
      // Por ahora buscaremos en la primera tabla encontrada o usaremos un método auxiliar
      const nivelGrado = await this.determinarNivelGradoDelAula(idAula);
      if (!nivelGrado) {
        throw new Error("No se pudo determinar el nivel y grado del aula");
      }

      const tabla = this.obtenerTablaAsistencias(
        nivelGrado.nivel,
        nivelGrado.grado
      );

      // Procesar cada estudiante
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
          // Continuar con el siguiente estudiante
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

  /**
   * Determina nivel y grado del aula consultando BaseAulasIDB
   */
  private async determinarNivelGradoDelAula(
    idAula: string
  ): Promise<{ nivel: NivelEducativo; grado: number } | null> {
    try {
      // Importar dinámicamente para evitar dependencias circulares
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

  /**
   * Obtiene el nombre de la tabla según nivel y grado
   */
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

  /**
   * Guarda un registro de estudiante individual
   */
  private async guardarRegistroEstudiante(
    tabla: TablasLocal,
    registro: IAsistenciaEstudianteLocal
  ): Promise<void> {
    const store = await IndexedDBConnection.getStore(tabla, "readwrite");

    return new Promise<void>((resolve, reject) => {
      // El registro debe tener exactamente la estructura que espera IndexedDB
      // con la clave compuesta [Id_Estudiante, Mes]
      const registroParaGuardar = {
        Id_Estudiante: registro.Id_Estudiante,
        Mes: registro.Mes,
        Asistencias_Mensuales: registro.Asistencias_Mensuales,
        ultima_fecha_actualizacion: registro.ultima_fecha_actualizacion,
      };

      console.log("Guardando registro:", registroParaGuardar); // Debug

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

  /**
   * Obtiene registros de estudiantes de un mes específico
   */
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

  /**
   * Verifica control de frecuencia para un aula
   */
  private async verificarControlFrecuenciaAula(
    idAula: string,
    mes: number
  ): Promise<{ puedeConsultar: boolean; minutosEspera: number }> {
    try {
      // Obtener información del aula
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

      // Verificar el registro más reciente
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

  // =====================================================================================
  // MÉTODOS DE UTILIDAD
  // =====================================================================================

  /**
   * Validaciones iniciales
   */
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

  /**
   * Crea un resultado de error
   */
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

  /**
   * Maneja mensajes de éxito
   */
  private handleSuccess(message: string): void {
    this.setSuccessMessage?.({ message });
  }

  /**
   * Maneja errores
   */
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

  /**
   * Obtiene estadísticas del caché por tabla
   */
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
