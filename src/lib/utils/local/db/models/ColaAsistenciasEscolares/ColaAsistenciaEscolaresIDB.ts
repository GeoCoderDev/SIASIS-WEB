import { TablasLocal } from "@/interfaces/shared/TablasSistema";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import AllErrorTypes, {
  DataConflictErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "@/interfaces/shared/errors";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";

import { ItemDeColaAsistenciaEscolar } from "@/lib/utils/queues/AsistenciasEscolaresQueue";
import IndexedDBConnection from "@/constants/singleton/IndexedDBConnection";

// Interfaz para filtros de búsqueda
export interface IColaAsistenciaFilter {
  Id_Estudiante?: string;
  TipoAsistencia?: TipoAsistencia;
  Actor?: ActoresSistema;
  ModoRegistro?: ModoRegistro;
  NivelDelEstudiante?: NivelEducativo;
  Grado?: number;
  Seccion?: string;
  desfaseSegundosAsistenciaEstudiante?: {
    min?: number;
    max?: number;
  };
}

export class ColaAsistenciasEscolaresIDB {
  private nombreTablaLocal: string =
    TablasLocal.Tabla_Cola_Asistencias_Escolares;

  constructor(
    private setIsSomethingLoading?: (isLoading: boolean) => void,
    private setError?: (error: ErrorResponseAPIBase | null) => void,
    private setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Crea un nuevo item en la tabla
   * @param item Item a crear
   * @returns Promise<void>
   */
  public async create(item: ItemDeColaAsistenciaEscolar): Promise<void> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.add(item);

        request.onsuccess = () => {
          this.handleSuccess(
            `Item creado: estudiante ${item.Id_Estudiante}, orden ${item.NumeroDeOrden}, nivel ${item.NivelDelEstudiante}, grado ${item.Grado}, sección ${item.Seccion}`
          );
          resolve();
        };

        request.onerror = () => {
          this.handleIndexedDBError(request.error, "crear item");
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "crear item");
      throw error;
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Obtiene un item por su número de orden
   * @param numeroDeOrden Número de orden del item
   * @returns Promise<ItemDeColaAsistenciaEscolar | null>
   */
  public async getByNumeroOrden(
    numeroDeOrden: number
  ): Promise<ItemDeColaAsistenciaEscolar | null> {
    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<ItemDeColaAsistenciaEscolar | null>(
        (resolve, reject) => {
          const request = store.get(numeroDeOrden);

          request.onsuccess = () => {
            resolve(request.result || null);
          };

          request.onerror = () => {
            this.handleIndexedDBError(
              request.error,
              `obtener item con número de orden ${numeroDeOrden}`
            );
            reject(request.error);
          };
        }
      );
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `obtener item con número de orden ${numeroDeOrden}`
      );
      return null;
    }
  }

  /**
   * Obtiene todos los items de la tabla
   * @param filtros Filtros opcionales para la búsqueda
   * @returns Promise<ItemDeColaAsistenciaEscolar[]>
   */
  public async getAll(
    filtros?: IColaAsistenciaFilter
  ): Promise<ItemDeColaAsistenciaEscolar[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<ItemDeColaAsistenciaEscolar[]>((resolve, reject) => {
        const items: ItemDeColaAsistenciaEscolar[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const item = cursor.value as ItemDeColaAsistenciaEscolar;

            // Aplicar filtros si existen
            let cumpleFiltros = true;

            if (
              filtros?.Id_Estudiante &&
              item.Id_Estudiante !== filtros.Id_Estudiante
            ) {
              cumpleFiltros = false;
            }

            if (
              filtros?.TipoAsistencia &&
              item.TipoAsistencia !== filtros.TipoAsistencia
            ) {
              cumpleFiltros = false;
            }

            if (filtros?.Actor && item.Actor !== filtros.Actor) {
              cumpleFiltros = false;
            }

            if (
              filtros?.ModoRegistro &&
              item.ModoRegistro !== filtros.ModoRegistro
            ) {
              cumpleFiltros = false;
            }

            if (
              filtros?.NivelDelEstudiante &&
              item.NivelDelEstudiante !== filtros.NivelDelEstudiante
            ) {
              cumpleFiltros = false;
            }

            if (filtros?.Grado && item.Grado !== filtros.Grado) {
              cumpleFiltros = false;
            }

            if (filtros?.Seccion && item.Seccion !== filtros.Seccion) {
              cumpleFiltros = false;
            }

            if (filtros?.desfaseSegundosAsistenciaEstudiante) {
              const { min, max } = filtros.desfaseSegundosAsistenciaEstudiante;
              if (
                min !== undefined &&
                item.desfaseSegundosAsistenciaEstudiante < min
              ) {
                cumpleFiltros = false;
              }
              if (
                max !== undefined &&
                item.desfaseSegundosAsistenciaEstudiante > max
              ) {
                cumpleFiltros = false;
              }
            }

            if (cumpleFiltros) {
              items.push(item);
            }

            cursor.continue();
          } else {
            // Ordenar por NumeroDeOrden (ya es number)
            items.sort((a, b) => a.NumeroDeOrden - b.NumeroDeOrden);

            this.handleSuccess(`Se encontraron ${items.length} items`);
            resolve(items);
          }
        };

        request.onerror = () => {
          this.handleIndexedDBError(request.error, "obtener todos los items");
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "obtener todos los items");
      return [];
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Actualiza un item existente
   * @param item Item con los datos actualizados
   * @returns Promise<boolean> - true si se actualizó, false si no existía
   */
  public async update(item: ItemDeColaAsistenciaEscolar): Promise<boolean> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      await IndexedDBConnection.init();

      // Verificar si el item existe
      const itemExistente = await this.getByNumeroOrden(item.NumeroDeOrden);

      if (!itemExistente) {
        this.handleSuccess(
          `Item con número de orden ${item.NumeroDeOrden} no encontrado`
        );
        return false;
      }

      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<boolean>((resolve, reject) => {
        const request = store.put(item);

        request.onsuccess = () => {
          this.handleSuccess(
            `Item actualizado: estudiante ${item.Id_Estudiante}, orden ${item.NumeroDeOrden}, nivel ${item.NivelDelEstudiante}`
          );
          resolve(true);
        };

        request.onerror = () => {
          this.handleIndexedDBError(request.error, "actualizar item");
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "actualizar item");
      return false;
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Elimina un item específico por su número de orden
   * @param numeroDeOrden Número de orden del item a eliminar
   * @returns Promise<boolean> - true si se eliminó, false si no existía
   */
  public async deleteByNumeroOrden(numeroDeOrden: number): Promise<boolean> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      await IndexedDBConnection.init();

      // Verificar si existe
      const itemExistente = await this.getByNumeroOrden(numeroDeOrden);

      if (!itemExistente) {
        this.handleSuccess(
          `Item con número de orden ${numeroDeOrden} no encontrado`
        );
        return false;
      }

      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<boolean>((resolve, reject) => {
        const request = store.delete(numeroDeOrden);

        request.onsuccess = () => {
          this.handleSuccess(
            `Item eliminado: estudiante ${itemExistente.Id_Estudiante}, orden ${numeroDeOrden}`
          );
          resolve(true);
        };

        request.onerror = () => {
          this.handleIndexedDBError(request.error, "eliminar item");
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "eliminar item");
      return false;
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Elimina todos los items de la tabla
   * @returns Promise<number> - Número de items eliminados
   */
  public async deleteAll(): Promise<number> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      await IndexedDBConnection.init();

      // Primero contar cuántos items hay
      const itemsActuales = await this.getAll();
      const totalItems = itemsActuales.length;

      if (totalItems === 0) {
        this.handleSuccess("No hay items para eliminar");
        return 0;
      }

      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<number>((resolve, reject) => {
        const request = store.clear();

        request.onsuccess = () => {
          this.handleSuccess(`Todos los items eliminados: ${totalItems} items`);
          resolve(totalItems);
        };

        request.onerror = () => {
          this.handleIndexedDBError(request.error, "eliminar todos los items");
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "eliminar todos los items");
      return 0;
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Cuenta el total de items en la tabla
   * @param filtros Filtros opcionales
   * @returns Promise<number>
   */
  public async count(filtros?: IColaAsistenciaFilter): Promise<number> {
    try {
      if (!filtros) {
        // Sin filtros, usar el método más eficiente
        await IndexedDBConnection.init();
        const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

        return new Promise<number>((resolve, reject) => {
          const request = store.count();

          request.onsuccess = () => {
            resolve(request.result);
          };

          request.onerror = () => {
            reject(request.error);
          };
        });
      } else {
        // Con filtros, obtener todos y contar
        const items = await this.getAll(filtros);
        return items.length;
      }
    } catch (error) {
      this.handleIndexedDBError(error, "contar items");
      return 0;
    }
  }

  /**
   * Obtiene el próximo número de orden disponible
   * @returns Promise<number>
   */
  public async getProximoNumeroOrden(): Promise<number> {
    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<number>((resolve, reject) => {
        // Abrir cursor en orden reverso para obtener el último
        const request = store.openCursor(null, "prev");

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            // Hay items, incrementar el último número
            const ultimoItem = cursor.value as ItemDeColaAsistenciaEscolar;
            resolve(ultimoItem.NumeroDeOrden + 1);
          } else {
            // No hay items, comenzar desde 1
            resolve(1);
          }
        };

        request.onerror = () => {
          // En caso de error, usar timestamp como fallback
          console.error(
            "Error al obtener próximo número de orden:",
            request.error
          );
          resolve(Date.now());
        };
      });
    } catch (error) {
      console.error("Error al obtener próximo número de orden:", error);
      // Fallback: usar timestamp
      return Date.now();
    }
  }

  /**
   * Verifica si existe un item con el número de orden dado
   * @param numeroDeOrden Número de orden a verificar
   * @returns Promise<boolean>
   */
  public async existsByNumeroOrden(numeroDeOrden: number): Promise<boolean> {
    try {
      const item = await this.getByNumeroOrden(numeroDeOrden);
      return item !== null;
    } catch (error) {
      console.error(
        `Error al verificar existencia de item ${numeroDeOrden}:`,
        error
      );
      return false;
    }
  }

  /**
   * Establece un mensaje de éxito
   * @param message Mensaje de éxito
   */
  private handleSuccess(message: string): void {
    const successResponse: MessageProperty = { message };
    this.setSuccessMessage?.(successResponse);
  }

  /**
   * Maneja los errores de operaciones con IndexedDB
   * @param error El error capturado
   * @param operacion Nombre de la operación que falló
   */
  private handleIndexedDBError(error: unknown, operacion: string): void {
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
    });
  }
}
