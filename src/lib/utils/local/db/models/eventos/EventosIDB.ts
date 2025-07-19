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

// Tipo para la entidad (reutilizamos la interfaz existente)
export type IEventoLocal = Pick<T_Eventos, "Id_Evento" | "Nombre"> & {
  Fecha_Inicio: string; // Formato YYYY-MM-DD
  Fecha_Conclusion: string; // Formato YYYY-MM-DD
  // ✅ NUEVO: Campos para sincronización granular
  mes_consultado?: number; // Mes por el cual se consultó este evento
  año_consultado?: number; // Año por el cual se consultó este evento
  ultima_actualizacion?: number; // Timestamp de cuando se obtuvo/actualizó
};

export interface IEventoFilter {
  Id_Evento?: number;
  Nombre?: string;
  mes?: number; // Filtro por mes
  año?: number; // Filtro por año
}

// ✅ NUEVO: Interfaz para metadatos de sincronización por mes
interface IMetadatoSincronizacionMes {
  clave: string; // "eventos_mes_2025_06"
  mes: number;
  año: number;
  ultima_actualizacion: number;
  cantidad_eventos: number;
}

export class EventosIDB {
  private tablaInfo: ITablaInfo = TablasSistema.EVENTOS;
  private nombreTablaLocal: string = this.tablaInfo.nombreLocal || "eventos";
  // ✅ USAR STORE EXISTENTE para metadatos
  private nombreTablaMetadatos: string = "system_meta";

  constructor(
    private siasisAPI: SiasisAPIS,
    private setIsSomethingLoading?: (isLoading: boolean) => void,
    private setError?: (error: ErrorResponseAPIBase | null) => void,
    private setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Normaliza una fecha ISO a formato YYYY-MM-DD
   */
  private normalizarFecha(fechaISO: string): string {
    return fechaISO.split("T")[0];
  }

  /**
   * ✅ NUEVO: Genera clave para metadatos de sincronización
   */
  private generarClaveMetadatos(mes: number, año: number): string {
    return `eventos_mes_${año}_${mes.toString().padStart(2, "0")}`;
  }

  /**
   * ✅ NUEVO: Guarda metadatos de sincronización por mes
   */
  private async guardarMetadatosSincronizacion(
    mes: number,
    año: number,
    cantidadEventos: number
  ): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaMetadatos,
        "readwrite"
      );
      const clave = this.generarClaveMetadatos(mes, año);

      const metadatos: IMetadatoSincronizacionMes = {
        clave,
        mes,
        año,
        ultima_actualizacion: Date.now(),
        cantidad_eventos: cantidadEventos,
      };

      return new Promise<void>((resolve, reject) => {
        const request = store.put({ key: clave, value: metadatos });

        request.onsuccess = () => {
          console.log(`💾 Metadatos guardados para ${clave}`);
          resolve();
        };

        request.onerror = () => {
          console.error(`❌ Error al guardar metadatos:`, request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`❌ Error al guardar metadatos de sincronización:`, error);
      throw error;
    }
  }

  /**
   * ✅ NUEVO: Obtiene metadatos de sincronización por mes
   */
  private async obtenerMetadatosSincronizacion(
    mes: number,
    año: number
  ): Promise<IMetadatoSincronizacionMes | null> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaMetadatos
      );
      const clave = this.generarClaveMetadatos(mes, año);

