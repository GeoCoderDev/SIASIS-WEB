import { TablasLocal } from "@/interfaces/shared/TablasSistema";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import AllErrorTypes, {
  SystemErrorTypes,
  DataConflictErrorTypes,
  UserErrorTypes,
} from "@/interfaces/shared/errors";
import { AsistenciaDateHelper } from "../utils/AsistenciaDateHelper";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";
import IndexedDBConnection from "../../IndexedDBConnection";
import {
  GradosPrimaria,
  GradosSecundaria,
} from "@/constants/GRADOS_POR_NIVEL_EDUCATIVO";

// Tipo para las asistencias por día (número como clave, no string)
export type AsistenciasPorDia = {
  [dia: number]: AsistenciaEscolarDeUnDia;
};

// Interfaz para el registro local usando clave compuesta [Id_Estudiante, Mes]
export interface IAsistenciaEscolarLocal {
  Id_Estudiante: string; // Parte de la clave compuesta
  Mes: number; // Parte de la clave compuesta
  Asistencias_Mensuales: string; // JSON string para máxima eficiencia
  ultima_fecha_actualizacion: number; // Timestamp numérico desde Redux
}

// Filtros para consultas
export interface IAsistenciaEscolarFilter {
  Id_Estudiante?: string;
  Mes?: number;
  NivelEducativo?: NivelEducativo;
  Grado?: number;
  rangoMeses?: { inicio: number; fin: number };
  rangoFechas?: { inicio: number; fin: number }; // Timestamps
}

export interface AsistenciasResponsableData {
  Mes: number;
  Asistencias: Record<number, AsistenciaEscolarDeUnDia | null>;
  registroCompleto: IAsistenciaEscolarLocal;
}

// Resultado de operaciones
export interface AsistenciaOperationResult {
  success: boolean;
  message: string;
  data?: AsistenciasResponsableData;
  count?: number;
}

// Mapeo de nivel y grado a tabla local
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

/**
 * Clase base para el manejo de asistencias escolares en IndexedDB
 * Proporciona funcionalidad CRUD común para las 11 tablas particionadas
 * por nivel educativo y grado usando claves compuestas [Id_Estudiante, Mes]
 */
export class AsistenciasEscolaresBaseIDB {
  protected dateHelper: AsistenciaDateHelper;

  constructor(
    protected setIsSomethingLoading?: (isLoading: boolean) => void,
    protected setError?: (error: ErrorResponseAPIBase | null) => void,
    protected setSuccessMessage?: (message: MessageProperty | null) => void
  ) {
    this.dateHelper = new AsistenciaDateHelper();
  }

  // =====================================================================================
  // MÉTODOS DE MAPEO Y UTILIDADES
  // =====================================================================================

