// ============================================================================
//               Clase abstracta base para gestión de aulas
// ============================================================================

import {
  ApiResponseBase,
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";

import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import comprobarSincronizacionDeTabla from "@/lib/helpers/validations/comprobarSincronizacionDeTabla";

import { DatabaseModificationOperations } from "@/interfaces/shared/DatabaseModificationOperations";
import TablasSistema, {
  ITablaInfo,
  TablasLocal,
} from "@/interfaces/shared/TablasSistema";
import IndexedDBConnection from "../../IndexedDBConnection";
import ultimaActualizacionTablasLocalesIDB from "../UltimaActualizacionTablasLocalesIDB";
import AllErrorTypes, {
  DataConflictErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "@/interfaces/shared/errors";
import { T_Aulas } from "@prisma/client";

// Filtros básicos para búsqueda
export interface IAulaBaseFilter {
  Id_Aula?: string;
  Nivel?: string;
  Grado?: number;
  Seccion?: string;
}

/**
 * Clase abstracta base para gestión de aulas
 * Todos los roles almacenan aulas en la tabla común "aulas"
 */
export abstract class BaseAulasIDB<T extends T_Aulas = T_Aulas> {
  // Tabla común para todos los roles
  protected readonly tablaAulas: string = "aulas";
  protected readonly tablaInfo: ITablaInfo = TablasSistema.AULAS;

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
  protected abstract getEndpoint(): string;
  protected abstract solicitarAulasDesdeAPI(idsAulas?: string[]): Promise<T[]>;

  /**
   * Obtiene un aula por su ID desde la tabla común
   */
  public async getAulaPorId(idAula: string): Promise<T | null> {
    try {
      const store = await IndexedDBConnection.getStore(this.tablaAulas);

      return new Promise<T | null>((resolve, reject) => {
        const request = store.get(idAula);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error al obtener aula con ID ${idAula}:`, error);
      this.handleIndexedDBError(error, `obtener aula con ID ${idAula}`);
      return null;
    }
  }

  /**
   * Obtiene múltiples aulas por sus IDs
   */
  public async getAulasPorIds(idsAulas: string[]): Promise<T[]> {
    try {
      const aulas: T[] = [];

      for (const idAula of idsAulas) {
        const aula = await this.getAulaPorId(idAula);
        if (aula) {
          aulas.push(aula);
        }
      }

      return aulas;
    } catch (error) {
      console.error("Error al obtener aulas por IDs:", error);
      this.handleIndexedDBError(error, "obtener aulas por IDs");
      return [];
    }
  }

  /**
   * Obtiene todas las aulas de la tabla común
   */
  public async getTodasLasAulas(): Promise<T[]> {
    this.setIsSomethingLoading(true);
    this.setError(null);
    this.setSuccessMessage?.(null);

    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.tablaAulas);

      const result = await new Promise<T[]>((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });

      if (result.length > 0) {
        this.handleSuccess(`Se encontraron ${result.length} aulas`);
      } else {
        this.handleSuccess("No se encontraron aulas");
      }

      this.setIsSomethingLoading(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "obtener todas las aulas");
      this.setIsSomethingLoading(false);
      return [];
    }
  }

  /**
   * Busca aulas con filtros básicos
   */
  public async buscarConFiltros(filtros: IAulaBaseFilter): Promise<T[]> {
    this.setIsSomethingLoading(true);
    this.setError(null);

    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.tablaAulas);

      const result = await new Promise<T[]>((resolve, reject) => {
        const aulas: T[] = [];
        const request = store.openCursor();

        request.onsuccess = (event: any) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            const aula = cursor.value as T;
            let cumpleFiltros = true;

            // Aplicar filtros básicos
            if (filtros.Id_Aula && aula.Id_Aula !== filtros.Id_Aula) {
              cumpleFiltros = false;
            }
            if (filtros.Nivel && aula.Nivel !== filtros.Nivel) {
              cumpleFiltros = false;
            }
            if (filtros.Grado !== undefined && aula.Grado !== filtros.Grado) {
              cumpleFiltros = false;
            }
            if (filtros.Seccion && aula.Seccion !== filtros.Seccion) {
              cumpleFiltros = false;
            }

            if (cumpleFiltros) {
              aulas.push(aula);
            }
            cursor.continue();
          } else {
            resolve(aulas);
          }
        };

        request.onerror = () => reject(request.error);
      });

      if (result.length > 0) {
        this.handleSuccess(
          `Se encontraron ${result.length} aulas con los filtros aplicados`
        );
      } else {
        this.handleSuccess("No se encontraron aulas con los filtros aplicados");
      }

      this.setIsSomethingLoading(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "buscar aulas con filtros");
      this.setIsSomethingLoading(false);
      return [];
    }
  }

  /**
   * Elimina un aula por su ID
   */
  protected async deleteById(idAula: string): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.tablaAulas,
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.delete(idAula);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error al eliminar aula con ID ${idAula}:`, error);
      throw error;
    }
  }

  /**
   * Actualiza o crea aulas en lote desde el servidor
   */
  protected async upsertFromServer(aulasServidor: T[]): Promise<{
    created: number;
    updated: number;
    errors: number;
  }> {
    const result = { created: 0, updated: 0, errors: 0 };

    try {
      const BATCH_SIZE = 20;

      for (let i = 0; i < aulasServidor.length; i += BATCH_SIZE) {
        const lote = aulasServidor.slice(i, i + BATCH_SIZE);

        for (const aulaServidor of lote) {
          try {
            const existeAula = await this.getAulaPorId(aulaServidor.Id_Aula);

            const store = await IndexedDBConnection.getStore(
              this.tablaAulas,
              "readwrite"
            );

            await new Promise<void>((resolve, reject) => {
              const request = store.put(aulaServidor);

              request.onsuccess = () => {
                if (existeAula) {
                  result.updated++;
                } else {
                  result.created++;
                }
                resolve();
              };

              request.onerror = () => {
                result.errors++;
                console.error(
                  `Error al guardar aula ${aulaServidor.Id_Aula}:`,
                  request.error
                );
                reject(request.error);
              };
            });
          } catch (error) {
            result.errors++;
            console.error(
              `Error al procesar aula ${aulaServidor.Id_Aula}:`,
              error
            );
          }
        }

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
   * Sincronización estándar para otras clases (no responsables)
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

      const aulas = await this.solicitarAulasDesdeAPI();
      const result = await this.upsertFromServer(aulas);

      await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
        this.tablaInfo.nombreLocal as TablasLocal,
        DatabaseModificationOperations.UPDATE
      );

      console.log(
        `Sincronización de aulas completada: ${aulas.length} aulas procesadas (${result.created} creadas, ${result.updated} actualizadas, ${result.errors} errores)`
      );
    } catch (error) {
      console.error("Error durante la sincronización de aulas:", error);
      await this.handleSyncError(error);
    }
  }

  /**
   * Manejo de errores de sincronización
   */
  protected async handleSyncError(error: unknown): Promise<void> {
    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = "Error al sincronizar aulas";

    if (error instanceof Error) {
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = "Error de red al sincronizar aulas";
      } else if (error.message.includes("obtener aulas")) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = error.message;
      } else if (
        error.name === "TransactionInactiveError" ||
        error.name === "QuotaExceededError"
      ) {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = "Error de base de datos al sincronizar aulas";
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
