import { AuxiliarSinContraseña } from "@/interfaces/shared/apis/shared/others/types";

import {
  TablasSistema,
  ITablaInfo,
  TablasLocal,
} from "../../../../../interfaces/shared/TablasSistema";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import AllErrorTypes, {
  DataConflictErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "../../../../../interfaces/shared/errors";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import comprobarSincronizacionDeTabla from "@/lib/helpers/validations/comprobarSincronizacionDeTabla";
import ultimaActualizacionTablasLocalesIDB from "./UltimaActualizacionTablasLocalesIDB";
import { DatabaseModificationOperations } from "@/interfaces/shared/DatabaseModificationOperations";
import { Endpoint_Get_Auxiliares_API01 } from "@/lib/utils/backend/endpoints/api01/Auxiliares";
import IndexedDBConnection from "@/constants/singleton/IndexedDBConnection";

// Type for the entity (without date attributes)
export type IAuxiliarLocal = AuxiliarSinContraseña;

export interface IAuxiliarFilter {
  Id_Auxiliar?: string;
  Nombres?: string;
  Apellidos?: string;
  Estado?: boolean;
}

export class AuxiliaresIDB {
  private tablaInfo: ITablaInfo = TablasSistema.AUXILIARES;
  private nombreTablaLocal: string = this.tablaInfo.nombreLocal || "auxiliares";

  constructor(
    private siasisAPI: SiasisAPIS,
    private setIsSomethingLoading: (isLoading: boolean) => void,
    private setError: (error: ErrorResponseAPIBase | null) => void,
    private setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Synchronization method that will be executed at the beginning of each operation
   * This method will be implemented by you later
   */
  private async sync(): Promise<void> {
    try {
      const debeSincronizar = await comprobarSincronizacionDeTabla(
        this.tablaInfo,
        this.siasisAPI
      );

      if (!debeSincronizar) {
        // No need to synchronize
        return;
      }

      // If we get here, we must synchronize
      await this.fetchYActualizarAuxiliares();
    } catch (error) {
      console.error("Error during auxiliary synchronization:", error);
      this.handleIndexedDBError(error, "synchronize auxiliaries");
    }
  }
  /**
   * Gets the auxiliaries from the API and updates them locally
   * @returns Promise that resolves when the auxiliaries have been updated
   */
  private async fetchYActualizarAuxiliares(): Promise<void> {
    try {
      // Extract the auxiliaries from the response body
      const { data: auxiliares } =
        await Endpoint_Get_Auxiliares_API01.realizarPeticion();

      // Update auxiliaries in the local database
      const result = await this.upsertFromServer(auxiliares);

      // Register the update in UltimaActualizacionTablasLocalesIDB
      await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
        this.tablaInfo.nombreLocal as TablasLocal,
        DatabaseModificationOperations.UPDATE
      );

      console.log(
        `Auxiliary synchronization completed: ${auxiliares.length} auxiliaries processed (${result.created} created, ${result.updated} updated, ${result.deleted} deleted, ${result.errors} errors)`
      );
    } catch (error) {
      console.error("Error getting and updating auxiliaries:", error);

      // Determine the error type
      let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
      let message = "Error synchronizing auxiliaries";

      if (error instanceof Error) {
        // If it is a network error or connection problems
        if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
          message = "Network error synchronizing auxiliaries";
        }
        // If it is an error related to the server response
        else if (error.message.includes("get auxiliaries")) {
          errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
          message = error.message;
        }
        // If it is an IndexedDB error
        else if (
          error.name === "TransactionInactiveError" ||
          error.name === "QuotaExceededError"
        ) {
          errorType = SystemErrorTypes.DATABASE_ERROR;
          message = "Database error synchronizing auxiliaries";
        } else {
          message = error.message;
        }
      }

      // Set the error in the global state
      this.setError({
        success: false,
        message: message,
        errorType: errorType,
        details: {
          origen: "AuxiliarIDB.fetchYActualizarAuxiliares",
          timestamp: Date.now(),
        },
      });

      throw error;
    }
  }

  /**
   * Gets all auxiliaries
   * @param includeInactive If true, includes inactive auxiliaries
   * @returns Promise with the array of auxiliaries
   */
  public async getAll(
    includeInactive: boolean = true
  ): Promise<IAuxiliarLocal[]> {
    this.setIsSomethingLoading(true);
    this.setError(null); // Clear previous errors
    this.setSuccessMessage?.(null); // Clear previous messages

    try {
      // Execute synchronization before the operation
      await this.sync();

      // Get the store
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      // Convert the IndexedDB callback API to promises
      const result = await new Promise<IAuxiliarLocal[]>((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result as IAuxiliarLocal[]);
        request.onerror = () => reject(request.error);
      });

      // Filter inactive if necessary
      const auxiliares = includeInactive
        ? result
        : result.filter((aux) => aux.Estado === true);

      // Show success message with relevant information
      if (auxiliares.length > 0) {
        this.handleSuccess(`Found ${auxiliares.length} auxiliaries`);
      } else {
        this.handleSuccess("No auxiliaries found");
      }

      this.setIsSomethingLoading(false);
      return auxiliares;
    } catch (error) {
      this.handleIndexedDBError(error, "get auxiliary list");
      this.setIsSomethingLoading(false);
      return []; // Return empty array in case of error
    }
  }

  /**
   * Gets all auxiliary DNIs stored locally
   * @returns Promise with array of DNIs
   */
  private async getAllDNIs(): Promise<string[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<string[]>((resolve, reject) => {
        const dnis: string[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            // Add the DNI of the current auxiliary
            dnis.push(cursor.value.Id_Auxiliar);
            cursor.continue();
          } else {
            // No more records, resolve with the array of DNIs
            resolve(dnis);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error getting all auxiliary DNIs:", error);
      throw error;
    }
  }

  /**
   * Deletes an auxiliary by their DNI
   * @param dni DNI of the auxiliary to delete
   * @returns Promise<void>
   */
  private async deleteByDNI(dni: string): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.delete(dni);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error deleting auxiliary with DNI ${dni}:`, error);
      throw error;
    }
  }

  /**
   * Updates or creates auxiliaries in batch from the server
   * Also deletes records that no longer exist on the server
   * @param auxiliaresServidor Auxiliaries from the server
   * @returns Count of operations: created, updated, deleted, errors
   */
  private async upsertFromServer(
    auxiliaresServidor: AuxiliarSinContraseña[]
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  }> {
    const result = { created: 0, updated: 0, deleted: 0, errors: 0 };

    try {
      // 1. Get current DNIs in cache
      const dnisLocales = await this.getAllDNIs();

      // 2. Create a set of server DNIs for quick lookup
      const dnisServidor = new Set(
        auxiliaresServidor.map((aux) => aux.Id_Auxiliar)
      );

      // 3. Identify DNIs that no longer exist on the server
      const dnisAEliminar = dnisLocales.filter((dni) => !dnisServidor.has(dni));

      // 4. Delete obsolete records
      for (const dni of dnisAEliminar) {
        try {
          await this.deleteByDNI(dni);
          result.deleted++;
        } catch (error) {
          console.error(`Error deleting auxiliary ${dni}:`, error);
          result.errors++;
        }
      }

      // 5. Process in batches to avoid excessively long transactions
      const BATCH_SIZE = 20;

      for (let i = 0; i < auxiliaresServidor.length; i += BATCH_SIZE) {
        const lote = auxiliaresServidor.slice(i, i + BATCH_SIZE);

        // For each auxiliary in the batch
        for (const auxiliarServidor of lote) {
          try {
            // Check if the auxiliary already exists
            const existeAuxiliar = await this.getById(
              auxiliarServidor.Id_Auxiliar
            );

            // Get a fresh store for each operation
            const store = await IndexedDBConnection.getStore(
              this.nombreTablaLocal,
              "readwrite"
            );

            // Execute the put operation
            await new Promise<void>((resolve, reject) => {
              const request = store.put(auxiliarServidor);

              request.onsuccess = () => {
                if (existeAuxiliar) {
                  result.updated++;
                } else {
                  result.created++;
                }
                resolve();
              };

              request.onerror = () => {
                result.errors++;
                console.error(
                  `Error saving auxiliary ${auxiliarServidor.Id_Auxiliar}:`,
                  request.error
                );
                reject(request.error);
              };
            });
          } catch (error) {
            result.errors++;
            console.error(
              `Error processing auxiliary ${auxiliarServidor.Id_Auxiliar}:`,
              error
            );
          }
        }

        // Give the event loop a break between batches
        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      return result;
    } catch (error) {
      console.error("Error in upsertFromServer operation:", error);
      result.errors++;
      return result;
    }
  }

  /**
   * Gets an auxiliary by their DNI
   * @param dni DNI of the auxiliary
   * @returns Found auxiliary or null
   */
  public async getById(dni: string): Promise<IAuxiliarLocal | null> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<IAuxiliarLocal | null>((resolve, reject) => {
        const request = store.get(dni);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error getting auxiliary with DNI ${dni}:`, error);
      this.handleIndexedDBError(error, `get auxiliary with DNI ${dni}`);
      return null;
    }
  }

  /**
   * Sets a success message
   * @param message Success message
   * @param data Optional additional data
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
      // Try to categorize the error by its message or name
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
        // If we cannot categorize specifically, we use the error message
        message = error.message || message;
      }
    }

    this.setError({
      success: false,
      message: message,
      errorType: errorType,
    });
  }
}