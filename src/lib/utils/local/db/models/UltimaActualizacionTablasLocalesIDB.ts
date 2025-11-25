import IndexedDBConnection from "../IndexedDBConnection";
import TablasSistema, {
  TablasLocal,
  ITablaInfo,
} from "../../../../../interfaces/shared/TablasSistema";
import { DatabaseModificationOperations } from "../../../../../interfaces/shared/DatabaseModificationOperations";
import { logout } from "@/lib/utils/frontend/auth/logout";
import { LogoutTypes } from "@/interfaces/LogoutTypes";

export interface T_Ultima_Actualizacion_Tablas_Locales {
  Nombre_Tabla: string; // Table name (acts as primary key)
  Operacion: string; // Operation type (INSERT, UPDATE, DELETE)
  Fecha_Actualizacion: Date | string; // Date of the last local update
}

export class UltimaActualizacionTablasLocalesIDB {
  // Complete table information
  private tablaInfo: ITablaInfo = TablasSistema.ULTIMA_ACTUALIZACION_LOCAL;

  constructor() {}

  /**
   * Registers or updates the last update information for a table
   * @param nombreTabla Table name (local or remote)
   * @param operacion Operation type performed
   * @returns Promise that resolves when the record has been saved
   */
  public async registrarActualizacion(
    nombreTabla: TablasLocal,
    operacion: DatabaseModificationOperations
  ): Promise<void> {
    try {
      const actualizacion: T_Ultima_Actualizacion_Tablas_Locales = {
        Nombre_Tabla: nombreTabla,
        Operacion: operacion,
        Fecha_Actualizacion: new Date(),
      };

      const store = await IndexedDBConnection.getStore(
        this.tablaInfo.nombreLocal!,
        "readwrite"
      );

      return new Promise((resolve, reject) => {
        // Remove the second parameter (the key) to use the inline key
        const request = store.put(actualizacion);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = (event) => {
          console.error(
            "Error registering local update:",
            event,
            actualizacion
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `Error registering local update for ${nombreTabla}:`,
        error
      );

      // Create error details
      const errorDetails = {
        origen: "UltimaActualizacionTablasLocalesIDB.registrarActualizacion",
        mensaje: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        contexto: `tabla=${nombreTabla}, operacion=${operacion}`,
      };

      logout(LogoutTypes.ERROR_BASE_DATOS, errorDetails);
      throw error;
    }
  }

  /**
   * Gets all registered local updates
   * @returns Promise with the array of updates
   */
  public async getAll(): Promise<T_Ultima_Actualizacion_Tablas_Locales[]> {
    try {
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
    } catch (error) {
      console.error(
        `Error getting local update records:`,
        error
      );

      // Create error details
      const errorDetails = {
        origen: "UltimaActualizacionTablasLocalesIDB.getAll",
        mensaje: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };

      logout(LogoutTypes.ERROR_BASE_DATOS, errorDetails);
      throw error;
    }
  }

  /**
   * Gets the update information for a specific table
   * @param nombreTabla Table name
   * @returns Update record or null if it does not exist
   */
  public async getByTabla(
    nombreTabla: TablasLocal
  ): Promise<T_Ultima_Actualizacion_Tablas_Locales | null> {
    try {
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
        `Error getting local update for table ${nombreTabla}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Gets the updates by operation type
   * @param operacion Operation type (INSERT, UPDATE, DELETE)
   * @returns List of updates that match the operation
   */
  public async getByOperacion(
    operacion: DatabaseModificationOperations
  ): Promise<T_Ultima_Actualizacion_Tablas_Locales[]> {
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
        `Error getting updates with operation ${operacion}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Gets updates made after a specific date
   * @param fecha Reference date
   * @returns List of updates after the date
   */
  public async getActualizacionesDesdeFecha(
    fecha: Date | string
  ): Promise<T_Ultima_Actualizacion_Tablas_Locales[]> {
    try {
      // Convert to date if it is a string
      const fechaReferencia =
        typeof fecha === "string" ? new Date(fecha) : fecha;

      const store = await IndexedDBConnection.getStore(
        this.tablaInfo.nombreLocal!
      );
      const index = store.index("by_date");

      // Create a range from the date to infinity
      const range = IDBKeyRange.lowerBound(fechaReferencia);

      return new Promise((resolve, reject) => {
        const request = index.getAll(range);

        request.onsuccess = () => {
          resolve(request.result || []);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error getting updates since date:`, error);
      throw error;
    }
  }

  /**
   * Gets the most recent update among all tables
   * @returns The most recent update or null if there are no records
   */
  public async getMasReciente(): Promise<T_Ultima_Actualizacion_Tablas_Locales | null> {
    try {
      const todas = await this.getAll();

      if (todas.length === 0) {
        return null;
      }

      // Sort by date descending
      const ordenadas = todas.sort(
        (a, b) =>
          new Date(b.Fecha_Actualizacion).getTime() -
          new Date(a.Fecha_Actualizacion).getTime()
      );

      return ordenadas[0];
    } catch (error) {
      console.error(`Error getting the most recent update:`, error);
      throw error;
    }
  }

  /**
   * Clears all update records
   * Useful for restarting tracking or clearing old records
   */
  public async limpiarRegistros(): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.tablaInfo.nombreLocal!,
        "readwrite"
      );

      return new Promise((resolve, reject) => {
        const request = store.clear();

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `Error clearing local update records:`,
        error
      );

      // Create error details
      const errorDetails = {
        origen: "UltimaActualizacionTablasLocalesIDB.limpiarRegistros",
        mensaje: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };

      logout(LogoutTypes.ERROR_BASE_DATOS, errorDetails);
      throw error;
    }
  }

  /**
   * Gets the tables that have been updated after a specific date
   * @param fecha Reference date
   * @returns List of names of updated tables
   */
  public async getTablasActualizadasDesdeFecha(
    fecha: Date | string
  ): Promise<string[]> {
    try {
      const actualizaciones = await this.getActualizacionesDesdeFecha(fecha);

      // Extract unique table names
      return Array.from(new Set(actualizaciones.map((a) => a.Nombre_Tabla)));
    } catch (error) {
      console.error(`Error getting updated tables since date:`, error);
      throw error;
    }
  }
}

// Singleton instance
const ultimaActualizacionTablasLocalesIDB =
  new UltimaActualizacionTablasLocalesIDB();
export default ultimaActualizacionTablasLocalesIDB;
