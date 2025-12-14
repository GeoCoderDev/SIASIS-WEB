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
  ultima_actualizacion?: number; // ⚠️ ELIMINAR mes_consultado y año_consultado
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

  //  NUEVA LÓGICA: Sincronización basada en última modificación de tabla remota
  private async debeActualizarEventos(): Promise<boolean> {
    try {
      console.log(`[SYNC] 📊 Verificando si debe actualizar eventos...`);

      // Obtener última actualización local
      const ultimaActLocal =
        await ultimaActualizacionTablasLocalesIDB.getByTabla(
          this.tablaInfo.nombreLocal as TablasLocal
        );

      // Obtener última modificación remota
      const ultimaModRemota = await new UltimaModificacionTablasIDB(
        this.siasisAPI
      ).getByTabla(this.tablaInfo.nombreRemoto!);

      // Si no hay datos locales, actualizar
      if (!ultimaActLocal) {
        console.log(`[SYNC] ❌ NO HAY DATOS LOCALES → DEBE ACTUALIZAR`);
        return true;
      }

      // Si no hay modificación remota, mantener local
      if (!ultimaModRemota) {
        console.log(`[SYNC] ⚠️ NO HAY MOD. REMOTA → MANTENER LOCAL`);
        return false;
      }

      // Comparar timestamps
      const timestampLocal = new Date(
        ultimaActLocal.Fecha_Actualizacion
      ).getTime();
      const timestampRemoto = new Date(
        ultimaModRemota.Fecha_Modificacion
      ).getTime();

      console.log(`[SYNC] 📊 Comparación:`);
      console.log(`  Local:  ${new Date(timestampLocal).toISOString()}`);
      console.log(`  Remoto: ${new Date(timestampRemoto).toISOString()}`);

      const debeActualizar = timestampLocal < timestampRemoto;
      console.log(
        `[SYNC] ${debeActualizar ? "🔄" : "✅"} ¿Actualizar? ${
          debeActualizar ? "SÍ" : "NO"
        }`
      );

      return debeActualizar;
    } catch (error) {
      console.error(`[SYNC] ❌ ERROR:`, error);
      // En caso de error, mejor actualizar para estar seguros
      return true;
    }
  }

  //  REEMPLAZAR fetchYActualizarEventosPorMes con nueva lógica global
  private async fetchYActualizarTodosLosEventos(): Promise<void> {
    console.log(`[API] 🌐 Consultando TODOS los eventos...`);
    let consultaExitosa = false;

    try {
      const { fetchSiasisAPI } = fetchSiasisApiGenerator(this.siasisAPI);

      // Consultar SIN filtros de mes/año para obtener TODOS los eventos activos
      const endpoint = `/api/eventos`;

      const fetchCancelable = await fetchSiasisAPI({
        endpoint,
        method: "GET",
      });

      if (!fetchCancelable) {
        throw new Error("No se pudo crear la petición");
      }

      const response = await fetchCancelable.fetch();

      if (!response.ok) {
        throw new Error(`Error HTTP: ${response.statusText}`);
      }

      const objectResponse = (await response.json()) as ApiResponseBase;

      if (!objectResponse.success) {
        throw new Error(`Error en respuesta: ${objectResponse.message}`);
      }

      const { data: eventosServidor } =
        objectResponse as GetEventosSuccessResponse;
      const cantidadEventos = eventosServidor?.length || 0;
      consultaExitosa = true;

      console.log(`[API] ✅ Respuesta: ${cantidadEventos} eventos`);

      // LIMPIAR TODOS los eventos anteriores
      try {
        await this.eliminarTodosLosEventos();
        console.log(`[IDB] 🗑️ Eventos anteriores eliminados`);
      } catch (e) {
        console.warn(`[IDB] ⚠️ Error limpiando (continuando):`, e);
      }

      // Guardar eventos solo si hay
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
              // ⚠️ NO incluir mes_consultado ni año_consultado
            })
          );

          await this.guardarEventos(eventosNormalizados);
          console.log(`[IDB] ✅ ${cantidadEventos} eventos guardados`);
        } catch (e) {
          console.error(`[IDB] ❌ Error guardando eventos:`, e);
          throw e; // Propagar error para que se maneje en el catch principal
        }
      } else {
        console.log(`[IDB] ℹ️ No hay eventos activos`);
      }
    } catch (error) {
      console.error(`[API] ❌ Error en consulta:`, error);
      this.setError?.({
        success: false,
        message: `Error al sincronizar: ${
          error instanceof Error ? error.message : String(error)
        }`,
        errorType: SystemErrorTypes.EXTERNAL_SERVICE_ERROR,
      });
      throw error; // Re-lanzar para que se maneje arriba
    } finally {
      // Registrar actualización solo si fue exitosa
      if (consultaExitosa) {
        try {
          await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
            this.tablaInfo.nombreLocal as TablasLocal,
            DatabaseModificationOperations.UPDATE
          );
          console.log(`[FINALLY] ✅ Actualización registrada`);
        } catch (errorFinal) {
          console.error(
            `[FINALLY] ❌ ERROR registrando actualización:`,
            errorFinal
          );
        }
      }
    }
  }

  //  NUEVO método para eliminar TODOS los eventos
  private async eliminarTodosLosEventos(): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      await new Promise<void>((resolve, reject) => {
        const request = store.clear(); // Eliminar todos los registros
        request.onsuccess = () => {
          console.log(`[IDB] 🗑️ Todos los eventos eliminados`);
          resolve();
        };
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IDB] ❌ Error eliminando todos los eventos:`, error);
      throw error;
    }
  }

  //  NUEVO método para obtener eventos que afectan a un mes específico
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

      // El evento afecta al mes si:
      // - Comienza antes o durante el mes Y termina durante o después del mes
      return fechaInicio <= ultimoDiaMes && fechaConclusion >= primerDiaMes;
    });
  }

  //  REEMPLAZAR getEventosPorMes con nueva lógica
  public async getEventosPorMes(
    mes: number,
    año?: number
  ): Promise<IEventoLocal[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // Validar mes
      if (mes < 1 || mes > 12) {
        this.setError?.({
          success: false,
          message: "El mes debe estar entre 1 y 12",
          errorType: SystemErrorTypes.UNKNOWN_ERROR,
        });
        return [];
      }

      const añoFinal = año || new Date().getFullYear();

      console.log(
        `\n[EVENTOS] ========== CONSULTA ${mes}/${añoFinal} ==========`
      );

      // Verificar si debe actualizar TODOS los eventos
      const debeActualizar = await this.debeActualizarEventos();

      if (debeActualizar) {
        console.log(`[EVENTOS] 🔄 ACTUALIZANDO todos los eventos...`);
        await this.fetchYActualizarTodosLosEventos();
      } else {
        console.log(`[EVENTOS] ✅ Eventos locales actualizados`);
      }

      // Obtener TODOS los eventos locales
      const todosEventos = await this.obtenerTodosLosEventosLocales();

      // Filtrar solo los que afectan al mes consultado
      const eventosDelMes = this.obtenerEventosQueAfectanMes(
        todosEventos,
        mes,
        añoFinal
      );

      console.log(`[EVENTOS] 📊 Resultados:`);
      console.log(`  Total eventos: ${todosEventos.length}`);
      console.log(
        `  Eventos del mes ${mes}/${añoFinal}: ${eventosDelMes.length}`
      );

      // Ordenar por fecha de inicio
      eventosDelMes.sort(
        (a, b) =>
          new Date(a.Fecha_Inicio + "T00:00:00").getTime() -
          new Date(b.Fecha_Inicio + "T00:00:00").getTime()
      );

      this.handleSuccess(
        `Se encontraron ${eventosDelMes.length} evento(s) para ${mes}/${añoFinal}`
      );

      console.log(`[EVENTOS] ========== CONSULTA COMPLETADA ==========\n`);

      return eventosDelMes;
    } catch (error) {
      console.error(`❌ Error en getEventosPorMes():`, error);
      this.handleIndexedDBError(error, `obtener eventos del mes ${mes}/${año}`);
      return [];
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  //  NUEVO método para obtener todos los eventos locales
  private async obtenerTodosLosEventosLocales(): Promise<IEventoLocal[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return await new Promise<IEventoLocal[]>((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const eventos = request.result as IEventoLocal[];
          console.log(`[IDB] 📦 ${eventos.length} eventos locales obtenidos`);
          resolve(eventos);
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IDB] ❌ Error obteniendo todos los eventos:`, error);
      throw error;
    }
  }

  //  ACTUALIZAR getAll para usar la nueva lógica
  public async getAll(filtros?: IEventoFilter): Promise<IEventoLocal[]> {
    // Si hay filtro de mes, usar getEventosPorMes
    if (filtros?.mes) {
      return this.getEventosPorMes(filtros.mes, filtros.año);
    }

    try {
      // Verificar si debe actualizar
      const debeActualizar = await this.debeActualizarEventos();

      if (debeActualizar) {
        await this.fetchYActualizarTodosLosEventos();
      }

      // Obtener todos los eventos
      const todosEventos = await this.obtenerTodosLosEventosLocales();

      // Aplicar filtros si existen
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

      this.handleSuccess(`Se encontraron ${eventosFiltrados.length} evento(s)`);
      return eventosFiltrados;
    } catch (error) {
      this.handleIndexedDBError(error, "obtener lista de eventos");
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
      console.error(`[IDB] ❌ Error guardando:`, error);
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
      this.handleIndexedDBError(error, `obtener evento con ID ${id}`);
      return null;
    }
  }

  public async hayEventoEnFecha(fecha: string): Promise<boolean> {
    try {
      const fechaObj = new Date(fecha + "T00:00:00");
      const mes = fechaObj.getMonth() + 1;
      const año = fechaObj.getFullYear();

      // Obtener eventos del mes
      const eventos = await this.getEventosPorMes(mes, año);

      const fechaBuscada = new Date(fecha + "T00:00:00");

      // Verificar si la fecha está dentro de algún evento
      return eventos.some((evento) => {
        const fechaInicio = new Date(evento.Fecha_Inicio + "T00:00:00");
        const fechaConclusion = new Date(evento.Fecha_Conclusion + "T00:00:00");
        return fechaBuscada >= fechaInicio && fechaBuscada <= fechaConclusion;
      });
    } catch (error) {
      console.error(`[EVENTOS] ❌ Error en hayEventoEnFecha:`, error);
      return false;
    }
  }

  private handleSuccess(message: string): void {
    this.setSuccessMessage?.({ message });
  }

  private handleIndexedDBError(error: unknown, operacion: string): void {
    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = `Error al ${operacion}`;

    if (error instanceof Error) {
      if (error.name === "ConstraintError") {
        errorType = DataConflictErrorTypes.VALUE_ALREADY_IN_USE;
        message = `Error de restricción al ${operacion}`;
      } else if (error.name === "NotFoundError") {
        errorType = UserErrorTypes.USER_NOT_FOUND;
        message = `No se encontró el recurso al ${operacion}`;
      } else if (error.name === "QuotaExceededError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Almacenamiento excedido al ${operacion}`;
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
