// ============================================================================
// Specific implementation for guardians
// ============================================================================

import {
  BaseEstudiantesIDB,
  IEstudianteBaseFilter,
} from "./EstudiantesBaseIDB";
import IndexedDBConnection from "../../IndexedDBConnection";
import AllErrorTypes, { SystemErrorTypes } from "@/interfaces/shared/errors";
import { Endpoint_Get_MisEstudiantesRelacionados_API02 } from "@/lib/utils/backend/endpoints/api02/Estudiantes";
import { EstudianteDelResponsable } from "@/interfaces/shared/Estudiantes";

// Specific filters for guardian students (extends base filters)
export interface IEstudianteResponsableFilter extends IEstudianteBaseFilter {
  Tipo_Relacion?: string;
}

/**
 * Specific student management for guardians (parents)
 * Inherits from BaseEstudiantesIDB and stores in the common "estudiantes" table
 * Adds specific functionalities for the Tipo_Relacion attribute
 */
export class EstudiantesParaResponsablesIDB extends BaseEstudiantesIDB<EstudianteDelResponsable> {
  /**
   * Specific synchronization for guardians
   * Synchronizes only the students related to the authenticated guardian
   * If there are no related students, logs out with an error
   */
  protected async sync(): Promise<void> {
    try {
      // Get students from the API with automatic authentication
      const estudiantes = await this.solicitarEstudiantesDesdeAPI();

      // If there are no related students, the guardian does not have valid data
      if (estudiantes.length === 0) {
        console.warn(
          "Guardian without related students - logging out"
        );

        // Dynamically import logout to avoid circular dependencies
        const { logout } = await import("@/lib/utils/frontend/auth/logout");
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");

        await logout(LogoutTypes.ERROR_DATOS_NO_DISPONIBLES, {
          codigo: "GUARDIAN_WITHOUT_STUDENTS",
          origen: "EstudiantesParaResponsablesIDB.sync",
          mensaje: "The guardian has no related students",
          timestamp: Date.now(),
          contexto: "Synchronization of guardian's students",
          siasisComponent: this.siasisAPI,
        });

        return; // Do not continue execution
      }

      // Clear the previous guardian's students before synchronizing
      await this.limpiarEstudiantesDelResponsableCompleto();

      // Use the inherited method to store in the common table
      // This will completely replace the guardian's students
      const result = await this.upsertEstudiantesResponsableCompleto(
        estudiantes
      );

      console.log(
        `Guardian's student synchronization completed: ${estudiantes.length} students processed (${result.created} created, ${result.updated} updated, ${result.deleted} deleted, ${result.errors} errors)`
      );
    } catch (error) {
      console.error(
        "Error during guardian's student synchronization:",
        error
      );
      await this.handleSyncError(error);
    }
  }

