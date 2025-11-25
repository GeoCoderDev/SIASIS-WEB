import {
  ApiResponseBase,
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";

import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import fetchSiasisApiGenerator from "@/lib/helpers/generators/fetchSiasisApisGenerator";

import { DatabaseModificationOperations } from "@/interfaces/shared/DatabaseModificationOperations";
import { T_Eventos } from "@prisma/client";
import { GetEventosSuccessResponse } from "@/interfaces/shared/apis/eventos/types";
import UltimaModificacionTablasIDB from "../UltimaModificacionTablasIDB";
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

export type IEventoLocal = Pick<T_Eventos, "Id_Evento" | "Nombre"> & {
  Fecha_Inicio: string;
  Fecha_Conclusion: string;
  ultima_actualizacion?: number; // ⚠️ REMOVE queried_month and queried_year
};

export interface IEventoFilter {
  Id_Evento?: number;
  Nombre?: string;
  mes?: number;
  año?: number;
}

export class EventosIDB {
  private tablaInfo: ITablaInfo = TablasSistema.EVENTOS;
  private nombreTablaLocal: string = this.tablaInfo.nombreLocal || "eventos";

  constructor(
    private siasisAPI: SiasisAPIS,
    private setIsSomethingLoading?: (isLoading: boolean) => void,
    private setError?: (error: ErrorResponseAPIBase | null) => void,
    private setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  private normalizarFecha(fechaISO: string): string {
    return fechaISO.split("T")[0];
  }

  // NEW LOGIC: Synchronization based on last remote table modification
  private async debeActualizarEventos(): Promise<boolean> {
    try {
      console.log(`[SYNC] 📊 Checking if events should be updated...`);

      // Get last local update
      const ultimaActLocal =
        await ultimaActualizacionTablasLocalesIDB.getByTabla(
          this.tablaInfo.nombreLocal as TablasLocal
        );

      // Get last remote modification
      const ultimaModRemota = await new UltimaModificacionTablasIDB(
        this.siasisAPI
      ).getByTabla(this.tablaInfo.nombreRemoto!);

      // If there is no local data, update
      if (!ultimaActLocal) {
        console.log(`[SYNC] ❌ NO LOCAL DATA → MUST UPDATE`);
        return true;
      }

      // If there is no remote modification, keep local
      if (!ultimaModRemota) {
        console.log(`[SYNC] ⚠️ NO REMOTE MOD. → KEEP LOCAL`);
        return false;
      }

      // Compare timestamps
      const timestampLocal = new Date(
        ultimaActLocal.Fecha_Actualizacion
      ).getTime();
      const timestampRemoto = new Date(
        ultimaModRemota.Fecha_Modificacion
      ).getTime();

      console.log(`[SYNC] 📊 Comparison:`);
      console.log(`  Local:  ${new Date(timestampLocal).toISOString()}`);
      console.log(`  Remote: ${new Date(timestampRemoto).toISOString()}`);

      const debeActualizar = timestampLocal < timestampRemoto;
      console.log(
        `[SYNC] ${debeActualizar ? "🔄" : "✅"} Update? ${
          debeActualizar ? "YES" : "NO"
        }`
      );

      return debeActualizar;
    } catch (error) {
      console.error(`[SYNC] ❌ ERROR:`, error);
      // In case of error, it's better to update to be sure
      return true;
    }
  }

  // REPLACE fetchAndRefreshEventsByMonth with new global logic
  private async fetchYActualizarTodosLosEventos(): Promise<void> {
    console.log(`[API] 🌐 Querying ALL events...`);
    let consultaExitosa = false;

    try {
      const { fetchSiasisAPI } = fetchSiasisApiGenerator(this.siasisAPI);

      // Query WITHOUT month/year filters to get ALL active events
      const endpoint = `/api/eventos`;

      const fetchCancelable = await fetchSiasisAPI({
        endpoint,
        method: "GET",
      });

      if (!fetchCancelable) {
        throw new Error("Could not create request");
      }

      const response = await fetchCancelable.fetch();

      if (!response.ok) {
        throw new Error(`HTTP Error: ${response.statusText}`);
      }

      const objectResponse = (await response.json()) as ApiResponseBase;

      if (!objectResponse.success) {
        throw new Error(`Error in response: ${objectResponse.message}`);
      }

      const { data: eventosServidor } =
        objectResponse as GetEventosSuccessResponse;
      const cantidadEventos = eventosServidor?.length || 0;
      consultaExitosa = true;

      console.log(`[API] ✅ Response: ${cantidadEventos} events`);

      // CLEAR ALL previous events
      try {
        await this.eliminarTodosLosEventos();
        console.log(`[IDB] 🗑️ Previous events deleted`);
      } catch (e) {
        console.warn(`[IDB] ⚠️ Error clearing (continuing):`, e);
      }

      // Save events only if there are any
      if (cantidadEventos > 0) {
        try {
          const eventosNormalizados: IEventoLocal[] = eventosServidor.map(
            (evento) => ({
              ...evento,
              Fecha_Inicio: this.normalizarFecha(String(evento.Fecha_Inicio)),
              Fecha_Conclusion: this.normalizarFecha(
                String(evento.Fecha_Conclusion)
              ),
              ultima_actualizacion: Date.now(),
              // ⚠️ DO NOT include queried_month or queried_year
            })
          );

          await this.guardarEventos(eventosNormalizados);
          console.log(`[IDB] ✅ ${cantidadEventos} events saved`);
        } catch (e) {
          console.error(`[IDB] ❌ Error saving events:`, e);
          throw e; // Propagate error to be handled in the main catch
        }
      } else {
        console.log(`[IDB] ℹ️ No active events`);
      }
    } catch (error) {
      console.error(`[API] ❌ Error in query:`, error);
      this.setError?.({
        success: false,
        message: `Error synchronizing: ${
          error instanceof Error ? error.message : String(error)
        }`,
        errorType: SystemErrorTypes.EXTERNAL_SERVICE_ERROR,
      });
      throw error; // Re-throw to be handled above
    } finally {
      // Register update only if successful
      if (consultaExitosa) {
        try {
          await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
            this.tablaInfo.nombreLocal as TablasLocal,
            DatabaseModificationOperations.UPDATE
          );
          console.log(`[FINALLY] ✅ Update registered`);
        } catch (errorFinal) {
          console.error(
            `[FINALLY] ❌ ERROR registering update:`,
            errorFinal
          );
        }
      }
    }
  }

  // NEW method to delete ALL events
  private async eliminarTodosLosEventos(): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      await new Promise<void>((resolve, reject) => {
        const request = store.clear(); // Delete all records
        request.onsuccess = () => {
          console.log(`[IDB] 🗑️ All events deleted`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IDB] ❌ Error deleting all events:`, error);
      throw error;
    }
  }

  // NEW method to get events that affect a specific month
  private obtenerEventosQueAfectanMes(
    todosEventos: IEventoLocal[],
    mes: number,
    año: number
  ): IEventoLocal[] {
    const primerDiaMes = new Date(año, mes - 1, 1);
    const ultimoDiaMes = new Date(año, mes, 0);

    return todosEventos.filter((evento) => {
      const fechaInicio = new Date(evento.Fecha_Inicio + "T00:00:00");
      const fechaConclusion = new Date(evento.Fecha_Conclusion + "T00:00:00");

      // The event affects the month if:
      // - It starts before or during the month AND ends during or after the month
      return fechaInicio <= ultimoDiaMes && fechaConclusion >= primerDiaMes;
    });
  }

  // REPLACE getEventsByMonth with new logic
  public async getEventosPorMes(
    mes: number,
    año?: number
  ): Promise<IEventoLocal[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // Validate month
      if (mes < 1 || mes > 12) {
        this.setError?.({
          success: false,
          message: "The month must be between 1 and 12",
          errorType: SystemErrorTypes.UNKNOWN_ERROR,
        });
        return [];
      }

      const añoFinal = año || new Date().getFullYear();

      console.log(
        `\n[EVENTS] ========== QUERY ${mes}/${añoFinal} ==========`
      );

      // Check if ALL events should be updated
      const debeActualizar = await this.debeActualizarEventos();

      if (debeActualizar) {
        console.log(`[EVENTS] 🔄 UPDATING all events...`);
        await this.fetchYActualizarTodosLosEventos();
      } else {
        console.log(`[EVENTS] ✅ Local events updated`);
      }

      // Get ALL local events
      const todosEventos = await this.obtenerTodosLosEventosLocales();

      // Filter only those that affect the queried month
      const eventosDelMes = this.obtenerEventosQueAfectanMes(
        todosEventos,
        mes,
        añoFinal
      );

      console.log(`[EVENTS] 📊 Results:`);
      console.log(`  Total events: ${todosEventos.length}`);
      console.log(
        `  Events for month ${mes}/${añoFinal}: ${eventosDelMes.length}`
      );

      // Sort by start date
      eventosDelMes.sort(
        (a, b) =>
          new Date(a.Fecha_Inicio + "T00:00:00").getTime() -
          new Date(b.Fecha_Inicio + "T00:00:00").getTime()
      );

      this.handleSuccess(
        `Found ${eventosDelMes.length} event(s) for ${mes}/${añoFinal}`
      );

      console.log(`[EVENTS] ========== QUERY COMPLETED ==========\n`);

      return eventosDelMes;
    } catch (error) {
      console.error(`❌ Error in getEventsByMonth():`, error);
      this.handleIndexedDBError(error, `get events for month ${mes}/${año}`);
      return [];
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  // NEW method to get all local events
  private async obtenerTodosLosEventosLocales(): Promise<IEventoLocal[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return await new Promise<IEventoLocal[]>((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const eventos = request.result as IEventoLocal[];
          console.log(`[IDB] 📦 ${eventos.length} local events obtained`);
          resolve(eventos);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IDB] ❌ Error getting all events:`, error);
      throw error;
    }
  }

  // UPDATE getAll to use the new logic
  public async getAll(filtros?: IEventoFilter): Promise<IEventoLocal[]> {
    // If there is a month filter, use getEventsByMonth
    if (filtros?.mes) {
      return this.getEventosPorMes(filtros.mes, filtros.año);
    }

    try {
      // Check if it should update
      const debeActualizar = await this.debeActualizarEventos();

      if (debeActualizar) {
        await this.fetchYActualizarTodosLosEventos();
      }

      // Get all events
      const todosEventos = await this.obtenerTodosLosEventosLocales();

      // Apply filters if they exist
      let eventosFiltrados = todosEventos;

      if (filtros) {
        eventosFiltrados = todosEventos.filter((evento) => {
          if (filtros.Id_Evento && evento.Id_Evento !== filtros.Id_Evento) {
            return false;
          }
          if (
            filtros.Nombre &&
            !evento.Nombre.toLowerCase().includes(filtros.Nombre.toLowerCase())
          ) {
            return false;
          }
          return true;
        });
      }

      this.handleSuccess(`Found ${eventosFiltrados.length} event(s)`);
      return eventosFiltrados;
    } catch (error) {
      this.handleIndexedDBError(error, "get event list");
      return [];
    }
  }

  private async guardarEventos(eventos: IEventoLocal[]): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      for (const evento of eventos) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(evento);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }
    } catch (error) {
      console.error(`[IDB] ❌ Error saving:`, error);
      throw error;
    }
  }

  public async getByID(id: number): Promise<IEventoLocal | null> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<IEventoLocal | null>((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      this.handleIndexedDBError(error, `get event with ID ${id}`);
      return null;
    }
  }

  public async hayEventoEnFecha(fecha: string): Promise<boolean> {
    try {
      const fechaObj = new Date(fecha + "T00:00:00");
      const mes = fechaObj.getMonth() + 1;
      const año = fechaObj.getFullYear();

      // Get events of the month
      const eventos = await this.getEventosPorMes(mes, año);

      const fechaBuscada = new Date(fecha + "T00:00:00");

      // Check if the date is within any event
      return eventos.some((evento) => {
        const fechaInicio = new Date(evento.Fecha_Inicio + "T00:00:00");
        const fechaConclusion = new Date(evento.Fecha_Conclusion + "T00:00:00");
        return fechaBuscada >= fechaInicio && fechaBuscada <= fechaConclusion;
      });
    } catch (error) {
      console.error(`[EVENTS] ❌ Error in hayEventoEnFecha:`, error);
      return false;
    }
  }

  private handleSuccess(message: string): void {
    this.setSuccessMessage?.({ message });
  }

  private handleIndexedDBError(error: unknown, operacion: string): void {
    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = `Error when ${operacion}`;

    if (error instanceof Error) {
      if (error.name === "ConstraintError") {
        errorType = DataConflictErrorTypes.VALUE_ALREADY_IN_USE;
        message = `Constraint error when ${operacion}`;
      } else if (error.name === "NotFoundError") {
        errorType = UserErrorTypes.USER_NOT_FOUND;
        message = `Resource not found when ${operacion}`;
      } else if (error.name === "QuotaExceededError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Storage exceeded when ${operacion}`;
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
