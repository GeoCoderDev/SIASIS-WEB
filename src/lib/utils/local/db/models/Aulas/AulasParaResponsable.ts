// ============================================================================
// AulasParaResponsablesIDB.ts - Implementación específica para responsables
// ============================================================================

import { Endpoint_Get_Aulas_API02 } from "@/lib/utils/backend/endpoints/api02/Aulas";
import { BaseAulasIDB } from "./AulasBase";
import { T_Aulas, T_Estudiantes } from "@prisma/client";

/**
 * Gestión específica de aulas para responsables (padres de familia)
 * Hereda de BaseAulasIDB y almacena en la tabla común "aulas"
 * Sincroniza solo las aulas relacionadas a los estudiantes del responsable
 */
export class AulasParaResponsablesIDB extends BaseAulasIDB<T_Aulas> {
  /**
   * Sincronización específica para responsables
   * Los responsables NO sincronizan todas las aulas, solo las específicas según demanda
   */
  protected async sync(): Promise<void> {
    // Los responsables no sincronizan automáticamente todas las aulas
    // Solo sincronizan aulas específicas cuando se requieren
    return Promise.resolve();
  }

  /**
   * Endpoint específico para obtener aulas
   */
  protected getEndpoint(): string {
    return "/api/aulas";
  }

  /**
   * MÉTODO SIMPLE: Obtiene un aula por ID con sync automático
   */
  public async obtenerAulaPorId(idAula: string): Promise<T_Aulas | null> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // SIMPLE: Solo ejecutar sync antes de consultar
      await this.sync();

      // Consultar localmente primero
      let aula = await this.getAulaPorId(idAula);

      // Si no existe localmente, consultar API específica
      if (!aula) {
        const aulasDesdeAPI = await this.solicitarAulasDesdeAPI([idAula]);

        if (aulasDesdeAPI.length > 0) {
          await this.upsertFromServer(aulasDesdeAPI);
          aula = aulasDesdeAPI[0];
        }
      }

      if (aula) {
        this.handleSuccess(`Datos del aula ${idAula} obtenidos exitosamente`);
      } else {
        this.setError?.({
          success: false,
          message: `No se encontró el aula con ID: ${idAula}`,
          errorType: "USER_NOT_FOUND" as any,
        });
      }

