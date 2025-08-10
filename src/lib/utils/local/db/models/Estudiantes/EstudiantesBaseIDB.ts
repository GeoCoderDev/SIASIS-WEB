// ============================================================================
//              Clase abstracta base para gestión de estudiantes
// ============================================================================


import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";

import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import comprobarSincronizacionDeTabla from "@/lib/helpers/validations/comprobarSincronizacionDeTabla";
import { DatabaseModificationOperations } from "@/interfaces/shared/DatabaseModificationOperations";
import TablasSistema, { ITablaInfo, TablasLocal } from "@/interfaces/shared/TablasSistema";
import { T_Estudiantes } from "@prisma/client";
import IndexedDBConnection from "../../IndexedDBConnection";
import ultimaActualizacionTablasLocalesIDB from "../UltimaActualizacionTablasLocalesIDB";
import AllErrorTypes, { DataConflictErrorTypes, SystemErrorTypes, UserErrorTypes } from "@/interfaces/shared/errors";


// Filtros para búsqueda basados en los atributos base de T_Estudiantes
export interface IEstudianteBaseFilter {
  Id_Estudiante?: string;
  Nombres?: string;
  Apellidos?: string;
  Estado?: boolean;
  Id_Aula?: string;
}

/**
 * Clase abstracta base para gestión de estudiantes
 * Todos los roles almacenan estudiantes en la tabla común "estudiantes"
 * Los métodos aquí trabajan solo con los atributos base de la interfaz T_Estudiantes
 */
export abstract class BaseEstudiantesIDB<T extends T_Estudiantes = T_Estudiantes> {
  // Tabla común para todos los roles
  protected readonly tablaEstudiantes: string = "estudiantes";
  protected readonly tablaInfo: ITablaInfo = TablasSistema.ESTUDIANTES;

