// ============================================================================
// AulasParaResponsablesIDB.ts - Specific implementation for guardians
// ============================================================================

import { Endpoint_Get_Aulas_API02 } from "@/lib/utils/backend/endpoints/api02/Aulas";
import { BaseAulasIDB } from "./AulasBase";
import { T_Aulas, T_Estudiantes } from "@prisma/client";

/**
 * Specific management of classrooms for guardians (parents)
 * Inherits from BaseAulasIDB and stores in the common "aulas" table
 * Synchronizes only the classrooms related to the guardian's students
 */
export class AulasParaResponsablesIDB extends BaseAulasIDB<T_Aulas> {
  /**
   * Specific synchronization for guardians
   * Guardians DO NOT automatically synchronize all classrooms, only specific ones on demand
   */
  protected async sync(): Promise<void> {
    // Guardians do not automatically synchronize all classrooms
    // They only synchronize specific classrooms when required
    return Promise.resolve();
  }

  /**
   * Specific endpoint to get classrooms
   */
  protected getEndpoint(): string {
    return "/api/aulas";
  }

  /**
   * SIMPLE METHOD: Gets a classroom by ID with automatic sync
   */
  public async obtenerAulaPorId(idAula: string): Promise<T_Aulas | null> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // SIMPLE: Just execute sync before querying
      await this.sync();

      // Query locally first
      let aula = await this.getAulaPorId(idAula);

      // If it does not exist locally, query the specific API
      if (!aula) {
        const aulasDesdeAPI = await this.solicitarAulasDesdeAPI([idAula]);

        if (aulasDesdeAPI.length > 0) {
          await this.upsertFromServer(aulasDesdeAPI);
          aula = aulasDesdeAPI[0];
        }
      }

      if (aula) {
        this.handleSuccess(`Classroom data ${idAula} obtained successfully`);
      } else {
        this.setError?.({
          success: false,
          message: `Classroom with ID not found: ${idAula}`,
          errorType: "USER_NOT_FOUND" as any,
        });
      }

