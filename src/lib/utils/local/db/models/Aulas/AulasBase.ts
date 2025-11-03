// ============================================================================
//               Clase base para gestión de aulas (NO ABSTRACTA)
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

// Filtros básicos para búsqueda
export interface IAulaBaseFilter {
  Id_Aula?: string;
  Nivel?: string;
  Grado?: number;
  Seccion?: string;
}

/**
 * Clase base para gestión de aulas (AHORA ES CONCRETA)
 * Todos los roles almacenan aulas en la tabla común "aulas"
 * Las clases hijas pueden sobrescribir los métodos según necesiten
 */
export class BaseAulasIDB<T extends T_Aulas = T_Aulas> {
  // Tabla común para todos los roles
  protected readonly tablaAulas: string = "aulas";
  protected readonly tablaInfo: ITablaInfo = TablasSistema.AULAS;

  constructor(
    protected siasisAPI?: SiasisAPIS | SiasisAPIS[],
    protected setIsSomethingLoading?: (isLoading: boolean) => void,
    protected setError?: (error: ErrorResponseAPIBase | null) => void,
    protected setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Verifica si la sincronización está habilitada para esta instancia
   * @returns true si hay al menos una API configurada, false si no
   */
  protected get isSyncEnabled(): boolean {
    return this.siasisAPI !== undefined;
  }

  /**
   * Métodos que las clases hijas pueden sobrescribir según necesiten
   * Ahora tienen implementaciones por defecto para permitir uso directo de la clase base
   */

  /**
   * Sincronización por defecto - usa sincronización estándar
   * Las clases hijas pueden sobrescribir este método para lógica específica
   */
  protected async sync(): Promise<void> {
    // Si no hay API configurada, no sincronizar
    if (!this.isSyncEnabled) {
      console.log(
        "Sincronización deshabilitada para esta instancia - siasisAPI es undefined"
      );
      return;
    }

    await this.syncronizacionEstandar();
  }

  /**
   * Obtiene el endpoint por defecto - implementación vacía
   * Las clases hijas pueden sobrescribir este método según necesiten
   */
  protected getEndpoint(): string {
    console.warn(
      "getEndpoint no implementado en clase base. " +
        "Las clases hijas pueden sobrescribir este método si necesitan endpoint específico."
    );
    return "";
  }

  /**
   * Solicita aulas desde la API - implementación por defecto
   * Las clases hijas DEBEN sobrescribir este método para funcionalidad real
   */
  protected async solicitarAulasDesdeAPI(idsAulas?: string[]): Promise<T[]> {
    if (!this.isSyncEnabled) {
      console.warn(
        "solicitarAulasDesdeAPI: Sincronización deshabilitada - retornando array vacío"
      );
      return [];
    }

    console.warn(
      "solicitarAulasDesdeAPI no implementado en clase base. " +
        "Las clases hijas deben sobrescribir este método para funcionalidad específica."
    );
    return [];
  }

  /**
   * Actualiza aulas de un subconjunto específico solo si los datos locales son más antiguos que la fecha de obtención del servidor
   * @param filtro Filtro que identifica el subconjunto de aulas que se va a reemplazar completamente
   * @param aulas Lista de aulas obtenidas del servidor que cumplen con el filtro
   * @param fechaObtenciones Fecha en formato timestamp string UTC de cuándo se obtuvieron estos datos del servidor
   * @returns Promise que se resuelve con el resultado de la operación o null si no se necesita actualizar
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
      // Si no hay API configurada, proceder directamente con la actualización sin verificar fechas
      if (!this.isSyncEnabled) {
        console.log(
          "Sincronización deshabilitada - actualizando aulas directamente sin verificar fechas del servidor"
        );
        const result = await this.upsertFromServerWithFilter(filtro, aulas);

        // Registrar la actualización local incluso sin sync habilitado
        await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
          this.tablaInfo.nombreLocal as TablasLocal,
          DatabaseModificationOperations.UPDATE
        );

        return { ...result, wasUpdated: true };
      }

      // Obtener la última actualización local
      const ultimaActualizacionLocal =
        await ultimaActualizacionTablasLocalesIDB.getByTabla(
          this.tablaInfo.nombreLocal as TablasLocal
        );

      // Convertir la fecha de obtención del servidor a timestamp
      const fechaObtencionsTimestamp = new Date(fechaObtenciones).getTime();

      // Si no hay actualización local, proceder con la actualización
      if (!ultimaActualizacionLocal) {
        console.log(
          "No hay actualización local registrada, procediendo con la actualización de aulas filtradas"
        );
        const result = await this.upsertFromServerWithFilter(filtro, aulas);

        await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
          this.tablaInfo.nombreLocal as TablasLocal,
          DatabaseModificationOperations.UPDATE
        );

        return { ...result, wasUpdated: true };
      }

      // Convertir la fecha de actualización local a timestamp
      const fechaActualizacionLocal =
        typeof ultimaActualizacionLocal.Fecha_Actualizacion === "number"
          ? ultimaActualizacionLocal.Fecha_Actualizacion
          : new Date(ultimaActualizacionLocal.Fecha_Actualizacion).getTime();

      // Comparar fechas: si la actualización local es anterior a la fecha de obtención del servidor, actualizar
      if (fechaActualizacionLocal < fechaObtencionsTimestamp) {
        const filtroStr = this.filtroToString(filtro);
        console.log(
          `Actualizando aulas con filtro [${filtroStr}]: datos locales (${new Date(
            fechaActualizacionLocal
          ).toLocaleString()}) son anteriores a los datos del servidor (${new Date(
            fechaObtencionsTimestamp
          ).toLocaleString()})`
        );

        const result = await this.upsertFromServerWithFilter(filtro, aulas);

        await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
          this.tablaInfo.nombreLocal as TablasLocal,
          DatabaseModificationOperations.UPDATE
        );

        console.log(
          `Actualización de aulas completada con filtro [${filtroStr}]: ${aulas.length} aulas procesadas (${result.created} creadas, ${result.updated} actualizadas, ${result.deleted} eliminadas, ${result.errors} errores)`
        );

        return { ...result, wasUpdated: true };
      } else {
        const filtroStr = this.filtroToString(filtro);
        console.log(
          `No se necesita actualizar aulas con filtro [${filtroStr}]: datos locales (${new Date(
            fechaActualizacionLocal
          ).toLocaleString()}) son más recientes que los datos del servidor (${new Date(
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
        "Error al verificar si es necesario actualizar aulas:",
        error
      );
      this.handleSyncError(error);
      return null;
    }
  }

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
   * Obtiene todas las aulas de la tabla común
   */
  public async getTodasLasAulas(): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // Solo sincronizar si está habilitado
      if (this.isSyncEnabled) {
        await this.sync();
      } else {
        console.log(
          "getTodasLasAulas: Sincronización deshabilitada, obteniendo datos locales únicamente"
        );
      }

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

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "obtener todas las aulas");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Obtiene las secciones disponibles para un nivel y grado específicos
   * @param nivel Nivel educativo ("PRIMARIA" o "SECUNDARIA")
   * @param grado Grado (1-6 para primaria, 1-5 para secundaria)
   * @returns Promise<string[]> Array con las secciones disponibles ordenadas alfabéticamente
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

