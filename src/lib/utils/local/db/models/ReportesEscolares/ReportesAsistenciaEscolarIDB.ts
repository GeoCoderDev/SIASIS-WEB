import IndexedDBConnection from "@/constants/singleton/IndexedDBConnection";
import {
  TablasSistema,
  ITablaInfo,
  TablasLocal,
} from "@/interfaces/shared/TablasSistema";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import AllErrorTypes, {
  SystemErrorTypes,
  UserErrorTypes,
} from "@/interfaces/shared/errors";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import comprobarSincronizacionDeTabla from "@/lib/helpers/validations/comprobarSincronizacionDeTabla";

import {
  ReporteAsistenciaEscolarAnonimo,
  EstadoReporteAsistenciaEscolar,
  TipoReporteAsistenciaEscolar,
  ReporteAsistenciaEscolarPorDias,
  ReporteAsistenciaEscolarPorMeses,
} from "@/interfaces/shared/ReporteAsistenciaEscolar";
import decodificarCombinacionParametrosParaReporteEscolar from "@/lib/helpers/decoders/reportes-asistencia-escolares/decodificarCombinacionParametrosParaReporteEscolar";
import { Endpoint_Get_Reportes_Disponibles_Asistencia_Escolar } from "@/lib/utils/backend/endpoints/api01/ReportesAsistenciaEscolar";
import ultimaActualizacionTablasLocalesIDB from "../UltimaActualizacionTablasLocalesIDB";
import { DatabaseModificationOperations } from "@/interfaces/shared/DatabaseModificationOperations";
import { downloadJSONFromGoogleDriveById } from "@/lib/helpers/downloaders/downloadJSONFromGoogleDriveById";

// Tipo extendido con datos descargados
export interface IReporteAsistenciaEscolarLocal
  extends ReporteAsistenciaEscolarAnonimo {
  datos?:
    | ReporteAsistenciaEscolarPorDias
    | ReporteAsistenciaEscolarPorMeses
    | null;
  ultima_fecha_actualizacion?: number;
}

export interface ICrearReporteParams {
  Combinacion_Parametros_Reporte: string;
}

export interface IEstimacionTiempo {
  tiempoMinimoSegundos: number;
  tiempoEstimadoTotalSegundos: number;
  tiempoAdicionalPorDatos: number;
  descripcion: string;
}

export class ReportesAsistenciaEscolarIDB {
  private tablaInfo: ITablaInfo = TablasSistema.REPORTES_ASISTENCIA_ESCOLAR;
  private nombreTablaLocal: string =
    this.tablaInfo.nombreLocal || "reportes_asistencia_escolar";

  // ====================================================================
  // CONSTANTES DE CONFIGURACIÓN (puedes modificar estos valores)
  // ====================================================================

  /**
   * Tiempo mínimo de espera antes del primer polling (en segundos)
   * Este es el tiempo que tarda GitHub Actions en hacer el build inicial
   */
  public readonly TIEMPO_MINIMO_GENERACION_SEGUNDOS = 35;

  /**
   * Intervalo entre cada intento de polling (en segundos)
   */
  public readonly INTERVALO_POLLING_SEGUNDOS = 10;

  /**
   * Tiempo estimado base por mes de datos (en segundos)
   */
  private readonly TIEMPO_BASE_POR_MES_SEGUNDOS = 5;

  /**
   * Tiempo adicional por cada aula (en segundos)
   */
  private readonly TIEMPO_POR_AULA_SEGUNDOS = 2;

  /**
   * Tiempo adicional por cada día en reportes diarios (en segundos)
   */
  private readonly TIEMPO_POR_DIA_SEGUNDOS = 0.5;

  /**
   * Factor multiplicador para múltiples meses
   */
  private readonly FACTOR_MULTIPLES_MESES = 1.2;

  // ====================================================================