  /**
   * Obtiene el nombre de la tabla correspondiente según nivel y grado
   */
  protected obtenerNombreTabla(
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
   * Valida que el grado sea válido para el nivel educativo
   */
  protected validarNivelYGrado(nivel: NivelEducativo, grado: number): boolean {
    if (nivel === NivelEducativo.PRIMARIA) {
      return Object.values(GradosPrimaria).includes(grado);
    } else if (nivel === NivelEducativo.SECUNDARIA) {
      return Object.values(GradosSecundaria).includes(grado);
    }
    return false;
  }

  /**
   * Obtiene todas las tablas para un nivel educativo específico
   */
  protected obtenerTablasDeNivel(nivel: NivelEducativo): TablasLocal[] {
    const tablas: TablasLocal[] = [];

    if (nivel === NivelEducativo.PRIMARIA) {
      Object.values(GradosPrimaria).forEach((grado) => {
        tablas.push(this.obtenerNombreTabla(nivel, grado as GradosPrimaria));
      });
    } else if (nivel === NivelEducativo.SECUNDARIA) {
      Object.values(GradosSecundaria).forEach((grado) => {
        tablas.push(this.obtenerNombreTabla(nivel, grado as GradosSecundaria));
      });
    }

    return tablas;
  }

  /**
   * Parsea de forma segura el JSON de asistencias mensuales
   */
  protected parsearAsistenciasMensuales(
    asistenciasJson: string
  ): AsistenciasPorDia {
    try {
      return JSON.parse(asistenciasJson) as AsistenciasPorDia;
    } catch (error) {
      console.error("Error al parsear asistencias mensuales:", error);
      return {};
    }
  }

  /**
   * Convierte objeto de asistencias a JSON string
   */
  protected stringificarAsistenciasMensuales(
    asistencias: AsistenciasPorDia
  ): string {
    try {
      return JSON.stringify(asistencias);
    } catch (error) {
      console.error("Error al convertir asistencias a JSON:", error);
      return "{}";
    }
  }

  /**
   * Genera clave compuesta para registro mensual de asistencia
   */
  protected generarClaveCompuesta(
    idEstudiante: string,
    mes: number
  ): [string, number] {
    return [idEstudiante, mes];
  }

  // =====================================================================================
  // MÉTODOS CRUD BÁSICOS
  // =====================================================================================

  /**
   * Obtiene un registro de asistencia específico usando clave compuesta
   */
  public async obtenerRegistroPorClave(
    nivel: NivelEducativo,
    grado: number,
    idEstudiante: string,
    mes: number
  ): Promise<IAsistenciaEscolarLocal | null> {
    try {
      if (!this.validarNivelYGrado(nivel, grado)) {
        throw new Error(`Grado ${grado} no válido para nivel ${nivel}`);
      }

      const nombreTabla = this.obtenerNombreTabla(nivel, grado);
      const store = await IndexedDBConnection.getStore(nombreTabla);
      const claveCompuesta = this.generarClaveCompuesta(idEstudiante, mes);

      return new Promise<IAsistenciaEscolarLocal | null>((resolve, reject) => {
        const request = store.get(claveCompuesta);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `obtener registro ${idEstudiante}-${mes}`
      );
      return null;
    }
  }

  /**
   * Obtiene asistencias de un estudiante para un mes específico
   * (Método mantenido para compatibilidad - internamente usa la clave compuesta)
   */
  public async obtenerAsistenciaEstudianteMes(
    nivel: NivelEducativo,
    grado: number,
    idEstudiante: string,
    mes: number
  ): Promise<IAsistenciaEscolarLocal | null> {
    // Delegar al método de clave compuesta
    return this.obtenerRegistroPorClave(nivel, grado, idEstudiante, mes);
  }

  /**
   * Obtiene todas las asistencias de un estudiante
   */
  public async obtenerAsistenciasEstudiante(
    nivel: NivelEducativo,
    grado: number,
    idEstudiante: string
  ): Promise<IAsistenciaEscolarLocal[]> {
    try {
      if (!this.validarNivelYGrado(nivel, grado)) {
        throw new Error(`Grado ${grado} no válido para nivel ${nivel}`);
      }

      const nombreTabla = this.obtenerNombreTabla(nivel, grado);
      const store = await IndexedDBConnection.getStore(nombreTabla);
      const index = store.index("por_estudiante");

      return new Promise<IAsistenciaEscolarLocal[]>((resolve, reject) => {
        const request = index.getAll(idEstudiante);

        request.onsuccess = () => {
          resolve(request.result as IAsistenciaEscolarLocal[]);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `obtener asistencias de estudiante ${idEstudiante}`
      );
      return [];
    }
  }

  /**
   * Obtiene asistencias por mes (todas las de un grado específico)
   */
  public async obtenerAsistenciasPorMes(
    nivel: NivelEducativo,
    grado: number,
    mes: number
  ): Promise<IAsistenciaEscolarLocal[]> {
    try {
      if (!this.validarNivelYGrado(nivel, grado)) {
        throw new Error(`Grado ${grado} no válido para nivel ${nivel}`);
      }

      const nombreTabla = this.obtenerNombreTabla(nivel, grado);
      const store = await IndexedDBConnection.getStore(nombreTabla);
      const index = store.index("por_mes");

      return new Promise<IAsistenciaEscolarLocal[]>((resolve, reject) => {
        const request = index.getAll(mes);

        request.onsuccess = () => {
          resolve(request.result as IAsistenciaEscolarLocal[]);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, `obtener asistencias del mes ${mes}`);
      return [];
    }
  }

  /**
   * Guarda o actualiza un registro de asistencia usando clave compuesta
   */
  public async guardarRegistroAsistencia(
    nivel: NivelEducativo,
    grado: number,
    registro: Omit<IAsistenciaEscolarLocal, "ultima_fecha_actualizacion">
  ): Promise<AsistenciaOperationResult> {
    try {
      if (!this.validarNivelYGrado(nivel, grado)) {
        throw new Error(`Grado ${grado} no válido para nivel ${nivel}`);
      }

      const nombreTabla = this.obtenerNombreTabla(nivel, grado);
      const store = await IndexedDBConnection.getStore(
        nombreTabla,
        "readwrite"
      );

      // Agregar timestamp actual
      const registroCompleto: IAsistenciaEscolarLocal = {
        ...registro,
        ultima_fecha_actualizacion: this.dateHelper.obtenerTimestampPeruano(),
      };

      return new Promise<AsistenciaOperationResult>((resolve, reject) => {
        const request = store.put(registroCompleto);

        request.onsuccess = () => {
          resolve({
            success: true,
            message: "Registro de asistencia guardado exitosamente",
            data: {
              Asistencias: JSON.parse(registroCompleto.Asistencias_Mensuales),
              Mes: registroCompleto.Mes,
              registroCompleto: registroCompleto,
            },
          });
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "guardar registro de asistencia");
      return {
        success: false,
        message: `Error al guardar registro: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      };
    }
  }

  /**
   * Elimina un registro de asistencia usando clave compuesta
   */
  public async eliminarRegistroAsistencia(
    nivel: NivelEducativo,
    grado: number,
    idEstudiante: string,
    mes: number
  ): Promise<AsistenciaOperationResult> {
    try {
      if (!this.validarNivelYGrado(nivel, grado)) {
        throw new Error(`Grado ${grado} no válido para nivel ${nivel}`);
      }

      const nombreTabla = this.obtenerNombreTabla(nivel, grado);
      const store = await IndexedDBConnection.getStore(
        nombreTabla,
        "readwrite"
      );
      const claveCompuesta = this.generarClaveCompuesta(idEstudiante, mes);

      return new Promise<AsistenciaOperationResult>((resolve, reject) => {
        const request = store.delete(claveCompuesta);

        request.onsuccess = () => {
          resolve({
            success: true,
            message: "Registro de asistencia eliminado exitosamente",
          });
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `eliminar registro ${idEstudiante}-${mes}`
      );
      return {
        success: false,
        message: `Error al eliminar registro: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      };
    }
  }

  // =====================================================================================
  // MÉTODOS DE CONSULTA AVANZADA
  // =====================================================================================

  /**
   * Busca asistencias con filtros personalizados
   */
  public async buscarAsistenciasConFiltros(
    filtros: IAsistenciaEscolarFilter
  ): Promise<IAsistenciaEscolarLocal[]> {
    try {
      const resultados: IAsistenciaEscolarLocal[] = [];

      // Determinar qué tablas consultar
      const tablasAConsultar: TablasLocal[] = [];

      if (filtros.NivelEducativo && filtros.Grado) {
        // Consultar tabla específica
        if (this.validarNivelYGrado(filtros.NivelEducativo, filtros.Grado)) {
          tablasAConsultar.push(
            this.obtenerNombreTabla(filtros.NivelEducativo, filtros.Grado)
          );
        }
      } else if (filtros.NivelEducativo) {
        // Consultar todas las tablas del nivel
        tablasAConsultar.push(
          ...this.obtenerTablasDeNivel(filtros.NivelEducativo)
        );
      } else {
        // Consultar todas las tablas
        tablasAConsultar.push(...Object.values(MAPEO_TABLA_ASISTENCIAS));
      }

      // Ejecutar búsquedas en paralelo
      const promesasBusqueda = tablasAConsultar.map(async (nombreTabla) => {
        return this.buscarEnTablaEspecifica(nombreTabla, filtros);
      });

      const resultadosPorTabla = await Promise.all(promesasBusqueda);

      // Combinar resultados
      resultadosPorTabla.forEach((registros) => {
        resultados.push(...registros);
      });

      return resultados;
    } catch (error) {
      this.handleIndexedDBError(error, "buscar asistencias con filtros");
      return [];
    }
  }

  /**
   * Busca registros en una tabla específica aplicando filtros
   */
  private async buscarEnTablaEspecifica(
    nombreTabla: TablasLocal,
    filtros: IAsistenciaEscolarFilter
  ): Promise<IAsistenciaEscolarLocal[]> {
    const store = await IndexedDBConnection.getStore(nombreTabla);

    return new Promise<IAsistenciaEscolarLocal[]>((resolve, reject) => {
      const registros: IAsistenciaEscolarLocal[] = [];
      let request: IDBRequest;

      // Optimizar consulta usando índices o clave primaria compuesta
      if (filtros.Id_Estudiante && filtros.Mes) {
        // Usar clave primaria compuesta directamente (más eficiente)
        const claveCompuesta = [filtros.Id_Estudiante, filtros.Mes];
        request = store.openCursor(IDBKeyRange.only(claveCompuesta));
      } else if (filtros.Id_Estudiante) {
        // Usar índice por estudiante
        const index = store.index("por_estudiante");
        request = index.openCursor(IDBKeyRange.only(filtros.Id_Estudiante));
      } else if (filtros.Mes) {
        // Usar índice por mes
        const index = store.index("por_mes");
        request = index.openCursor(IDBKeyRange.only(filtros.Mes));
      } else {
        // Scan completo (menos eficiente)
        request = store.openCursor();
      }

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue;

        if (cursor) {
          const registro = cursor.value as IAsistenciaEscolarLocal;

          // Aplicar filtros adicionales
          if (this.aplicarFiltrosAdicionales(registro, filtros)) {
            registros.push(registro);
          }

          cursor.continue();
        } else {
          resolve(registros);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Aplica filtros que no pueden ser optimizados con índices
   */
  private aplicarFiltrosAdicionales(
    registro: IAsistenciaEscolarLocal,
    filtros: IAsistenciaEscolarFilter
  ): boolean {
    // Filtro por rango de meses
    if (filtros.rangoMeses) {
      if (
        registro.Mes < filtros.rangoMeses.inicio ||
        registro.Mes > filtros.rangoMeses.fin
      ) {
        return false;
      }
    }

    // Filtro por rango de fechas (usando ultima_fecha_actualizacion)
    if (filtros.rangoFechas) {
      if (
        registro.ultima_fecha_actualizacion < filtros.rangoFechas.inicio ||
        registro.ultima_fecha_actualizacion > filtros.rangoFechas.fin
      ) {
        return false;
      }
    }

    return true;
  }

  // =====================================================================================
  // MÉTODOS DE SINCRONIZACIÓN
  // =====================================================================================

  /**
   * Verifica si un registro necesita sincronización basándose en la fecha de modificación
   */
  protected async necesitaSincronizacion(
    registro: IAsistenciaEscolarLocal,
    fechaModificacionRemota: number
  ): Promise<boolean> {
    return registro.ultima_fecha_actualizacion < fechaModificacionRemota;
  }

  /**
   * Actualiza múltiples registros desde datos del servidor
   */
  protected async actualizarRegistrosDesdeServidor(
    nivel: NivelEducativo,
    grado: number,
    registrosServidor: Omit<
      IAsistenciaEscolarLocal,
      "ultima_fecha_actualizacion"
    >[]
  ): Promise<{ actualizados: number; creados: number; errores: number }> {
    const resultado = { actualizados: 0, creados: 0, errores: 0 };

    try {
      const nombreTabla = this.obtenerNombreTabla(nivel, grado);
      const BATCH_SIZE = 50; // Procesar en lotes para evitar bloqueos

      for (let i = 0; i < registrosServidor.length; i += BATCH_SIZE) {
        const lote = registrosServidor.slice(i, i + BATCH_SIZE);

        for (const registroServidor of lote) {
          try {
            const registroExistente = await this.obtenerRegistroPorClave(
              nivel,
              grado,
              registroServidor.Id_Estudiante,
              registroServidor.Mes
            );

            const resultadoOperacion = await this.guardarRegistroAsistencia(
              nivel,
              grado,
              registroServidor
            );

            if (resultadoOperacion.success) {
              if (registroExistente) {
                resultado.actualizados++;
              } else {
                resultado.creados++;
              }
            } else {
              resultado.errores++;
            }
          } catch (error) {
            console.error(
              `Error procesando registro ${registroServidor.Id_Estudiante}-${registroServidor.Mes}:`,
              error
            );
            resultado.errores++;
          }
        }

        // Pausa entre lotes para no saturar IndexedDB
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } catch (error) {
      console.error("Error en actualización masiva desde servidor:", error);
      resultado.errores++;
    }

    return resultado;
  }

  // =====================================================================================
  // MÉTODOS DE UTILIDAD Y MANEJO DE ERRORES
  // =====================================================================================

  /**
   * Establece un mensaje de éxito
   */
  protected handleSuccess(message: string, data?: any): void {
    const successResponse: MessageProperty = { message };
    this.setSuccessMessage?.(successResponse);
  }

  /**
   * Maneja los errores de operaciones con IndexedDB
   */
  protected handleIndexedDBError(error: unknown, operacion: string): void {
    console.error(`Error en operación IndexedDB (${operacion}):`, error);

    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = `Error al ${operacion}`;

    if (error instanceof Error) {
      if (error.name === "ConstraintError") {
        errorType = DataConflictErrorTypes.VALUE_ALREADY_IN_USE;
        message = `Error de restricción al ${operacion}: valor duplicado`;
      } else if (error.name === "NotFoundError") {
        errorType = UserErrorTypes.USER_NOT_FOUND;
        message = `No se encontró el recurso al ${operacion}`;
      } else if (error.name === "QuotaExceededError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Almacenamiento excedido al ${operacion}`;
      } else if (error.name === "TransactionInactiveError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Transacción inactiva al ${operacion}`;
      } else {
        message = error.message || message;
      }
    }

    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
      details: {
        origen: "AsistenciasEscolaresBaseIDB",
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Obtiene estadísticas básicas de una tabla específica
   */
  public async obtenerEstadisticasTabla(
    nivel: NivelEducativo,
    grado: number
  ): Promise<{
    totalRegistros: number;
    ultimaActualizacion: number | null;
    mesesConDatos: number[];
  }> {
    try {
      if (!this.validarNivelYGrado(nivel, grado)) {
        throw new Error(`Grado ${grado} no válido para nivel ${nivel}`);
      }

      const nombreTabla = this.obtenerNombreTabla(nivel, grado);
      const store = await IndexedDBConnection.getStore(nombreTabla);

      return new Promise((resolve, reject) => {
        const stats = {
          totalRegistros: 0,
          ultimaActualizacion: null as number | null,
          mesesConDatos: [] as number[],
        };

        const mesesSet = new Set<number>();
        let ultimaFecha = 0;

        const request = store.openCursor();

        request.onsuccess = (event: any) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const registro = cursor.value as IAsistenciaEscolarLocal;
            stats.totalRegistros++;
            mesesSet.add(registro.Mes);

            if (registro.ultima_fecha_actualizacion > ultimaFecha) {
              ultimaFecha = registro.ultima_fecha_actualizacion;
            }

            cursor.continue();
          } else {
            stats.mesesConDatos = Array.from(mesesSet).sort((a, b) => a - b);
            stats.ultimaActualizacion = ultimaFecha > 0 ? ultimaFecha : null;
            resolve(stats);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `obtener estadísticas de ${nivel}-${grado}`
      );
      return {
        totalRegistros: 0,
        ultimaActualizacion: null,
        mesesConDatos: [],
      };
    }
  }
}
