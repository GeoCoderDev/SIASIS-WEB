import { PersonalAdministrativoSinContraseña } from "@/interfaces/shared/apis/shared/others/types";
import IndexedDBConnection from "../IndexedDBConnection";
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
import { Endpoint_Get_Personal_Administrativo_API01 } from "@/lib/utils/backend/endpoints/api01/PersonalAdministrativo";

// Type for the entity (without date attributes)
export type IPersonalAdministrativoLocal = PersonalAdministrativoSinContraseña;

export interface IPersonalAdministrativoFilter {
  Id_Personal_Administrativo?: string;
  Nombres?: string;
  Apellidos?: string;
  Estado?: boolean;
  Cargo?: string;
}

export class PersonalAdministrativoIDB {
  private tablaInfo: ITablaInfo = TablasSistema.PERSONAL_ADMINISTRATIVO;
  private nombreTablaLocal: string =
    this.tablaInfo.nombreLocal || "personal_administrativo";

  constructor(
    private siasisAPI: SiasisAPIS = "API01",
    private setIsSomethingLoading?: (isLoading: boolean) => void,
    private setError?: (error: ErrorResponseAPIBase | null) => void,
    private setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Synchronization method that will be executed at the beginning of each operation
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
      await this.fetchYActualizarPersonalAdministrativo();
    } catch (error) {
      console.error(
        "Error during administrative staff synchronization:",
        error
      );
      this.handleIndexedDBError(error, "synchronize administrative staff");
    }
  }

  /**
   * Gets the administrative staff from the API and updates them locally
   * @returns Promise that resolves when the administrative staff has been updated
   */
  private async fetchYActualizarPersonalAdministrativo(): Promise<void> {
    try {
      // Extract the administrative staff from the response body
      const { data: personalAdministrativo } =
        await Endpoint_Get_Personal_Administrativo_API01.realizarPeticion();

      // Update administrative staff in the local database
      const result = await this.upsertFromServer(personalAdministrativo);

      // Register the update in UltimaActualizacionTablasLocalesIDB
      await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
        this.tablaInfo.nombreLocal as TablasLocal,
        DatabaseModificationOperations.UPDATE
      );

      console.log(
        `Administrative staff synchronization completed: ${personalAdministrativo.length} members processed (${result.created} created, ${result.updated} updated, ${result.deleted} deleted, ${result.errors} errors)`
      );
    } catch (error) {
      console.error(
        "Error getting and updating administrative staff:",
        error
      );

      // Determine the error type
      let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
      let message = "Error synchronizing administrative staff";

      if (error instanceof Error) {
        // If it is a network error or connection problems
        if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
          message = "Network error synchronizing administrative staff";
        }
        // If it is an error related to the server response
        else if (error.message.includes("get administrative staff")) {
          errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
          message = error.message;
        }
        // If it is an IndexedDB error
        else if (
          error.name === "TransactionInactiveError" ||
          error.name === "QuotaExceededError"
        ) {
          errorType = SystemErrorTypes.DATABASE_ERROR;
          message =
            "Database error synchronizing administrative staff";
        } else {
          message = error.message;
        }
      }

      // Set the error in the global state
      this.setError?.({
        success: false,
        message: message,
        errorType: errorType,
        details: {
          origen:
            "PersonalAdministrativoIDB.fetchYActualizarPersonalAdministrativo",
          timestamp: Date.now(),
        },
      });

      throw error;
    }
  }

  /**
   * Gets all administrative staff
   * @param includeInactive If true, includes inactive staff
   * @returns Promise with the array of administrative staff
   */
  public async getAll(
    includeInactive: boolean = true
  ): Promise<IPersonalAdministrativoLocal[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null); // Clear previous errors
    this.setSuccessMessage?.(null); // Clear previous messages

    try {
      // Execute synchronization before the operation
      await this.sync();

      // Get the store
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      // Convert the IndexedDB callback API to promises
      const result = await new Promise<IPersonalAdministrativoLocal[]>(
        (resolve, reject) => {
          const request = store.getAll();

          request.onsuccess = () =>
            resolve(request.result as IPersonalAdministrativoLocal[]);
          request.onerror = () => reject(request.error);
        }
      );

      // Filter inactive if necessary
      const personalAdministrativo = includeInactive
        ? result
        : result.filter((personal) => personal.Estado === true);

      // Show success message with relevant information
      if (personalAdministrativo.length > 0) {
        this.handleSuccess(
          `Found ${personalAdministrativo.length} administrative staff members`
        );
      } else {
        this.handleSuccess("No administrative staff found");
      }

      this.setIsSomethingLoading?.(false);
      return personalAdministrativo;
    } catch (error) {
      this.handleIndexedDBError(
        error,
        "get administrative staff list"
      );
      this.setIsSomethingLoading?.(false);
      return []; // Return empty array in case of error
    }
  }

  /**
   * Gets all DNIs of the administrative staff stored locally
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
            // Add the DNI of the current administrative staff
            dnis.push(cursor.value.Id_Personal_Administrativo);
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
      console.error(
        "Error getting all administrative staff DNIs:",
        error
      );
      throw error;
    }
  }

  /**
   * Deletes an administrative staff member by their DNI
   * @param dni DNI of the administrative staff to delete
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
      console.error(
        `Error deleting administrative staff with DNI ${dni}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Updates or creates administrative staff in batch from the server
   * Also deletes records that no longer exist on the server
   * @param personalAdministrativoServidor Administrative staff from the server
   * @returns Count of operations: created, updated, deleted, errors
   */
  private async upsertFromServer(
    personalAdministrativoServidor: PersonalAdministrativoSinContraseña[]
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
        personalAdministrativoServidor.map(
          (personal) => personal.Id_Personal_Administrativo
        )
      );

      // 3. Identify DNIs that no longer exist on the server
      const dnisAEliminar = dnisLocales.filter((dni) => !dnisServidor.has(dni));

      // 4. Delete records that no longer exist on the server
      for (const dni of dnisAEliminar) {
        try {
          await this.deleteByDNI(dni);
          result.deleted++;
        } catch (error) {
          console.error(
            `Error deleting administrative staff ${dni}:`,
            error
          );
          result.errors++;
        }
      }

      // 5. Process in batches to avoid excessively long transactions
      const BATCH_SIZE = 20;

      for (
        let i = 0;
        i < personalAdministrativoServidor.length;
        i += BATCH_SIZE
      ) {
        const lote = personalAdministrativoServidor.slice(i, i + BATCH_SIZE);

        // For each administrative staff member in the batch
        for (const personalServidor of lote) {
          try {
            // Check if the administrative staff already exists
            const existePersonal = await this.getById(
              personalServidor.Id_Personal_Administrativo
            );

            // Get a fresh store for each operation
            const store = await IndexedDBConnection.getStore(
              this.nombreTablaLocal,
              "readwrite"
            );

            // Execute the put operation
            await new Promise<void>((resolve, reject) => {
              const request = store.put(personalServidor);

              request.onsuccess = () => {
                if (existePersonal) {
                  result.updated++;
                } else {
                  result.created++;
                }
                resolve();
              };

              request.onerror = () => {
                result.errors++;
                console.error(
                  `Error saving administrative staff ${personalServidor.Id_Personal_Administrativo}:`,
                  request.error
                );
                reject(request.error);
              };
            });
          } catch (error) {
            result.errors++;
            console.error(
              `Error processing administrative staff ${personalServidor.Id_Personal_Administrativo}:`,
              error
            );
          }
        }

        // Give the event loop a little break between batches
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
   * Gets an administrative staff member by their DNI
   * @param dni DNI of the administrative staff
   * @returns Found administrative staff or null
   */
  public async getById(
    dni: string
  ): Promise<IPersonalAdministrativoLocal | null> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<IPersonalAdministrativoLocal | null>(
        (resolve, reject) => {
          const request = store.get(dni);

          request.onsuccess = () => {
            resolve(request.result || null);
          };

          request.onerror = () => {
            reject(request.error);
          };
        }
      );
    } catch (error) {
      console.error(
        `Error getting administrative staff with DNI ${dni}:`,
        error
      );
      this.handleIndexedDBError(
        error,
        `get administrative staff with DNI ${dni}`
      );
      return null;
    }
  }

  /**
   * Gets administrative staff by position
   * @param cargo Position of the administrative staff
   * @returns Array with the administrative staff that match the position
   */
  public async getByCargo(
    cargo: string
  ): Promise<IPersonalAdministrativoLocal[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);
      const index = store.index("by_position");

      return new Promise<IPersonalAdministrativoLocal[]>((resolve, reject) => {
        const request = index.getAll(cargo);

        request.onsuccess = () => {
          resolve(request.result as IPersonalAdministrativoLocal[]);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `Error getting administrative staff with position ${cargo}:`,
        error
      );
      this.handleIndexedDBError(
        error,
        `get administrative staff with position ${cargo}`
      );
      return [];
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

    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
    });
  }
}
