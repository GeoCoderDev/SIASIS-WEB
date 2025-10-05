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
  mes_consultado?: number;
  año_consultado?: number;
  ultima_actualizacion?: number;
};

export interface IEventoFilter {
  Id_Evento?: number;
  Nombre?: string;
  mes?: number;
  año?: number;
}

interface IMetadatoSincronizacionMes {
  clave: string;
  mes: number;
  año: number;
  ultima_actualizacion: number;
  cantidad_eventos: number;
}

export class EventosIDB {
  private tablaInfo: ITablaInfo = TablasSistema.EVENTOS;
  private nombreTablaLocal: string = this.tablaInfo.nombreLocal || "eventos";
  private nombreTablaMetadatos: string = "system_meta";

  constructor(
    private siasisAPI: SiasisAPIS,
    private setIsSomethingLoading?: (isLoading: boolean) => void,
    private setError?: (error: ErrorResponseAPIBase | null) => void,
    private setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  private normalizarFecha(fechaISO: string): string {
    return fechaISO.split("T")[0];
  }

  private generarClaveMetadatos(mes: number, año: number): string {
    return `eventos_mes_${año}_${mes.toString().padStart(2, "0")}`;
  }

  private async guardarMetadatosSincronizacion(
    mes: number,
    año: number,
    cantidadEventos: number
  ): Promise<void> {
    const clave = this.generarClaveMetadatos(mes, año);

    console.log(`[METADATOS] 💾 Guardando para ${clave}:`);
    console.log(`  - Cantidad: ${cantidadEventos}`);
    console.log(`  - Timestamp: ${Date.now()}`);

    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaMetadatos,
        "readwrite"
      );

      const metadatos: IMetadatoSincronizacionMes = {
        clave,
        mes,
        año,
        ultima_actualizacion: Date.now(),
        cantidad_eventos: cantidadEventos,
      };

      await new Promise<void>((resolve, reject) => {
        const request = store.put({ key: clave, value: metadatos });

        request.onsuccess = () => {
          console.log(`[METADATOS] ✅ GUARDADOS EXITOSAMENTE: ${clave}`);
          resolve();
        };

        request.onerror = () => {
          console.error(`[METADATOS] ❌ ERROR AL GUARDAR:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`[METADATOS] ❌ EXCEPCIÓN:`, error);
      throw error;
    }
  }

  private async obtenerMetadatosSincronizacion(
    mes: number,
    año: number
  ): Promise<IMetadatoSincronizacionMes | null> {
    const clave = this.generarClaveMetadatos(mes, año);

    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaMetadatos
      );

      const resultado = await new Promise<IMetadatoSincronizacionMes | null>(
        (resolve, reject) => {
          const request = store.get(clave);

          request.onsuccess = () => {
            const dato = request.result;
            if (dato && dato.value) {
              console.log(
                `[METADATOS] ✅ ENCONTRADOS para ${clave}:`,
                dato.value
              );
              resolve(dato.value as IMetadatoSincronizacionMes);
            } else {
              console.log(`[METADATOS] ⚠️ NO EXISTEN para ${clave}`);
              resolve(null);
            }
          };

          request.onerror = () => {
            console.error(`[METADATOS] ❌ ERROR AL OBTENER:`, request.error);
            reject(request.error);
          };
        }
      );

      return resultado;
    } catch (error) {
      console.error(`[METADATOS] ❌ EXCEPCIÓN AL OBTENER:`, error);
      return null;
    }
  }

  private async syncEventosPorMes(mes: number, año: number): Promise<boolean> {
    console.log(`\n[SYNC] ========== INICIANDO SYNC ${mes}/${año} ==========`);

    try {
      const metadatosLocales = await this.obtenerMetadatosSincronizacion(
        mes,
        año
      );

      const ultimaModificacionTabla = await new UltimaModificacionTablasIDB(
        this.siasisAPI
      ).getByTabla(this.tablaInfo.nombreRemoto!);

      let debeSincronizar = false;

      if (!metadatosLocales) {
        console.log(`[SYNC] ❌ NO HAY METADATOS → DEBE SINCRONIZAR`);
        debeSincronizar = true;
      } else if (!ultimaModificacionTabla) {
        console.log(`[SYNC] ⚠️ NO HAY MOD. REMOTA → MANTENER LOCAL`);
        debeSincronizar = false;
      } else {
        const timestampLocal = metadatosLocales.ultima_actualizacion;
        const timestampRemoto = new Date(
          ultimaModificacionTabla.Fecha_Modificacion
        ).getTime();

        console.log(`[SYNC] 📊 Comparación:`);
        console.log(`  Local:  ${new Date(timestampLocal).toISOString()}`);
        console.log(`  Remoto: ${new Date(timestampRemoto).toISOString()}`);

        debeSincronizar = timestampLocal < timestampRemoto;
        console.log(
          `[SYNC] ${debeSincronizar ? "🔄" : "✅"} ¿Sincronizar? ${
            debeSincronizar ? "SÍ" : "NO"
          }`
        );
      }

      if (debeSincronizar) {
        console.log(`[SYNC] 🚀 CONSULTANDO API...`);
        await this.fetchYActualizarEventosPorMes(mes, año);
        console.log(`[SYNC] ========== SYNC COMPLETADO ==========\n`);
        return true;
      } else {
        console.log(`[SYNC] ========== DATOS ACTUALIZADOS ==========\n`);
        return false;
      }
    } catch (error) {
      console.error(`[SYNC] ❌ ERROR:`, error);
      this.handleIndexedDBError(
        error,
        `sincronizar eventos del mes ${mes}/${año}`
      );
      return false;
    }
  }

  // ✅ MÉTODO CRÍTICO CON try-catch-finally
  private async fetchYActualizarEventosPorMes(
    mes: number,
    año: number
  ): Promise<void> {
    console.log(`[API] 🌐 Consultando ${mes}/${año}...`);

    let cantidadEventos = 0;
    let consultaExitosa = false;

    try {
      const { fetchSiasisAPI } = fetchSiasisApiGenerator(this.siasisAPI);
      const endpoint = `/api/eventos?Mes=${mes}&Año=${año}`;

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

      cantidadEventos = eventosServidor?.length || 0;
      consultaExitosa = true;

      console.log(`[API] ✅ Respuesta: ${cantidadEventos} eventos`);

      // Limpiar eventos anteriores
      try {
        await this.eliminarEventosDelMes(mes, año);
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
              mes_consultado: mes,
              año_consultado: año,
              ultima_actualizacion: Date.now(),
            })
          );

          await this.guardarEventos(eventosNormalizados);
          console.log(`[IDB] ✅ ${cantidadEventos} eventos guardados`);
        } catch (e) {
          console.error(`[IDB] ❌ Error guardando eventos:`, e);
        }
      } else {
        console.log(`[IDB] ℹ️ Mes sin eventos`);
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
    } finally {
      // ✅ CRÍTICO: ESTO SE EJECUTA SIEMPRE
      console.log(
        `[FINALLY] 🔒 Guardando metadatos (cantidad: ${cantidadEventos})...`
      );

      try {
        await this.guardarMetadatosSincronizacion(mes, año, cantidadEventos);

        if (consultaExitosa) {
          await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
            this.tablaInfo.nombreLocal as TablasLocal,
            DatabaseModificationOperations.UPDATE
          );
        }

        console.log(`[FINALLY] ✅ Metadatos guardados correctamente`);
      } catch (errorFinal) {
        console.error(
          `[FINALLY] ❌ ERROR CRÍTICO guardando metadatos:`,
          errorFinal
        );
      }
    }
  }

  private async eliminarEventosDelMes(mes: number, año: number): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      await new Promise<void>((resolve, reject) => {
        const request = store.openCursor();
        let eliminados = 0;

        request.onsuccess = (event: any) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const evento = cursor.value as IEventoLocal;

            if (
              evento.mes_consultado === mes &&
              evento.año_consultado === año
            ) {
              cursor.delete();
              eliminados++;
            }

            cursor.continue();
          } else {
            console.log(`[IDB] 🗑️ Eliminados ${eliminados} eventos`);
            resolve();
          }
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`[IDB] ❌ Error eliminando:`, error);
      throw error;
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

  private async obtenerEventosDelMesLocal(
    mes: number,
    año: number
  ): Promise<IEventoLocal[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      const eventos = await new Promise<IEventoLocal[]>((resolve, reject) => {
        const request = store.openCursor();
        const resultado: IEventoLocal[] = [];

        request.onsuccess = (event: any) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const evento = cursor.value as IEventoLocal;

            if (
              evento.mes_consultado === mes &&
              evento.año_consultado === año
            ) {
              resultado.push(evento);
            }

            cursor.continue();
          } else {
            resultado.sort(
              (a, b) =>
                new Date(a.Fecha_Inicio + "T00:00:00").getTime() -
                new Date(b.Fecha_Inicio + "T00:00:00").getTime()
            );

            resolve(resultado);
          }
        };

        request.onerror = () => reject(request.error);
      });

      console.log(`[IDB] 📦 ${eventos.length} eventos locales`);
      return eventos;
    } catch (error) {
      console.error(`[IDB] ❌ Error obteniendo locales:`, error);
      throw error;
    }
  }

  public async getEventosPorMes(
    mes: number,
    año?: number
  ): Promise<IEventoLocal[]> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      if (mes < 1 || mes > 12) {
        this.setError?.({
          success: false,
          message: "El mes debe estar entre 1 y 12",
          errorType: SystemErrorTypes.UNKNOWN_ERROR,
        });
        return [];
      }

      const añoFinal = año || new Date().getFullYear();

      await this.syncEventosPorMes(mes, añoFinal);
      const eventos = await this.obtenerEventosDelMesLocal(mes, añoFinal);

      this.handleSuccess(
        `Se encontraron ${eventos.length} evento(s) para ${mes}/${añoFinal}`
      );

      return eventos;
    } catch (error) {
      console.error(`❌ Error en getEventosPorMes():`, error);
      this.handleIndexedDBError(error, `obtener eventos del mes ${mes}/${año}`);
      return [];
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  public async getAll(filtros?: IEventoFilter): Promise<IEventoLocal[]> {
    if (filtros?.mes) {
      return this.getEventosPorMes(filtros.mes, filtros.año);
    }

    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      const result = await new Promise<IEventoLocal[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as IEventoLocal[]);
        request.onerror = () => reject(request.error);
      });

      let eventosFiltrados = result;

      if (filtros) {
        eventosFiltrados = result.filter((evento) => {
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

      const eventos = await this.getEventosPorMes(mes, año);
      const fechaBuscada = new Date(fecha + "T00:00:00");

      return eventos.some((evento) => {
        const fechaInicio = new Date(evento.Fecha_Inicio + "T00:00:00");
        const fechaConclusion = new Date(evento.Fecha_Conclusion + "T00:00:00");
        return fechaBuscada >= fechaInicio && fechaBuscada <= fechaConclusion;
      });
    } catch (error) {
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
