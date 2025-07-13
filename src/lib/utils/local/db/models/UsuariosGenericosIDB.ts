import IndexedDBConnection from "../IndexedDBConnection";
import { GenericUser } from "@/interfaces/shared/GenericUser";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import { GetGenericUsersSuccessResponse } from "@/interfaces/shared/apis/api01/usuarios-genericos/types";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import AllErrorTypes, { SystemErrorTypes } from "@/interfaces/shared/errors";
import fetchSiasisApiGenerator from "@/lib/helpers/generators/fetchSiasisApisGenerator";
import UltimaModificacionTablasIDB from "./UltimaModificacionTablasIDB";
import { TablasRemoto } from "@/interfaces/shared/TablasSistema";

// Interfaz para el registro de cache
export interface IUsuariosGenericosCache {
  clave_busqueda: string; // Key compuesta: "rol|criterio|limite"
  rol: RolesSistema;
  criterio: string;
  limite: number;
  resultados: GenericUser[];
  total: number;
  ultima_actualizacion: number; // Timestamp
}

// Mapeo de roles a sus tablas correspondientes
const MAPEO_ROLES_TABLAS: Record<RolesSistema, TablasRemoto> = {
  [RolesSistema.Directivo]: TablasRemoto.Tabla_Directivos,
  [RolesSistema.ProfesorPrimaria]: TablasRemoto.Tabla_Profesores_Primaria,
  [RolesSistema.ProfesorSecundaria]: TablasRemoto.Tabla_Profesores_Secundaria,
  [RolesSistema.Tutor]: TablasRemoto.Tabla_Profesores_Secundaria, // Mismo que ProfesorSecundaria
  [RolesSistema.Auxiliar]: TablasRemoto.Tabla_Auxiliares,
  [RolesSistema.Responsable]: TablasRemoto.Tabla_Responsables,
  [RolesSistema.PersonalAdministrativo]:
    TablasRemoto.Tabla_Personal_Administrativo,
};

export class UsuariosGenericosIDB {
  private nombreTablaLocal = "usuarios_genericos_cache";

