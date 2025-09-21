// ============================================================================
//              Clase base para gestión de estudiantes (NO ABSTRACTA)
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

// Filtros para búsqueda basados en los atributos base de T_Estudiantes
export interface IEstudianteBaseFilter {
  Id_Estudiante?: string;
  Nombres?: string;
  Apellidos?: string;
  Estado?: boolean;
  Id_Aula?: string;
}

/**
 * Clase base para gestión de estudiantes (AHORA ES CONCRETA)
 * Todos los roles almacenan estudiantes en la tabla común "estudiantes"
 * Los métodos aquí trabajan solo con los atributos base de la interfaz T_Estudiantes
 * Las clases hijas pueden sobrescribir los métodos según necesiten
 */
export class BaseEstudiantesIDB<T extends T_Estudiantes = T_Estudiantes> {
  // Tabla común para todos los roles
  protected readonly tablaEstudiantes: string = "estudiantes";
  protected readonly tablaInfo: ITablaInfo = TablasSistema.ESTUDIANTES;

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
   * Solicita estudiantes desde la API - implementación por defecto
   * Las clases hijas DEBEN sobrescribir este método para funcionalidad real
   */
  protected async solicitarEstudiantesDesdeAPI(): Promise<T[]> {
    if (!this.isSyncEnabled) {
      console.warn(
        "solicitarEstudiantesDesdeAPI: Sincronización deshabilitada - retornando array vacío"
      );
      return [];
    }

    console.warn(
      "solicitarEstudiantesDesdeAPI no implementado en clase base. " +
        "Las clases hijas deben sobrescribir este método para funcionalidad específica."
    );
    return [];
  }