            // Verificar que coincida nivel y grado
            if (aula.Nivel == nivel && aula.Grado == grado) {
              secciones.add(aula.Seccion);
            }

            cursor.continue();
          } else {
            // Convertir Set a Array y ordenar alfabéticamente
            const seccionesArray = Array.from(secciones).sort();
            resolve(seccionesArray);
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(
        `Error al obtener secciones para ${nivel} - Grado ${grado}:`,
        error
      );
      this.handleIndexedDBError(
        error,
        `obtener secciones para ${nivel} - Grado ${grado}`
      );
      return [];
    }
  }

  /**
   * Busca aulas con filtros básicos
   */
  public async buscarConFiltros(filtros: IAulaBaseFilter): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);

    try {
      // Solo sincronizar si está habilitado
      if (this.isSyncEnabled) {
        await this.sync();
      } else {
        console.log(
          "buscarConFiltros: Sincronización deshabilitada, buscando en datos locales únicamente"
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

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "buscar aulas con filtros");
      this.setIsSomethingLoading?.(false);
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
   * Actualiza o crea aulas en lote desde el servidor usando filtros para reemplazo específico
   * Método mejorado que reemplaza completamente el subconjunto que cumple con el filtro
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
      // 1. Obtener aulas locales que cumplen el filtro
      const aulasLocalesFiltradas = await this.getAulasQueCumplenFiltro(filtro);
      const idsLocalesFiltradas = new Set(
        aulasLocalesFiltradas.map((aula) => aula.Id_Aula)
      );

      // 2. Obtener IDs de aulas del servidor
      const idsServidor = new Set(aulasServidor.map((aula) => aula.Id_Aula));

      // 3. Identificar aulas locales que deben ser eliminadas
      // (cumplen el filtro pero ya no están en los datos del servidor)
      const idsAEliminar = Array.from(idsLocalesFiltradas).filter(
        (id) => !idsServidor.has(id)
      );

      // 4. Eliminar registros obsoletos del subconjunto filtrado
      for (const id of idsAEliminar) {
        try {
          await this.deleteById(id);
          result.deleted++;
        } catch (error) {
          console.error(`Error al eliminar aula ${id}:`, error);
          result.errors++;
        }
      }

      // 5. Procesar aulas del servidor en lotes
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
      console.error("Error en la operación upsertFromServerWithFilter:", error);
      result.errors++;
      return result;
    }
  }

  /**
   * Obtiene aulas locales que cumplen con un filtro específico
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

            // Aplicar filtros específicos (solo los que están definidos)
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
      console.error("Error al obtener aulas que cumplen filtro:", error);
      throw error;
    }
  }

  /**
   * Convierte un filtro en string legible para logs
   */
  private filtroToString(filtro: IAulaBaseFilter): string {
    const partes: string[] = [];

    if (filtro.Id_Aula) partes.push(`ID: ${filtro.Id_Aula}`);
    if (filtro.Nivel) partes.push(`Nivel: ${filtro.Nivel}`);
    if (filtro.Grado !== undefined) partes.push(`Grado: ${filtro.Grado}`);
    if (filtro.Seccion) partes.push(`Sección: ${filtro.Seccion}`);

    return partes.length > 0 ? partes.join(", ") : "Sin filtros";
  }

  /**
   * Actualiza o crea aulas en lote desde el servidor
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
    // Si no hay API configurada, no sincronizar
    if (!this.isSyncEnabled) {
      console.log(
        "syncronizacionEstandar: Sincronización deshabilitada - siasisAPI es undefined"
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