      this.setIsSomethingLoading?.(false);
      return aula;
    } catch (error) {
      this.handleIndexedDBError(error, `get classroom ${idAula}`);
      this.setIsSomethingLoading?.(false);
      return null;
    }
  }

  /**
   * Requests classrooms from the API
   */
  protected async solicitarAulasDesdeAPI(
    idsAulas?: string[]
  ): Promise<T_Aulas[]> {
    try {
      const { data: aulas } = await Endpoint_Get_Aulas_API02.realizarPeticion({
        queryParams: idsAulas ? { idsAulas } : undefined,
      });

      return aulas;
    } catch (error) {
      console.error("Error getting classrooms from API:", error);
      throw error;
    }
  }

  /**
   * MAIN UTILITY METHOD
   * Gets the classrooms corresponding to a list of students
   * Synchronizes only the missing classrooms efficiently
   */
  public async obtenerAulasPorEstudiantes(
    estudiantes: T_Estudiantes[]
  ): Promise<T_Aulas[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // 1. Execute sync before any query
      await this.sync();

      // 2. Extract unique classroom IDs (without duplicates and nulls)
      const idsAulasRequeridas = Array.from(
        new Set(
          estudiantes
            .map((est) => est.Id_Aula)
            .filter((id): id is string => id !== null && id !== undefined)
        )
      );

      if (idsAulasRequeridas.length === 0) {
        this.handleSuccess(
          "No classrooms to process (students without assigned classrooms)"
        );
        this.setIsSomethingLoading?.(false);
        return [];
      }

      console.log(
        `Processing ${idsAulasRequeridas.length} unique classrooms for ${estudiantes.length} students`
      );

      // 3. Check which classrooms are already in IndexedDB
      const aulasEnCache: T_Aulas[] = [];
      const idsFaltantes: string[] = [];

      for (const idAula of idsAulasRequeridas) {
        const aulaExistente = await this.getAulaPorId(idAula);
        if (aulaExistente) {
          aulasEnCache.push(aulaExistente);
        } else {
          idsFaltantes.push(idAula);
        }
      }

      console.log(
        `Classrooms in cache: ${aulasEnCache.length}, Missing classrooms: ${idsFaltantes.length}`
      );

      // 4. If all classrooms are in cache, return directly
      if (idsFaltantes.length === 0) {
        this.handleSuccess(
          `Found all ${aulasEnCache.length} classrooms in local cache`
        );
        this.setIsSomethingLoading?.(false);
        return aulasEnCache;
      }

      // 5. Query only the missing classrooms from the API
      console.log(
        `Querying ${idsFaltantes.length} missing classrooms from the API:`,
        idsFaltantes
      );

      const aulasDesdeAPI = await this.solicitarAulasDesdeAPI(idsFaltantes);

      // 6. Store the new classrooms in the common table
      if (aulasDesdeAPI.length > 0) {
        const result = await this.upsertFromServer(aulasDesdeAPI);
        console.log(
          `Classrooms synchronized from API: ${result.created} created, ${result.updated} updated`
        );
      }

      // 7. Combine classrooms from the cache with those obtained from the API
      const todasLasAulas = [...aulasEnCache, ...aulasDesdeAPI];

      // 8. Check if all required classrooms were obtained
      const idsObtenidos = new Set(todasLasAulas.map((aula) => aula.Id_Aula));
      const aulasFaltantesFinal = idsAulasRequeridas.filter(
        (id) => !idsObtenidos.has(id)
      );

      if (aulasFaltantesFinal.length > 0) {
        console.warn(
          `Warning: Could not get ${aulasFaltantesFinal.length} classrooms:`,
          aulasFaltantesFinal
        );
        this.handleSuccess(
          `Obtained ${todasLasAulas.length} of ${idsAulasRequeridas.length} requested classrooms`
        );
      } else {
        this.handleSuccess(
          `Obtained all ${todasLasAulas.length} required classrooms (${aulasEnCache.length} from cache, ${aulasDesdeAPI.length} from API)`
        );
      }

      this.setIsSomethingLoading?.(false);
      return todasLasAulas;
    } catch (error) {
      this.handleIndexedDBError(error, "get classrooms by students");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Gets specific classrooms by their IDs, querying the API if necessary
   */
  public async obtenerAulasEspecificas(idsAulas: string[]): Promise<T_Aulas[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // 1. Execute sync before any query
      await this.sync();

      // 2. Remove duplicates
      const idsUnicos = Array.from(new Set(idsAulas));

      if (idsUnicos.length === 0) {
        this.handleSuccess("No classroom IDs to process");
        this.setIsSomethingLoading?.(false);
        return [];
      }

      // 3. Check which classrooms are already in IndexedDB
      const aulasEnCache: T_Aulas[] = [];
      const idsFaltantes: string[] = [];

      for (const idAula of idsUnicos) {
        const aulaExistente = await this.getAulaPorId(idAula);
        if (aulaExistente) {
          aulasEnCache.push(aulaExistente);
        } else {
          idsFaltantes.push(idAula);
        }
      }

      // 4. If all classrooms are in cache, return directly
      if (idsFaltantes.length === 0) {
        this.handleSuccess(
          `Found all ${aulasEnCache.length} classrooms in local cache`
        );
        this.setIsSomethingLoading?.(false);
        return aulasEnCache;
      }

      // 5. Query only the missing classrooms from the API
      const aulasDesdeAPI = await this.solicitarAulasDesdeAPI(idsFaltantes);

      // 6. Store the new classrooms in the common table
      if (aulasDesdeAPI.length > 0) {
        await this.upsertFromServer(aulasDesdeAPI);
      }

      // 7. Combine results
      const todasLasAulas = [...aulasEnCache, ...aulasDesdeAPI];

      this.handleSuccess(
        `Obtained ${todasLasAulas.length} classrooms (${aulasEnCache.length} from cache, ${aulasDesdeAPI.length} from API)`
      );

      this.setIsSomethingLoading?.(false);
      return todasLasAulas;
    } catch (error) {
      this.handleIndexedDBError(error, "get specific classrooms");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Specific handling of synchronization errors for guardians
   */
  protected async handleSyncError(error: unknown): Promise<void> {
    let errorType: any = "UNKNOWN_ERROR";
    let message = "Error synchronizing guardian's classrooms";
    let shouldLogout = false;
    let logoutType: any = null;

    if (error instanceof Error) {
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorType = "EXTERNAL_SERVICE_ERROR";
        message = "Network error synchronizing guardian's classrooms";
        shouldLogout = true;
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");
        logoutType = LogoutTypes.ERROR_RED;
      } else if (error.message.includes("get classrooms")) {
        errorType = "EXTERNAL_SERVICE_ERROR";
        message = error.message;
        shouldLogout = true;
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");
        logoutType = LogoutTypes.ERROR_SINCRONIZACION;
      } else if (
        error.name === "TransactionInactiveError" ||
        error.name === "QuotaExceededError"
      ) {
        errorType = "DATABASE_ERROR";
        message = "Database error synchronizing guardian's classrooms";
        shouldLogout = true;
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");
        logoutType = LogoutTypes.ERROR_BASE_DATOS;
      } else {
        message = error.message;
        // For classrooms, minor errors do not require automatic logout
        shouldLogout = false;
      }
    }

    // Set error in state
    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
      details: {
        origen: "AulasParaResponsablesIDB.sync",
        timestamp: Date.now(),
      },
    });

    // Only log out in critical errors
    if (shouldLogout && logoutType) {
      console.error(
        "Critical error in classroom synchronization - logging out:",
        error
      );

      try {
        const { logout } = await import("@/lib/utils/frontend/auth/logout");

        await logout(logoutType, {
          codigo: "SYNC_ERROR_AULAS_GUARDIAN",
          origen: "AulasParaResponsablesIDB.handleSyncError",
          mensaje: message,
          timestamp: Date.now(),
          contexto: "Error during guardian's classroom synchronization",
          siasisComponent: this.siasisAPI,
        });
      } catch (logoutError) {
        console.error(
          "Additional error when trying to log out:",
          logoutError
        );
        window.location.reload();
      }
    }

    throw error;
  }
}