  /**
   * Completely clears all of the guardian's students from the common table
   * This ensures that no obsolete data remains
   */
  private async limpiarEstudiantesDelResponsableCompleto(): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.tablaEstudiantes,
        "readwrite"
      );

      const estudiantesAEliminar: string[] = [];

      // Identify all students with Tipo_Relacion (from the guardian)
      await new Promise<void>((resolve, reject) => {
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value;
            if (estudiante.Tipo_Relacion) {
              estudiantesAEliminar.push(estudiante.Id_Estudiante);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });

      // Delete all identified students
      for (const id of estudiantesAEliminar) {
        await this.deleteById(id);
      }

      console.log(
        `Deleted ${estudiantesAEliminar.length} students from the previous guardian`
      );
    } catch (error) {
      console.error("Error clearing guardian's students:", error);
      throw error;
    }
  }

  /**
   * Completely updates the guardian's students in the common table
   * This ensures that the cache exactly reflects what comes from the server
   */
  private async upsertEstudiantesResponsableCompleto(
    estudiantes: EstudianteDelResponsable[]
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  }> {
    const result = { created: 0, updated: 0, deleted: 0, errors: 0 };

    try {
      // Process students in batches
      const BATCH_SIZE = 20;

      for (let i = 0; i < estudiantes.length; i += BATCH_SIZE) {
        const lote = estudiantes.slice(i, i + BATCH_SIZE);

        for (const estudianteServidor of lote) {
          try {
            // Check if the student already exists
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
      console.error(
        "Error in upsertEstudiantesResponsableCompleto operation:",
        error
      );
      result.errors++;
      return result;
    }
  }

  /**
   * Specific handling of synchronization errors for guardians
   * Overwrites the base method to include logout logic
   */
  protected async handleSyncError(error: unknown): Promise<void> {
    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = "Error synchronizing guardian's students";
    let shouldLogout = false;
    let logoutType: any = null;

    if (error instanceof Error) {
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = "Network error synchronizing guardian's students";
        shouldLogout = true;
        // Dynamically import to avoid circular dependencies
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");
        logoutType = LogoutTypes.ERROR_RED;
      } else if (error.message.includes("get students")) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = error.message;
        shouldLogout = true;
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");
        logoutType = LogoutTypes.ERROR_SINCRONIZACION;
      } else if (
        error.name === "TransactionInactiveError" ||
        error.name === "QuotaExceededError"
      ) {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message =
          "Database error synchronizing guardian's students";
        shouldLogout = true;
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");
        logoutType = LogoutTypes.ERROR_BASE_DATOS;
      } else {
        message = error.message;
        shouldLogout = true;
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");
        logoutType = LogoutTypes.ERROR_SINCRONIZACION;
      }
    }

    // Set error in state
    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
      details: {
        origen: "EstudiantesParaResponsablesIDB.sync",
        timestamp: Date.now(),
      },
    });

    // If it is a critical error, log out
    if (shouldLogout && logoutType) {
      console.error(
        "Critical error in synchronization - logging out:",
        error
      );

      try {
        const { logout } = await import("@/lib/utils/frontend/auth/logout");

        await logout(logoutType, {
          codigo: "SYNC_ERROR_GUARDIAN",
          origen: "EstudiantesParaResponsablesIDB.handleSyncError",
          mensaje: message,
          timestamp: Date.now(),
          contexto:
            "Error during guardian's student synchronization",
          siasisComponent: this.siasisAPI,
        });
      } catch (logoutError) {
        console.error(
          "Additional error when trying to log out:",
          logoutError
        );
        // Force page reload as a last resort
        window.location.reload();
      }
    }

    throw error;
  }

  /**
   * Gets students from the API (required by the abstract class)
   */
  protected async solicitarEstudiantesDesdeAPI(): Promise<
    EstudianteDelResponsable[]
  > {
    try {
      const { data: estudiantes } =
        await Endpoint_Get_MisEstudiantesRelacionados_API02.realizarPeticion();

      return estudiantes;
    } catch (error) {
      console.error("Error getting students from API:", error);
      throw error;
    }
  }

  /**
   * Gets and synchronizes students related to a specific guardian
   * Stores them in the common "estudiantes" table
   * @param forzarActualizacion If it should force a new query to the API
   * @returns Array of students related to the guardian
   */
  public async obtenerYSincronizarEstudiantesDelResponsable(
    forzarActualizacion: boolean = false
  ): Promise<EstudianteDelResponsable[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // If not forcing update, try to get from the common table
      // filtering by those with Tipo_Relacion (specific to the current guardian)
      if (!forzarActualizacion) {
        const estudiantesCacheados =
          await this.obtenerEstudiantesConTipoRelacion();
        if (estudiantesCacheados.length > 0) {
          this.handleSuccess(
            `Found ${estudiantesCacheados.length} students (from local cache)`
          );
          this.setIsSomethingLoading?.(false);
          return estudiantesCacheados;
        }
      }

      // Get from the API and store in the common table
      const estudiantes = await this.solicitarEstudiantesDesdeAPI();

      // Use the inherited method to store in the common table
      const result = await this.upsertFromServer(estudiantes);

      if (estudiantes.length > 0) {
        this.handleSuccess(
          `Synchronized ${estudiantes.length} related students (${result.created} new, ${result.updated} updated)`
        );
      } else {
        this.handleSuccess("No related students found");
      }

      this.setIsSomethingLoading?.(false);
      return estudiantes;
    } catch (error) {
      this.handleIndexedDBError(
        error,
        "get and synchronize guardian's students"
      );
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Gets students who have the Tipo_Relacion attribute from the common table
   * @returns Array of students with relationship type
   */
  private async obtenerEstudiantesConTipoRelacion(): Promise<
    EstudianteDelResponsable[]
  > {
    try {
      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      return new Promise<EstudianteDelResponsable[]>((resolve, reject) => {
        const estudiantes: EstudianteDelResponsable[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value;
            // Only include students who have the Tipo_Relacion attribute
            if (estudiante.Tipo_Relacion && estudiante.Estado === true) {
              estudiantes.push(estudiante as EstudianteDelResponsable);
            }
            cursor.continue();
          } else {
            resolve(estudiantes);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(
        "Error getting students with relationship type:",
        error
      );
      throw error;
    }
  }

  /**
   * Searches for guardian's students by specific relationship type
   * @param tipoRelacion Relationship type to filter ("HIJO" or "A_CARGO")
   * @param includeInactive If to include inactive students
   * @returns Array of students with the specified relationship type
   */
  public async filtrarPorTipoRelacion(
    tipoRelacion: string,
    includeInactive: boolean = false
  ): Promise<EstudianteDelResponsable[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);

    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<EstudianteDelResponsable[]>(
        (resolve, reject) => {
          const estudiantes: EstudianteDelResponsable[] = [];
          const request = store.openCursor();

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest)
              .result as IDBCursorWithValue;
            if (cursor) {
              const estudiante = cursor.value;

              // Filter by relationship type and status
              if (
                estudiante.Tipo_Relacion === tipoRelacion &&
                (includeInactive || estudiante.Estado === true)
              ) {
                estudiantes.push(estudiante as EstudianteDelResponsable);
              }
              cursor.continue();
            } else {
              resolve(estudiantes);
            }
          };

          request.onerror = () => reject(request.error);
        }
      );

      if (result.length > 0) {
        this.handleSuccess(
          `Found ${result.length} students with relationship "${tipoRelacion}"`
        );
      } else {
        this.handleSuccess(
          `No students found with relationship "${tipoRelacion}"`
        );
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "filter by relationship type");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Searches for students applying specific guardian filters
   * Extends the base functionality by adding filtering by Tipo_Relacion
   * @param filtros Specific filters for guardian's students
   * @param includeInactive If to include inactive students
   * @returns Array of students that meet the filters
   */
  public async buscarConFiltrosResponsable(
    filtros: IEstudianteResponsableFilter,
    includeInactive: boolean = false
  ): Promise<EstudianteDelResponsable[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);

    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      const result = await new Promise<EstudianteDelResponsable[]>(
        (resolve, reject) => {
          const estudiantes: EstudianteDelResponsable[] = [];
          const request = store.openCursor();

          request.onsuccess = (event) => {
            const cursor = (event.target as IDBRequest)
              .result as IDBCursorWithValue;
            if (cursor) {
              const estudiante = cursor.value;
              let cumpleFiltros = true;

              // Only consider students who have Tipo_Relacion
              if (!estudiante.Tipo_Relacion) {
                cursor.continue();
                return;
              }

              // Filter by status if not including inactive
              if (!includeInactive && !estudiante.Estado) {
                cursor.continue();
                return;
              }

              // Apply inherited base filters
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

              // Specific filter by relationship type
              if (
                filtros.Tipo_Relacion &&
                estudiante.Tipo_Relacion !== filtros.Tipo_Relacion
              ) {
                cumpleFiltros = false;
              }

              if (cumpleFiltros) {
                estudiantes.push(estudiante as EstudianteDelResponsable);
              }
              cursor.continue();
            } else {
              resolve(estudiantes);
            }
          };

          request.onerror = () => reject(request.error);
        }
      );

      if (result.length > 0) {
        this.handleSuccess(
          `Found ${result.length} students with the applied guardian filters`
        );
      } else {
        this.handleSuccess(
          "No students found with the applied guardian filters"
        );
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "search with guardian filters");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Gets only the guardian's children (Tipo_Relacion = "HIJO")
   * @param includeInactive If to include inactive students
   * @returns Array of students who are children
   */
  public async obtenerSoloHijos(
    includeInactive: boolean = false
  ): Promise<EstudianteDelResponsable[]> {
    return this.filtrarPorTipoRelacion("HIJO", includeInactive);
  }

  /**
   * Gets only the students in the guardian's care (Tipo_Relacion = "A_CARGO")
   * @param includeInactive If to include inactive students
   * @returns Array of students who are in care
   */
  public async obtenerSoloACargo(
    includeInactive: boolean = false
  ): Promise<EstudianteDelResponsable[]> {
    return this.filtrarPorTipoRelacion("A_CARGO", includeInactive);
  }

  /**
   * Counts guardian's students by relationship type
   * @param tipoRelacion Specific relationship type (optional)
   * @param includeInactive If to include inactive in the count
   * @returns Number of students with the specified relationship type
   */
  public async contarEstudiantesPorTipoRelacion(
    tipoRelacion?: string,
    includeInactive: boolean = false
  ): Promise<number> {
    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.tablaEstudiantes);

      return new Promise<number>((resolve, reject) => {
        let contador = 0;
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value;

            // Only count students who have Tipo_Relacion
            if (estudiante.Tipo_Relacion) {
              // Filter by status if necessary
              if (includeInactive || estudiante.Estado === true) {
                // Filter by specific relationship type if provided
                if (
                  !tipoRelacion ||
                  estudiante.Tipo_Relacion === tipoRelacion
                ) {
                  contador++;
                }
              }
            }
            cursor.continue();
          } else {
            resolve(contador);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error("Error counting students by relationship type:", error);
      this.handleIndexedDBError(
        error,
        "count students by relationship type"
      );
      return 0;
    }
  }

  /**
   * SIMPLE METHOD: Gets a guardian's student with automatic sync
   */
  public async obtenerMiEstudiantePorId(
    idEstudiante: string,
    forzarActualizacion: boolean = false
  ): Promise<EstudianteDelResponsable | null> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // SIMPLE: Just execute sync before querying (like AuxiliaresIDB)
      await this.sync();

      // Get the student
      const estudiante = await this.getEstudiantePorId(idEstudiante);

      if (!estudiante) {
        this.setError?.({
          success: false,
          message: `Student with ID not found: ${idEstudiante}`,
          errorType: "USER_NOT_FOUND" as any,
        });
        this.setIsSomethingLoading?.(false);
        return null;
      }

      // Check that it has Tipo_Relacion (belongs to the guardian)
      const estudianteDelResponsable = estudiante as EstudianteDelResponsable;

      if (!estudianteDelResponsable.Tipo_Relacion) {
        this.setError?.({
          success: false,
          message: "The student is not related to your account",
          errorType: "UNAUTHORIZED_ACCESS" as any,
        });
        this.setIsSomethingLoading?.(false);
        return null;
      }

      this.handleSuccess(
        `Data of ${estudianteDelResponsable.Nombres} ${estudianteDelResponsable.Apellidos} obtained successfully`
      );
      this.setIsSomethingLoading?.(false);
      return estudianteDelResponsable;
    } catch (error) {
      this.handleIndexedDBError(error, "get my student by ID");
      this.setIsSomethingLoading?.(false);
      return null;
    }
  }

  /**
   * Gets a summary of students grouped by relationship type
   * @param includeInactive If to include inactive students
   * @returns Object with count by relationship type
   */
  public async obtenerResumenPorTipoRelacion(
    includeInactive: boolean = false
  ): Promise<{
    hijos: number;
    aCargo: number;
    total: number;
  }> {
    try {
      const [hijos, aCargo] = await Promise.all([
        this.contarEstudiantesPorTipoRelacion("HIJO", includeInactive),
        this.contarEstudiantesPorTipoRelacion("A_CARGO", includeInactive),
      ]);

      return {
        hijos,
        aCargo,
        total: hijos + aCargo,
      };
    } catch (error) {
      console.error("Error getting summary by relationship type:", error);
      this.handleIndexedDBError(error, "get summary by relationship type");
      return { hijos: 0, aCargo: 0, total: 0 };
    }
  }

  /**
   * Clears from the common table only the students who have Tipo_Relacion
   * (specific to the guardian)
   */
  public async limpiarEstudiantesDelResponsable(): Promise<void> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);

    try {
      const store = await IndexedDBConnection.getStore(
        this.tablaEstudiantes,
        "readwrite"
      );

      const estudiantesAEliminar: string[] = [];

      // First, identify students with Tipo_Relacion
      await new Promise<void>((resolve, reject) => {
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            const estudiante = cursor.value;
            if (estudiante.Tipo_Relacion) {
              estudiantesAEliminar.push(estudiante.Id_Estudiante);
            }
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });

      // Delete the identified students
      for (const id of estudiantesAEliminar) {
        await this.deleteById(id);
      }

      this.handleSuccess(
        `Deleted ${estudiantesAEliminar.length} students of the guardian`
      );
      this.setIsSomethingLoading?.(false);
    } catch (error) {
      this.handleIndexedDBError(error, "clear guardian's students");
      this.setIsSomethingLoading?.(false);
    }
  }
}

export const estudiantesParaResponsablesIDB =
  new EstudiantesParaResponsablesIDB();
