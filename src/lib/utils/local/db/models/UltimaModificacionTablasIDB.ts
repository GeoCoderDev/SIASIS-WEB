import IndexedDBConnection from "../IndexedDBConnection";
import TablasSistema, {
  TablasLocal,
  TablasRemoto,
  ITablaInfo,
} from "../../../../../interfaces/shared/TablasSistema";
import { DatabaseModificationOperations } from "../../../../../interfaces/shared/DatabaseModificationOperations";
import { T_Ultima_Modificacion_Tablas } from "@prisma/client";

import { logout } from "@/lib/utils/frontend/auth/logout";
import { LogoutTypes } from "@/interfaces/LogoutTypes";
import comprobarSincronizacion from "@/lib/helpers/validations/comprobarSincronizacion";
import fetchSiasisApiGenerator from "@/lib/helpers/generators/fetchSiasisApisGenerator";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import userStorage from "./UserStorage";
import {
  MAX_CACHE_LIFETIME_SECONDS,
  MIN_CACHE_LIFETIME_SECONDS,
} from "@/constants/CACHE_LIFETIME";

class UltimaModificacionTablasIDB {
  // Complete table information including local name, remote name, description, etc.
  private tablaInfo: ITablaInfo = TablasSistema.ULTIMA_MODIFICACION;

  constructor(private siasisAPI: SiasisAPIS | SiasisAPIS[]) {}

  /**
   * Synchronization method that verifies and updates data from the server
   * based on a random time interval
   * @param forzarSincronizacion If true, synchronization is forced regardless of the elapsed time
   * @returns Promise that resolves with true if synchronized, false otherwise
   */
  public async sync(forzarSincronizacion: boolean = false): Promise<boolean> {
    try {
      // We use the checkSynchronization function to determine if we should synchronize
      const debeSincronizar = await comprobarSincronizacion(
        MIN_CACHE_LIFETIME_SECONDS,
        MAX_CACHE_LIFETIME_SECONDS,
        forzarSincronizacion
      );

      // If it should synchronize, we get data from the server
      if (debeSincronizar) {
        await this.fetchYActualizarModificaciones();
      }

      return debeSincronizar;
    } catch (error) {
      console.error(
        "Error in modification synchronization process:",
        error
      );

      // Log out with error details
      const errorDetails = {
        origen: "UltimaModificacionTablasIDB.sync",
        mensaje: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        contexto: `forzarSincronizacion=${forzarSincronizacion}`,
      };

      logout(LogoutTypes.ERROR_SINCRONIZACION, errorDetails);
      return false;
    }
  }

