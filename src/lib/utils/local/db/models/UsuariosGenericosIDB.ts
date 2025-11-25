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
import { Endpoint_Get_Usuarios_Genericos_API01 } from "@/lib/utils/backend/endpoints/api01/UsuariosGenericos";
import { PersonalDelColegio } from "@/interfaces/shared/PersonalDelColegio";

// Interface for the cache record
export interface IUsuariosGenericosCache {
  clave_busqueda: string; // Composite key: "role|criteria|limit"
  rol: RolesSistema;
  criterio: string;
  limite: number;
  resultados: GenericUser[];
  total: number;
  ultima_actualizacion: number; // Timestamp
}

// Mapping of roles to their corresponding tables
const MAPEO_ROLES_TABLAS: Record<RolesSistema, TablasRemoto> = {
  [RolesSistema.Directivo]: TablasRemoto.Tabla_Directivos,
  [RolesSistema.ProfesorPrimaria]: TablasRemoto.Tabla_Profesores_Primaria,
  [RolesSistema.ProfesorSecundaria]: TablasRemoto.Tabla_Profesores_Secundaria,
  [RolesSistema.Tutor]: TablasRemoto.Tabla_Profesores_Secundaria, // Same as SecondaryTeacher
  [RolesSistema.Auxiliar]: TablasRemoto.Tabla_Auxiliares,
  [RolesSistema.Responsable]: TablasRemoto.Tabla_Responsables,
  [RolesSistema.PersonalAdministrativo]:
    TablasRemoto.Tabla_Personal_Administrativo,
};

export class UsuariosGenericosIDB {
  private nombreTablaLocal = "usuarios_genericos_cache";

  constructor(
    private siasisAPI: SiasisAPIS,
    private setIsSomethingLoading?: (isLoading: boolean) => void,
    private setError?: (error: ErrorResponseAPIBase | null) => void,
    private setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Generates a unique key for the search
   */
  private generarClaveBusqueda(
    rol: RolesSistema,
    criterio: string,
    limite: number
  ): string {
    // We normalize the criteria to avoid inconsistencies
    const criterioNormalizado = criterio.trim().toLowerCase();
    return `${rol}|${criterioNormalizado}|${limite}`;
  }

  /**
   * Checks if synchronization is needed by comparing with the last modification of the corresponding table
   */
  private async necesitaSincronizacion(
    registroCache: IUsuariosGenericosCache
  ): Promise<boolean> {
    try {
      // Get the corresponding table for the role
      const tablaCorrespondiente = MAPEO_ROLES_TABLAS[registroCache.rol];

      if (!tablaCorrespondiente) {
        console.warn(
          `No corresponding table found for role: ${registroCache.rol}`
        );
        return true; // If we don't know the table, it's better to synchronize
      }

      // Get the last modification of the corresponding table
      const ultimaModificacion = await new UltimaModificacionTablasIDB(
        this.siasisAPI
      ).getByTabla(tablaCorrespondiente);

      // If there is no modification record, we consider that it does not need synchronization
      if (!ultimaModificacion) {
        return false;
      }

      // Convert the remote modification date to a timestamp
      const fechaModificacionRemota = new Date(
        ultimaModificacion.Fecha_Modificacion
      ).getTime();

      // Compare: if the remote modification is more recent than our cache, we need to synchronize
      return registroCache.ultima_actualizacion < fechaModificacionRemota;
    } catch (error) {
      console.error("Error checking need for synchronization:", error);
      return true; // In case of error, it's better to synchronize
    }
  }

  /**
   * Gets users from the API
   */
  private async fetchUsuariosDesdeAPI(
    rol: RolesSistema,
    criterio: string,
    limite: number
  ): Promise<{ resultados: GenericUser[]; total: number }> {
    try {
      const responseData =
        await Endpoint_Get_Usuarios_Genericos_API01.realizarPeticion({
          queryParams: {
            Criterio: criterio.trim(),
            Limite: limite,
            Rol: rol as PersonalDelColegio,
          },
        });

      return {
        resultados: responseData.data || [],
        total: responseData.total || 0,
      };
    } catch (error) {
      console.error("Error getting users from API:", error);

      let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
      let message = "Error getting users";

      if (error instanceof Error) {
        if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
          message = "Network error getting users";
        } else {
          message = error.message;
        }
      }

      this.setError?.({
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
   * Saves the result in the local cache
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
      console.error("Error saving to cache:", error);
      throw error;
    }
  }

  /**
   * Gets a record from the local cache
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
      console.error("Error getting from cache:", error);
      return null;
    }
  }

  /**
   * Searches for generic users with smart cache
   */
  public async buscarUsuarios(
    rol: RolesSistema,
    criterio: string,
    limite: number
  ): Promise<{ resultados: GenericUser[]; total: number }> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // Validate parameters
      if (criterio.trim().length > 0 && criterio.trim().length < 2) {
        this.setError?.({
          success: false,
          message: "The search criteria must have at least 2 characters",
        });
        this.setIsSomethingLoading?.(false);
        return { resultados: [], total: 0 };
      }

      // Generate search key
      const claveBusqueda = this.generarClaveBusqueda(rol, criterio, limite);

      // Try to get from cache
      const registroCache = await this.obtenerDesdeCache(claveBusqueda);

      // If we have cache, check if synchronization is needed
      if (registroCache) {
        const necesitaSync = await this.necesitaSincronizacion(registroCache);

        if (!necesitaSync) {
          // Valid cache, return results
          this.setSuccessMessage?.({
            message: `Found ${registroCache.resultados.length} users (from cache)`,
          });
          this.setIsSomethingLoading?.(false);
          return {
            resultados: registroCache.resultados,
            total: registroCache.total,
          };
        }
      }

      // Invalid cache or it doesn't exist, get from API
      const { resultados, total } = await this.fetchUsuariosDesdeAPI(
        rol,
        criterio,
        limite
      );

      // Save in cache
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

      // Success message
      this.setSuccessMessage?.({
        message: `Found ${resultados.length} users`,
      });

      this.setIsSomethingLoading?.(false);
      return { resultados, total };
    } catch (error) {
      this.handleIndexedDBError(error, "search users");
      this.setIsSomethingLoading?.(false);
      return { resultados: [], total: 0 };
    }
  }

  /**
   * Clears the cache for a specific role (useful when we know the data has changed)
   */
  public async limpiarCacheDeRol(rol: RolesSistema): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );
      const index = store.index("by_role");

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
      console.error(`Error clearing cache for role ${rol}:`, error);
      throw error;
    }
  }

  /**
   * Clears the entire generic users cache
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
      console.error("Error clearing the entire cache:", error);
      throw error;
    }
  }

  /**
   * Handles errors from IndexedDB operations
   */
  private handleIndexedDBError(error: unknown, operacion: string): void {
    console.error(`Error in IndexedDB operation (${operacion}):`, error);

    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = `Error when ${operacion}`;

    if (error instanceof Error) {
      if (error.name === "QuotaExceededError") {
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
    });
  }
}
