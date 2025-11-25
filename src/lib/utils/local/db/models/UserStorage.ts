import { SuccessLoginData } from "@/interfaces/shared/apis/shared/login/types";
import dbConnection from "../IndexedDBConnection";
import { logout } from "@/lib/utils/frontend/auth/logout";
import { LogoutTypes, ErrorDetailsForLogout } from "@/interfaces/LogoutTypes";
import { Genero } from "@/interfaces/shared/Genero";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { TablasLocal } from "@/interfaces/shared/TablasSistema";

// We extend SuccessLoginData with the new property
export interface UserData extends SuccessLoginData {
  ultimaSincronizacionTablas?: number; // New property added
}

class UserStorage {
  private storeName: TablasLocal = TablasLocal.Tabla_Datos_Usuario;

  /**
   * Handles errors according to their type and performs logout if necessary
   * @param error Captured error
   * @param operacion Description of the failed operation
   * @param detalles Additional error details
   */
  private handleError(
    error: unknown,
    operacion: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detalles?: Record<string, any>
  ): void {
    console.error(`Error in UserStorage (${operacion}):`, error);

    // Create object with error details
    const errorDetails: ErrorDetailsForLogout = {
      origen: `UserStorage.${operacion}`,
      mensaje: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      contexto: JSON.stringify(detalles || {}),
      siasisComponent: "CLN01",
    };

    // Determine the error type
    let logoutType: LogoutTypes;

    if (error instanceof Error) {
      if (error.name === "QuotaExceededError") {
        logoutType = LogoutTypes.ERROR_BASE_DATOS;
      } else if (error.name === "AbortError") {
        logoutType = LogoutTypes.ERROR_BASE_DATOS;
      } else if (error.message.includes("No user data")) {
        logoutType = LogoutTypes.SESION_EXPIRADA;
      } else if (error.message.includes("token")) {
        logoutType = LogoutTypes.SESION_EXPIRADA;
      } else {
        logoutType = LogoutTypes.ERROR_SISTEMA;
      }
    } else {
      logoutType = LogoutTypes.ERROR_SISTEMA;
    }

    // Log out with error details
    logout(logoutType, errorDetails);
  }

  /**
   * Saves user data in IndexedDB, updating only the provided properties
   * @param userData Partial user data to save
   * @returns Promise that resolves when the data has been saved
   */
  public async saveUserData(userData: Partial<UserData>): Promise<void> {
    try {
      // Make sure the connection is initialized
      await dbConnection.init();

      // First, we get the current data (if it exists)
      const currentUserData = await this.getUserData();

      // Get the data store
      const store = await dbConnection.getStore(this.storeName, "readwrite");

      // We combine the current data with the new data
      // If currentUserData is null, we use an empty object
      const dataToSave = {
        ...(currentUserData || {}),
        ...userData, // Only the properties included in userData are overwritten
        last_updated: Date.now(),
      };

      // We use a fixed ID 'current_user' to always update the same data
      return new Promise((resolve, reject) => {
        const request = store.put(dataToSave, "current_user");

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = (event) => {
          reject(
            new Error(
              `Error saving user data: ${
                (event.target as IDBRequest).error
              }`
            )
          );
        };
      });
    } catch (error) {
      this.handleError(error, "saveUserData", {
        datosSolicitados: Object.keys(userData),
        timeStamp: Date.now(),
      });
      throw error;
    }
  }

  /**
   * Gets the stored user data
   * @returns Promise that resolves with the user data or null if there is no data
   */
  public async getUserData(): Promise<UserData | null> {
    try {
      // Make sure the connection is initialized
      await dbConnection.init();

      // Get the data store
      const store = await dbConnection.getStore(this.storeName, "readonly");

      return new Promise((resolve, reject) => {
        const request = store.get("current_user");

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = (event) => {
          reject(
            new Error(
              `Error getting user data: ${
                (event.target as IDBRequest).error
              }`
            )
          );
        };
      });
    } catch (error) {
      this.handleError(error, "getUserData");
      throw error;
    }
  }

  /**
   * Updates only the authentication token
   * @param token New authentication token
   * @returns Promise that resolves when the token has been updated
   */
  public async updateAuthToken(token: string): Promise<void> {
    try {
      const userData = await this.getUserData();

      if (!userData) {
        throw new Error("No user data to update the token");
      }

      // Update only the token
      await this.saveUserData({
        ...userData,
        token,
      });
    } catch (error) {
      this.handleError(error, "updateAuthToken", {
        tokenLength: token?.length || 0,
      });
      throw error;
    }
  }

  /**
   * Gets only the authentication token
   * @returns Promise that resolves with the token or null if there is no token
   */
  public async getAuthToken(): Promise<string> {
    try {
      const userData = await this.getUserData();
      if (!userData?.token) {
        throw new Error("Token not available in user data");
      }
      return userData.token;
    } catch (error) {
      this.handleError(error, "getAuthToken");
      throw error;
    }
  }

  /**
   * Gets the stored user role
   * @returns Promise that resolves with the user role or null if there is no data
   */
  public async getRol(): Promise<RolesSistema> {
    try {
      const userData = await this.getUserData();
      if (!userData?.Rol) {
        throw new Error("Role not available in user data");
      }
      return userData.Rol;
    } catch (error) {
      this.handleError(error, "getRol");
      throw error;
    }
  }