      this.setIsSomethingLoading?.(false);
      return aula;
    } catch (error) {
      this.handleIndexedDBError(error, `obtener aula ${idAula}`);
      this.setIsSomethingLoading?.(false);
      return null;
    }
  }

  /**
   * Solicita aulas desde la API
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
      console.error("Error al obtener aulas desde la API:", error);
      throw error;
    }
  }

  /**
   * MÉTODO ÚTIL PRINCIPAL
   * Obtiene las aulas correspondientes a una lista de estudiantes
   * Sincroniza solo las aulas faltantes de manera eficiente
   */
  public async obtenerAulasPorEstudiantes(
    estudiantes: T_Estudiantes[]
  ): Promise<T_Aulas[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // 1. Ejecutar sync antes de cualquier consulta
      await this.sync();

      // 2. Extraer IDs de aulas únicos (sin duplicados y sin nulls)
      const idsAulasRequeridas = Array.from(
        new Set(
          estudiantes
            .map((est) => est.Id_Aula)
            .filter((id): id is string => id !== null && id !== undefined)
        )
      );

      if (idsAulasRequeridas.length === 0) {
        this.handleSuccess(
          "No hay aulas para procesar (estudiantes sin aulas asignadas)"
        );
        this.setIsSomethingLoading?.(false);
        return [];
      }

      console.log(
        `Procesando ${idsAulasRequeridas.length} aulas únicas para ${estudiantes.length} estudiantes`
      );

      // 3. Verificar qué aulas ya están en IndexedDB
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
        `Aulas en caché: ${aulasEnCache.length}, Aulas faltantes: ${idsFaltantes.length}`
      );

      // 4. Si todas las aulas están en caché, retornar directamente
      if (idsFaltantes.length === 0) {
        this.handleSuccess(
          `Se encontraron todas las ${aulasEnCache.length} aulas en caché local`
        );
        this.setIsSomethingLoading?.(false);
        return aulasEnCache;
      }

      // 5. Consultar solo las aulas faltantes a la API
      console.log(
        `Consultando ${idsFaltantes.length} aulas faltantes a la API:`,
        idsFaltantes
      );

      const aulasDesdeAPI = await this.solicitarAulasDesdeAPI(idsFaltantes);

      // 6. Almacenar las nuevas aulas en la tabla común
      if (aulasDesdeAPI.length > 0) {
        const result = await this.upsertFromServer(aulasDesdeAPI);
        console.log(
          `Aulas sincronizadas desde API: ${result.created} creadas, ${result.updated} actualizadas`
        );
      }

      // 7. Combinar aulas del caché con las obtenidas de la API
      const todasLasAulas = [...aulasEnCache, ...aulasDesdeAPI];

      // 8. Verificar si se obtuvieron todas las aulas requeridas
      const idsObtenidos = new Set(todasLasAulas.map((aula) => aula.Id_Aula));
      const aulasFaltantesFinal = idsAulasRequeridas.filter(
        (id) => !idsObtenidos.has(id)
      );

      if (aulasFaltantesFinal.length > 0) {
        console.warn(
          `Advertencia: No se pudieron obtener ${aulasFaltantesFinal.length} aulas:`,
          aulasFaltantesFinal
        );
        this.handleSuccess(
          `Se obtuvieron ${todasLasAulas.length} de ${idsAulasRequeridas.length} aulas solicitadas`
        );
      } else {
        this.handleSuccess(
          `Se obtuvieron todas las ${todasLasAulas.length} aulas requeridas (${aulasEnCache.length} desde caché, ${aulasDesdeAPI.length} desde API)`
        );
      }

      this.setIsSomethingLoading?.(false);
      return todasLasAulas;
    } catch (error) {
      this.handleIndexedDBError(error, "obtener aulas por estudiantes");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Obtiene aulas específicas por sus IDs, consultando la API si es necesario
   */
  public async obtenerAulasEspecificas(idsAulas: string[]): Promise<T_Aulas[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // 1. Ejecutar sync antes de cualquier consulta
      await this.sync();

      // 2. Eliminar duplicados
      const idsUnicos = Array.from(new Set(idsAulas));

      if (idsUnicos.length === 0) {
        this.handleSuccess("No hay IDs de aulas para procesar");
        this.setIsSomethingLoading?.(false);
        return [];
      }

      // 3. Verificar qué aulas ya están en IndexedDB
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

      // 4. Si todas las aulas están en caché, retornar directamente
      if (idsFaltantes.length === 0) {
        this.handleSuccess(
          `Se encontraron todas las ${aulasEnCache.length} aulas en caché local`
        );
        this.setIsSomethingLoading?.(false);
        return aulasEnCache;
      }

      // 5. Consultar solo las aulas faltantes a la API
      const aulasDesdeAPI = await this.solicitarAulasDesdeAPI(idsFaltantes);

      // 6. Almacenar las nuevas aulas en la tabla común
      if (aulasDesdeAPI.length > 0) {
        await this.upsertFromServer(aulasDesdeAPI);
      }

      // 7. Combinar resultados
      const todasLasAulas = [...aulasEnCache, ...aulasDesdeAPI];

      this.handleSuccess(
        `Se obtuvieron ${todasLasAulas.length} aulas (${aulasEnCache.length} desde caché, ${aulasDesdeAPI.length} desde API)`
      );

      this.setIsSomethingLoading?.(false);
      return todasLasAulas;
    } catch (error) {
      this.handleIndexedDBError(error, "obtener aulas específicas");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Manejo específico de errores de sincronización para responsables
   */
  protected async handleSyncError(error: unknown): Promise<void> {
    let errorType: any = "UNKNOWN_ERROR";
    let message = "Error al sincronizar aulas del responsable";
    let shouldLogout = false;
    let logoutType: any = null;

    if (error instanceof Error) {
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorType = "EXTERNAL_SERVICE_ERROR";
        message = "Error de red al sincronizar aulas del responsable";
        shouldLogout = true;
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");
        logoutType = LogoutTypes.ERROR_RED;
      } else if (error.message.includes("obtener aulas")) {
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
        message = "Error de base de datos al sincronizar aulas del responsable";
        shouldLogout = true;
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");
        logoutType = LogoutTypes.ERROR_BASE_DATOS;
      } else {
        message = error.message;
        // Para aulas, errores menores no requieren logout automático
        shouldLogout = false;
      }
    }

    // Establecer error en el estado
    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
      details: {
        origen: "AulasParaResponsablesIDB.sync",
        timestamp: Date.now(),
      },
    });

    // Solo cerrar sesión en errores críticos
    if (shouldLogout && logoutType) {
      console.error(
        "Error crítico en sincronización de aulas - cerrando sesión:",
        error
      );

      try {
        const { logout } = await import("@/lib/utils/frontend/auth/logout");

        await logout(logoutType, {
          codigo: "SYNC_ERROR_AULAS_RESPONSABLE",
          origen: "AulasParaResponsablesIDB.handleSyncError",
          mensaje: message,
          timestamp: Date.now(),
          contexto: "Error durante sincronización de aulas del responsable",
          siasisComponent: this.siasisAPI,
        });
      } catch (logoutError) {
        console.error(
          "Error adicional al intentar cerrar sesión:",
          logoutError
        );
        window.location.reload();
      }
    }

    throw error;
  }
}