  /**
   * Gets table modifications from one or multiple APIs and stores them locally
   * @returns Promise that resolves when the modifications have been updated
   */
  public async fetchYActualizarModificaciones(): Promise<void> {
    try {
      // Determine if we have one API or multiple APIs
      const apis = Array.isArray(this.siasisAPI)
        ? this.siasisAPI
        : [this.siasisAPI];

      console.log(`Querying modifications from ${apis.length} API(s)`);

      // Create promises for each API
      const promesasApis = apis.map(async (api, index) => {
        try {
          console.log(`Starting query to API ${index + 1}:`, api);

          const { fetchSiasisAPI } = fetchSiasisApiGenerator(api);

          // Make the request to the endpoint
          const fetchCancelable = await fetchSiasisAPI({
            endpoint: "/api/modificaciones-tablas",
            method: "GET",
          });

          if (!fetchCancelable) {
            throw new Error(
              `Could not create table modifications request for API ${
                index + 1
              }`
            );
          }

          // Execute the request
          const response = await fetchCancelable.fetch();

          if (!response.ok) {
            throw new Error(
              `Error getting table modifications from API ${
                index + 1
              }: ${response.statusText}`
            );
          }

          const data = await response.json();

          if (!data.success) {
            throw new Error(
              `Error in table modifications response from API ${
                index + 1
              }: ${data.message}`
            );
          }

          console.log(
            `API ${index + 1} responded with ${
              data.data?.length || 0
            } modifications`
          );
          return data.data as T_Ultima_Modificacion_Tablas[];
        } catch (error) {
          console.warn(`Error querying API ${index + 1} (${api}):`, error);
          // Return an empty array for this API in case of error
          // This allows other APIs to continue working
          return [] as T_Ultima_Modificacion_Tablas[];
        }
      });

      // Execute all queries in parallel
      const resultadosApis = await Promise.all(promesasApis);

      // Consolidate all results
      const todasLasModificaciones = resultadosApis.flat();
      console.log(
        `Total modifications obtained: ${todasLasModificaciones.length}`
      );

      // Remove duplicates and keep the most recent per table
      const modificacionesConsolidadas = this.consolidarModificaciones(
        todasLasModificaciones
      );
      console.log(
        `Consolidated modifications (without duplicates): ${modificacionesConsolidadas.length}`
      );

      // Update modifications in the local database
      await this.updateFromApiResponse(modificacionesConsolidadas);

      console.log(
        "Table modifications updated correctly from all APIs"
      );
    } catch (error) {
      console.error(
        "Error getting and updating table modifications:",
        error
      );

      // Determine the error type
      let logoutType = LogoutTypes.ERROR_SINCRONIZACION;

      if (error instanceof Error) {
        // If it is a network error or connection problems
        if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          logoutType = LogoutTypes.ERROR_RED;
        }
        // If it is an error related to the server response
        else if (error.message.includes("get modifications")) {
          logoutType = LogoutTypes.ERROR_SINCRONIZACION;
        }
      }

      // Create error details
      const errorDetails = {
        origen: "UltimaModificacionTablasIDB.fetchYActualizarModificaciones",
        mensaje: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        codigo: error instanceof Error && error.name ? error.name : undefined,
        contexto: `APIs queried: ${
          Array.isArray(this.siasisAPI)
            ? this.siasisAPI.join(", ")
            : this.siasisAPI
        }`,
      };

      logout(logoutType, errorDetails);
      throw error;
    }
  }

  /**
   * Consolidates modifications by removing duplicates and keeping the most recent one per table
   * @param modificaciones Array of all obtained modifications
   * @returns Consolidated array without duplicates
   */
  private consolidarModificaciones(
    modificaciones: T_Ultima_Modificacion_Tablas[]
  ): T_Ultima_Modificacion_Tablas[] {
    if (modificaciones.length === 0) {
      return [];
    }

    // Group modifications by table name
    const modificacionesPorTabla = new Map<
      string,
      T_Ultima_Modificacion_Tablas[]
    >();

    modificaciones.forEach((modificacion) => {
      const nombreTabla = modificacion.Nombre_Tabla;

      if (!modificacionesPorTabla.has(nombreTabla)) {
        modificacionesPorTabla.set(nombreTabla, []);
      }

      modificacionesPorTabla.get(nombreTabla)!.push(modificacion);
    });

    // For each table, keep only the most recent modification
    const modificacionesConsolidadas: T_Ultima_Modificacion_Tablas[] = [];

    modificacionesPorTabla.forEach((modificacionesDeTabla, nombreTabla) => {
      if (modificacionesDeTabla.length === 1) {
        // If there is only one modification, we keep it
        modificacionesConsolidadas.push(modificacionesDeTabla[0]);
      } else {
        // If there are multiple, we keep the most recent one
        const masReciente = modificacionesDeTabla.reduce((prev, current) => {
          const fechaPrev = new Date(prev.Fecha_Modificacion).getTime();
          const fechaCurrent = new Date(current.Fecha_Modificacion).getTime();

          return fechaCurrent > fechaPrev ? current : prev;
        });

        console.log(
          `Table "${nombreTabla}": ${modificacionesDeTabla.length} records found, ` +
            `keeping the most recent (${masReciente.Fecha_Modificacion})`
        );

        modificacionesConsolidadas.push(masReciente);
      }
    });

    return modificacionesConsolidadas;
  }

  /**
   * Gets all modification records, synchronizing before if necessary
   * @param forzarSincronizacion If true, forces synchronization regardless of time
   * @returns List of last modification records
   */
  public async getAll(
    forzarSincronizacion: boolean = false
  ): Promise<T_Ultima_Modificacion_Tablas[]> {
    try {
      // Try to synchronize before getting the data
      await this.sync(forzarSincronizacion);

      const store = await IndexedDBConnection.getStore(
        this.tablaInfo.nombreLocal!
      );
      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    }
    catch (error) {
      console.error(
        `Error getting last modification records (${this.tablaInfo.descripcion}):`,
        error
      );

      // Create error details
      const errorDetails = {
        origen: "UltimaModificacionTablasIDB.getAll",
        mensaje: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        contexto: `forzarSincronizacion=${forzarSincronizacion}, tabla=${this.tablaInfo.nombreLocal}`,
      };

      logout(LogoutTypes.ERROR_BASE_DATOS, errorDetails);
      throw error;
    }
  }

  /**
   * Gets the last modification record for a specific table
   * @param nombreTabla Table name (remote or local)
   * @returns Last modification record or null if it does not exist
   */
  public async getByTabla(
    nombreTabla: TablasRemoto | TablasLocal
  ): Promise<T_Ultima_Modificacion_Tablas | null> {
    try {
      // Try to synchronize before getting the data
      await this.sync();

      const store = await IndexedDBConnection.getStore(
        this.tablaInfo.nombreLocal!
      );

      return new Promise((resolve, reject) => {
        const request = store.get(nombreTabla);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `Error getting last modification for table ${nombreTabla}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Gets the modification records by operation type
   * @param operacion Operation type (INSERT, UPDATE, DELETE)
   * @returns List of records filtered by operation
   */
  public async getByOperacion(
    operacion: DatabaseModificationOperations
  ): Promise<T_Ultima_Modificacion_Tablas[]> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.tablaInfo.nombreLocal!
      );
      const index = store.index("by_operation");

      return new Promise((resolve, reject) => {
        const request = index.getAll(IDBKeyRange.only(operacion));

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `Error getting modifications with operation ${operacion}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Gets the modification records within a date range
   * @param fechaInicio Start date (ISO 8601 string)
   * @param fechaFin End date (ISO 8601 string)
   * @returns List of records within the date range
   */
  public async getByRangoFechas(
    fechaInicio: string,
    fechaFin: string
  ): Promise<T_Ultima_Modificacion_Tablas[]> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.tablaInfo.nombreLocal!
      );
      const index = store.index("by_date");

      return new Promise((resolve, reject) => {
        const request = index.getAll(IDBKeyRange.bound(fechaInicio, fechaFin));

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `Error getting modifications in date range:`,
        error
      );
      throw error;
    }
  }

  /**
   * Registers a new table modification
   * @param modificacion Modification data
   */
  public async add(modificacion: T_Ultima_Modificacion_Tablas): Promise<void> {
    try {
      // Ensure we have a modification date
      if (!modificacion.Fecha_Modificacion) {
        modificacion.Fecha_Modificacion = new Date();
      }

      const store = await IndexedDBConnection.getStore(
        this.tablaInfo.nombreLocal!,
        "readwrite"
      );

      return new Promise((resolve, reject) => {
        const request = store.put(modificacion); // We use put instead of add to overwrite if it already exists

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error registering table modification:`, error);
      throw error;
    }
  }

  /**
   * Deletes a table modification record
   * @param nombreTabla Table name (remote or local)
   */
  public async delete(nombreTabla: TablasRemoto | TablasLocal): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.tablaInfo.nombreLocal!,
        "readwrite"
      );

      return new Promise((resolve, reject) => {
        const request = store.delete(nombreTabla);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `Error deleting modification record for table ${nombreTabla}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Updates the modifications locally from the API response
   * @param modificaciones Array of modifications from the API
   */
  public async updateFromApiResponse(
    modificaciones: T_Ultima_Modificacion_Tablas[]
  ): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.tablaInfo.nombreLocal!,
        "readwrite"
      );

      // Process each modification individually
      for (const modificacion of modificaciones) {
        try {
          await new Promise<void>((resolve, reject) => {
            // Simply use put with a single parameter
            // to respect the inline keys configured in the store
            const request = store.put(modificacion);

            request.onsuccess = () => resolve();
            request.onerror = (event) => {
              console.error(
                "Error saving modification:",
                event,
                modificacion
              );
              reject(request.error);
            };
          });
        } catch (itemError) {
          console.warn(
            `Error updating individual modification for table ${modificacion.Nombre_Tabla}:`,
            itemError
          );
        }
      }

      // Update the synchronization date in the user's storage
      userStorage.guardarUltimaSincronizacion(Date.now());

      console.log(
        `Updated ${modificaciones.length} modifications from the API`
      );
    } catch (error) {
      console.error(`Error updating modifications from the API:`, error);

      // Create error details
      const errorDetails = {
        origen: "UltimaModificacionTablasIDB.updateFromApiResponse",
        mensaje: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        contexto: `totalModificaciones=${modificaciones?.length || 0}`,
      };

      logout(LogoutTypes.ERROR_BASE_DATOS, errorDetails);
      throw error;
    }
  }

  /**
   * Gets the most recent modification by date
   * @returns The most recent modification or null if there are no records
   */
  public async getMasReciente(): Promise<T_Ultima_Modificacion_Tablas | null> {
    try {
      const todas = await this.getAll();

      if (todas.length === 0) {
        return null;
      }

      // Sort by date descending
      const ordenadas = todas.sort(
        (a, b) =>
          new Date(b.Fecha_Modificacion).getTime() -
          new Date(a.Fecha_Modificacion).getTime()
      );

      return ordenadas[0];
    } catch (error) {
      console.error(`Error getting the most recent modification:`, error);
      throw error;
    }
  }

  /**
   * Gets the most recent modifications for all tables
   * @param limit Limit of results per table (default 1)
   * @returns Object with the tables and their most recent modifications
   */
  public async getModificacionesRecientesPorTabla(
    limit: number = 1
  ): Promise<Record<string, T_Ultima_Modificacion_Tablas[]>> {
    try {
      const todas = await this.getAll();
      const resultado: Record<string, T_Ultima_Modificacion_Tablas[]> = {};

      // Group by table
      todas.forEach((modificacion) => {
        const nombreTabla = modificacion.Nombre_Tabla;
        if (!resultado[nombreTabla]) {
          resultado[nombreTabla] = [];
        }
        resultado[nombreTabla].push(modificacion);
      });

      // Sort each group by date and limit results
      Object.keys(resultado).forEach((tabla) => {
        resultado[tabla].sort(
          (a, b) =>
            new Date(b.Fecha_Modificacion).getTime() -
            new Date(a.Fecha_Modificacion).getTime()
        );
        resultado[tabla] = resultado[tabla].slice(0, limit);
      });

      return resultado;
    } catch (error) {
      console.error(
        `Error getting recent modifications by table:`,
        error
      );
      throw error;
    }
  }

  /**
   * Gets the tables that have been modified since a specific date
   * @param fechaReferencia ISO string date from which to search
   * @returns Array with the names of the tables modified after the date
   */
  public async getTablasModificadasDesdeFecha(
    fechaReferencia: string
  ): Promise<string[]> {
    try {
      const timestampReferencia = new Date(fechaReferencia).getTime();
      const todas = await this.getAll();

      // Filter modifications after the reference date
      const modificacionesRecientes = todas.filter(
        (mod) =>
          new Date(mod.Fecha_Modificacion).getTime() > timestampReferencia
      );

      // Get unique table names
      const tablasModificadas = Array.from(
        new Set(modificacionesRecientes.map((mod) => mod.Nombre_Tabla))
      );

      return tablasModificadas;
    } catch (error) {
      console.error(`Error getting modified tables since date:`, error);
      throw error;
    }
  }
}

export default UltimaModificacionTablasIDB;