  constructor(
    private siasisAPI: SiasisAPIS = "API01",
    private setIsSomethingLoading?: (isLoading: boolean) => void,
    private setError?: (error: ErrorResponseAPIBase | null) => void,
    private setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Método de sincronización que se ejecutará al inicio de cada operación
   */
  private async sync(): Promise<void> {
    try {
      const debeSincronizar = await comprobarSincronizacionDeTabla(
        this.tablaInfo,
        this.siasisAPI
      );

      if (!debeSincronizar) {
        return;
      }

      await this.fetchYActualizarReportes();
    } catch (error) {
      console.error(
        "Error durante la sincronización de reportes de asistencia escolar:",
        error
      );
      this.handleIndexedDBError(
        error,
        "sincronizar reportes de asistencia escolar"
      );
    }
  }

  /**
   * Obtiene los reportes desde la API y los actualiza localmente
   */
  private async fetchYActualizarReportes(): Promise<void> {
    try {
      const { data: reportes } =
        await Endpoint_Get_Reportes_Disponibles_Asistencia_Escolar.realizarPeticion();

      const result = await this.upsertFromServer(reportes);

      await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
        this.tablaInfo.nombreLocal as TablasLocal,
        DatabaseModificationOperations.UPDATE
      );

      console.log(
        `Sincronización de reportes completada: ${reportes.length} reportes procesados (${result.created} creados, ${result.updated} actualizados, ${result.deleted} eliminados, ${result.errors} errores)`
      );
    } catch (error) {
      console.error(
        "Error al obtener y actualizar reportes de asistencia escolar:",
        error
      );

      let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
      let message = "Error al sincronizar reportes de asistencia escolar";

      if (error instanceof Error) {
        if (
          error.message.includes("network") ||
          error.message.includes("fetch")
        ) {
          errorType = SystemErrorTypes.EXTERNAL_SERVICE_ERROR;
          message =
            "Error de red al sincronizar reportes de asistencia escolar";
        } else if (
          error.name === "TransactionInactiveError" ||
          error.name === "QuotaExceededError"
        ) {
          errorType = SystemErrorTypes.DATABASE_ERROR;
          message =
            "Error de base de datos al sincronizar reportes de asistencia escolar";
        } else {
          message = error.message;
        }
      }

      this.setError?.({
        success: false,
        message: message,
        errorType: errorType,
        details: {
          origen: "ReportesAsistenciaEscolarIDB.fetchYActualizarReportes",
          timestamp: Date.now(),
        },
      });

      throw error;
    }
  }