      return new Promise<IMetadatoSincronizacionMes | null>(
        (resolve, reject) => {
          const request = store.get(clave);

          request.onsuccess = () => {
            const resultado = request.result;
            resolve(resultado ? resultado.value : null);
          };

          request.onerror = () => {
            reject(request.error);
          };
        }
      );
    } catch (error) {
      console.error(`❌ Error al obtener metadatos de sincronización:`, error);
      return null;
    }
  }

  /**
   * ✅ NUEVO: Método de sincronización granular por mes/año específico
   */
  private async syncEventosPorMes(mes: number, año?: number): Promise<boolean> {
    try {
      const añoFinal = año || new Date().getFullYear();
      console.log(
        `🔄 Verificando sincronización para eventos de ${mes}/${añoFinal}`
      );

      // 1. Obtener metadatos de sincronización local
      const metadatosLocales = await this.obtenerMetadatosSincronizacion(
        mes,
        añoFinal
      );

      // 2. Obtener la última modificación de la tabla eventos desde el servidor
      const ultimaModificacionTabla = await new UltimaModificacionTablasIDB(
        this.siasisAPI
      ).getByTabla(this.tablaInfo.nombreRemoto!);

      // 3. Determinar si necesitamos sincronizar
      let debeSincronizar = false;

      if (!metadatosLocales) {
        debeSincronizar = true;
        console.log(
          `📥 No hay metadatos locales para ${mes}/${añoFinal}, sincronizando...`
        );
      } else if (!ultimaModificacionTabla) {
        debeSincronizar = false;
        console.log(
          `✅ No hay modificación remota registrada, manteniendo datos locales`
        );
      } else {
        const timestampLocal = metadatosLocales.ultima_actualizacion;
        const timestampRemoto = new Date(
          ultimaModificacionTabla.Fecha_Modificacion
        ).getTime();

        debeSincronizar = timestampLocal < timestampRemoto;

        console.log(`🕐 Comparación de timestamps para ${mes}/${añoFinal}:`);
        console.log(`   Local: ${new Date(timestampLocal).toLocaleString()}`);
        console.log(`   Remoto: ${new Date(timestampRemoto).toLocaleString()}`);
        console.log(`   ¿Debe sincronizar?: ${debeSincronizar}`);
      }

      // 4. Sincronizar si es necesario
      if (debeSincronizar) {
        console.log(
          `🚀 Iniciando sincronización de eventos para ${mes}/${añoFinal}...`
        );
        await this.fetchYActualizarEventosPorMes(mes, añoFinal);
        return true;
      } else {
        console.log(`✅ Eventos de ${mes}/${añoFinal} están actualizados`);
        return false;
      }
    } catch (error) {
      console.error(
        `❌ Error durante la sincronización de eventos para ${mes}/${año}:`,
        error
      );
      this.handleIndexedDBError(
        error,
        `sincronizar eventos del mes ${mes}/${año}`
      );
      return false;
    }
  }

  /**
   * ✅ NUEVO: Obtiene eventos desde la API y los actualiza por mes específico
   */
  private async fetchYActualizarEventosPorMes(
    mes: number,
    año: number
  ): Promise<void> {
    try {
      console.log(`📡 Obteniendo eventos de la API para ${mes}/${año}`);

      // 1. Obtener eventos desde la API
      const { fetchSiasisAPI } = fetchSiasisApiGenerator(this.siasisAPI);
      const endpoint = `/api/eventos?Mes=${mes}&Año=${año}`;

      console.log(`🌐 Endpoint: ${endpoint}`);

      const fetchCancelable = await fetchSiasisAPI({
        endpoint,
        method: "GET",
      });

      if (!fetchCancelable) {
        throw new Error("No se pudo crear la petición de eventos");
      }

      const response = await fetchCancelable.fetch();

      if (!response.ok) {
        throw new Error(`Error al obtener eventos: ${response.statusText}`);
      }

      const objectResponse = (await response.json()) as ApiResponseBase;

      if (!objectResponse.success) {
        throw new Error(
          `Error en respuesta de eventos: ${objectResponse.message}`
        );
      }

      const { data: eventosServidor } =
        objectResponse as GetEventosSuccessResponse;

      console.log(`📦 Eventos recibidos de la API: ${eventosServidor.length}`);

      // 2. Normalizar fechas y agregar metadatos de sincronización
      const eventosNormalizados: IEventoLocal[] = eventosServidor.map(
        (evento) => ({
          ...evento,
          Fecha_Inicio: this.normalizarFecha(String(evento.Fecha_Inicio)),
          Fecha_Conclusion: this.normalizarFecha(
            String(evento.Fecha_Conclusion)
          ),
          // ✅ AGREGAR metadatos de sincronización
          mes_consultado: mes,
          año_consultado: año,
          ultima_actualizacion: Date.now(),
        })
      );

      // 3. Eliminar eventos anteriores del mismo mes/año
      await this.eliminarEventosDelMes(mes, año);

      // 4. Guardar nuevos eventos en IndexedDB
      await this.guardarEventos(eventosNormalizados);

      // 5. Guardar metadatos de sincronización
      await this.guardarMetadatosSincronizacion(
        mes,
        año,
        eventosNormalizados.length
      );

      // 6. Registrar actualización en el sistema general
      await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
        this.tablaInfo.nombreLocal as TablasLocal,
        DatabaseModificationOperations.UPDATE
      );

      console.log(
        `✅ Sincronización completada para ${mes}/${año}: ${eventosNormalizados.length} eventos`
      );
    } catch (error) {
      console.error(
        `❌ Error al obtener y actualizar eventos para ${mes}/${año}:`,
        error
      );

      this.setError?.({
        success: false,
        message: `Error al sincronizar eventos: ${
          error instanceof Error ? error.message : String(error)
        }`,
        errorType: SystemErrorTypes.EXTERNAL_SERVICE_ERROR,
        details: {
          origen: "EventosIDB.fetchYActualizarEventosPorMes",
          timestamp: Date.now(),
        },
      });

      throw error;
    }
  }

  /**
   * ✅ NUEVO: Elimina eventos del mes/año específico antes de actualizar
   */
  private async eliminarEventosDelMes(mes: number, año: number): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.openCursor();
        let eliminados = 0;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.onsuccess = (event: any) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const evento = cursor.value as IEventoLocal;

            // Eliminar si fue consultado para el mismo mes/año
            if (
              evento.mes_consultado === mes &&
              evento.año_consultado === año
            ) {
              cursor.delete();
              eliminados++;
            }

            cursor.continue();
          } else {
            console.log(
              `🗑️ Eliminados ${eliminados} eventos del mes ${mes}/${año}`
            );
            resolve();
          }
        };

        request.onerror = () => {
          console.error("❌ Error durante la eliminación:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `❌ Error al eliminar eventos del mes ${mes}/${año}:`,
        error
      );
      throw error;
    }
  }

  /**
   * ✅ NUEVO: Guarda eventos en IndexedDB
   */
  private async guardarEventos(eventos: IEventoLocal[]): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      for (const evento of eventos) {
        await new Promise<void>((resolve, reject) => {
          const request = store.put(evento);

          request.onsuccess = () => {
            resolve();
          };

          request.onerror = () => {
            console.error(
              `❌ Error al guardar evento ${evento.Id_Evento}:`,
              request.error
            );
            reject(request.error);
          };
        });
      }

      console.log(`✅ ${eventos.length} eventos guardados correctamente`);
    } catch (error) {
      console.error(`❌ Error al guardar eventos:`, error);
      throw error;
    }
  }

  /**
   * ✅ MÉTODO PRINCIPAL: Obtiene eventos específicos para un mes y año
   */
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
        console.error(`❌ Mes inválido: ${mes}`);
        this.setError?.({
          success: false,
          message: "El mes debe estar entre 1 y 12",
          errorType: SystemErrorTypes.UNKNOWN_ERROR,
        });
        return [];
      }

      const añoFinal = año || new Date().getFullYear();
      console.log(`🎯 getEventosPorMes() llamado para ${mes}/${añoFinal}`);

      // 1. Sincronizar eventos del mes específico
      await this.syncEventosPorMes(mes, añoFinal);

      // 2. Obtener eventos del mes desde IndexedDB
      const eventos = await this.obtenerEventosDelMesLocal(mes, añoFinal);

      console.log(
        `✅ Eventos encontrados para ${mes}/${añoFinal}: ${eventos.length}`
      );

      // 3. Mostrar mensaje de éxito
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

  /**
   * ✅ NUEVO: Obtiene eventos del mes desde IndexedDB local
   */
  private async obtenerEventosDelMesLocal(
    mes: number,
    año: number
  ): Promise<IEventoLocal[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<IEventoLocal[]>((resolve, reject) => {
        const request = store.openCursor();
        const eventos: IEventoLocal[] = [];

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.onsuccess = (event: any) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const evento = cursor.value as IEventoLocal;

            // Incluir eventos que fueron consultados para este mes/año
            // O eventos que naturalmente pertenecen a este mes (para compatibilidad)
            if (
              evento.mes_consultado === mes &&
              evento.año_consultado === año
            ) {
              eventos.push(evento);
            } else if (!evento.mes_consultado) {
              // Compatibilidad: eventos sin metadatos, verificar por fecha
              const fechaInicio = new Date(evento.Fecha_Inicio + "T00:00:00");
              const fechaConclusión = new Date(
                evento.Fecha_Conclusion + "T00:00:00"
              );

              const mesInicio = fechaInicio.getMonth() + 1;
              const mesConclusión = fechaConclusión.getMonth() + 1;
              const añoInicio = fechaInicio.getFullYear();
              const añoConclusión = fechaConclusión.getFullYear();

              // Verificar si el evento incluye el mes/año solicitado
              const incluyeMes = mes >= mesInicio && mes <= mesConclusión;
              const incluyeAño = año >= añoInicio && año <= añoConclusión;

              if (incluyeMes && incluyeAño) {
                eventos.push(evento);
              }
            }

            cursor.continue();
          } else {
            // Ordenar por fecha de inicio
            eventos.sort(
              (a, b) =>
                new Date(a.Fecha_Inicio + "T00:00:00").getTime() -
                new Date(b.Fecha_Inicio + "T00:00:00").getTime()
            );

            resolve(eventos);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `❌ Error al obtener eventos locales del mes ${mes}/${año}:`,
        error
      );
      throw error;
    }
  }

  /**
   * ✅ MÉTODO HEREDADO: Para compatibilidad (simplificado)
   */
  public async getAll(filtros?: IEventoFilter): Promise<IEventoLocal[]> {
    // Si hay filtro por mes específico, usar el nuevo método optimizado
    if (filtros?.mes) {
      return this.getEventosPorMes(filtros.mes, filtros.año);
    }

    // Para consultas generales, usar método tradicional
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      const result = await new Promise<IEventoLocal[]>((resolve, reject) => {
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as IEventoLocal[]);
        request.onerror = () => reject(request.error);
      });

      // Aplicar filtros básicos
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

  /**
   * Obtiene un evento por su ID
   */
  public async getByID(id: number): Promise<IEventoLocal | null> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<IEventoLocal | null>((resolve, reject) => {
        const request = store.get(id);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      console.error(`Error al obtener evento con ID ${id}:`, error);
      this.handleIndexedDBError(error, `obtener evento con ID ${id}`);
      return null;
    }
  }

  /**
   * Verifica si hay eventos en una fecha específica
   */
  public async hayEventoEnFecha(fecha: string): Promise<boolean> {
    try {
      const fechaObj = new Date(fecha + "T00:00:00");
      const mes = fechaObj.getMonth() + 1;
      const año = fechaObj.getFullYear();

      const eventos = await this.getEventosPorMes(mes, año);
      const fechaBuscada = new Date(fecha + "T00:00:00");

      return eventos.some((evento) => {
        const fechaInicio = new Date(evento.Fecha_Inicio + "T00:00:00");
        const fechaConclusión = new Date(evento.Fecha_Conclusion + "T00:00:00");
        return fechaBuscada >= fechaInicio && fechaBuscada <= fechaConclusión;
      });
    } catch (error) {
      console.error("Error al verificar eventos en fecha:", error);
      return false;
    }
  }

  /**
   * Establece un mensaje de éxito
   */
  private handleSuccess(message: string): void {
    const successResponse: MessageProperty = { message };
    this.setSuccessMessage?.(successResponse);
  }

  /**
   * Maneja los errores de operaciones con IndexedDB
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