  /**
   * Actualiza estudiantes de un subconjunto específico solo si los datos locales son más antiguos que la fecha de obtención del servidor
   * @param filtro Filtro que identifica el subconjunto de estudiantes que se va a reemplazar completamente
   * @param estudiantes Lista de estudiantes obtenidos del servidor que cumplen con el filtro
   * @param fechaObtenciones Fecha en formato timestamp string UTC de cuándo se obtuvieron estos datos del servidor
   * @returns Promise que se resuelve con el resultado de la operación o null si no se necesita actualizar
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
      // Si no hay API configurada, proceder directamente con la actualización sin verificar fechas
      if (!this.isSyncEnabled) {
        console.log(
          "Sincronización deshabilitada - actualizando directamente sin verificar fechas del servidor"
        );
        const result = await this.upsertFromServerWithFilter(
          filtro,
          estudiantes
        );

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
          "No hay actualización local registrada, procediendo con la actualización de estudiantes filtrados"
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

      // Convertir la fecha de actualización local a timestamp
      const fechaActualizacionLocal =
        typeof ultimaActualizacionLocal.Fecha_Actualizacion === "number"
          ? ultimaActualizacionLocal.Fecha_Actualizacion
          : new Date(ultimaActualizacionLocal.Fecha_Actualizacion).getTime();

      // Comparar fechas: si la actualización local es anterior a la fecha de obtención del servidor, actualizar
      if (fechaActualizacionLocal < fechaObtencionsTimestamp) {
        const filtroStr = this.filtroToString(filtro);
        console.log(
          `Actualizando estudiantes con filtro [${filtroStr}]: datos locales (${new Date(
            fechaActualizacionLocal
          ).toLocaleString()}) son anteriores a los datos del servidor (${new Date(
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
          `Actualización de estudiantes completada con filtro [${filtroStr}]: ${estudiantes.length} estudiantes procesados (${result.created} creados, ${result.updated} actualizados, ${result.deleted} eliminados, ${result.errors} errores)`
        );

        return { ...result, wasUpdated: true };
      } else {
        const filtroStr = this.filtroToString(filtro);
        console.log(
          `No se necesita actualizar estudiantes con filtro [${filtroStr}]: datos locales (${new Date(
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
        "Error al verificar si es necesario actualizar estudiantes:",
        error
      );
      this.handleSyncError(error);
      return null;
    }
  }

  /**
   * Obtiene un estudiante por su ID - SIMPLE como AuxiliaresIDB
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
        `Error al obtener estudiante con ID ${idEstudiante}:`,
        error
      );
      this.handleIndexedDBError(
        error,
        `obtener estudiante con ID ${idEstudiante}`
      );
      return null;
    }
  }

  /**
   * Obtiene todos los estudiantes CON SYNC automático
   */
  public async getTodosLosEstudiantes(
    includeInactive: boolean = false
  ): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // SIMPLE: Solo ejecutar sync antes de consultar
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
        this.handleSuccess(`Se encontraron ${estudiantes.length} estudiantes`);
      } else {
        this.handleSuccess("No se encontraron estudiantes");
      }

      this.setIsSomethingLoading?.(false);
      return estudiantes;
    } catch (error) {
      this.handleIndexedDBError(error, "obtener todos los estudiantes");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Busca estudiantes por nombre CON SYNC automático
   */
  public async buscarPorNombre(
    nombreBusqueda: string,
    includeInactive: boolean = false
  ): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);

    try {
      // SIMPLE: Solo ejecutar sync antes de consultar
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
          `Se encontraron ${result.length} estudiantes con "${nombreBusqueda}"`
        );
      } else {
        this.handleSuccess(
          `No se encontraron estudiantes con "${nombreBusqueda}"`
        );
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "buscar estudiantes por nombre");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Filtra estudiantes por estado (activo/inactivo)
   * @param estado Estado a filtrar (true = activo, false = inactivo)
   * @returns Array de estudiantes con el estado especificado
   */
  public async filtrarPorEstado(estado: boolean): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);

    try {
      // Solo sincronizar si está habilitado
      if (this.isSyncEnabled) {
        await this.sync();
      } else {
        console.log(
          "filtrarPorEstado: Sincronización deshabilitada, filtrando datos locales únicamente"
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

      const estadoTexto = estado ? "activos" : "inactivos";
      if (result.length > 0) {
        this.handleSuccess(
          `Se encontraron ${result.length} estudiantes ${estadoTexto}`
        );
      } else {
        this.handleSuccess(`No se encontraron estudiantes ${estadoTexto}`);
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "filtrar estudiantes por estado");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Filtra estudiantes por aula
   * @param idAula ID del aula
   * @param includeInactive Si incluir estudiantes inactivos
   * @returns Array de estudiantes del aula especificada
   */
  public async filtrarPorAula(
    idAula: string,
    includeInactive: boolean = false
  ): Promise<T[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);

    try {
      // Solo sincronizar si está habilitado
      if (this.isSyncEnabled) {
        await this.sync();
      } else {
        console.log(
          "filtrarPorAula: Sincronización deshabilitada, filtrando datos locales únicamente"
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

            // Filtrar por aula y estado
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
          `Se encontraron ${result.length} estudiantes en el aula ${idAula}`
        );
      } else {
        this.handleSuccess(
          `No se encontraron estudiantes en el aula ${idAula}`
        );
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `filtrar estudiantes por aula ${idAula}`
      );
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Busca estudiantes aplicando múltiples filtros basados en T_Estudiantes
   * @param filtros Filtros basados en los atributos base
   * @param includeInactive Si incluir estudiantes inactivos
   * @returns Array de estudiantes que cumplen todos los filtros
   */
  public async buscarConFiltros(
    filtros: IEstudianteBaseFilter,
    includeInactive: boolean = false
  ): Promise<T[]> {
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

            // Filtro por estado si no se incluyen inactivos
            if (!includeInactive && !estudiante.Estado) {
              cursor.continue();
              return;
            }

            // Aplicar filtros específicos
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
          `Se encontraron ${result.length} estudiantes con los filtros aplicados`
        );
      } else {
        this.handleSuccess(
          "No se encontraron estudiantes con los filtros aplicados"
        );
      }

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "buscar estudiantes con filtros");
      this.setIsSomethingLoading?.(false);
      return [];
    }
  }

  /**
   * Cuenta el total de estudiantes en la tabla
   * @param includeInactive Si incluir estudiantes inactivos en el conteo
   * @returns Número total de estudiantes
   */
  public async contarEstudiantes(
    includeInactive: boolean = false
  ): Promise<number> {
    try {
      // Solo sincronizar si está habilitado
      if (this.isSyncEnabled) {
        await this.sync();
      } else {
        console.log(
          "contarEstudiantes: Sincronización deshabilitada, contando datos locales únicamente"
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
      console.error("Error al contar estudiantes:", error);
      this.handleIndexedDBError(error, "contar estudiantes");
      return 0;
    }
  }

  /**
   * Actualiza o crea estudiantes en lote desde el servidor usando filtros para reemplazo específico
   * Método mejorado que reemplaza completamente el subconjunto que cumple con el filtro
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
      // 1. Obtener estudiantes locales que cumplen el filtro
      const estudiantesLocalesFiltrados =
        await this.getEstudiantesQueCumplenFiltro(filtro);
      const idsLocalesFiltrados = new Set(
        estudiantesLocalesFiltrados.map((est) => est.Id_Estudiante)
      );

      // 2. Obtener IDs de estudiantes del servidor
      const idsServidor = new Set(
        estudiantesServidor.map((est) => est.Id_Estudiante)
      );

      // 3. Identificar estudiantes locales que deben ser eliminados
      // (cumplen el filtro pero ya no están en los datos del servidor)
      const idsAEliminar = Array.from(idsLocalesFiltrados).filter(
        (id) => !idsServidor.has(id)
      );

      // 4. Eliminar registros obsoletos del subconjunto filtrado
      for (const id of idsAEliminar) {
        try {
          await this.deleteById(id);
          result.deleted++;
        } catch (error) {
          console.error(`Error al eliminar estudiante ${id}:`, error);
          result.errors++;
        }
      }

      // 5. Procesar estudiantes del servidor en lotes
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
      console.error("Error en la operación upsertFromServerWithFilter:", error);
      result.errors++;
      return result;
    }
  }

  /**
   * Obtiene estudiantes locales que cumplen con un filtro específico
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

            // Aplicar filtros específicos (solo los que están definidos)
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
              filtro.Apellidos &&
              !estudiante.Apellidos.toLowerCase().includes(
                filtro.Apellidos.toLowerCase()
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
      console.error("Error al obtener estudiantes que cumplen filtro:", error);
      throw error;
    }
  }

  /**
   * Convierte un filtro en string legible para logs
   */
  private filtroToString(filtro: IEstudianteBaseFilter): string {
    const partes: string[] = [];

    if (filtro.Id_Estudiante) partes.push(`ID: ${filtro.Id_Estudiante}`);
    if (filtro.Nombres) partes.push(`Nombres: ${filtro.Nombres}`);
    if (filtro.Apellidos) partes.push(`Apellidos: ${filtro.Apellidos}`);
    if (filtro.Estado !== undefined)
      partes.push(`Estado: ${filtro.Estado ? "Activo" : "Inactivo"}`);
    if (filtro.Id_Aula) partes.push(`Aula: ${filtro.Id_Aula}`);

    return partes.length > 0 ? partes.join(", ") : "Sin filtros";
  }

  /**
   * Obtiene todos los IDs de estudiantes en la tabla
   * @returns Array de IDs de estudiantes
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
      console.error("Error al obtener todos los IDs de estudiantes:", error);
      throw error;
    }
  }

  /**
   * Elimina un estudiante por su ID
   * @param idEstudiante ID del estudiante a eliminar
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
        `Error al eliminar estudiante con ID ${idEstudiante}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Actualiza o crea estudiantes en lote desde el servidor
   * Método común que pueden usar todas las clases hijas
   */
  protected async upsertFromServer(estudiantesServidor: T[]): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  }> {
    const result = { created: 0, updated: 0, deleted: 0, errors: 0 };

    try {
      // Obtener IDs actuales en la tabla
      const idsLocales = await this.getAllIds();
      const idsServidor = new Set(
        estudiantesServidor.map((est) => est.Id_Estudiante)
      );

      // Identificar estudiantes que ya no existen en el servidor
      const idsAEliminar = idsLocales.filter((id) => !idsServidor.has(id));

      // Eliminar registros obsoletos
      for (const id of idsAEliminar) {
        try {
          await this.deleteById(id);
          result.deleted++;
        } catch (error) {
          console.error(`Error al eliminar estudiante ${id}:`, error);
          result.errors++;
        }
      }

      // Procesar estudiantes en lotes
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
      console.error("Error en la operación upsertFromServer:", error);
      result.errors++;
      return result;
    }
  }

  /**
   * Manejo de sincronización estándar usando comprobarSincronizacionDeTabla
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

      console.log(
        "%cSE DEBE SINCRONIZAR EL MODELO DE ESTUDIANTES",
        "font-size:1.3rem; color:cyan"
      );
      const estudiantes = await this.solicitarEstudiantesDesdeAPI();
      const result = await this.upsertFromServer(estudiantes);

      await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
        this.tablaInfo.nombreLocal as TablasLocal,
        DatabaseModificationOperations.UPDATE
      );

      console.log(
        `Sincronización de estudiantes completada: ${estudiantes.length} estudiantes procesados (${result.created} creados, ${result.updated} actualizados, ${result.deleted} eliminados, ${result.errors} errores)`
      );
    } catch (error) {
      console.error("Error durante la sincronización de estudiantes:", error);
      this.handleSyncError(error);
    }
  }

  /**
   * Manejo de errores de sincronización - puede ser sobrescrito por clases hijas
   * @param error Error capturado durante la sincronización
   */
  protected async handleSyncError(error: unknown): Promise<void> {
    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = "Error al sincronizar estudiantes";

    if (error instanceof Error) {
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = "Error de red al sincronizar estudiantes";
      } else if (error.message.includes("obtener estudiantes")) {
        errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
        message = error.message;
      } else if (
        error.name === "TransactionInactiveError" ||
        error.name === "QuotaExceededError"
      ) {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = "Error de base de datos al sincronizar estudiantes";
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
