import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import {
  AuxiliarAsistenciaResponse,
  BaseAsistenciaResponse,
  DirectivoAsistenciaResponse,
  PersonalAdministrativoAsistenciaResponse,
  ProfesorPrimariaAsistenciaResponse,
  ProfesorTutorSecundariaAsistenciaResponse,
  ResponsableAsistenciaResponse,
} from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";

import { LogoutTypes, ErrorDetailsForLogout } from "@/interfaces/LogoutTypes";
import { logout } from "@/lib/utils/frontend/auth/logout";
import store from "@/global/store";
import { HandlerDirectivoAsistenciaResponse } from "./handlers/HandlerDirectivoAsistenciaResponse";
import { HandlerProfesorPrimariaAsistenciaResponse } from "./handlers/HandlerProfesorPrimariaAsistenciaResponse";
import { HandlerAuxiliarAsistenciaResponse } from "./handlers/HandlerAuxiliarAsistenciaResponse";
import { HandlerProfesorTutorSecundariaAsistenciaResponse } from "./handlers/HandlerProfesorTutorSecundariaAsistenciaResponse";
import { HandlerResponsableAsistenciaResponse } from "./handlers/HandlerResponsableAsistenciaResponse";
import { HandlerPersonalAdministrativoAsistenciaResponse } from "./handlers/HandlerPersonalAdministrativoAsistenciaResponse";
import userStorage from "../UserStorage";
import { Meses } from "@/interfaces/shared/Meses";
import {
  EstadoTomaAsistenciaResponseBody,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { TablasLocal } from "@/interfaces/shared/TablasSistema";
import IndexedDBConnection from "@/constants/singleton/IndexedDBConnection";

// Interface for the object saved in IndexedDB
export interface DatosAsistenciaAlmacenados {
  id: string; // 'current_attendance_data'
  rol: RolesSistema;
  datos: BaseAsistenciaResponse;
  fechaGuardado: string;
}

export class DatosAsistenciaHoyIDB {
  private readonly storeName: TablasLocal =
    TablasLocal.Tabla_Archivos_Asistencia_Hoy;
  private static readonly STORAGE_KEY = "current_attendance_data";
  // Constants for the new keys
  private static readonly ESTADO_TOMA_ASISTENCIA_PERSONAL_KEY =
    "estado_toma_asistencia_de_personal";
  private static readonly ESTADO_TOMA_ASISTENCIA_SECUNDARIA_KEY =
    "estado_toma_asistencia_estudiantes_secundaria";
  private static readonly ESTADO_TOMA_ASISTENCIA_PRIMARIA_KEY =
    "estado_toma_asistencia_estudiantes_primaria";

  /**
   * Handles errors according to their type and performs logout if necessary
   */
  private handleError(
    error: unknown,
    operacion: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detalles?: Record<string, any>
  ): void {
    console.error(
      `Error in DatosAsistenciaHoyAlmacenamiento (${operacion}):`,
      error
    );

    const errorDetails: ErrorDetailsForLogout = {
      origen: `DatosAsistenciaHoyAlmacenamiento.${operacion}`,
      mensaje: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      contexto: JSON.stringify(detalles || {}),
      siasisComponent: "CLN01", // Consider externalizing or configuring this
    };

    let logoutType: LogoutTypes;

    if (error instanceof Error) {
      if (error.name === "QuotaExceededError" || error.name === "AbortError") {
        logoutType = LogoutTypes.ERROR_BASE_DATOS;
      } else if (
        error.message.includes("fetch") ||
        error.message.includes("network")
      ) {
        logoutType = LogoutTypes.ERROR_RED;
      } else if (
        error.message.includes("JSON") ||
        error.message.includes("parse")
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_CORRUPTOS;
      } else {
        logoutType = LogoutTypes.ERROR_SISTEMA;
      }
    } else {
      logoutType = LogoutTypes.ERROR_SISTEMA;
    }

    logout(logoutType, errorDetails);
  }

  /**
   * Gets the current date from the Redux state
   * @returns Date object with the current date according to the global state or null if it cannot be obtained.
   */
  private obtenerFechaActualDesdeRedux(): Date | null {
    try {
      // We get the current state of Redux
      const state = store.getState();

      // We access the date from the global state
      const fechaHoraRedux = state.others.fechaHoraActualReal.fechaHora;

      // If we have a date in Redux, we use it
      if (fechaHoraRedux) {
        return new Date(fechaHoraRedux);
      }

      // If the date cannot be obtained from Redux, we return null
      return null;
    } catch (error) {
      console.error(
        "Error getting date from Redux in DatosAsistenciaHoyAlmacenamiento:",
        error
      );
      return null;
    }
  }

  /**
   * Formats a date in ISO format without the time part
   */
  private formatearFechaSoloDia(fecha: Date): string {
    return fecha.toISOString().split("T")[0];
  }

  /**
   * Compares if two ISO dates (day only) are the same day
   */
  private esMismoDia(fecha1ISO: string, fecha2ISO: string): boolean {
    return fecha1ISO === fecha2ISO;
  }

  /**
   * Checks if the provided date corresponds to a Saturday or Sunday (Peru time).
   */
  private esFinDeSemana(fecha: Date | null): boolean {
    if (!fecha) {
      return false; // If there is no date, it is not a weekend for this logic
    }
    // const dayOfWeek = fecha.getUTCDay(); // 0 (Sunday) - 6 (Saturday)
    const dayOfWeek = fecha.getDay(); // 0 (Sunday) - 6 (Saturday)
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  /**
   * Gets the data from the server and stores it in IndexedDB
   */
  private async fetchDatosFromServer(): Promise<BaseAsistenciaResponse> {
    try {
      const response = await fetch("/api/datos-asistencia-hoy");
      if (!response.ok) {
        throw new Error(
          `Error in server response: ${response.status} ${response.statusText}`
        );
      }
      return await response.json();
    } catch (error) {
      this.handleError(error, "fetchDatosFromServer");
      throw error;
    }
  }

  /**
   * Saves the attendance data in IndexedDB
   */
  private async guardarDatosInterno(
    datos: BaseAsistenciaResponse
  ): Promise<void> {
    const fechaActual = this.obtenerFechaActualDesdeRedux();
    if (!fechaActual) {
      console.warn(
        "Could not save data because the date was not obtained from Redux."
      );
      return;
    }
    const rol = await userStorage.getRol();

    try {
      const store = await IndexedDBConnection.getStore(
        this.storeName,
        "readwrite"
      );

      const datosAlmacenados: DatosAsistenciaAlmacenados = {
        id: DatosAsistenciaHoyIDB.STORAGE_KEY,
        rol,
        datos,
        fechaGuardado: this.formatearFechaSoloDia(fechaActual),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(
          datosAlmacenados,
          DatosAsistenciaHoyIDB.STORAGE_KEY
        );

        request.onsuccess = () => {
          resolve();
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.onerror = (event: any) => {
          reject(
            new Error(
              `Error saving data to IndexedDB: ${
                (event.target as IDBRequest).error
              }`
            )
          );
        };
      });
    } catch (error) {
      this.handleError(error, "guardarDatosInterno");
      throw error;
    }
  }

  /**
   * Gets the attendance taking status according to the specified key
   * If there is no data in IndexedDB, it tries to get it from the API
   */
  public async obtenerEstadoTomaAsistencia(
    tipoAsistencia: TipoAsistencia
  ): Promise<EstadoTomaAsistenciaResponseBody | null> {
    try {
      const key = this.getKeyPorTipo(tipoAsistencia);
      const store = await IndexedDBConnection.getStore(
        this.storeName,
        "readwrite"
      );

      // First we try to get from IndexedDB
      const resultadoIDB =
        await new Promise<EstadoTomaAsistenciaResponseBody | null>(
          (resolve, reject) => {
            const request = store.get(key);
            request.onsuccess = () => {
              resolve(request.result || null);
            };
            request.onerror = () => {
              reject(request.error);
            };
          }
        );

      // If we find data in IndexedDB, we return it
      if (resultadoIDB) {
        return resultadoIDB;
      }

      // If there is no data in IndexedDB, we query the API
      console.log(
        `No data found in IndexedDB for ${tipoAsistencia}, querying API...`
      );

      try {
        const response = await fetch(
          `/api/asistencia-hoy/consultar-estado?TipoAsistencia=${tipoAsistencia}`,
          {
            method: "GET",
          }
        );

        if (!response.ok) {
          throw new Error(
            `Error querying API: ${response.status} ${response.statusText}`
          );
        }

        const datos =
          (await response.json()) as EstadoTomaAsistenciaResponseBody;

        // Save the obtained data in IndexedDB for future queries
        if (datos) {
          await this.guardarEstadoTomaAsistencia(datos);
        }

        return datos;
      } catch (apiError) {
        console.error(
          `Error querying API for attendance status ${tipoAsistencia}:`,
          apiError
        );

        // If the API fails, we create an object with a false status based on the current date
        const fechaActual = this.obtenerFechaActualDesdeRedux();
        if (!fechaActual) return null;

        const estadoDefault: EstadoTomaAsistenciaResponseBody = {
          TipoAsistencia: tipoAsistencia,
          Dia: fechaActual.getDate(),
          Mes: (fechaActual.getMonth() + 1) as Meses,
          Anio: fechaActual.getFullYear(),
          AsistenciaIniciada: false,
        };

        // We save this default state in IndexedDB
        await this.guardarEstadoTomaAsistencia(estadoDefault);

        return estadoDefault;
      }
    } catch (error) {
      this.handleError(error, "obtenerEstadoTomaAsistencia", {
        tipoAsistencia,
      });
      return null;
    }
  }

  /**
   * Saves the attendance taking status for the specified type
   */
  public async guardarEstadoTomaAsistencia(
    estado: EstadoTomaAsistenciaResponseBody
  ): Promise<void> {
    try {
      const key = this.getKeyPorTipo(estado.TipoAsistencia);
      const store = await IndexedDBConnection.getStore(
        this.storeName,
        "readwrite"
      );

      return new Promise((resolve, reject) => {
        const request = store.put(estado, key);
        request.onsuccess = () => {
          resolve();
        };
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.onerror = (event: any) => {
          reject(
            new Error(
              `Error saving attendance taking status: ${
                (event.target as IDBRequest).error
              }`
            )
          );
        };
      });
    } catch (error) {
      this.handleError(error, "guardarEstadoTomaAsistencia", {
        estado,
      });
      throw error;
    }
  }

  /**
   * Updates the AsistenciaIniciada field for the specified type
   */
  public async actualizarEstadoAsistenciaIniciada(
    tipoAsistencia: TipoAsistencia,
    iniciada: boolean
  ): Promise<void> {
    try {
      const estadoActual = await this.obtenerEstadoTomaAsistencia(
        tipoAsistencia
      );
      if (estadoActual) {
        // Only update the AsistenciaIniciada field
        estadoActual.AsistenciaIniciada = iniciada;
        await this.guardarEstadoTomaAsistencia(estadoActual);
      } else {
        // If a state does not exist, create one with the current data
        const fechaActual = this.obtenerFechaActualDesdeRedux();
        if (!fechaActual) {
          throw new Error("Could not get current date");
        }

        const nuevoEstado: EstadoTomaAsistenciaResponseBody = {
          TipoAsistencia: tipoAsistencia,
          Dia: fechaActual.getDate(),
          Mes: (fechaActual.getMonth() + 1) as Meses,
          Anio: fechaActual.getFullYear(),
          AsistenciaIniciada: iniciada,
        };

        await this.guardarEstadoTomaAsistencia(nuevoEstado);
      }
    } catch (error) {
      this.handleError(error, "actualizarEstadoAsistenciaIniciada", {
        tipoAsistencia,
        iniciada,
      });
      throw error;
    }
  }

  /**
   * Checks if attendance is started for the specified type on the current date
   */
  public async verificarAsistenciaIniciadaHoy(
    tipoAsistencia: TipoAsistencia
  ): Promise<boolean> {
    try {
      const estadoActual = await this.obtenerEstadoTomaAsistencia(
        tipoAsistencia
      );
      if (!estadoActual) return false;

      const fechaActual = this.obtenerFechaActualDesdeRedux();
      if (!fechaActual) return false;

      // Check that it is the same day
      const esMismoDia =
        estadoActual.Dia === fechaActual.getDate() &&
        estadoActual.Mes === fechaActual.getMonth() + 1 &&
        estadoActual.Anio === fechaActual.getFullYear();

      return esMismoDia && estadoActual.AsistenciaIniciada;
    } catch (error) {
      this.handleError(error, "verificarAsistenciaIniciadaHoy", {
        tipoAsistencia,
      });
      return false;
    }
  }

  /**
   * Clears all attendance taking states
   */
  public async limpiarTodosLosEstados(): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.storeName,
        "readwrite"
      );
      const promises = [
        this.deleteKey(
          store,
          DatosAsistenciaHoyIDB.ESTADO_TOMA_ASISTENCIA_PERSONAL_KEY
        ),
        this.deleteKey(
          store,
          DatosAsistenciaHoyIDB.ESTADO_TOMA_ASISTENCIA_SECUNDARIA_KEY
        ),
        this.deleteKey(
          store,
          DatosAsistenciaHoyIDB.ESTADO_TOMA_ASISTENCIA_PRIMARIA_KEY
        ),
      ];

      await Promise.all(promises);
    } catch (error) {
      this.handleError(error, "limpiarTodosLosEstados");
      throw error;
    }
  }

  /**
   * Auxiliary method to delete a specific key
   */
  private deleteKey(store: IDBObjectStore, key: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = store.delete(key);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Gets the corresponding key according to the state type
   */
  private getKeyPorTipo(tipoAsistencia: TipoAsistencia): string {
    switch (tipoAsistencia) {
      case TipoAsistencia.ParaPersonal:
        return DatosAsistenciaHoyIDB.ESTADO_TOMA_ASISTENCIA_PERSONAL_KEY;
      case TipoAsistencia.ParaEstudiantesSecundaria:
        return DatosAsistenciaHoyIDB.ESTADO_TOMA_ASISTENCIA_SECUNDARIA_KEY;
      case TipoAsistencia.ParaEstudiantesPrimaria:
        return DatosAsistenciaHoyIDB.ESTADO_TOMA_ASISTENCIA_PRIMARIA_KEY;
      default:
        throw new Error("Unrecognized state type");
    }
  }

  /**
   * Gets the stored data from IndexedDB
   */
  private async obtenerDatosAlmacenados(): Promise<DatosAsistenciaAlmacenados | null> {
    try {
      const store = await IndexedDBConnection.getStore(this.storeName);
      return new Promise((resolve, reject) => {
        const request = store.get(DatosAsistenciaHoyIDB.STORAGE_KEY);
        request.onsuccess = () => {
          resolve(request.result || null);
        };
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleError(error, "obtenerDatosAlmacenados");
      return null;
    }
  }

  /**
   * Synchronizes data from the server if necessary and returns it.
   */
  public async obtenerDatos<
    T extends BaseAsistenciaResponse
  >(): Promise<T | null> {
    const fechaHoyRedux = this.obtenerFechaActualDesdeRedux();

    // If the date could not be obtained from Redux, do nothing and return null
    if (!fechaHoyRedux) {
      return null;
    }

    try {
      const storedData = await this.obtenerDatosAlmacenados();

      const fechaHoyISO = this.formatearFechaSoloDia(fechaHoyRedux);

      // Do not synchronize if it is a weekend
      if (this.esFinDeSemana(fechaHoyRedux) && storedData) {
        if (storedData && storedData.rol) {
          return storedData.datos as T;
        }
        return null; // No valid data for today (weekend)
      }

      if (
        !storedData ||
        !this.esMismoDia(String(storedData.datos.FechaLocalPeru), fechaHoyISO)
      ) {
        const freshData = await this.fetchDatosFromServer();
        await this.guardarDatosInterno(freshData);
        return freshData as T;
      }

      return storedData.datos as T;
    } catch (error) {
      console.error("Error getting or synchronizing data:", error);
      return null;
    }
  }

  /**
   * Clears the stored data
   */
  public async limpiarDatos(): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.storeName,
        "readwrite"
      );
      return new Promise((resolve, reject) => {
        const request = store.delete(DatosAsistenciaHoyIDB.STORAGE_KEY);
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error clearing data:", error);
    }
  }

  /**
   * Saves the data directly without checking the date.
   */
  public async guardarDatosDirecto(
    datos: BaseAsistenciaResponse
  ): Promise<void> {
    await this.guardarDatosInterno(datos);
  }

  /**
   * Gets the corresponding handler according to the role stored in IndexedDB.
   */
  public async getHandler() {
    const storedData = await this.obtenerDatosAlmacenados();
    if (!storedData) {
      return null;
    }

    switch (storedData.rol) {
      case RolesSistema.Directivo:
        return new HandlerDirectivoAsistenciaResponse(
          storedData.datos as DirectivoAsistenciaResponse // Adjust the type as necessary
        );
      case RolesSistema.ProfesorPrimaria:
        return new HandlerProfesorPrimariaAsistenciaResponse(
          storedData.datos as ProfesorPrimariaAsistenciaResponse
        );
      case RolesSistema.Auxiliar:
        return new HandlerAuxiliarAsistenciaResponse(
          storedData.datos as AuxiliarAsistenciaResponse
        );
      case RolesSistema.ProfesorSecundaria:
      case RolesSistema.Tutor:
        return new HandlerProfesorTutorSecundariaAsistenciaResponse(
          storedData.datos as ProfesorTutorSecundariaAsistenciaResponse
        );
      case RolesSistema.Responsable:
        return new HandlerResponsableAsistenciaResponse(
          storedData.datos as ResponsableAsistenciaResponse
        );
      case RolesSistema.PersonalAdministrativo:
        return new HandlerPersonalAdministrativoAsistenciaResponse(
          storedData.datos as PersonalAdministrativoAsistenciaResponse
        );
      default:
        return null;
    }
  }
}
