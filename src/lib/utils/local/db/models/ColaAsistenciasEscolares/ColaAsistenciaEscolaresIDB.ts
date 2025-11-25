import { TablasLocal } from "@/interfaces/shared/TablasSistema";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import AllErrorTypes, {
  DataConflictErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "@/interfaces/shared/errors";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";

import { ItemDeColaAsistenciaEscolar } from "@/lib/utils/queues/AsistenciasEscolaresQueue";
import IndexedDBConnection from "@/constants/singleton/IndexedDBConnection";

// Interface for search filters
export interface IColaAsistenciaFilter {
  Id_Estudiante?: string;
  TipoAsistencia?: TipoAsistencia;
  Actor?: ActoresSistema;
  ModoRegistro?: ModoRegistro;
  NivelDelEstudiante?: NivelEducativo;
  Grado?: number;
  Seccion?: string;
  desfaseSegundosAsistenciaEstudiante?: {
    min?: number;
    max?: number;
  };
}

export class ColaAsistenciasEscolaresIDB {
  private nombreTablaLocal: string =
    TablasLocal.Tabla_Cola_Asistencias_Escolares;

  constructor(
    private setIsSomethingLoading?: (isLoading: boolean) => void,
    private setError?: (error: ErrorResponseAPIBase | null) => void,
    private setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Creates a new item in the table
   * @param item Item to create
   * @returns Promise<void>
   */
  public async create(item: ItemDeColaAsistenciaEscolar): Promise<void> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.add(item);

        request.onsuccess = () => {
          this.handleSuccess(
            `Item created: student ${item.Id_Estudiante}, order ${item.NumeroDeOrden}, level ${item.NivelDelEstudiante}, grade ${item.Grado}, section ${item.Seccion}`
          );
          resolve();
        };

        request.onerror = () => {
          this.handleIndexedDBError(request.error, "create item");
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "create item");
      throw error;
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Gets an item by its order number
   * @param numeroDeOrden Order number of the item
   * @returns Promise<ItemDeColaAsistenciaEscolar | null>
   */
  public async getByNumeroOrden(
    numeroDeOrden: number
  ): Promise<ItemDeColaAsistenciaEscolar | null> {
    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<ItemDeColaAsistenciaEscolar | null>(
        (resolve, reject) => {
          const request = store.get(numeroDeOrden);

          request.onsuccess = () => {
            resolve(request.result || null);
          };

          request.onerror = () => {
            this.handleIndexedDBError(
              request.error,
              `get item with order number ${numeroDeOrden}`
            );
            reject(request.error);
          };
        }
      );
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `get item with order number ${numeroDeOrden}`
      );
      return null;
    }
  }

  /**
   * Gets all items from the table
   * @param filtros Optional filters for the search
   * @returns Promise<ItemDeColaAsistenciaEscolar[]>
   */
  public async getAll(
    filtros?: IColaAsistenciaFilter
  ): Promise<ItemDeColaAsistenciaEscolar[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<ItemDeColaAsistenciaEscolar[]>((resolve, reject) => {
        const items: ItemDeColaAsistenciaEscolar[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const item = cursor.value as ItemDeColaAsistenciaEscolar;

            // Apply filters if they exist
            let cumpleFiltros = true;

            if (
              filtros?.Id_Estudiante &&
              item.Id_Estudiante !== filtros.Id_Estudiante
            ) {
              cumpleFiltros = false;
            }

            if (
              filtros?.TipoAsistencia &&
              item.TipoAsistencia !== filtros.TipoAsistencia
            ) {
              cumpleFiltros = false;
            }

            if (filtros?.Actor && item.Actor !== filtros.Actor) {
              cumpleFiltros = false;
            }

            if (
              filtros?.ModoRegistro &&
              item.ModoRegistro !== filtros.ModoRegistro
            ) {
              cumpleFiltros = false;
            }

            if (
              filtros?.NivelDelEstudiante &&
              item.NivelDelEstudiante !== filtros.NivelDelEstudiante
            ) {
              cumpleFiltros = false;
            }

            if (filtros?.Grado && item.Grado !== filtros.Grado) {
              cumpleFiltros = false;
            }

            if (filtros?.Seccion && item.Seccion !== filtros.Seccion) {
              cumpleFiltros = false;
            }

            if (filtros?.desfaseSegundosAsistenciaEstudiante) {
              const { min, max } = filtros.desfaseSegundosAsistenciaEstudiante;
              if (
                min !== undefined &&
                item.desfaseSegundosAsistenciaEstudiante < min
              ) {
                cumpleFiltros = false;
              }
              if (
                max !== undefined &&
                item.desfaseSegundosAsistenciaEstudiante > max
              ) {
                cumpleFiltros = false;
              }
            }

            if (cumpleFiltros) {
              items.push(item);
            }

            cursor.continue();
          } else {
            // Sort by NumeroDeOrden (already a number)
            items.sort((a, b) => a.NumeroDeOrden - b.NumeroDeOrden);

            this.handleSuccess(`Found ${items.length} items`);
            resolve(items);
          }
        };

        request.onerror = () => {
          this.handleIndexedDBError(request.error, "get all items");
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "get all items");
      return [];
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Updates an existing item
   * @param item Item with the updated data
   * @returns Promise<boolean> - true if updated, false if it did not exist
   */
  public async update(item: ItemDeColaAsistenciaEscolar): Promise<boolean> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      await IndexedDBConnection.init();

      // Check if the item exists
      const itemExistente = await this.getByNumeroOrden(item.NumeroDeOrden);

      if (!itemExistente) {
        this.handleSuccess(
          `Item with order number ${item.NumeroDeOrden} not found`
        );
        return false;
      }

      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<boolean>((resolve, reject) => {
        const request = store.put(item);

        request.onsuccess = () => {
          this.handleSuccess(
            `Item updated: student ${item.Id_Estudiante}, order ${item.NumeroDeOrden}, level ${item.NivelDelEstudiante}`
          );
          resolve(true);
        };

        request.onerror = () => {
          this.handleIndexedDBError(request.error, "update item");
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "update item");
      return false;
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Deletes a specific item by its order number
   * @param numeroDeOrden Order number of the item to delete
   * @returns Promise<boolean> - true if deleted, false if it did not exist
   */
  public async deleteByNumeroOrden(numeroDeOrden: number): Promise<boolean> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      await IndexedDBConnection.init();

      // Check if it exists
      const itemExistente = await this.getByNumeroOrden(numeroDeOrden);

      if (!itemExistente) {
        this.handleSuccess(
          `Item with order number ${numeroDeOrden} not found`
        );
        return false;
      }

      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<boolean>((resolve, reject) => {
        const request = store.delete(numeroDeOrden);

        request.onsuccess = () => {
          this.handleSuccess(
            `Item deleted: student ${itemExistente.Id_Estudiante}, order ${numeroDeOrden}`
          );
          resolve(true);
        };

        request.onerror = () => {
          this.handleIndexedDBError(request.error, "delete item");
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "delete item");
      return false;
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Deletes all items from the table
   * @returns Promise<number> - Number of items deleted
   */
  public async deleteAll(): Promise<number> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      await IndexedDBConnection.init();

      // First count how many items there are
      const itemsActuales = await this.getAll();
      const totalItems = itemsActuales.length;

      if (totalItems === 0) {
        this.handleSuccess("No items to delete");
        return 0;
      }

      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<number>((resolve, reject) => {
        const request = store.clear();

        request.onsuccess = () => {
          this.handleSuccess(`All items deleted: ${totalItems} items`);
          resolve(totalItems);
        };

        request.onerror = () => {
          this.handleIndexedDBError(request.error, "delete all items");
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "delete all items");
      return 0;
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Counts the total number of items in the table
   * @param filtros Optional filters
   * @returns Promise<number>
   */
  public async count(filtros?: IColaAsistenciaFilter): Promise<number> {
    try {
      if (!filtros) {
        // Without filters, use the most efficient method
        await IndexedDBConnection.init();
        const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

        return new Promise<number>((resolve, reject) => {
          const request = store.count();

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onerror = () => {
            reject(request.error);
          };
        });
      } else {
        // With filters, get all and count
        const items = await this.getAll(filtros);
        return items.length;
      }
    } catch (error) {
      this.handleIndexedDBError(error, "count items");
      return 0;
    }
  }

  /**
   * Gets the next available order number
   * @returns Promise<number>
   */
  public async getProximoNumeroOrden(): Promise<number> {
    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<number>((resolve, reject) => {
        // Open cursor in reverse order to get the last one
        const request = store.openCursor(null, "prev");

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            // There are items, increment the last number
            const ultimoItem = cursor.value as ItemDeColaAsistenciaEscolar;
            resolve(ultimoItem.NumeroDeOrden + 1);
          } else {
            // No items, start from 1
            resolve(1);
          }
        };

        request.onerror = () => {
          // In case of error, use timestamp as fallback
          console.error(
            "Error getting next order number:",
            request.error
          );
          resolve(Date.now());
        };
      });
    } catch (error) {
      console.error("Error getting next order number:", error);
      // Fallback: use timestamp
      return Date.now();
    }
  }

  /**
   * Checks if an item with the given order number exists
   * @param numeroDeOrden Order number to check
   * @returns Promise<boolean>
   */
  public async existsByNumeroOrden(numeroDeOrden: number): Promise<boolean> {
    try {
      const item = await this.getByNumeroOrden(numeroDeOrden);
      return item !== null;
    } catch (error) {
      console.error(
        `Error checking existence of item ${numeroDeOrden}:`,
        error
      );
      return false;
    }
  }

  /**
   * Sets a success message
   * @param message Success message
   */
  private handleSuccess(message: string): void {
    const successResponse: MessageProperty = { message };
    this.setSuccessMessage?.(successResponse);
  }

  /**
   * Handles errors from IndexedDB operations
   * @param error The captured error
   * @param operacion Name of the failed operation
   */
  private handleIndexedDBError(error: unknown, operacion: string): void {
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
    });
  }
}