  /**
   * Gets the stored user gender
   * @returns Promise that resolves with the user gender or null if there is no data
   */
  public async getGenero(): Promise<Genero | null> {
    try {
      const userData = await this.getUserData();
      return userData?.Genero || null;
    } catch (error) {
      this.handleError(error, "getGenero");
      throw error;
    }
  }

  /**
   * Gets the user's full name
   * @returns Promise that resolves with the full name or null if there is no data
   */
  public async getNombres(): Promise<string | null> {
    try {
      const userData = await this.getUserData();
      if (!userData?.Nombres) {
        throw new Error("Names not available in user data");
      }
      return userData.Nombres;
    } catch (error) {
      this.handleError(error, "getNombres");
      throw error;
    }
  }

  /**
   * Gets the user's last names
   * @returns Promise that resolves with the last names or null if there is no data
   */
  public async getApellidos(): Promise<string | null> {
    try {
      const userData = await this.getUserData();
      if (!userData?.Apellidos) {
        throw new Error("Last names not available in user data");
      }
      return userData.Apellidos;
    } catch (error) {
      this.handleError(error, "getApellidos");
      throw error;
    }
  }

  /**
   * Gets the user's first name
   * @returns Promise that resolves with the first name or null if there is no data
   */
  public async getPrimerNombre(): Promise<string | null> {
    try {
      const nombres = await this.getNombres();
      if (!nombres) return null;

      // Split the name by spaces and take the first element
      const primerNombre = nombres.split(" ")[0];

      return primerNombre;
    } catch (error) {
      this.handleError(error, "getPrimerNombre");
      throw error;
    }
  }

  /**
   * Gets the user's first last name
   * @returns Promise that resolves with the first last name or null if there is no data
   */
  public async getPrimerApellido(): Promise<string | null> {
    try {
      const apellidos = await this.getApellidos();

      if (!apellidos) return null;

      // Split the last names by spaces and take the first element
      const primerApellido = apellidos.split(" ")[0];
      return primerApellido;
    } catch (error) {
      this.handleError(error, "getPrimerApellido");
      throw error;
    }
  }

  /**
   * Gets the user's first name and last name initials
   * @returns Promise that resolves with the initials or null if there is no data
   */
  public async getIniciales(): Promise<string | null> {
    try {
      const primerNombre = await this.getPrimerNombre();
      const primerApellido = await this.getPrimerApellido();

      if (!primerNombre || !primerApellido) return null;

      return `${primerNombre.charAt(0)}${primerApellido.charAt(
        0
      )}`.toUpperCase();
    } catch (error) {
      this.handleError(error, "getIniciales");
      throw error;
    }
  }

  /**
   * Gets the user's full name (first names + last names)
   * @returns Promise that resolves with the full name or null if there is no data
   */
  public async getNombreCompleto(): Promise<string | null> {
    try {
      const nombres = await this.getNombres();
      const apellidos = await this.getApellidos();

      if (!nombres || !apellidos) return null;

      return `${nombres} ${apellidos}`;
    } catch (error) {
      this.handleError(error, "getNombreCompleto");
      throw error;
    }
  }

  /**
   * Gets the username to display in the interface
   * @returns Promise that resolves with the formatted username
   */
  public async getNombreCompletoCorto(): Promise<string | null> {
    try {
      const userData = await this.getUserData();
      if (!userData) return null;

      const primerNombre = await this.getPrimerNombre();
      const apellidos = await this.getPrimerApellido();

      if (!primerNombre || !apellidos) return null;

      return `${primerNombre} ${apellidos}`;
    } catch (error) {
      this.handleError(error, "getNombreCompletoCorto");
      throw error;
    }
  }

  /**
   * Saves the last synchronization timestamp of the tables
   * @param timestamp Synchronization timestamp
   * @returns Promise that resolves when the timestamp has been saved
   */
  public async guardarUltimaSincronizacion(timestamp: number): Promise<void> {
    try {
      const userData = await this.getUserData();

      await this.saveUserData({
        ...(userData || {}),
        ultimaSincronizacionTablas: timestamp,
      });
    } catch (error) {
      this.handleError(error, "guardarUltimaSincronizacion", { timestamp });
      throw error;
    }
  }

  /**
   * Gets the last synchronization timestamp of the tables
   * @returns Promise that resolves with the timestamp or null if there is no timestamp
   */
  public async obtenerUltimaSincronizacion(): Promise<number | null> {
    try {
      const userData = await this.getUserData();
      return userData?.ultimaSincronizacionTablas || null;
    } catch (error) {
      this.handleError(error, "obtenerUltimaSincronizacion");
      throw error;
    }
  }

  /**
   * Deletes all user data
   * @returns Promise that resolves when the data has been deleted
   */
  public async clearUserData(): Promise<void> {
    try {
      // Make sure the connection is initialized
      await dbConnection.init();

      // Get the data store
      const store = await dbConnection.getStore(this.storeName, "readwrite");

      return new Promise((resolve, reject) => {
        const request = store.delete("current_user");

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = (event) => {
          reject(
            new Error(
              `Error deleting user data: ${
                (event.target as IDBRequest).error
              }`
            )
          );
        };
      });
    } catch (error) {
      // For this particular method, we do not logout as it is probably
      // already in the process of logging out
      console.error("Error deleting user data:", error);
      throw error;
    }
  }
}

// Export a singleton instance
const userStorage = new UserStorage();
export default userStorage;