  /**
   * Obtiene todas las combinaciones de parámetros almacenadas localmente
   */
  private async getAllCombinaciones(): Promise<string[]> {
    try {
      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      return new Promise<string[]>((resolve, reject) => {
        const combinaciones: string[] = [];
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;
          if (cursor) {
            combinaciones.push(cursor.value.Combinacion_Parametros_Reporte);
            cursor.continue();
          } else {
            resolve(combinaciones);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        "Error al obtener todas las combinaciones de reportes:",
        error
      );
      throw error;
    }
  }

  /**
   * Elimina un reporte por su combinación de parámetros
   */
  private async deleteByCombinacion(combinacion: string): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.delete(combinacion);

        request.onsuccess = () => {
          resolve();
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `Error al eliminar reporte con combinación ${combinacion}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Actualiza o crea reportes en lote desde el servidor
   * También elimina registros que ya no existen en el servidor
   */
  private async upsertFromServer(
    reportesServidor: ReporteAsistenciaEscolarAnonimo[]
  ): Promise<{
    created: number;
    updated: number;
    deleted: number;
    errors: number;
  }> {
    const result = { created: 0, updated: 0, deleted: 0, errors: 0 };

    try {
      const combinacionesLocales = await this.getAllCombinaciones();
      const combinacionesServidor = new Set(
        reportesServidor.map((r) => r.Combinacion_Parametros_Reporte)
      );

      const combinacionesAEliminar = combinacionesLocales.filter(
        (comb) => !combinacionesServidor.has(comb)
      );

      for (const combinacion of combinacionesAEliminar) {
        try {
          await this.deleteByCombinacion(combinacion);
          result.deleted++;
        } catch (error) {
          console.error(`Error al eliminar reporte ${combinacion}:`, error);
          result.errors++;
        }
      }

      const BATCH_SIZE = 20;

      for (let i = 0; i < reportesServidor.length; i += BATCH_SIZE) {
        const lote = reportesServidor.slice(i, i + BATCH_SIZE);

        for (const reporteServidor of lote) {
          try {
            const existeReporte =
              await this.obtenerReportePorCombinacionParametros(
                reporteServidor.Combinacion_Parametros_Reporte,
                false // No hacer sync aquí para evitar recursión
              );

            const reporteLocal: IReporteAsistenciaEscolarLocal = {
              Combinacion_Parametros_Reporte:
                reporteServidor.Combinacion_Parametros_Reporte,
              Datos_Google_Drive_Id:
                reporteServidor.Datos_Google_Drive_Id || null,
              Estado_Reporte: reporteServidor.Estado_Reporte,
              Fecha_Generacion: reporteServidor.Fecha_Generacion,
              datos: existeReporte?.datos || null,
              ultima_fecha_actualizacion: Date.now(),
            };

            const store = await IndexedDBConnection.getStore(
              this.nombreTablaLocal,
              "readwrite"
            );

            await new Promise<void>((resolve, reject) => {
              const request = store.put(reporteLocal);

              request.onsuccess = () => {
                if (existeReporte) {
                  result.updated++;
                } else {
                  result.created++;
                }
                resolve();
              };

              request.onerror = () => {
                result.errors++;
                console.error(
                  `Error al guardar reporte ${reporteServidor.Combinacion_Parametros_Reporte}:`,
                  request.error
                );
                reject(request.error);
              };
            });
          } catch (error) {
            result.errors++;
            console.error(
              `Error al procesar reporte ${reporteServidor.Combinacion_Parametros_Reporte}:`,
              error
            );
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      return result;
    } catch (error) {
      console.error("Error en la operación upsertFromServer:", error);
      result.errors++;
      return result;
    }
  }

  /**
   * Obtiene un reporte por su combinación de parámetros
   * @param combinacionParametros Combinación de parámetros del reporte
   * @param shouldSync Si debe ejecutar sincronización antes de consultar
   * @returns Reporte encontrado o null
   */
  public async obtenerReportePorCombinacionParametros(
    combinacionParametros: string,
    shouldSync: boolean = true
  ): Promise<IReporteAsistenciaEscolarLocal | null> {
    if (shouldSync) {
      this.setIsSomethingLoading?.(true);
      this.setError?.(null);
      this.setSuccessMessage?.(null);
    }

    try {
      if (shouldSync) {
        await this.sync();
      }

      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      const reporte = await new Promise<IReporteAsistenciaEscolarLocal | null>(
        (resolve, reject) => {
          const request = store.get(combinacionParametros);

          request.onsuccess = () => {
            resolve(request.result || null);
          };

          request.onerror = () => {
            reject(request.error);
          };
        }
      );

      // Si el reporte está disponible y no tiene datos descargados, descargarlos
      if (
        reporte &&
        reporte.Estado_Reporte === EstadoReporteAsistenciaEscolar.DISPONIBLE &&
        !reporte.datos &&
        reporte.Datos_Google_Drive_Id
      ) {
        const datos = await this.descargarDatosReporte(
          reporte.Datos_Google_Drive_Id,
          combinacionParametros
        );
        reporte.datos = datos;

        // Actualizar en la base de datos con los datos descargados
        const storeWrite = await IndexedDBConnection.getStore(
          this.nombreTablaLocal,
          "readwrite"
        );

        await new Promise<void>((resolve, reject) => {
          const request = storeWrite.put({
            ...reporte,
            ultima_fecha_actualizacion: Date.now(),
          });
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      }

      if (shouldSync) {
        this.setIsSomethingLoading?.(false);
      }

      return reporte;
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `obtener reporte con combinación ${combinacionParametros}`
      );
      if (shouldSync) {
        this.setIsSomethingLoading?.(false);
      }
      return null;
    }
  }

  /**
   * Descarga los datos del reporte desde Google Drive
   */
  private async descargarDatosReporte(
    googleDriveId: string,
    combinacionParametros: string
  ): Promise<
    ReporteAsistenciaEscolarPorDias | ReporteAsistenciaEscolarPorMeses | null
  > {
    try {
      const parametrosDecodificados =
        decodificarCombinacionParametrosParaReporteEscolar(
          combinacionParametros
        );

      if (!parametrosDecodificados) {
        throw new Error("No se pudo decodificar la combinación de parámetros");
      }

      if (
        parametrosDecodificados.tipoReporte ===
        TipoReporteAsistenciaEscolar.POR_DIA
      ) {
        const datos =
          await downloadJSONFromGoogleDriveById<ReporteAsistenciaEscolarPorDias>(
            googleDriveId
          );
        return datos;
      } else {
        const datos =
          await downloadJSONFromGoogleDriveById<ReporteAsistenciaEscolarPorMeses>(
            googleDriveId
          );
        return datos;
      }
    } catch (error) {
      console.error("Error al descargar datos del reporte:", error);
      return null;
    }
  }

  /**
   * Crea un nuevo reporte o verifica si ya existe
   * @param combinacionParametros Combinación de parámetros para el reporte
   * @returns El reporte creado o existente
   */
  public async crearReporte(
    combinacionParametros: string
  ): Promise<IReporteAsistenciaEscolarLocal | null> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // Primero sincronizar para verificar si ya existe
      await this.sync();

      // Verificar si el reporte ya existe localmente
      const reporteExistente =
        await this.obtenerReportePorCombinacionParametros(
          combinacionParametros,
          false
        );

      if (reporteExistente) {
        // Si ya existe, verificar su estado
        if (
          reporteExistente.Estado_Reporte ===
            EstadoReporteAsistenciaEscolar.DISPONIBLE &&
          reporteExistente.datos
        ) {
          this.handleSuccess("El reporte ya está disponible");
          this.setIsSomethingLoading?.(false);
          return reporteExistente;
        } else if (
          reporteExistente.Estado_Reporte ===
          EstadoReporteAsistenciaEscolar.PENDIENTE
        ) {
          this.handleSuccess(
            "El reporte ya está siendo generado. Puedes consultarlo en unos momentos."
          );
          this.setIsSomethingLoading?.(false);
          return reporteExistente;
        }
      }

      // Si no existe o está en error, crear uno nuevo en el servidor
      const response = await fetch("/api/reportes-escolares/crear", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          Combinacion_Parametros_Reporte: combinacionParametros,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.message || "Error al crear el reporte en el servidor"
        );
      }

      const nuevoReporte: ReporteAsistenciaEscolarAnonimo =
        await response.json();

      // ✅ ASEGURAR QUE EL OBJETO TENGA TODOS LOS CAMPOS REQUERIDOS
      // Guardar en IndexedDB
      const reporteLocal: IReporteAsistenciaEscolarLocal = {
        // Primero los campos del servidor
        Estado_Reporte: nuevoReporte.Estado_Reporte,
        Datos_Google_Drive_Id: nuevoReporte.Datos_Google_Drive_Id || null,
        Fecha_Generacion: nuevoReporte.Fecha_Generacion,

        // ✅ ASEGURAR QUE SIEMPRE TENGA EL KEY PATH
        Combinacion_Parametros_Reporte: combinacionParametros,

        // Campos locales
        datos: null,
        ultima_fecha_actualizacion: Date.now(),
      };

      const store = await IndexedDBConnection.getStore(
        this.nombreTablaLocal,
        "readwrite"
      );

      await new Promise<void>((resolve, reject) => {
        const request = store.put(reporteLocal);
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });

      this.handleSuccess(
        "Reporte creado exitosamente. La generación ha comenzado."
      );
      this.setIsSomethingLoading?.(false);

      return reporteLocal;
    } catch (error) {
      this.handleIndexedDBError(error, "crear reporte");
      this.setIsSomethingLoading?.(false);
      return null;
    }
  }

  /**
   * Realiza polling para verificar el estado de un reporte
   * @param combinacionParametros Combinación de parámetros del reporte
   * @param onUpdate Callback que se ejecuta en cada actualización
   * @returns Promise que se resuelve cuando el reporte está disponible o en error
   */
  public async pollingReporteAsistenciaEscolar(
    combinacionParametros: string,
    onUpdate?: (
      reporte: IReporteAsistenciaEscolarLocal,
      tiempoTranscurrido: number
    ) => void
  ): Promise<IReporteAsistenciaEscolarLocal | null> {
    try {
      // Esperar el tiempo mínimo antes del primer polling
      await new Promise((resolve) =>
        setTimeout(resolve, this.TIEMPO_MINIMO_GENERACION_SEGUNDOS * 1000)
      );

      let tiempoTranscurrido = this.TIEMPO_MINIMO_GENERACION_SEGUNDOS;

      while (true) {
        // Hacer la petición al endpoint de Next.js API
        const response = await fetch(
          `/api/reportes-escolares/${combinacionParametros}`
        );

        if (!response.ok) {
          throw new Error("Error al consultar el estado del reporte");
        }

        const reporteServidor: ReporteAsistenciaEscolarAnonimo =
          await response.json();

        // Actualizar en IndexedDB
        let reporteLocal: IReporteAsistenciaEscolarLocal = {
          ...reporteServidor,
          datos: null,
          ultima_fecha_actualizacion: Date.now(),
        };

        // Si está disponible, descargar datos
        if (
          reporteServidor.Estado_Reporte ===
            EstadoReporteAsistenciaEscolar.DISPONIBLE &&
          reporteServidor.Datos_Google_Drive_Id
        ) {
          const datos = await this.descargarDatosReporte(
            reporteServidor.Datos_Google_Drive_Id,
            combinacionParametros
          );
          reporteLocal.datos = datos;
        }

        // Guardar en IndexedDB
        const store = await IndexedDBConnection.getStore(
          this.nombreTablaLocal,
          "readwrite"
        );

        await new Promise<void>((resolve, reject) => {
          const request = store.put(reporteLocal);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });

        // Llamar al callback si existe
        if (onUpdate) {
          onUpdate(reporteLocal, tiempoTranscurrido);
        }

        // Si el reporte está disponible o en error, terminar el polling
        if (
          reporteServidor.Estado_Reporte ===
            EstadoReporteAsistenciaEscolar.DISPONIBLE ||
          reporteServidor.Estado_Reporte ===
            EstadoReporteAsistenciaEscolar.ERROR
        ) {
          return reporteLocal;
        }

        // Esperar el intervalo antes del siguiente polling
        await new Promise((resolve) =>
          setTimeout(resolve, this.INTERVALO_POLLING_SEGUNDOS * 1000)
        );

        tiempoTranscurrido += this.INTERVALO_POLLING_SEGUNDOS;
      }
    } catch (error) {
      console.error("Error en polling de reporte:", error);
      this.handleIndexedDBError(
        error,
        "realizar polling del reporte de asistencia escolar"
      );
      return null;
    }
  }

  /**
   * Estima el tiempo de generación de un reporte basado en los parámetros
   * @param combinacionParametros Combinación de parámetros del reporte
   * @returns Estimación de tiempo en segundos
   */
  public estimarTiempoGeneracion(
    combinacionParametros: string
  ): IEstimacionTiempo {
    try {
      const parametrosDecodificados =
        decodificarCombinacionParametrosParaReporteEscolar(
          combinacionParametros
        );

      if (!parametrosDecodificados) {
        return {
          tiempoMinimoSegundos: this.TIEMPO_MINIMO_GENERACION_SEGUNDOS,
          tiempoEstimadoTotalSegundos: this.TIEMPO_MINIMO_GENERACION_SEGUNDOS,
          tiempoAdicionalPorDatos: 0,
          descripcion: "No se pudo estimar el tiempo",
        };
      }

      const { tipoReporte, rangoTiempo, aulasSeleccionadas } =
        parametrosDecodificados;

      let tiempoAdicional = 0;

      // Calcular número de meses
      const numeroMeses = rangoTiempo.HastaMes - rangoTiempo.DesdeMes + 1;

      // Tiempo base por meses
      tiempoAdicional += numeroMeses * this.TIEMPO_BASE_POR_MES_SEGUNDOS;

      // Si son múltiples meses, aplicar factor multiplicador
      if (numeroMeses > 1) {
        tiempoAdicional *= this.FACTOR_MULTIPLES_MESES;
      }

      // Calcular número de aulas afectadas
      let numeroAulas = 1;
      if (aulasSeleccionadas.Grado === "T") {
        // Todas las aulas del nivel
        numeroAulas = aulasSeleccionadas.Nivel === "P" ? 6 : 5; // 6 grados primaria, 5 secundaria
      }
      if (aulasSeleccionadas.Seccion === "T") {
        // Múltiples secciones por grado (estimado: 2-3 secciones por grado)
        numeroAulas *= 2.5;
      }

      // Tiempo adicional por aulas
      tiempoAdicional += numeroAulas * this.TIEMPO_POR_AULA_SEGUNDOS;

      // Si es reporte por días, calcular días involucrados
      if (tipoReporte === TipoReporteAsistenciaEscolar.POR_DIA) {
        const diasEstimados = this.calcularDiasHabiles(
          rangoTiempo.DesdeMes,
          rangoTiempo.DesdeDia || 1,
          rangoTiempo.HastaMes,
          rangoTiempo.HastaDia || 31
        );
        tiempoAdicional += diasEstimados * this.TIEMPO_POR_DIA_SEGUNDOS;
      }

      // Redondear el tiempo adicional al múltiplo de INTERVALO_POLLING_SEGUNDOS más cercano
      // Esto asegura que el tiempo estimado coincida con los momentos de polling
      const tiempoAdicionalRedondeado =
        Math.ceil(tiempoAdicional / this.INTERVALO_POLLING_SEGUNDOS) *
        this.INTERVALO_POLLING_SEGUNDOS;

      const tiempoTotal =
        this.TIEMPO_MINIMO_GENERACION_SEGUNDOS + tiempoAdicionalRedondeado;

      return {
        tiempoMinimoSegundos: this.TIEMPO_MINIMO_GENERACION_SEGUNDOS,
        tiempoEstimadoTotalSegundos: tiempoTotal,
        tiempoAdicionalPorDatos: tiempoAdicionalRedondeado,
        descripcion: this.generarDescripcionEstimacion(
          tipoReporte,
          numeroMeses,
          numeroAulas,
          tiempoTotal
        ),
      };
    } catch (error) {
      console.error("Error al estimar tiempo de generación:", error);
      return {
        tiempoMinimoSegundos: this.TIEMPO_MINIMO_GENERACION_SEGUNDOS,
        tiempoEstimadoTotalSegundos: this.TIEMPO_MINIMO_GENERACION_SEGUNDOS,
        tiempoAdicionalPorDatos: 0,
        descripcion: "Error al estimar el tiempo",
      };
    }
  }

  /**
   * Calcula el número de días hábiles entre dos fechas
   */
  private calcularDiasHabiles(
    mesDesde: number,
    diaDesde: number,
    mesHasta: number,
    diaHasta: number
  ): number {
    const añoActual = new Date().getFullYear();
    const fechaDesde = new Date(añoActual, mesDesde - 1, diaDesde);
    const fechaHasta = new Date(añoActual, mesHasta - 1, diaHasta);

    let diasHabiles = 0;
    const fechaTemp = new Date(fechaDesde);

    while (fechaTemp <= fechaHasta) {
      const diaSemana = fechaTemp.getDay();
      if (diaSemana >= 1 && diaSemana <= 5) {
        diasHabiles++;
      }
      fechaTemp.setDate(fechaTemp.getDate() + 1);
    }

    return diasHabiles;
  }

  /**
   * Genera una descripción legible de la estimación
   */
  private generarDescripcionEstimacion(
    tipoReporte: TipoReporteAsistenciaEscolar,
    numeroMeses: number,
    numeroAulas: number,
    tiempoTotalSegundos: number
  ): string {
    const minutos = Math.floor(tiempoTotalSegundos / 60);
    const segundos = tiempoTotalSegundos % 60;

    let descripcion = `Reporte ${
      tipoReporte === TipoReporteAsistenciaEscolar.POR_DIA
        ? "diario"
        : "mensual"
    }`;
    descripcion += ` de ${Math.round(numeroAulas)} aula${
      numeroAulas > 1 ? "s" : ""
    }`;
    descripcion += ` durante ${numeroMeses} mes${numeroMeses > 1 ? "es" : ""}`;
    descripcion += ` - Estimado: ${minutos}m ${segundos}s`;

    return descripcion;
  }

  /**
   * Obtiene todos los reportes almacenados
   */
  public async obtenerTodosLosReportes(): Promise<
    IReporteAsistenciaEscolarLocal[]
  > {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      await this.sync();

      const store = await IndexedDBConnection.getStore(this.nombreTablaLocal);

      const result = await new Promise<IReporteAsistenciaEscolarLocal[]>(
        (resolve, reject) => {
          const request = store.getAll();

          request.onsuccess = () =>
            resolve(request.result as IReporteAsistenciaEscolarLocal[]);
          request.onerror = () => reject(request.error);
        }
      );

      this.setIsSomethingLoading?.(false);
      return result;
    } catch (error) {
      this.handleIndexedDBError(error, "obtener todos los reportes");
      this.setIsSomethingLoading?.(false);
      return [];
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
      if (error.name === "NotFoundError") {
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
