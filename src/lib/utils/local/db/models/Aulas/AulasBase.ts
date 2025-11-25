// ============================================================================
// Base class for classroom management (NOT ABSTRACT)
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
import { T_Aulas, T_Estudiantes } from "@prisma/client";
import { EstudianteConAula } from "@/interfaces/shared/Estudiantes";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";

// Basic filters for search
export interface IAulaBaseFilter {
  Id_Aula?: string;
  Nivel?: string;
  Grado?: number;
  Seccion?: string;
}

/**
 * Base class for classroom management (NOW CONCRETE)
 * All roles store classrooms in the common "aulas" table
 * Child classes can override the methods as needed
 */
export class BaseAulasIDB<T extends T_Aulas = T_Aulas> {
  // Common table for all roles
  protected readonly tablaAulas: string = "aulas";
  protected readonly tablaInfo: ITablaInfo = TablasSistema.AULAS;

  constructor(
    protected siasisAPI?: SiasisAPIS | SiasisAPIS[],
    protected setIsSomethingLoading?: (isLoading: boolean) => void,
    protected setError?: (error: ErrorResponseAPIBase | null) => void,
    protected setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Checks if synchronization is enabled for this instance
   * @returns true if at least one API is configured, false otherwise
   */
  protected get isSyncEnabled(): boolean {
    return this.siasisAPI !== undefined;
  }

  /**
   * Methods that child classes can override as needed
   * Now have default implementations to allow direct use of the base class
   */

  /**
   * Default synchronization - uses standard synchronization
   * Child classes can override this method for specific logic
   */
  protected async sync(): Promise<void> {
    // If no API is configured, do not synchronize
    if (!this.isSyncEnabled) {
      console.log(
        "Synchronization disabled for this instance - siasisAPI is undefined"
      );
      return;
    }

    await this.syncronizacionEstandar();
  }

  /**
   * Gets the default endpoint - empty implementation
   * Child classes can override this method as needed
   */
  protected getEndpoint(): string {
    console.warn(
      "getEndpoint not implemented in base class. " +
        "Child classes can override this method if they need a specific endpoint."
    );
    return "";
  }

  /**
   * Requests classrooms from the API - default implementation
   * Child classes MUST override this method for real functionality
   */
  protected async solicitarAulasDesdeAPI(idsAulas?: string[]): Promise<T[]> {
    if (!this.isSyncEnabled) {
      console.warn(
        "solicitarAulasDesdeAPI: Synchronization disabled - returning empty array"
      );
      return [];
    }

    console.warn(
      "solicitarAulasDesdeAPI not implemented in base class. " +
        "Child classes must override this method for specific functionality."
    );
    return [];
  }

  /**
   * Updates classrooms of a specific subset only if the local data is older than the server's retrieval date
   * @param filtro Filter that identifies the subset of classrooms to be completely replaced
   * @param aulas List of classrooms obtained from the server that meet the filter
   * @param fechaObtenciones Date in UTC timestamp string format of when this data was obtained from the server
   * @returns Promise that resolves with the result of the operation or null if no update is needed
   */
  public async actualizarSiEsNecesario(
    filtro: IAulaBaseFilter,
    aulas: T[],
    fechaObtenciones: string
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: number;
    wasUpdated: boolean;
  } | null> {
    try {
      // If no API is configured, proceed directly with the update without checking dates
      if (!this.isSyncEnabled) {
        console.log(
          "Synchronization disabled - updating classrooms directly without checking server dates"
        );
        const result = await this.upsertFromServerWithFilter(filtro, aulas);

        // Register the local update even without sync enabled
        await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
          this.tablaInfo.nombreLocal as TablasLocal,
          DatabaseModificationOperations.UPDATE
        );

        return { ...result, wasUpdated: true };
      }

      // Get the last local update
      const ultimaActualizacionLocal =
        await ultimaActualizacionTablasLocalesIDB.getByTabla(
          this.tablaInfo.nombreLocal as TablasLocal
        );

      // Convert the server data obtaining date to a timestamp
      const fechaObtencionsTimestamp = new Date(fechaObtenciones).getTime();

      // If there is no local update, proceed with the update
      if (!ultimaActualizacionLocal) {
        console.log(
          "No local update registered, proceeding with updating filtered classrooms"
        );
        const result = await this.upsertFromServerWithFilter(filtro, aulas);

        await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
          this.tablaInfo.nombreLocal as TablasLocal,
          DatabaseModificationOperations.UPDATE
        );

        return { ...result, wasUpdated: true };
      }

      // Convert the local update date to a timestamp
      const fechaActualizacionLocal =
        typeof ultimaActualizacionLocal.Fecha_Actualizacion === "number"
          ? ultimaActualizacionLocal.Fecha_Actualizacion
          : new Date(ultimaActualizacionLocal.Fecha_Actualizacion).getTime();

      // Compare dates: if the local update is older than the server data obtaining date, update
      if (fechaActualizacionLocal < fechaObtencionsTimestamp) {
        const filtroStr = this.filtroToString(filtro);
        console.log(
          `Updating classrooms with filter [${filtroStr}]: local data (${new Date(
            fechaActualizacionLocal
          ).toLocaleString()}) is older than server data (${new Date(
            fechaObtencionsTimestamp
          ).toLocaleString()})`
        );

        const result = await this.upsertFromServerWithFilter(filtro, aulas);

        await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
          this.tablaInfo.nombreLocal as TablasLocal,
          DatabaseModificationOperations.UPDATE
        );

        console.log(
          `Classroom update completed with filter [${filtroStr}]: ${aulas.length} classrooms processed (${result.created} created, ${result.updated} updated, ${result.deleted} deleted, ${result.errors} errors)`
        );

        return { ...result, wasUpdated: true };
      } else {
        const filtroStr = this.filtroToString(filtro);
        console.log(
          `No need to update classrooms with filter [${filtroStr}]: local data (${new Date(
            fechaActualizacionLocal
          ).toLocaleString()}) is more recent than server data (${new Date(
            fechaObtencionsTimestamp
          ).toLocaleString()})`
        );

        return {
          created: 0,
          updated: 0,
          deleted: 0,
          errors: 0,
          wasUpdated: false,
        };
      }
    } catch (error) {
      console.error(
        "Error checking if it is necessary to update classrooms:",
        error
      );
      this.handleSyncError(error);
      return null;
    }
  }

  /**
   * Gets a classroom by its ID from the common table
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
      console.error(`Error getting classroom with ID ${idAula}:`, error);
      this.handleIndexedDBError(error, `get classroom with ID ${idAula}`);
      return null;
    }
  }

  /**
   * Gets multiple classrooms by their IDs
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
      console.error("Error getting classrooms by IDs:", error);
      this.handleIndexedDBError(error, "get classrooms by IDs");
      return [];
    }
  }

  public async obtenerEstudianteConAula(
    estudiante: T_Estudiantes
  ): Promise<EstudianteConAula | null> {
    if (!estudiante || !estudiante.Id_Aula) return null;

    const aula = await this.getAulaPorId(estudiante.Id_Aula!);
    if (!aula) return null;

    return {
      Id_Estudiante: estudiante.Id_Estudiante,
      Nombres: estudiante.Nombres,
      Apellidos: estudiante.Apellidos,
      Estado: estudiante.Estado,
      Google_Drive_Foto_ID: estudiante.Google_Drive_Foto_ID,
      aula: aula,
    };
  }

  /**
   * Gets all classrooms from the common table
   */
  public async getTodasLasAulas(): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // Only synchronize if enabled
      if (this.isSyncEnabled) {
        await this.sync();
      } else {
        console.log(
          "getTodasLasAulas: Synchronization disabled, getting local data only"
        );
      }

      const store = await IndexedDBConnection.getStore(this.tablaAulas);

      const result = await new Promise<T[]>((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });

      if (result.length > 0) {
        this.handleSuccess(`Found ${result.length} classrooms`);
      } else {
        this.handleSuccess("No classrooms found");
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "get all classrooms");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Gets the available sections for a specific level and grade
   * @param nivel Educational level ("PRIMARY" or "SECONDARY")
   * @param grado Grade (1-6 for primary, 1-5 for secondary)
   * @returns Promise<string[]> Array with the available sections sorted alphabetically
   */
  public async getSeccionesPorNivelYGrado(
    nivel: NivelEducativo,
    grado: number
  ): Promise<string[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.tablaAulas);

      return new Promise<string[]>((resolve, reject) => {
        const secciones = new Set<string>();
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const aula = cursor.value as T;

            // Check that level and grade match
            if (aula.Nivel == nivel && aula.Grado == grado) {
              secciones.add(aula.Seccion);
            }

            cursor.continue();
          } else {
            // Convert Set to Array and sort alphabetically
            const seccionesArray = Array.from(secciones).sort();
            resolve(seccionesArray);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(
        `Error getting sections for ${nivel} - Grade ${grado}:`,
        error
      );
      this.handleIndexedDBError(
        error,
        `get sections for ${nivel} - Grade ${grado}`
      );
      return [];
    }
  }

  /**
   * Searches for classrooms with basic filters
   */
  public async buscarConFiltros(filtros: IAulaBaseFilter): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);

    try {
      // Only synchronize if enabled
      if (this.isSyncEnabled) {
        await this.sync();
      } else {
        console.log(
          "searchWithFilters: Synchronization disabled, searching local data only"
        );
      }

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

            // Apply basic filters
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
          `Found ${result.length} classrooms with the applied filters`
        );
      } else {
        this.handleSuccess("No classrooms found with the applied filters");
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "search classrooms with filters");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Deletes a classroom by its ID
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
      console.error(`Error deleting classroom with ID ${idAula}:`, error);
      throw error;
    }
  }

  /**
   * Updates or creates classrooms in batch from the server using filters for specific replacement
   * Improved method that completely replaces the subset that meets the filter
   */
  protected async upsertFromServerWithFilter(
    filtro: IAulaBaseFilter,
    aulasServidor: T[]
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  }> {
    const result = { created: 0, updated: 0, deleted: 0, errors: 0 };

    try {
      // 1. Get local classrooms that meet the filter
      const aulasLocalesFiltradas = await this.getAulasQueCumplenFiltro(filtro);
      const idsLocalesFiltradas = new Set(
        aulasLocalesFiltradas.map((aula) => aula.Id_Aula)
      );

      // 2. Get classroom IDs from the server
      const idsServidor = new Set(aulasServidor.map((aula) => aula.Id_Aula));

      // 3. Identify local classrooms that should be deleted
      // (meet the filter but are no longer in the server data)
      const idsAEliminar = Array.from(idsLocalesFiltradas).filter(
        (id) => !idsServidor.has(id)
      );

      // 4. Delete obsolete records from the filtered subset
      for (const id of idsAEliminar) {
        try {
          await this.deleteById(id);
          result.deleted++;
        } catch (error) {
          console.error(`Error deleting classroom ${id}:`, error);
          result.errors++;
        }
      }

      // 5. Process server classrooms in batches
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
                  `Error saving classroom ${aulaServidor.Id_Aula}:`,
                  request.error
                );
                reject(request.error);
              };
            });
          } catch (error) {
            result.errors++;
            console.error(
              `Error processing classroom ${aulaServidor.Id_Aula}:`,
              error
            );
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      return result;
    } catch (error) {
      console.error("Error in upsertFromServerWithFilter operation:", error);
      result.errors++;
      return result;
    }
  }

  /**
   * Gets local classrooms that meet a specific filter
   */
  private async getAulasQueCumplenFiltro(
    filtro: IAulaBaseFilter
  ): Promise<T[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.tablaAulas);

      return new Promise<T[]>((resolve, reject) => {
        const aulasFiltradas: T[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            const aula = cursor.value as T;
            let cumpleFiltro = true;

            // Apply specific filters (only those that are defined)
            if (filtro.Id_Aula && aula.Id_Aula !== filtro.Id_Aula) {
              cumpleFiltro = false;
            }
            if (filtro.Nivel && aula.Nivel !== filtro.Nivel) {
              cumpleFiltro = false;
            }
            if (filtro.Grado !== undefined && aula.Grado !== filtro.Grado) {
              cumpleFiltro = false;
            }
            if (filtro.Seccion && aula.Seccion !== filtro.Seccion) {
              cumpleFiltro = false;
            }

            if (cumpleFiltro) {
              aulasFiltradas.push(aula);
            }
            cursor.continue();
          } else {
            resolve(aulasFiltradas);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error getting classrooms that meet filter:", error);
      throw error;
    }
  }

  /**
   * Converts a filter into a readable string for logs
   */
  private filtroToString(filtro: IAulaBaseFilter): string {
    const partes: string[] = [];

    if (filtro.Id_Aula) partes.push(`ID: ${filtro.Id_Aula}`);
    if (filtro.Nivel) partes.push(`Level: ${filtro.Nivel}`);
    if (filtro.Grado !== undefined) partes.push(`Grade: ${filtro.Grado}`);
    if (filtro.Seccion) partes.push(`Section: ${filtro.Seccion}`);

    return partes.length > 0 ? partes.join(", ") : "No filters";
  }

  /**
   * Updates or creates classrooms in batch from the server
   */
  protected async upsertFromServer(aulasServidor: T[]): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  }> {
    const result = { created: 0, updated: 0, deleted: 0, errors: 0 };

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
                  `Error saving classroom ${aulaServidor.Id_Aula}:`,
                  request.error
                );
                reject(request.error);
              };
            });
          } catch (error) {
            result.errors++;
            console.error(
              `Error processing classroom ${aulaServidor.Id_Aula}:`,
              error
            );
          }
        }

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
   * Standard synchronization for other classes (not guardians)
   */
  protected async syncronizacionEstandar(): Promise<void> {
    // If no API is configured, do not synchronize
    if (!this.isSyncEnabled) {
      console.log(
        "syncronizacionEstandar: Synchronization disabled - siasisAPI is undefined"
      );
      return;
    }

    try {
      const debeSincronizar = await comprobarSincronizacionDeTabla(
        this.tablaInfo,
        this.siasisAPI!
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
        `Classroom synchronization completed: ${aulas.length} classrooms processed (${result.created} created, ${result.updated} updated, ${result.errors} errors)`
      );
    } catch (error) {
      console.error("Error during classroom synchronization:", error);
      await this.handleSyncError(error);
    }
  }

  /**
   * Synchronization error handling
   */
  protected async handleSyncError(error: unknown): Promise<void> {
    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = "Error synchronizing classrooms";

    if (error instanceof Error) {
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = "Network error synchronizing classrooms";
      } else if (error.message.includes("get classrooms")) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = error.message;
      } else if (
        error.name === "TransactionInactiveError" ||
        error.name === "QuotaExceededError"
      ) {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = "Database error synchronizing classrooms";
      } else {
        message = error.message;
      }
    }

    this.setError?.({
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
   * Sets a success message
   */
  protected handleSuccess(message: string): void {
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
        origen: `${this.constructor.name}.${operacion}`,
        timestamp: Date.now(),
      },
    });
  }
}