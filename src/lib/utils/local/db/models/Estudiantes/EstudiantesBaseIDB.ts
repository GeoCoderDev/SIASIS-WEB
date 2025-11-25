// ============================================================================
// Base class for student management (NOT ABSTRACT)
// ============================================================================

import {
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
import { T_Estudiantes } from "@prisma/client";
import IndexedDBConnection from "../../IndexedDBConnection";
import ultimaActualizacionTablasLocalesIDB from "../UltimaActualizacionTablasLocalesIDB";
import AllErrorTypes, {
  DataConflictErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "@/interfaces/shared/errors";

// Filters for search based on the base attributes of T_Estudiantes
export interface IEstudianteBaseFilter {
  Id_Estudiante?: string;
  Nombres?: string;
  Apellidos?: string;
  Estado?: boolean;
  Id_Aula?: string;
}

/**
 * Base class for student management (NOW CONCRETE)
 * All roles store students in the common "estudiantes" table
 * The methods here work only with the base attributes of the T_Estudiantes interface
 * Child classes can override the methods as needed
 */
export class BaseEstudiantesIDB<T extends T_Estudiantes = T_Estudiantes> {
  // Common table for all roles
  protected readonly tablaEstudiantes: string = "estudiantes";
  protected readonly tablaInfo: ITablaInfo = TablasSistema.ESTUDIANTES;

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
   * Requests students from the API - default implementation
   * Child classes MUST override this method for real functionality
   */
  protected async solicitarEstudiantesDesdeAPI(): Promise<T[]> {
    if (!this.isSyncEnabled) {
      console.warn(
        "solicitarEstudiantesDesdeAPI: Synchronization disabled - returning empty array"
      );
      return [];
    }

    console.warn(
      "solicitarEstudiantesDesdeAPI not implemented in base class. " +
        "Child classes must override this method for specific functionality."
    );
    return [];
  }

  /**
   * Updates students from a specific subset only if the local data is older than the server's retrieval date
   * @param filtro Filter that identifies the subset of students to be completely replaced
   * @param estudiantes List of students obtained from the server that meet the filter
   * @param fechaObtenciones Date in UTC timestamp string format of when this data was obtained from the server
   * @returns Promise that resolves with the result of the operation or null if no update is needed
   */
  public async actualizarSiEsNecesario(
    filtro: IEstudianteBaseFilter,
    estudiantes: T[],
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
          "Synchronization disabled - updating directly without checking server dates"
        );
        const result = await this.upsertFromServerWithFilter(
          filtro,
          estudiantes
        );

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
          "No local update registered, proceeding with updating filtered students"
        );
        const result = await this.upsertFromServerWithFilter(
          filtro,
          estudiantes
        );

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
          `Updating students with filter [${filtroStr}]: local data (${new Date(
            fechaActualizacionLocal
          ).toLocaleString()}) is older than server data (${new Date(
            fechaObtencionsTimestamp
          ).toLocaleString()})`
        );

        const result = await this.upsertFromServerWithFilter(
          filtro,
          estudiantes
        );

        await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
          this.tablaInfo.nombreLocal as TablasLocal,
          DatabaseModificationOperations.UPDATE
        );

        console.log(
          `Student update completed with filter [${filtroStr}]: ${estudiantes.length} students processed (${result.created} created, ${result.updated} updated, ${result.deleted} deleted, ${result.errors} errors)`
        );

        return { ...result, wasUpdated: true };
      } else {
        const filtroStr = this.filtroToString(filtro);
        console.log(
          `No need to update students with filter [${filtroStr}]: local data (${new Date(
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
        "Error checking if it is necessary to update students:",
        error
      );
      this.handleSyncError(error);
      return null;
    }
  }

  /**
   * Gets a student by their ID - SIMPLE as AuxiliaresIDB
   */
  public async getEstudiantePorId(idEstudiante: string): Promise<T | null> {
    try {
      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      return new Promise<T | null>((resolve, reject) => {
        const request = store.get(idEstudiante);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(
        `Error getting student with ID ${idEstudiante}:`,
        error
      );
      this.handleIndexedDBError(
        error,
        `get student with ID ${idEstudiante}`
      );
      return null;
    }
  }

  /**
   * Gets all students WITH automatic SYNC
   */
  public async getTodosLosEstudiantes(
    includeInactive: boolean = false
  ): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // SIMPLE: Just execute sync before querying
      if (this.isSyncEnabled) {
        await this.sync();
      }

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<T[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as T[]);
        request.onerror = () => reject(request.error);
      });

      const estudiantes = includeInactive
        ? result
        : result.filter((est) => est.Estado === true);

      if (estudiantes.length > 0) {
        this.handleSuccess(`Found ${estudiantes.length} students`);
      } else {
        this.handleSuccess("No students found");
      }

      this.setIsSomethingLoading?.(false);
      return estudiantes;
    } catch (error) {
      this.handleIndexedDBError(error, "get all students");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Searches for students by name WITH automatic SYNC
   */
  public async buscarPorNombre(
    nombreBusqueda: string,
    includeInactive: boolean = false
  ): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);

    try {
      // SIMPLE: Just execute sync before querying
      if (this.isSyncEnabled) {
        await this.sync();
      }

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<T[]>((resolve, reject) => {
        const estudiantes: T[] = [];
        const request = store.openCursor();
        const busquedaLower = nombreBusqueda.toLowerCase();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value as T;

            if (!includeInactive && !estudiante.Estado) {
              cursor.continue();
              return;
            }

            const nombreCompleto =
              `${estudiante.Nombres} ${estudiante.Apellidos}`.toLowerCase();
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
        this.handleSuccess(
          `Found ${result.length} students with "${nombreBusqueda}"`
        );
      } else {
        this.handleSuccess(
          `No students found with "${nombreBusqueda}"`
        );
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "search students by name");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Filters students by status (active/inactive)
   * @param estado Status to filter (true = active, false = inactive)
   * @returns Array of students with the specified status
   */
  public async filtrarPorEstado(estado: boolean): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);

    try {
      // Only synchronize if enabled
      if (this.isSyncEnabled) {
        await this.sync();
      } else {
        console.log(
          "filtrarPorEstado: Synchronization disabled, filtering local data only"
        );
      }

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<T[]>((resolve, reject) => {
        const estudiantes: T[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
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

      const estadoTexto = estado ? "active" : "inactive";
      if (result.length > 0) {
        this.handleSuccess(
          `Found ${result.length} ${estadoTexto} students`
        );
      } else {
        this.handleSuccess(`No ${estadoTexto} students found`);
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "filter students by status");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Filters students by classroom
   * @param idAula Classroom ID
   * @param includeInactive If to include inactive students
   * @returns Array of students from the specified classroom
   */
  public async filtrarPorAula(
    idAula: string,
    includeInactive: boolean = false
  ): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);

    try {
      // Only synchronize if enabled
      if (this.isSyncEnabled) {
        await this.sync();
      } else {
        console.log(
          "filterByClassroom: Synchronization disabled, filtering local data only"
        );
      }

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<T[]>((resolve, reject) => {
        const estudiantes: T[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value as T;

            // Filter by classroom and status
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
        this.handleSuccess(
          `Found ${result.length} students in classroom ${idAula}`
        );
      } else {
        this.handleSuccess(
          `No students found in classroom ${idAula}`
        );
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `filter students by classroom ${idAula}`
      );
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Searches for students by applying multiple filters based on T_Estudiantes
   * @param filtros Filters based on base attributes
   * @param includeInactive If to include inactive students
   * @returns Array of students that meet all filters
   */
  public async buscarConFiltros(
    filtros: IEstudianteBaseFilter,
    includeInactive: boolean = false
  ): Promise<T[]> {
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

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<T[]>((resolve, reject) => {
        const estudiantes: T[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value as T;
            let cumpleFiltros = true;

            // Filter by status if not including inactive
            if (!includeInactive && !estudiante.Estado) {
              cursor.continue();
              return;
            }

            // Apply specific filters
            if (
              filtros.Id_Estudiante &&
              estudiante.Id_Estudiante !== filtros.Id_Estudiante
            ) {
              cumpleFiltros = false;
            }
            if (
              filtros.Nombres &&
              !estudiante.Nombres.toLowerCase().includes(
                filtros.Nombres.toLowerCase()
              )
            ) {
              cumpleFiltros = false;
            }
            if (
              filtros.Apellidos &&
              !estudiante.Apellidos.toLowerCase().includes(
                filtros.Apellidos.toLowerCase()
              )
            ) {
              cumpleFiltros = false;
            }
            if (
              filtros.Estado !== undefined &&
              estudiante.Estado !== filtros.Estado
            ) {
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
        this.handleSuccess(
          `Found ${result.length} students with the applied filters`
        );
      } else {
        this.handleSuccess(
          "No students found with the applied filters"
        );
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "search students with filters");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Counts the total number of students in the table
   * @param includeInactive If to include inactive students in the count
   * @returns Total number of students
   */
  public async contarEstudiantes(
    includeInactive: boolean = false
  ): Promise<number> {
    try {
      // Only synchronize if enabled
      if (this.isSyncEnabled) {
        await this.sync();
      } else {
        console.log(
          "countStudents: Synchronization disabled, counting local data only"
        );
      }

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      return new Promise<number>((resolve, reject) => {
        let contador = 0;
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
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
      console.error("Error counting students:", error);
      this.handleIndexedDBError(error, "count students");
      return 0;
    }
  }

  /**
   * Updates or creates students in batch from the server using filters for specific replacement
   * Improved method that completely replaces the subset that meets the filter
   */
  protected async upsertFromServerWithFilter(
    filtro: IEstudianteBaseFilter,
    estudiantesServidor: T[]
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  }> {
    const result = { created: 0, updated: 0, deleted: 0, errors: 0 };

    try {
      // 1. Get local students that meet the filter
      const estudiantesLocalesFiltrados =
        await this.getEstudiantesQueCumplenFiltro(filtro);
      const idsLocalesFiltrados = new Set(
        estudiantesLocalesFiltrados.map((est) => est.Id_Estudiante)
      );

      // 2. Get student IDs from the server
      const idsServidor = new Set(
        estudiantesServidor.map((est) => est.Id_Estudiante)
      );

      // 3. Identify local students that should be deleted
      // (meet the filter but are no longer in the server data)
      const idsAEliminar = Array.from(idsLocalesFiltrados).filter(
        (id) => !idsServidor.has(id)
      );

      // 4. Delete obsolete records from the filtered subset
      for (const id of idsAEliminar) {
        try {
          await this.deleteById(id);
          result.deleted++;
        } catch (error) {
          console.error(`Error deleting student ${id}:`, error);
          result.errors++;
        }
      }

      // 5. Process server students in batches
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
                  `Error saving student ${estudianteServidor.Id_Estudiante}:`,
                  request.error
                );
                reject(request.error);
              };
            });
          } catch (error) {
            result.errors++;
            console.error(
              `Error processing student ${estudianteServidor.Id_Estudiante}:`,
              error
            );
          }
        }

        // Give the event loop a break
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
   * Gets local students that meet a specific filter
   */
  private async getEstudiantesQueCumplenFiltro(
    filtro: IEstudianteBaseFilter
  ): Promise<T[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      return new Promise<T[]>((resolve, reject) => {
        const estudiantesFiltrados: T[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value as T;
            let cumpleFiltro = true;

            // Apply specific filters (only those that are defined)
            if (
              filtro.Id_Estudiante &&
              estudiante.Id_Estudiante !== filtro.Id_Estudiante
            ) {
              cumpleFiltro = false;
            }
            if (
              filtro.Nombres &&
              !estudiante.Nombres.toLowerCase().includes(
                filtro.Nombres.toLowerCase()
              )
            ) {
              cumpleFiltro = false;
            }
            if (
              filtros.Apellidos &&
              !estudiante.Apellidos.toLowerCase().includes(
                filtros.Apellidos.toLowerCase()
              )
            ) {
              cumpleFiltro = false;
            }
            if (
              filtro.Estado !== undefined &&
              estudiante.Estado !== filtro.Estado
            ) {
              cumpleFiltro = false;
            }
            if (filtro.Id_Aula && estudiante.Id_Aula !== filtro.Id_Aula) {
              cumpleFiltro = false;
            }

            if (cumpleFiltro) {
              estudiantesFiltrados.push(estudiante);
            }
            cursor.continue();
          } else {
            resolve(estudiantesFiltrados);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error getting students that meet filter:", error);
      throw error;
    }
  }

  /**
   * Converts a filter into a readable string for logs
   */
  private filtroToString(filtro: IEstudianteBaseFilter): string {
    const partes: string[] = [];

    if (filtro.Id_Estudiante) partes.push(`ID: ${filtro.Id_Estudiante}`);
    if (filtro.Nombres) partes.push(`Nombres: ${filtro.Nombres}`);
    if (filtro.Apellidos) partes.push(`Apellidos: ${filtro.Apellidos}`);
    if (filtro.Estado !== undefined)
      partes.push(`Estado: ${filtro.Estado ? "Active" : "Inactive"}`);
    if (filtro.Id_Aula) partes.push(`Classroom: ${filtro.Id_Aula}`);

    return partes.length > 0 ? partes.join(", ") : "No filters";
  }

  /**
   * Gets all student IDs in the table
   * @returns Array of student IDs
   */
  protected async getAllIds(): Promise<string[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      return new Promise<string[]>((resolve, reject) => {
        const ids: string[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
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
      console.error("Error getting all student IDs:", error);
      throw error;
    }
  }

  /**
   * Deletes a student by their ID
   * @param idEstudiante ID of the student to delete
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
      console.error(
        `Error deleting student with ID ${idEstudiante}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Updates or creates students in batch from the server
   * Common method that all child classes can use
   */
  protected async upsertFromServer(estudiantesServidor: T[]): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  }> {
    const result = { created: 0, updated: 0, deleted: 0, errors: 0 };

    try {
      // Get current IDs in the table
      const idsLocales = await this.getAllIds();
      const idsServidor = new Set(
        estudiantesServidor.map((est) => est.Id_Estudiante)
      );

      // Identify students that no longer exist on the server
      const idsAEliminar = idsLocales.filter((id) => !idsServidor.has(id));

      // Delete obsolete records
      for (const id of idsAEliminar) {
        try {
          await this.deleteById(id);
          result.deleted++;
        } catch (error) {
          console.error(`Error deleting student ${id}:`, error);
          result.errors++;
        }
      }

      // Process students in batches
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
                  `Error saving student ${estudianteServidor.Id_Estudiante}:`,
                  request.error
                );
                reject(request.error);
              };
            });
          } catch (error) {
            result.errors++;
            console.error(
              `Error processing student ${estudianteServidor.Id_Estudiante}:`,
              error
            );
          }
        }

        // Give the event loop a break
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
   * Standard synchronization handling using comprobarSincronizacionDeTabla
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

      console.log(
        "%cMUST SYNCHRONIZE STUDENT MODEL",
        "font-size:1.3rem; color:cyan"
      );
      const estudiantes = await this.solicitarEstudiantesDesdeAPI();
      const result = await this.upsertFromServer(estudiantes);

      await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
        this.tablaInfo.nombreLocal as TablasLocal,
        DatabaseModificationOperations.UPDATE
      );

      console.log(
        `Student synchronization completed: ${estudiantes.length} students processed (${result.created} created, ${result.updated} updated, ${result.deleted} deleted, ${result.errors} errors)`
      );
    } catch (error) {
      console.error("Error during student synchronization:", error);
      this.handleSyncError(error);
    }
  }

  /**
   * Synchronization error handling - can be overridden by child classes
   * @param error Error captured during synchronization
   */
  protected async handleSyncError(error: unknown): Promise<void> {
    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = "Error synchronizing students";

    if (error instanceof Error) {
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = "Network error synchronizing students";
      } else if (error.message.includes("get students")) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = error.message;
      } else if (
        error.name === "TransactionInactiveError" ||
        error.name === "QuotaExceededError"
      ) {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = "Database error synchronizing students";
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
