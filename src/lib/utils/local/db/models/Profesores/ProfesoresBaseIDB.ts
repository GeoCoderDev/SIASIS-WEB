import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { TablasLocal, TablasRemoto } from "@/interfaces/shared/TablasSistema";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
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
import IndexedDBConnection from "../../IndexedDBConnection";
import UltimaModificacionTablasIDB from "../UltimaModificacionTablasIDB";

// Base interface for teachers (minimum fields accessible by all roles)
export interface IProfesorBaseLocal {
  // Level-specific fields
  Id_Profesor_Primaria?: string; // Only for primary
  Id_Profesor_Secundaria?: string; // Only for secondary

  // Common fields
  Nombres: string;
  Apellidos: string;
  Genero: string;
  Google_Drive_Foto_ID?: string | null;
  Celular: string;

  // Synchronization field
  ultima_fecha_actualizacion: number;
}

// Filters for queries
export interface IProfesorFilter {
  idProfesor?: string;
  nivel?: NivelEducativo;
  nombres?: string;
  apellidos?: string;
}

// Result of operations
export interface ProfesorOperationResult {
  success: boolean;
  message: string;
  data?: any;
  count?: number;
}

// Mapping of level to local table
const MAPEO_TABLA_PROFESORES: Record<NivelEducativo, TablasLocal> = {
  [NivelEducativo.PRIMARIA]: TablasLocal.Tabla_Profesores_Primaria,
  [NivelEducativo.SECUNDARIA]: TablasLocal.Tabla_Profesores_Secundaria,
};

// Mapping of level to remote table (for synchronization)
const MAPEO_TABLA_REMOTA_PROFESORES: Record<NivelEducativo, TablasRemoto> = {
  [NivelEducativo.PRIMARIA]: TablasRemoto.Tabla_Profesores_Primaria,
  [NivelEducativo.SECUNDARIA]: TablasRemoto.Tabla_Profesores_Secundaria,
};

/**
 * Base class for handling teachers in IndexedDB
 * Handles both primary and secondary school teachers
 */
export class ProfesoresBaseIDB {
  protected dateHelper: AsistenciaDateHelper;

  constructor(
    protected siasisAPI: SiasisAPIS = "API01",
    protected setIsSomethingLoading?: (isLoading: boolean) => void,
    protected setError?: (error: ErrorResponseAPIBase | null) => void,
    protected setSuccessMessage?: (message: MessageProperty | null) => void
  ) {
    this.dateHelper = new AsistenciaDateHelper();
  }

  // =====================================================================================
  // MAPPING AND UTILITY METHODS
  // =====================================================================================

  /**
   * Gets the corresponding table name according to the level
   */
  protected obtenerNombreTabla(nivel: NivelEducativo): TablasLocal {
    const tabla = MAPEO_TABLA_PROFESORES[nivel];
    if (!tabla) {
      throw new Error(`No table found for level ${nivel}`);
    }
    return tabla;
  }

  /**
   * Gets the name of the remote table for synchronization
   */
  protected obtenerTablaRemota(nivel: NivelEducativo): TablasRemoto {
    const tabla = MAPEO_TABLA_REMOTA_PROFESORES[nivel];
    if (!tabla) {
      throw new Error(`No remote table found for level ${nivel}`);
    }
    return tabla;
  }

  /**
   * Generates the key according to the teacher's level
   */
  protected generarClaveProfesor(
    idProfesor: string,
    nivel: NivelEducativo
  ): string {
    // The key is simply the teacher's ID, but it is stored in the table corresponding to the level
    return idProfesor;
  }

  /**
   * Gets the corresponding ID field according to the level
   */
  protected obtenerCampoId(nivel: NivelEducativo): string {
    return nivel === NivelEducativo.PRIMARIA
      ? "Id_Profesor_Primaria"
      : "Id_Profesor_Secundaria";
  }

  // =====================================================================================
  // SYNCHRONIZATION METHODS
  // =====================================================================================

  /**
   * Checks if synchronization is needed by comparing with the last remote modification
   */
  protected async necesitaSincronizacion(
    nivel: NivelEducativo
  ): Promise<boolean> {
    try {
      const tablaRemota = this.obtenerTablaRemota(nivel);
      const ultimaModificacionIDB = new UltimaModificacionTablasIDB(
        this.siasisAPI
      );
      const ultimaModificacion = await ultimaModificacionIDB.getByTabla(
        tablaRemota
      );

      if (!ultimaModificacion) {
        return false; // If there is no modification record, do not synchronize
      }

      // Check if there are local records
      const registrosLocales = await this.obtenerTodosLosProfesores(nivel);
      if (registrosLocales.length === 0) {
        return true; // No local data, initial synchronization needed
      }

      // Find the record with the last local update
      const ultimaActualizacionLocal = Math.max(
        ...registrosLocales.map((r) => r.ultima_fecha_actualizacion)
      );

      const fechaModificacionRemota = new Date(
        ultimaModificacion.Fecha_Modificacion
      ).getTime();

      return ultimaActualizacionLocal < fechaModificacionRemota;
    } catch (error) {
      console.error("Error checking synchronization:", error);
      return true; // In case of error, it is better to synchronize
    }
  }