  constructor(
    private siasisAPI: SiasisAPIS,
    private setIsSomethingLoading: (isLoading: boolean) => void,
    private setError: (error: ErrorResponseAPIBase | null) => void,
    private setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Genera una clave única para la búsqueda
   */
  private generarClaveBusqueda(
    rol: RolesSistema,
    criterio: string,
    limite: number
  ): string {
    // Normalizamos el criterio para evitar inconsistencias
    const criterioNormalizado = criterio.trim().toLowerCase();
    return `${rol}|${criterioNormalizado}|${limite}`;
  }

  /**
   * Verifica si necesita sincronización comparando con la última modificación de la tabla correspondiente
   */
  private async necesitaSincronizacion(
    registroCache: IUsuariosGenericosCache
  ): Promise<boolean> {
    try {
      // Obtener la tabla correspondiente al rol
      const tablaCorrespondiente = MAPEO_ROLES_TABLAS[registroCache.rol];

      if (!tablaCorrespondiente) {
        console.warn(
          `No se encontró tabla correspondiente para el rol: ${registroCache.rol}`
        );
        return true; // Si no sabemos la tabla, mejor sincronizamos
      }

      // Obtener la última modificación de la tabla correspondiente
      const ultimaModificacion = await new UltimaModificacionTablasIDB(
        this.siasisAPI
      ).getByTabla(tablaCorrespondiente);

      // Si no hay registro de modificación, consideramos que no necesita sincronización
      if (!ultimaModificacion) {
        return false;
      }

      // Convertir la fecha de modificación remota a timestamp
      const fechaModificacionRemota = new Date(
        ultimaModificacion.Fecha_Modificacion
      ).getTime();

      // Comparar: si la modificación remota es más reciente que nuestro cache, necesitamos sincronizar
      return registroCache.ultima_actualizacion < fechaModificacionRemota;
    } catch (error) {
      console.error("Error al verificar necesidad de sincronización:", error);
      return true; // En caso de error, mejor sincronizamos
    }
  }

  /**
   * Obtiene usuarios desde la API
   */
  private async fetchUsuariosDesdeAPI(
    rol: RolesSistema,
    criterio: string,
    limite: number
  ): Promise<{ resultados: GenericUser[]; total: number }> {
    try {
      const { fetchSiasisAPI } = fetchSiasisApiGenerator(this.siasisAPI);

      const fetchCancelable = await fetchSiasisAPI({
        endpoint: "/api/usuarios-genericos",
        method: "GET",
        queryParams: {
          Rol: rol,
          Criterio: criterio.trim(),
          Limite: limite,
        },
      });

      if (!fetchCancelable) {
        throw new Error("No se pudo crear la petición");
      }

      const response = await fetchCancelable.fetch();

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Error en la petición");
      }

      const responseData =
        (await response.json()) as GetGenericUsersSuccessResponse;

      return {
        resultados: responseData.data || [],
        total: responseData.total || 0,
      };
    } catch (error) {
      console.error("Error al obtener usuarios desde API:", error);

      let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
      let message = "Error al obtener usuarios";

      if (error instanceof Error) {
        if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
          message = "Error de red al obtener usuarios";
        } else {
          message = error.message;
        }
      }

      this.setError({
        success: false,
        message: message,
        errorType: errorType,
        details: {
          origen: "UsuariosGenericosIDB.fetchUsuariosDesdeAPI",
          timestamp: Date.now(),
        },
      });

      throw error;
    }
  }

  /**
   * Guarda el resultado en el cache local
   */
  private async guardarEnCache(
    registro: IUsuariosGenericosCache
  ): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.put(registro);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error al guardar en cache:", error);
      throw error;
    }
  }

  /**
   * Obtiene un registro del cache local
   */
  private async obtenerDesdeCache(
    claveBusqueda: string
  ): Promise<IUsuariosGenericosCache | null> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<IUsuariosGenericosCache | null>((resolve, reject) => {
        const request = store.get(claveBusqueda);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error al obtener desde cache:", error);
      return null;
    }
  }

  /**
   * Busca usuarios genéricos con cache inteligente
   */
  public async buscarUsuarios(
    rol: RolesSistema,
    criterio: string,
    limite: number
  ): Promise<{ resultados: GenericUser[]; total: number }> {
    this.setIsSomethingLoading(true);
    this.setError(null);
    this.setSuccessMessage?.(null);

    try {
      // Validar parámetros
      if (criterio.trim().length > 0 && criterio.trim().length < 2) {
        this.setError({
          success: false,
          message: "El criterio de búsqueda debe tener al menos 2 caracteres",
        });
        this.setIsSomethingLoading(false);
        return { resultados: [], total: 0 };
      }

      // Generar clave de búsqueda
      const claveBusqueda = this.generarClaveBusqueda(rol, criterio, limite);

      // Intentar obtener desde cache
      const registroCache = await this.obtenerDesdeCache(claveBusqueda);

      // Si tenemos cache, verificar si necesita sincronización
      if (registroCache) {
        const necesitaSync = await this.necesitaSincronizacion(registroCache);

        if (!necesitaSync) {
          // Cache válido, devolver resultados
          this.setSuccessMessage?.({
            message: `Se encontraron ${registroCache.resultados.length} usuarios (desde cache)`,
          });
          this.setIsSomethingLoading(false);
          return {
            resultados: registroCache.resultados,
            total: registroCache.total,
          };
        }
      }

      // Cache no válido o no existe, obtener desde API
      const { resultados, total } = await this.fetchUsuariosDesdeAPI(
        rol,
        criterio,
        limite
      );

      // Guardar en cache
      const nuevoRegistro: IUsuariosGenericosCache = {
        clave_busqueda: claveBusqueda,
        rol,
        criterio: criterio.trim().toLowerCase(),
        limite,
        resultados,
        total,
        ultima_actualizacion: Date.now(),
      };

      await this.guardarEnCache(nuevoRegistro);

      // Mensaje de éxito
      this.setSuccessMessage?.({
        message: `Se encontraron ${resultados.length} usuarios`,
      });

      this.setIsSomethingLoading(false);
      return { resultados, total };
    } catch (error) {
      this.handleIndexedDBError(error, "buscar usuarios");
      this.setIsSomethingLoading(false);
      return { resultados: [], total: 0 };
    }
  }

  /**
   * Limpia el cache para un rol específico (útil cuando sabemos que los datos han cambiado)
   */
  public async limpiarCacheDeRol(rol: RolesSistema): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );
      const index = store.index("por_rol");

      return new Promise<void>((resolve, reject) => {
        const request = index.openCursor(IDBKeyRange.only(rol));

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          } else {
            resolve();
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error al limpiar cache del rol ${rol}:`, error);
      throw error;
    }
  }

  /**
   * Limpia todo el cache de usuarios genéricos
   */
  public async limpiarTodoElCache(): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error al limpiar todo el cache:", error);
      throw error;
    }
  }

  /**
   * Maneja los errores de operaciones con IndexedDB
   */
  private handleIndexedDBError(error: unknown, operacion: string): void {
    console.error(`Error en operación IndexedDB (${operacion}):`, error);

    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = `Error al ${operacion}`;

    if (error instanceof Error) {
      if (error.name === "QuotaExceededError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Almacenamiento excedido al ${operacion}`;
      } else if (error.name === "TransactionInactiveError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Transacción inactiva al ${operacion}`;
      } else {
        message = error.message || message;
      }
    }

    this.setError({
      success: false,
      message: message,
      errorType: errorType,
    });
  }
}