  constructor(
    protected siasisAPI: SiasisAPIS,
    protected setIsSomethingLoading: (isLoading: boolean) => void,
    protected setError: (error: ErrorResponseAPIBase | null) => void,
    protected setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Métodos abstractos que deben implementar las clases hijas
   */
  protected abstract sync(): Promise<void>;
  protected abstract solicitarEstudiantesDesdeAPI(): Promise<T[]>;

  /**
   * Obtiene un estudiante por su ID desde la tabla común
   * @param idEstudiante ID del estudiante
   * @returns Estudiante encontrado o null
   */
  public async getEstudiantePorId(idEstudiante: string): Promise<T | null> {
    try {
      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      return new Promise<T | null>((resolve, reject) => {
        const request = store.get(idEstudiante);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error al obtener estudiante con ID ${idEstudiante}:`, error);
      this.handleIndexedDBError(error, `obtener estudiante con ID ${idEstudiante}`);
      return null;
    }
  }

  /**
   * Obtiene todos los estudiantes de la tabla común
   * @param includeInactive Si incluir estudiantes inactivos
   * @returns Array de estudiantes
   */
  public async getTodosLosEstudiantes(includeInactive: boolean = false): Promise<T[]> {
    this.setIsSomethingLoading(true);
    this.setError(null);
    this.setSuccessMessage?.(null);

    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<T[]>((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });

      // Filtrar por estado si es necesario
      const estudiantes = includeInactive
        ? result
        : result.filter((est) => est.Estado === true);

      if (estudiantes.length > 0) {
        this.handleSuccess(`Se encontraron ${estudiantes.length} estudiantes`);
      } else {
        this.handleSuccess("No se encontraron estudiantes");
      }

      this.setIsSomethingLoading(false);
      return estudiantes;
    } catch (error) {
      this.handleIndexedDBError(error, "obtener todos los estudiantes");
      this.setIsSomethingLoading(false);
      return [];
    }
  }

  /**
   * Busca estudiantes por nombre (búsqueda parcial en nombres y apellidos)
   * @param nombreBusqueda Texto a buscar
   * @param includeInactive Si incluir estudiantes inactivos
   * @returns Array de estudiantes que coinciden con la búsqueda
   */
  public async buscarPorNombre(
    nombreBusqueda: string,
    includeInactive: boolean = false
  ): Promise<T[]> {
    this.setIsSomethingLoading(true);
    this.setError(null);

    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<T[]>((resolve, reject) => {
        const estudiantes: T[] = [];
        const request = store.openCursor();
        const busquedaLower = nombreBusqueda.toLowerCase();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value as T;
            
            // Filtrar por estado si es necesario
            if (!includeInactive && !estudiante.Estado) {
              cursor.continue();
              return;
            }

            // Buscar en nombres, apellidos y nombre completo
            const nombreCompleto = `${estudiante.Nombres} ${estudiante.Apellidos}`.toLowerCase();
            if (
              estudiante.Nombres.toLowerCase().includes(busquedaLower) ||
              estudiante.Apellidos.toLowerCase().includes(busquedaLower) ||
              nombreCompleto.includes(busquedaLower)
            ) {
              estudiantes.push(estudiante);
            }
            cursor.continue();
          } else {
            resolve(estudiantes);
          }
        };

        request.onerror = () => reject(request.error);
      });

      if (result.length > 0) {
        this.handleSuccess(`Se encontraron ${result.length} estudiantes con "${nombreBusqueda}"`);
      } else {
        this.handleSuccess(`No se encontraron estudiantes con "${nombreBusqueda}"`);
      }

      this.setIsSomethingLoading(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "buscar estudiantes por nombre");
      this.setIsSomethingLoading(false);
      return [];
    }
  }

  /**
   * Filtra estudiantes por estado (activo/inactivo)
   * @param estado Estado a filtrar (true = activo, false = inactivo)
   * @returns Array de estudiantes con el estado especificado
   */
  public async filtrarPorEstado(estado: boolean): Promise<T[]> {
    this.setIsSomethingLoading(true);
    this.setError(null);

    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<T[]>((resolve, reject) => {
        const estudiantes: T[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value as T;
            if (estudiante.Estado === estado) {
              estudiantes.push(estudiante);
            }
            cursor.continue();
          } else {
            resolve(estudiantes);
          }
        };

        request.onerror = () => reject(request.error);
      });

      const estadoTexto = estado ? "activos" : "inactivos";
      if (result.length > 0) {
        this.handleSuccess(`Se encontraron ${result.length} estudiantes ${estadoTexto}`);
      } else {
        this.handleSuccess(`No se encontraron estudiantes ${estadoTexto}`);
      }

      this.setIsSomethingLoading(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "filtrar estudiantes por estado");
      this.setIsSomethingLoading(false);
      return [];
    }
  }

  /**
   * Filtra estudiantes por aula
   * @param idAula ID del aula
   * @param includeInactive Si incluir estudiantes inactivos
   * @returns Array de estudiantes del aula especificada
   */
  public async filtrarPorAula(
    idAula: string,
    includeInactive: boolean = false
  ): Promise<T[]> {
    this.setIsSomethingLoading(true);
    this.setError(null);

    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<T[]>((resolve, reject) => {
        const estudiantes: T[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value as T;
            
            // Filtrar por aula y estado
            if (
              estudiante.Id_Aula === idAula &&
              (includeInactive || estudiante.Estado === true)
            ) {
              estudiantes.push(estudiante);
            }
            cursor.continue();
          } else {
            resolve(estudiantes);
          }
        };

        request.onerror = () => reject(request.error);
      });

      if (result.length > 0) {
        this.handleSuccess(`Se encontraron ${result.length} estudiantes en el aula ${idAula}`);
      } else {
        this.handleSuccess(`No se encontraron estudiantes en el aula ${idAula}`);
      }

      this.setIsSomethingLoading(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, `filtrar estudiantes por aula ${idAula}`);
      this.setIsSomethingLoading(false);
      return [];
    }
  }

  /**
   * Busca estudiantes aplicando múltiples filtros basados en T_Estudiantes
   * @param filtros Filtros basados en los atributos base
   * @param includeInactive Si incluir estudiantes inactivos
   * @returns Array de estudiantes que cumplen todos los filtros
   */
  public async buscarConFiltros(
    filtros: IEstudianteBaseFilter,
    includeInactive: boolean = false
  ): Promise<T[]> {
    this.setIsSomethingLoading(true);
    this.setError(null);

    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<T[]>((resolve, reject) => {
        const estudiantes: T[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value as T;
            let cumpleFiltros = true;

            // Filtro por estado si no se incluyen inactivos
            if (!includeInactive && !estudiante.Estado) {
              cursor.continue();
              return;
            }

            // Aplicar filtros específicos
            if (filtros.Id_Estudiante && estudiante.Id_Estudiante !== filtros.Id_Estudiante) {
              cumpleFiltros = false;
            }
            if (filtros.Nombres && !estudiante.Nombres.toLowerCase().includes(filtros.Nombres.toLowerCase())) {
              cumpleFiltros = false;
            }
            if (filtros.Apellidos && !estudiante.Apellidos.toLowerCase().includes(filtros.Apellidos.toLowerCase())) {
              cumpleFiltros = false;
            }
            if (filtros.Estado !== undefined && estudiante.Estado !== filtros.Estado) {
              cumpleFiltros = false;
            }
            if (filtros.Id_Aula && estudiante.Id_Aula !== filtros.Id_Aula) {
              cumpleFiltros = false;
            }

            if (cumpleFiltros) {
              estudiantes.push(estudiante);
            }
            cursor.continue();
          } else {
            resolve(estudiantes);
          }
        };

        request.onerror = () => reject(request.error);
      });

      if (result.length > 0) {
        this.handleSuccess(`Se encontraron ${result.length} estudiantes con los filtros aplicados`);
      } else {
        this.handleSuccess("No se encontraron estudiantes con los filtros aplicados");
      }

      this.setIsSomethingLoading(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "buscar estudiantes con filtros");
      this.setIsSomethingLoading(false);
      return [];
    }
  }

  /**
   * Cuenta el total de estudiantes en la tabla
   * @param includeInactive Si incluir estudiantes inactivos en el conteo
   * @returns Número total de estudiantes
   */
  public async contarEstudiantes(includeInactive: boolean = false): Promise<number> {
    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      return new Promise<number>((resolve, reject) => {
        let contador = 0;
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value as T;
            if (includeInactive || estudiante.Estado === true) {
              contador++;
            }
            cursor.continue();
          } else {
            resolve(contador);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error al contar estudiantes:", error);
      this.handleIndexedDBError(error, "contar estudiantes");
      return 0;
    }
  }

  /**
   * Obtiene todos los IDs de estudiantes en la tabla
   * @returns Array de IDs de estudiantes
   */
  protected async getAllIds(): Promise<string[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      return new Promise<string[]>((resolve, reject) => {
        const ids: string[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest).result as IDBCursorWithValue;
          if (cursor) {
            ids.push(cursor.value.Id_Estudiante);
            cursor.continue();
          } else {
            resolve(ids);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error al obtener todos los IDs de estudiantes:", error);
      throw error;
    }
  }

  /**
   * Elimina un estudiante por su ID
   * @param idEstudiante ID del estudiante a eliminar
   */
  protected async deleteById(idEstudiante: string): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.tablaEstudiantes,
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.delete(idEstudiante);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error al eliminar estudiante con ID ${idEstudiante}:`, error);
      throw error;
    }
  }

  /**
   * Actualiza o crea estudiantes en lote desde el servidor
   * Método común que pueden usar todas las clases hijas
   */
  protected async upsertFromServer(
    estudiantesServidor: T[]
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  }> {
    const result = { created: 0, updated: 0, deleted: 0, errors: 0 };

    try {
      // Obtener IDs actuales en la tabla
      const idsLocales = await this.getAllIds();
      const idsServidor = new Set(
        estudiantesServidor.map((est) => est.Id_Estudiante)
      );

      // Identificar estudiantes que ya no existen en el servidor
      const idsAEliminar = idsLocales.filter((id) => !idsServidor.has(id));

      // Eliminar registros obsoletos
      for (const id of idsAEliminar) {
        try {
          await this.deleteById(id);
          result.deleted++;
        } catch (error) {
          console.error(`Error al eliminar estudiante ${id}:`, error);
          result.errors++;
        }
      }

      // Procesar estudiantes en lotes
      const BATCH_SIZE = 20;

      for (let i = 0; i < estudiantesServidor.length; i += BATCH_SIZE) {
        const lote = estudiantesServidor.slice(i, i + BATCH_SIZE);

        for (const estudianteServidor of lote) {
          try {
            const existeEstudiante = await this.getEstudiantePorId(
              estudianteServidor.Id_Estudiante
            );

            const store = await IndexedDBConnection.getStore(
              this.tablaEstudiantes,
              "readwrite"
            );

            await new Promise<void>((resolve, reject) => {
              const request = store.put(estudianteServidor);

              request.onsuccess = () => {
                if (existeEstudiante) {
                  result.updated++;
                } else {
                  result.created++;
                }
                resolve();
              };

              request.onerror = () => {
                result.errors++;
                console.error(
                  `Error al guardar estudiante ${estudianteServidor.Id_Estudiante}:`,
                  request.error
                );
                reject(request.error);
              };
            });
          } catch (error) {
            result.errors++;
            console.error(
              `Error al procesar estudiante ${estudianteServidor.Id_Estudiante}:`,
              error
            );
          }
        }

        // Dar respiro al bucle de eventos
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      return result;
    } catch (error) {
      console.error("Error en la operación upsertFromServer:", error);
      result.errors++;
      return result;
    }
  }

  /**
   * Manejo de sincronización estándar usando comprobarSincronizacionDeTabla
   */
  protected async syncronizacionEstandar(): Promise<void> {
    try {
      const debeSincronizar = await comprobarSincronizacionDeTabla(
        this.tablaInfo,
        this.siasisAPI
      );

      if (!debeSincronizar) {
        return;
      }

      const estudiantes = await this.solicitarEstudiantesDesdeAPI();
      const result = await this.upsertFromServer(estudiantes);

      await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
        this.tablaInfo.nombreLocal as TablasLocal,
        DatabaseModificationOperations.UPDATE
      );

      console.log(
        `Sincronización de estudiantes completada: ${estudiantes.length} estudiantes procesados (${result.created} creados, ${result.updated} actualizados, ${result.deleted} eliminados, ${result.errors} errores)`
      );
    } catch (error) {
      console.error("Error durante la sincronización de estudiantes:", error);
      this.handleSyncError(error);
    }
  }

/**
   * Manejo de errores de sincronización - puede ser sobrescrito por clases hijas
   * @param error Error capturado durante la sincronización
   */
  protected async handleSyncError(error: unknown): Promise<void> {
    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = "Error al sincronizar estudiantes";

    if (error instanceof Error) {
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = "Error de red al sincronizar estudiantes";
      } else if (error.message.includes("obtener estudiantes")) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = error.message;
      } else if (
        error.name === "TransactionInactiveError" ||
        error.name === "QuotaExceededError"
      ) {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = "Error de base de datos al sincronizar estudiantes";
      } else {
        message = error.message;
      }
    }

    this.setError({
      success: false,
      message: message,
      errorType: errorType,
      details: {
        origen: `${this.constructor.name}.sync`,
        timestamp: Date.now(),
      },
    });

    throw error;
  }

  /**
   * Establece un mensaje de éxito
   */
  protected handleSuccess(message: string): void {
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

    this.setError({
      success: false,
      message: message,
      errorType: errorType,
      details: {
        origen: `${this.constructor.name}.${operacion}`,
        timestamp: Date.now(),
      },
    });
  }
}