  // =====================================================================================
  // BASIC CRUD METHODS
  // =====================================================================================

  /**
   * Gets a specific teacher by ID and level
   */
  public async obtenerProfesorPorId(
    idProfesor: string,
    nivel: NivelEducativo
  ): Promise<IProfesorBaseLocal | null> {
    try {
      const nombreTabla = this.obtenerNombreTabla(nivel);
      const store = await IndexedDBConnection.getStore(nombreTabla);
      const clave = this.generarClaveProfesor(idProfesor, nivel);

      return new Promise<IProfesorBaseLocal | null>((resolve, reject) => {
        const request = store.get(clave);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, `get teacher ${idProfesor}`);
      return null;
    }
  }

  /**
   * Gets all teachers of a specific level
   */
  public async obtenerTodosLosProfesores(
    nivel: NivelEducativo
  ): Promise<IProfesorBaseLocal[]> {
    try {
      const nombreTabla = this.obtenerNombreTabla(nivel);
      const store = await IndexedDBConnection.getStore(nombreTabla);

      return new Promise<IProfesorBaseLocal[]>((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result as IProfesorBaseLocal[]);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `get all teachers from ${nivel}`
      );
      return [];
    }
  }

  /**
   * Saves or updates a teacher - FIXED VERSION
   */
  public async guardarProfesor(
    profesor: Omit<IProfesorBaseLocal, "ultima_fecha_actualizacion">,
    nivel: NivelEducativo
  ): Promise<ProfesorOperationResult> {
    try {
      const nombreTabla = this.obtenerNombreTabla(nivel);
      const store = await IndexedDBConnection.getStore(
        nombreTabla,
        "readwrite"
      );

      // Add current timestamp
      const profesorCompleto: IProfesorBaseLocal = {
        ...profesor,
        ultima_fecha_actualizacion: this.dateHelper.obtenerTimestampPeruano(),
      };

      return new Promise<ProfesorOperationResult>((resolve, reject) => {
        const request = store.put(profesorCompleto);

        request.onsuccess = () => {
          resolve({
            success: true,
            message: "Teacher saved successfully",
            data: profesorCompleto, // RETURN THE COMPLETE OBJECT, NOT JUST THE ID
          });
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "save teacher");
      return {
        success: false,
        message: `Error saving teacher: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Deletes a teacher
   */
  public async eliminarProfesor(
    idProfesor: string,
    nivel: NivelEducativo
  ): Promise<ProfesorOperationResult> {
    try {
      const nombreTabla = this.obtenerNombreTabla(nivel);
      const store = await IndexedDBConnection.getStore(
        nombreTabla,
        "readwrite"
      );
      const clave = this.generarClaveProfesor(idProfesor, nivel);

      return new Promise<ProfesorOperationResult>((resolve, reject) => {
        const request = store.delete(clave);

        request.onsuccess = () => {
          resolve({
            success: true,
            message: "Teacher deleted successfully",
          });
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, `delete teacher ${idProfesor}`);
      return {
        success: false,
        message: `Error deleting teacher: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Searches for teachers with filters
   */
  public async buscarProfesoresConFiltros(
    filtros: IProfesorFilter
  ): Promise<IProfesorBaseLocal[]> {
    try {
      const resultados: IProfesorBaseLocal[] = [];

      // Determine which levels to query
      const nivelesAConsultar = filtros.nivel
        ? [filtros.nivel]
        : [NivelEducativo.PRIMARIA, NivelEducativo.SECUNDARIA];

      // Execute searches in parallel
      const promesasBusqueda = nivelesAConsultar.map(async (nivel) => {
        return this.buscarEnNivelEspecifico(nivel, filtros);
      });

      const resultadosPorNivel = await Promise.all(promesasBusqueda);

      // Combine results
      resultadosPorNivel.forEach((profesores) => {
        resultados.push(...profesores);
      });

      return resultados;
    } catch (error) {
      this.handleIndexedDBError(error, "search teachers with filters");
      return [];
    }
  }

  /**
   * Searches for teachers in a specific level applying filters
   */
  private async buscarEnNivelEspecifico(
    nivel: NivelEducativo,
    filtros: IProfesorFilter
  ): Promise<IProfesorBaseLocal[]> {
    const nombreTabla = this.obtenerNombreTabla(nivel);
    const store = await IndexedDBConnection.getStore(nombreTabla);

    return new Promise<IProfesorBaseLocal[]>((resolve, reject) => {
      const profesores: IProfesorBaseLocal[] = [];
      let request: IDBRequest;

      // If there is a specific ID, use direct get
      if (filtros.idProfesor) {
        const clave = this.generarClaveProfesor(filtros.idProfesor, nivel);
        request = store.openCursor(IDBKeyRange.only(clave));
      } else {
        // Full scan for other filters
        request = store.openCursor();
      }

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue;

        if (cursor) {
          const profesor = cursor.value as IProfesorBaseLocal;

          // Apply additional filters
          if (this.aplicarFiltrosProfesor(profesor, filtros)) {
            profesores.push(profesor);
          }

          cursor.continue();
        } else {
          resolve(profesores);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Applies additional filters to a teacher
   */
  private aplicarFiltrosProfesor(
    profesor: IProfesorBaseLocal,
    filtros: IProfesorFilter
  ): boolean {
    // Filter by names (partial search, case insensitive)
    if (filtros.nombres) {
      const nombresBusqueda = filtros.nombres.toLowerCase();
      const nombresProfesor = profesor.Nombres.toLowerCase();
      if (!nombresProfesor.includes(nombresBusqueda)) {
        return false;
      }
    }

    // Filter by last names (partial search, case insensitive)
    if (filtros.apellidos) {
      const apellidosBusqueda = filtros.apellidos.toLowerCase();
      const apellidosProfesor = profesor.Apellidos.toLowerCase();
      if (!apellidosProfesor.includes(apellidosBusqueda)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Updates multiple teachers from server data
   */
  protected async actualizarProfesoresDesdeServidor(
    nivel: NivelEducativo,
    profesoresServidor: Omit<IProfesorBaseLocal, "ultima_fecha_actualizacion">[]
  ): Promise<{ actualizados: number; creados: number; errores: number }> {
    const resultado = { actualizados: 0, creados: 0, errores: 0 };

    try {
      const BATCH_SIZE = 50;

      for (let i = 0; i < profesoresServidor.length; i += BATCH_SIZE) {
        const lote = profesoresServidor.slice(i, i + BATCH_SIZE);

        for (const profesorServidor of lote) {
          try {
            const idProfesor =
              nivel === NivelEducativo.PRIMARIA
                ? profesorServidor.Id_Profesor_Primaria!
                : profesorServidor.Id_Profesor_Secundaria!;

            const profesorExistente = await this.obtenerProfesorPorId(
              idProfesor,
              nivel
            );

            const resultadoOperacion = await this.guardarProfesor(
              profesorServidor,
              nivel
            );

            if (resultadoOperacion.success) {
              if (profesorExistente) {
                resultado.actualizados++;
              } else {
                resultado.creados++;
              }
            } else {
              resultado.errores++;
            }
          } catch (error) {
            console.error(`Error processing teacher:`, error);
            resultado.errores++;
          }
        }

        // Pause between batches
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } catch (error) {
      console.error("Error in bulk update:", error);
      resultado.errores++;
    }

    return resultado;
  }

  // =====================================================================================
  // UTILITY AND ERROR HANDLING METHODS
  // =====================================================================================

  /**
   * Sets a success message
   */
  protected handleSuccess(message: string, data?: any): void {
    const successResponse: MessageProperty = { message };
    this.setSuccessMessage?.(successResponse);
  }

  /**
   * Handles errors from IndexedDB operations
   */
  protected handleIndexedDBError(error: unknown, operacion: string): void {
    console.error(`Error in IndexedDB operation (${operacion}):`, error);

    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = `Error when ${operacion}`;

    if (error instanceof Error) {
      if (error.name === "ConstraintError") {
        errorType = DataConflictErrorTypes.VALUE_ALREADY_IN_USE;
        message = `Constraint error when ${operacion}: duplicate value`;
      } else if (error.name === "NotFoundError") {
        errorType = UserErrorTypes.USER_NOT_FOUND;
        message = `Resource not found when ${operacion}`;
      } else if (error.name === "QuotaExceededError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Storage exceeded when ${operacion}`;
      } else if (error.name === "TransactionInactiveError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Inactive transaction when ${operacion}`;
      } else {
        message = error.message || message;
      }
    }

    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
      details: {
        origen: "ProfesoresBaseIDB",
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Gets basic statistics by level
   */
  public async obtenerEstadisticasNivel(nivel: NivelEducativo): Promise<{
    totalProfesores: number;
    ultimaActualizacion: number | null;
  }> {
    try {
      const nombreTabla = this.obtenerNombreTabla(nivel);
      const store = await IndexedDBConnection.getStore(nombreTabla);

      return new Promise((resolve, reject) => {
        const stats = {
          totalProfesores: 0,
          ultimaActualizacion: null as number | null,
        };

        let ultimaFecha = 0;
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const profesor = cursor.value as IProfesorBaseLocal;
            stats.totalProfesores++;

            if (profesor.ultima_fecha_actualizacion > ultimaFecha) {
              ultimaFecha = profesor.ultima_fecha_actualizacion;
            }

            cursor.continue();
          } else {
            stats.ultimaActualizacion = ultimaFecha > 0 ? ultimaFecha : null;
            resolve(stats);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, `get statistics from ${nivel}`);
      return {
        totalProfesores: 0,
        ultimaActualizacion: null,
      };
    }
  }
}
