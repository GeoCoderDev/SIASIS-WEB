// ============================================================================
//               Implementación específica para responsables
// ============================================================================

import {
  BaseEstudiantesIDB,
  IEstudianteBaseFilter,
} from "./EstudiantesBaseIDB";
import IndexedDBConnection from "../../IndexedDBConnection";
import AllErrorTypes, { SystemErrorTypes } from "@/interfaces/shared/errors";
import { Endpoint_Get_MisEstudiantesRelacionados_API02 } from "@/lib/utils/backend/endpoints/api02/Estudiantes";
import { EstudianteDelResponsable } from "@/interfaces/shared/Estudiantes";

// Filtros específicos para estudiantes de responsables (extiende los filtros base)
export interface IEstudianteResponsableFilter extends IEstudianteBaseFilter {
  Tipo_Relacion?: string;
}

/**
 * Gestión específica de estudiantes para responsables (padres de familia)
 * Hereda de BaseEstudiantesIDB y almacena en la tabla común "estudiantes"
 * Añade funcionalidades específicas para el atributo Tipo_Relacion
 */
export class EstudiantesParaResponsablesIDB extends BaseEstudiantesIDB<EstudianteDelResponsable> {
  /**
   * Sincronización específica para responsables
   * Sincroniza solo los estudiantes relacionados al responsable autenticado
   * Si no hay estudiantes relacionados, cierra sesión con error
   */
  protected async sync(): Promise<void> {
    try {
      // Obtener estudiantes desde la API con autenticación automática
      const estudiantes = await this.solicitarEstudiantesDesdeAPI();

      // Si no hay estudiantes relacionados, el responsable no tiene datos válidos
      if (estudiantes.length === 0) {
        console.warn(
          "Responsable sin estudiantes relacionados - cerrando sesión"
        );

        // Importar logout dinámicamente para evitar dependencias circulares
        const { logout } = await import("@/lib/utils/frontend/auth/logout");
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");

        await logout(LogoutTypes.ERROR_DATOS_NO_DISPONIBLES, {
          codigo: "RESPONSABLE_SIN_ESTUDIANTES",
          origen: "EstudiantesParaResponsablesIDB.sync",
          mensaje: "El responsable no tiene estudiantes relacionados",
          timestamp: Date.now(),
          contexto: "Sincronización de estudiantes del responsable",
          siasisComponent: this.siasisAPI,
        });

        return; // No continuar con la ejecución
      }

      // Limpiar estudiantes del responsable anterior antes de sincronizar
      await this.limpiarEstudiantesDelResponsableCompleto();

      // Usar el método heredado para almacenar en la tabla común
      // Esto reemplazará completamente los estudiantes del responsable
      const result = await this.upsertEstudiantesResponsableCompleto(
        estudiantes
      );

      console.log(
        `Sincronización de estudiantes del responsable completada: ${estudiantes.length} estudiantes procesados (${result.created} creados, ${result.updated} actualizados, ${result.deleted} eliminados, ${result.errors} errores)`
      );
    } catch (error) {
      console.error(
        "Error durante la sincronización de estudiantes del responsable:",
        error
      );
      await this.handleSyncError(error);
    }
  }

  /**
   * Limpia completamente todos los estudiantes del responsable de la tabla común
   * Esto asegura que no queden datos obsoletos
   */
  private async limpiarEstudiantesDelResponsableCompleto(): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.tablaEstudiantes,
        "readwrite"
      );

      const estudiantesAEliminar: string[] = [];

      // Identificar todos los estudiantes con Tipo_Relacion (del responsable)
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

      // Eliminar todos los estudiantes identificados
      for (const id of estudiantesAEliminar) {
        await this.deleteById(id);
      }

      console.log(
        `Se eliminaron ${estudiantesAEliminar.length} estudiantes del responsable anterior`
      );
    } catch (error) {
      console.error("Error al limpiar estudiantes del responsable:", error);
      throw error;
    }
  }

  /**
   * Actualiza completamente los estudiantes del responsable en la tabla común
   * Esto asegura que el caché refleje exactamente lo que viene del servidor
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
      // Procesar estudiantes en lotes
      const BATCH_SIZE = 20;

      for (let i = 0; i < estudiantes.length; i += BATCH_SIZE) {
        const lote = estudiantes.slice(i, i + BATCH_SIZE);

        for (const estudianteServidor of lote) {
          try {
            // Verificar si el estudiante ya existe
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
      console.error(
        "Error en la operación upsertEstudiantesResponsableCompleto:",
        error
      );
      result.errors++;
      return result;
    }
  }

  /**
   * Manejo específico de errores de sincronización para responsables
   * Sobrescribe el método base para incluir lógica de logout
   */
  protected async handleSyncError(error: unknown): Promise<void> {
    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = "Error al sincronizar estudiantes del responsable";
    let shouldLogout = false;
    let logoutType: any = null;

    if (error instanceof Error) {
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = "Error de red al sincronizar estudiantes del responsable";
        shouldLogout = true;
        // Importar dinámicamente para evitar dependencias circulares
        const { LogoutTypes } = await import("@/interfaces/LogoutTypes");
        logoutType = LogoutTypes.ERROR_RED;
      } else if (error.message.includes("obtener estudiantes")) {
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
          "Error de base de datos al sincronizar estudiantes del responsable";
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

    // Establecer error en el estado
    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
      details: {
        origen: "EstudiantesParaResponsablesIDB.sync",
        timestamp: Date.now(),
      },
    });

    // Si es un error crítico, cerrar sesión
    if (shouldLogout && logoutType) {
      console.error(
        "Error crítico en sincronización - cerrando sesión:",
        error
      );

      try {
        const { logout } = await import("@/lib/utils/frontend/auth/logout");

        await logout(logoutType, {
          codigo: "SYNC_ERROR_RESPONSABLE",
          origen: "EstudiantesParaResponsablesIDB.handleSyncError",
          mensaje: message,
          timestamp: Date.now(),
          contexto:
            "Error durante sincronización de estudiantes del responsable",
          siasisComponent: this.siasisAPI,
        });
      } catch (logoutError) {
        console.error(
          "Error adicional al intentar cerrar sesión:",
          logoutError
        );
        // Forzar recarga de la página como último recurso
        window.location.reload();
      }
    }

    throw error;
  }

  /**
   * Obtiene estudiantes desde la API (requerido por la clase abstracta)
   */
  protected async solicitarEstudiantesDesdeAPI(): Promise<
    EstudianteDelResponsable[]
  > {
    try {
      const { data: estudiantes } =
        await Endpoint_Get_MisEstudiantesRelacionados_API02.realizarPeticion();

      return estudiantes;
    } catch (error) {
      console.error("Error al obtener estudiantes desde la API:", error);
      throw error;
    }
  }

  /**
   * Obtiene y sincroniza los estudiantes relacionados a un responsable específico
   * Los almacena en la tabla común "estudiantes"
   * @param forzarActualizacion Si debe forzar una nueva consulta a la API
   * @returns Array de estudiantes relacionados al responsable
   */
  public async obtenerYSincronizarEstudiantesDelResponsable(
    forzarActualizacion: boolean = false
  ): Promise<EstudianteDelResponsable[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // Si no se fuerza actualización, intentar obtener desde la tabla común
      // filtrando por los que tienen Tipo_Relacion (específicos del responsable actual)
      if (!forzarActualizacion) {
        const estudiantesCacheados =
          await this.obtenerEstudiantesConTipoRelacion();
        if (estudiantesCacheados.length > 0) {
          this.handleSuccess(
            `Se encontraron ${estudiantesCacheados.length} estudiantes (desde caché local)`
          );
          this.setIsSomethingLoading?.(false);
          return estudiantesCacheados;
        }
      }

      // Obtener desde la API y almacenar en la tabla común
      const estudiantes = await this.solicitarEstudiantesDesdeAPI();

      // Usar el método heredado para almacenar en la tabla común
      const result = await this.upsertFromServer(estudiantes);

      if (estudiantes.length > 0) {
        this.handleSuccess(
          `Se sincronizaron ${estudiantes.length} estudiantes relacionados (${result.created} nuevos, ${result.updated} actualizados)`
        );
      } else {
        this.handleSuccess("No se encontraron estudiantes relacionados");
      }

      this.setIsSomethingLoading?.(false);
      return estudiantes;
    } catch (error) {
      this.handleIndexedDBError(
        error,
        "obtener y sincronizar estudiantes del responsable"
      );
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Obtiene estudiantes que tienen el atributo Tipo_Relacion desde la tabla común
   * @returns Array de estudiantes con tipo de relación
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
            // Solo incluir estudiantes que tengan el atributo Tipo_Relacion
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
        "Error al obtener estudiantes con tipo de relación:",
        error
      );
      throw error;
    }
  }

  /**
   * Busca estudiantes del responsable por tipo de relación específico
   * @param tipoRelacion Tipo de relación a filtrar ("HIJO" o "A_CARGO")
   * @param includeInactive Si incluir estudiantes inactivos
   * @returns Array de estudiantes con el tipo de relación especificado
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

              // Filtrar por tipo de relación y estado
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
          `Se encontraron ${result.length} estudiantes con relación "${tipoRelacion}"`
        );
      } else {
        this.handleSuccess(
          `No se encontraron estudiantes con relación "${tipoRelacion}"`
        );
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "filtrar por tipo de relación");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Busca estudiantes aplicando filtros específicos de responsable
   * Extiende la funcionalidad base agregando filtrado por Tipo_Relacion
   * @param filtros Filtros específicos para estudiantes de responsable
   * @param includeInactive Si incluir estudiantes inactivos
   * @returns Array de estudiantes que cumplen los filtros
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

              // Solo considerar estudiantes que tengan Tipo_Relacion
              if (!estudiante.Tipo_Relacion) {
                cursor.continue();
                return;
              }

              // Filtro por estado si no se incluyen inactivos
              if (!includeInactive && !estudiante.Estado) {
                cursor.continue();
                return;
              }

              // Aplicar filtros base heredados
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

              // Filtro específico por tipo de relación
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
          `Se encontraron ${result.length} estudiantes con los filtros de responsable aplicados`
        );
      } else {
        this.handleSuccess(
          "No se encontraron estudiantes con los filtros de responsable aplicados"
        );
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "buscar con filtros de responsable");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Obtiene solo los hijos del responsable (Tipo_Relacion = "HIJO")
   * @param includeInactive Si incluir estudiantes inactivos
   * @returns Array de estudiantes que son hijos
   */
  public async obtenerSoloHijos(
    includeInactive: boolean = false
  ): Promise<EstudianteDelResponsable[]> {
    return this.filtrarPorTipoRelacion("HIJO", includeInactive);
  }

  /**
   * Obtiene solo los estudiantes a cargo del responsable (Tipo_Relacion = "A_CARGO")
   * @param includeInactive Si incluir estudiantes inactivos
   * @returns Array de estudiantes que están a cargo
   */
  public async obtenerSoloACargo(
    includeInactive: boolean = false
  ): Promise<EstudianteDelResponsable[]> {
    return this.filtrarPorTipoRelacion("A_CARGO", includeInactive);
  }

  /**
   * Cuenta estudiantes del responsable por tipo de relación
   * @param tipoRelacion Tipo de relación específico (opcional)
   * @param includeInactive Si incluir inactivos en el conteo
   * @returns Número de estudiantes con el tipo de relación especificado
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

            // Solo contar estudiantes que tengan Tipo_Relacion
            if (estudiante.Tipo_Relacion) {
              // Filtrar por estado si es necesario
              if (includeInactive || estudiante.Estado === true) {
                // Filtrar por tipo de relación específico si se proporciona
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
      console.error("Error al contar estudiantes por tipo de relación:", error);
      this.handleIndexedDBError(
        error,
        "contar estudiantes por tipo de relación"
      );
      return 0;
    }
  }

  /**
   * MÉTODO SIMPLE: Obtiene un estudiante del responsable con sync automático
   */
  public async obtenerMiEstudiantePorId(
    idEstudiante: string,
    forzarActualizacion: boolean = false
  ): Promise<EstudianteDelResponsable | null> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // SIMPLE: Solo ejecutar sync antes de consultar (como AuxiliaresIDB)
      await this.sync();

      // Obtener el estudiante
      const estudiante = await this.getEstudiantePorId(idEstudiante);

      if (!estudiante) {
        this.setError?.({
          success: false,
          message: `No se encontró el estudiante con ID: ${idEstudiante}`,
          errorType: "USER_NOT_FOUND" as any,
        });
        this.setIsSomethingLoading?.(false);
        return null;
      }

      // Verificar que tiene Tipo_Relacion (pertenece al responsable)
      const estudianteDelResponsable = estudiante as EstudianteDelResponsable;

      if (!estudianteDelResponsable.Tipo_Relacion) {
        this.setError?.({
          success: false,
          message: "El estudiante no está relacionado con su cuenta",
          errorType: "UNAUTHORIZED_ACCESS" as any,
        });
        this.setIsSomethingLoading?.(false);
        return null;
      }

      this.handleSuccess(
        `Datos de ${estudianteDelResponsable.Nombres} ${estudianteDelResponsable.Apellidos} obtenidos exitosamente`
      );
      this.setIsSomethingLoading?.(false);
      return estudianteDelResponsable;
    } catch (error) {
      this.handleIndexedDBError(error, "obtener mi estudiante por ID");
      this.setIsSomethingLoading?.(false);
      return null;
    }
  }

  /**
   * Obtiene un resumen de estudiantes agrupados por tipo de relación
   * @param includeInactive Si incluir estudiantes inactivos
   * @returns Objeto con conteo por tipo de relación
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
      console.error("Error al obtener resumen por tipo de relación:", error);
      this.handleIndexedDBError(error, "obtener resumen por tipo de relación");
      return { hijos: 0, aCargo: 0, total: 0 };
    }
  }

  /**
   * Limpia de la tabla común solo los estudiantes que tienen Tipo_Relacion
   * (específicos del responsable)
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

      // Primero, identificar estudiantes con Tipo_Relacion
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

      // Eliminar los estudiantes identificados
      for (const id of estudiantesAEliminar) {
        await this.deleteById(id);
      }

      this.handleSuccess(
        `Se eliminaron ${estudiantesAEliminar.length} estudiantes del responsable`
      );
      this.setIsSomethingLoading?.(false);
    } catch (error) {
      this.handleIndexedDBError(error, "limpiar estudiantes del responsable");
      this.setIsSomethingLoading?.(false);
    }
  }
}

export const estudiantesParaResponsablesIDB =
  new EstudiantesParaResponsablesIDB();
