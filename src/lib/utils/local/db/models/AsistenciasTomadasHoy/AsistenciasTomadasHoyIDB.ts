import IndexedDBConnection from "../../IndexedDBConnection";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";
import { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";
import { CANTIDAD_MINUTOS_MAXIMO_PARA_DESCARTE_ASISTENCIAS } from "@/constants/CANTIDAD_MINUTOS_MAXIMO_PARA_DESCARTE_ASISTENCIAS";
import { TablasLocal } from "@/interfaces/shared/TablasSistema";
import { AsistenciaDateHelper } from "../utils/AsistenciaDateHelper";
import {
  SEGUNDOS_TOLERANCIA_ENTRADA_PERSONAL,
  SEGUNDOS_TOLERANCIA_SALIDA_PERSONAL,
} from "@/constants/MINUTOS_TOLERANCIA_ASISTENCIA_PERSONAL";

// ✅ INTERFACE: Base structure for attendances
interface AsistenciaHoyBase {
  clave: string; // Unique key: date:mode:actor:dni[:extras]
  dni: string;
  actor: ActoresSistema;
  modoRegistro: ModoRegistro;
  tipoAsistencia: TipoAsistencia;
  fecha: string; // YYYY-MM-DD
  timestampConsulta: number; // Moment it was queried from Redis (Peruvian timestamp)
}

// ✅ INTERFACE: Staff attendance
export interface AsistenciaPersonalHoy extends AsistenciaHoyBase {
  timestamp: number; // Moment of entry/exit registration
  desfaseSegundos: number;
  estado: EstadosAsistenciaPersonal;
}

// ✅ INTERFACE: Student attendance
export interface AsistenciaEstudianteHoy extends AsistenciaHoyBase {
  estado: EstadosAsistenciaPersonal;
  nivelEducativo?: string;
  grado?: string;
  seccion?: string;
}

// ✅ UNION TYPE: To handle both types
export type AsistenciaHoy = AsistenciaPersonalHoy | AsistenciaEstudianteHoy;

// ✅ INTERFACE: For specific queries
export interface ConsultaAsistenciaHoy {
  idUsuario: string | number;
  actor: ActoresSistema;
  modoRegistro: ModoRegistro;
  tipoAsistencia: TipoAsistencia;
  fecha?: string; // Optional, defaults to today
  nivelEducativo?: string; // For students
  grado?: string; // For students
  seccion?: string; // For students
}

/**
 * ✅ CLASS: Manages attendances taken on the current day
 * 🎯 PURPOSE: Avoid excessive queries to Redis by temporarily storing data
 * ⏰ LOGIC: Implements automatic discard after the set time
 * 📁 TABLE: attendances_taken_today (local only, not synchronized)
 *
 * ✅ FIXED:
 * - All temporal logic delegated to DateHelper (SRP)
 * - Consistent Peruvian timestamps from Redux
 * - Optimized maintenance with real schedules
 * - Improved logging with readable timestamps
 */
export class AsistenciasTomadasHoyIDB {
  private nombreTabla: string = TablasLocal.Tabla_Asistencias_Tomadas_Hoy;
  private dateHelper: AsistenciaDateHelper; // ✅ NEW: DateHelper dependency
  private intervalos: NodeJS.Timeout[] = []; // ✅ NEW: To clear intervals

  constructor(dateHelper: AsistenciaDateHelper) {
    // ✅ NEW: Constructor with dependency
    this.dateHelper = dateHelper;
  }

  /**
   * ✅ GENERATE UNIQUE KEY to identify each attendance
   * 📝 STAFF FORMAT: date:mode:actor:dni
   * 📝 STUDENT FORMAT: date:mode:actor:dni:level:grade:section
   * 🎯 COMPATIBILITY: Same format used by the marking endpoint
   * ✅ FIXED: Use DateHelper to get date
   */
  private generarClave(consulta: ConsultaAsistenciaHoy): string {
    // ✅ FIXED: Use DateHelper instead of new Date()
    const fecha =
      consulta.fecha ||
      this.dateHelper.obtenerFechaStringActual() ||
      this.obtenerFechaHoyFallback();
    const base = `${fecha}:${consulta.modoRegistro}:${consulta.actor}`;

    // ✅ STUDENT FORMAT: Always include level, grade and section
    if (consulta.actor === ActoresSistema.Estudiante) {
      const nivel = consulta.nivelEducativo || "UNKNOWN";
      const grado = consulta.grado!;
      const seccion = consulta.seccion!;
      return `${base}:${nivel}:${grado}:${seccion}`;
    }

    // ✅ STAFF FORMAT: Just the base key
    return `${base}:${consulta.idUsuario}`;
  }

  /**
   * ✅ NEW: Fallback to get date if DateHelper fails
   * Only used as an emergency backup
   */
  private obtenerFechaHoyFallback(): string {
    console.warn(
      "⚠️ Using fallback to get date (DateHelper not available)"
    );
    const hoy = new Date();
    return hoy.toISOString().split("T")[0];
  }

  /**
   * ✅ VERIFY if an attendance should be discarded due to time
   * 🕐 LOGIC: Discard if more than X minutes have passed since the query
   * ✅ FIXED: Use DateHelper for current timestamp
   */
  private debeDescartar(
    timestampConsulta: number,
    tipoAsistencia: TipoAsistencia
  ): boolean {
    // ✅ FIXED: Use DateHelper instead of Date.now()
    const timestampActual = this.dateHelper.obtenerTimestampPeruano();
    const tiempoTranscurrido = timestampActual - timestampConsulta;
    const minutosTranscurridos = Math.floor(tiempoTranscurrido / (1000 * 60));

    const limitMinutos =
      CANTIDAD_MINUTOS_MAXIMO_PARA_DESCARTE_ASISTENCIAS[tipoAsistencia];

    const debeDescartar = minutosTranscurridos > limitMinutos;

    if (debeDescartar) {
      console.log(
        `⏰ Expired attendance: ${minutosTranscurridos}min > ${limitMinutos}min limit (queried: ${this.dateHelper.formatearTimestampLegible(
          timestampConsulta
        )})`
      );
    }

    return debeDescartar;
  }

  /**
   * ✅ QUERY attendance in local cache
   * 🔍 RETURNS: The attendance if it exists and should not be discarded, otherwise null
   * ✅ FIXED: Improved logging with readable timestamps
   */
  public async consultarAsistencia(
    consulta: ConsultaAsistenciaHoy
  ): Promise<AsistenciaHoy | null> {
    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        this.nombreTabla,
        "readonly"
      );

      const clave = this.generarClave(consulta);

      return new Promise<AsistenciaHoy | null>((resolve, reject) => {
        const request = store.get(clave);

        request.onsuccess = () => {
          const asistencia = request.result as AsistenciaHoy | undefined;

          if (!asistencia) {
            console.log(`📭 Not found in cache: ${clave}`);
            resolve(null);
            return;
          }

          // Check if it should be discarded due to time
          if (
            this.debeDescartar(
              asistencia.timestampConsulta,
              asistencia.tipoAsistencia
            )
          ) {
            console.log(
              `⏰ Expired attendance in cache: ${clave} (queried: ${this.dateHelper.formatearTimestampLegible(
                asistencia.timestampConsulta
              )})`
            );
            // Delete the expired attendance
            this.eliminarAsistencia(clave).catch(console.error);
            resolve(null);
            return;
          }

          console.log(
            `✅ Attendance found in cache: ${clave} (queried: ${this.dateHelper.formatearTimestampLegible(
              asistencia.timestampConsulta
            )})`
          );
          resolve(asistencia);
        };

        request.onerror = () => {
          console.error(`❌ Error querying attendance: ${request.error}`);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ Error querying attendance in cache:", error);
      return null;
    }
  }

  /**
   * ✅ SAVE attendance from Redis data in local cache
   * 💾 COMPATIBLE: Handles both staff and students
   * 🔄 FORMAT: Adapts according to the type of data received
   * ✅ FIXED: Use Peruvian timestamp for timestampConsulta
   */
  public async guardarAsistenciaDesdeRedis(
    clave: string,
    valor: string | string[], // Redis can return string (students) or array (staff)
    actor: ActoresSistema,
    modoRegistro: ModoRegistro,
    tipoAsistencia: TipoAsistencia,
    dni: string,
    nivelEducativo?: string,
    grado?: string,
    seccion?: string
  ): Promise<void> {
    try {
      // ✅ FIXED: Use DateHelper for date and timestamp
      const fecha =
        this.dateHelper.obtenerFechaStringActual() ||
        this.obtenerFechaHoyFallback();
      const timestampConsulta = this.dateHelper.obtenerTimestampPeruano();

      let asistenciaCache: AsistenciaHoy;

      if (actor === ActoresSistema.Estudiante) {
        // ✅ STUDENT ATTENDANCE: The value is a state (string)
        const estado = valor as EstadosAsistenciaPersonal;

        asistenciaCache = {
          clave,
          dni,
          actor,
          modoRegistro,
          tipoAsistencia,
          estado,
          nivelEducativo,
          grado,
          seccion,
          fecha,
          timestampConsulta,
        } as AsistenciaEstudianteHoy;
      } else {
        // ✅ STAFF ATTENDANCE: The value is an array [timestamp, offsetSeconds]
        const valorArray = Array.isArray(valor) ? valor : [valor, "0"];
        const timestamp = parseInt(valorArray[0]) || 0;
        const desfaseSegundos = parseInt(valorArray[1]) || 0;

        // Determine state based on offset
        const estado = this.determinarEstadoPersonal(
          desfaseSegundos,
          modoRegistro
        );

        asistenciaCache = {
          clave,
          dni,
          actor,
          modoRegistro,
          tipoAsistencia,
          timestamp,
          desfaseSegundos,
          estado,
          fecha,
          timestampConsulta,
        } as AsistenciaPersonalHoy;
      }

      await this.guardarAsistencia(asistenciaCache);
      console.log(
        `💾 Attendance from Redis saved in cache: ${clave} (timestamp: ${this.dateHelper.formatearTimestampLegible(
          timestampConsulta
        )})`
      );
    } catch (error) {
      console.error("❌ Error saving attendance from Redis:", error);
      throw error;
    }
  }

  /**
   * ✅ DETERMINE staff attendance state based on offset
   * ⏰ LOGIC: Same as in AsistenciaDePersonalIDB
   * ✅ NO CHANGES: Does not handle timestamps directly
   */
  private determinarEstadoPersonal(
    desfaseSegundos: number,
    modoRegistro: ModoRegistro
  ): EstadosAsistenciaPersonal {
    if (modoRegistro === ModoRegistro.Entrada) {
      // ✅ CHANGE: Only Early or Late
      if (desfaseSegundos <= SEGUNDOS_TOLERANCIA_ENTRADA_PERSONAL) {
        return EstadosAsistenciaPersonal.Temprano; // ✅ CHANGED
      } else {
        return EstadosAsistenciaPersonal.Tarde; // ✅ WITHOUT TOLERANCE
      }
    } else {
      // For exits, keep the existing logic or change as needed
      if (desfaseSegundos >= -SEGUNDOS_TOLERANCIA_SALIDA_PERSONAL) {
        return EstadosAsistenciaPersonal.Cumplido;
      } else {
        return EstadosAsistenciaPersonal.Salida_Anticipada;
      }
    }
  }

  /**
   * ✅ DELETE specific attendance from cache
   * ✅ NO CHANGES: Does not handle timestamps
   */
  private async eliminarAsistencia(clave: string): Promise<void> {
    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        this.nombreTabla,
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.delete(clave);

        request.onsuccess = () => {
          console.log(`🗑️ Attendance deleted from cache: ${clave}`);
          resolve();
        };

        request.onerror = () => {
          console.error(`❌ Error deleting attendance: ${request.error}`);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ Error deleting attendance from cache:", error);
    }
  }

  /**
   * ✅ CLEAR expired attendances from cache
   * 🧹 EXECUTES: Cleanup routine by deleting old records
   * ✅ IMPROVED: Detailed logging with timestamps
   */
  public async limpiarAsistenciasExpiradas(): Promise<{
    eliminadas: number;
    errores: number;
    timestampLimpieza: number;
  }> {
    const timestampLimpieza = this.dateHelper.obtenerTimestampPeruano();
    const resultado = {
      eliminadas: 0,
      errores: 0,
      timestampLimpieza,
    };

    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        this.nombreTabla,
        "readwrite"
      );

      return new Promise<typeof resultado>((resolve, reject) => {
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const asistencia = cursor.value as AsistenciaHoy;

            // Check if it should be discarded
            if (
              this.debeDescartar(
                asistencia.timestampConsulta,
                asistencia.tipoAsistencia
              )
            ) {
              try {
                cursor.delete();
                resultado.eliminadas++;
                console.log(
                  `🗑️ Expired attendance deleted: ${
                    asistencia.clave
                  } (queried: ${this.dateHelper.formatearTimestampLegible(
                    asistencia.timestampConsulta
                  )})`
                );
              } catch (error) {
                resultado.errores++;
                console.error(
                  `❌ Error deleting ${asistencia.clave}:`,
                  error
                );
              }
            }

            cursor.continue();
          } else {
            // We finished iterating through all the records
            console.log(
              `🧹 Cleanup completed at ${this.dateHelper.formatearTimestampLegible(
                timestampLimpieza
              )}: ${resultado.eliminadas} deleted, ${
                resultado.errores
              } errors`
            );
            resolve(resultado);
          }
        };

        request.onerror = () => {
          console.error(`❌ Error during cleanup: ${request.error}`);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ Error clearing expired attendances:", error);
      resultado.errores++;
      return resultado;
    }
  }

  /**
   * ✅ CLEAR all attendances for a specific date
   * 🗓️ USEFUL: To clear previous day's data when the day changes
   * ✅ NO CHANGES: Does not handle timestamps directly
   */
  public async limpiarAsistenciasPorFecha(fecha: string): Promise<void> {
    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        this.nombreTabla,
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const asistencia = cursor.value as AsistenciaHoy;

            // If the date matches, delete
            if (asistencia.fecha === fecha) {
              cursor.delete();
              console.log(
                `🗑️ Attendance for date ${fecha} deleted: ${asistencia.clave}`
              );
            }

            cursor.continue();
          } else {
            console.log(`🧹 Cleanup by date completed: ${fecha}`);
            resolve();
          }
        };

        request.onerror = () => {
          console.error(`❌ Error clearing by date: ${request.error}`);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `❌ Error clearing attendances for date ${fecha}:`,
        error
      );
    }
  }

  /**
   * ✅ CLEAR all attendances with a date prior to the specified one
   * 🗓️ USEFUL: To clear all previous days at once
   */
  public async limpiarAsistenciasAnterioresA(
    fechaLimite: string
  ): Promise<number> {
    try {
      // 🔍 TEMPORARY DEBUG
      console.log("🔍 DEBUG clearAttendancesBefore:");
      console.log("- received limitDate:", fechaLimite);

      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        this.nombreTabla,
        "readwrite"
      );

      // ✅ CONVERT limitDate to timestamp for reliable comparison
      const fechaLimiteObj = new Date(fechaLimite + "T00:00:00.000Z");
      const timestampLimite = fechaLimiteObj.getTime();

      console.log("- limitDate as Date:", fechaLimiteObj);
      console.log("- limitTimestamp:", timestampLimite);

      return new Promise<number>((resolve, reject) => {
        const request = store.openCursor();
        let eliminadas = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const asistencia = cursor.value as AsistenciaHoy;

            // ✅ RELIABLE COMPARISON: Convert attendance date to timestamp
            const fechaAsistenciaObj = new Date(
              asistencia.fecha + "T00:00:00.000Z"
            );
            const timestampAsistencia = fechaAsistenciaObj.getTime();

            const debeEliminar = timestampAsistencia < timestampLimite;

            // 🔍 TEMPORARY DEBUG
            console.log(`🔍 Comparing attendance:`);
            console.log(
              `  - Date: "${asistencia.fecha}" -> timestamp: ${timestampAsistencia}`
            );
            console.log(`  - Is it earlier? ${debeEliminar}`);
            console.log(`  - Key: ${asistencia.clave}`);

            if (debeEliminar) {
              cursor.delete();
              eliminadas++;
              console.log(
                `🗑️ Attendance DELETED: ${asistencia.clave} (date: ${asistencia.fecha})`
              );
            } else {
              console.log(
                `✅ Attendance KEPT: ${asistencia.clave} (date: ${asistencia.fecha})`
              );
            }

            cursor.continue();
          } else {
            console.log(
              `🧹 Cleanup completed: ${eliminadas} attendances before ${fechaLimite} deleted`
            );
            resolve(eliminadas);
          }
        };

        request.onerror = () => {
          console.error(
            `❌ Error clearing previous attendances: ${request.error}`
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `❌ Error clearing attendances before ${fechaLimite}:`,
        error
      );
      return 0;
    }
  }

  /**
   * ✅ SAVE attendance in local cache
   * 💾 STORES: Attendance data with current query timestamp
   * ✅ FIXED: Use Peruvian timestamp for timestampConsulta
   */
  public async guardarAsistencia(asistencia: AsistenciaHoy): Promise<void> {
    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        this.nombreTabla,
        "readwrite"
      );

      // ✅ FIXED: Use DateHelper for query timestamp
      const timestampConsultaActual = this.dateHelper.obtenerTimestampPeruano();
      const asistenciaConTimestamp = {
        ...asistencia,
        timestampConsulta: timestampConsultaActual,
      };

      return new Promise<void>((resolve, reject) => {
        const request = store.put(asistenciaConTimestamp);

        request.onsuccess = () => {
          console.log(
            `💾 Attendance saved in cache: ${
              asistencia.clave
            } (timestamp: ${this.dateHelper.formatearTimestampLegible(
              timestampConsultaActual
            )})`
          );
          resolve();
        };

        request.onerror = () => {
          console.error(`❌ Error saving attendance: ${request.error}`);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ Error saving attendance in cache:", error);
      throw error;
    }
  }

  /**
   * ✅ QUERY MULTIPLE attendances (for queries by classroom/section)
   * 🎯 USEFUL: For when all students in a section are queried
   * ✅ NO CHANGES: Does not handle timestamps directly
   */
  public async consultarAsistenciasMultiples(
    actor: ActoresSistema,
    modoRegistro: ModoRegistro,
    tipoAsistencia: TipoAsistencia,
    filtros?: {
      fecha?: string;
      nivelEducativo?: string;
      grado?: string;
      seccion?: string;
    }
  ): Promise<AsistenciaHoy[]> {
    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        this.nombreTabla,
        "readonly"
      );

      return new Promise<AsistenciaHoy[]>((resolve, reject) => {
        const request = store.openCursor();
        const resultados: AsistenciaHoy[] = [];

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const asistencia = cursor.value as AsistenciaHoy;

            // Check if it meets basic criteria
            if (
              asistencia.actor === actor &&
              asistencia.modoRegistro === modoRegistro &&
              asistencia.tipoAsistencia === tipoAsistencia
            ) {
              // Apply additional filters if provided
              let cumpleFiltros = true;

              if (filtros?.fecha && asistencia.fecha !== filtros.fecha) {
                cumpleFiltros = false;
              }

              if (
                filtros?.nivelEducativo &&
                "nivelEducativo" in asistencia &&
                asistencia.nivelEducativo !== filtros.nivelEducativo
              ) {
                cumpleFiltros = false;
              }

              if (
                filtros?.grado &&
                "grado" in asistencia &&
                asistencia.grado !== filtros.grado
              ) {
                cumpleFiltros = false;
              }

              if (
                filtros?.seccion &&
                "seccion" in asistencia &&
                asistencia.seccion !== filtros.seccion
              ) {
                cumpleFiltros = false;
              }

              // Check if not expired
              if (
                cumpleFiltros &&
                !this.debeDescartar(
                  asistencia.timestampConsulta,
                  asistencia.tipoAsistencia
                )
              ) {
                resultados.push(asistencia);
              }
            }

            cursor.continue();
          } else {
            resolve(resultados);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ Error querying multiple attendances:", error);
      return [];
    }
  }

  /**
   * ✅ GET STATISTICS from cache
   * 📊 INFORMATION: Number of records, expired, etc.
   * ✅ FIXED: Use DateHelper for date
   */
  public async obtenerEstadisticas(): Promise<{
    totalRegistros: number;
    registrosExpirados: number;
    registrosValidos: number;
    fechaHoy: string;
    timestampEstadisticas: number;
  }> {
    const timestampEstadisticas = this.dateHelper.obtenerTimestampPeruano();
    const stats = {
      totalRegistros: 0,
      registrosExpirados: 0,
      registrosValidos: 0,
      fechaHoy:
        this.dateHelper.obtenerFechaStringActual() ||
        this.obtenerFechaHoyFallback(),
      timestampEstadisticas,
    };

    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        this.nombreTabla,
        "readonly"
      );

      return new Promise<typeof stats>((resolve, reject) => {
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const asistencia = cursor.value as AsistenciaHoy;
            stats.totalRegistros++;

            if (
              this.debeDescartar(
                asistencia.timestampConsulta,
                asistencia.tipoAsistencia
              )
            ) {
              stats.registrosExpirados++;
            } else {
              stats.registrosValidos++;
            }

            cursor.continue();
          } else {
            console.log(
              `📊 Statistics obtained: ${stats.totalRegistros} total, ${
                stats.registrosValidos
              } valid, ${
                stats.registrosExpirados
              } expired (${this.dateHelper.formatearTimestampLegible(
                timestampEstadisticas
              )})`
            );
            resolve(stats);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("❌ Error getting statistics:", error);
      return stats;
    }
  }

  /**
   * ✅ INITIALIZE maintenance routines
   * 🔄 EXECUTES: Automatic cleanup every certain time
   * ✅ FIXED: Use DateHelper for temporal calculations
   */
  public inicializarMantenimiento(): void {
    console.log(
      `🔧 Initializing attendance cache maintenance (${this.dateHelper.formatearTimestampLegible(
        this.dateHelper.obtenerTimestampPeruano()
      )})`
    );

    // ✅ FIXED: Clear expired attendances every 5 minutes using DateHelper
    const intervaloLimpieza = setInterval(async () => {
      try {
        const timestampInicio = this.dateHelper.obtenerTimestampPeruano();
        const resultado = await this.limpiarAsistenciasExpiradas();

        if (resultado.eliminadas > 0) {
          console.log(
            `🧹 Automatic maintenance completed at ${this.dateHelper.formatearTimestampLegible(
              timestampInicio
            )}: ${resultado.eliminadas} expired attendances deleted`
          );
        }
      } catch (error) {
        console.error("❌ Error in automatic maintenance:", error);
      }
    }, 5 * 60 * 1000); // 5 minutes

    this.intervalos.push(intervaloLimpieza);

    // ✅ FIXED: Use DateHelper for midnight calculations
    this.programarLimpiezaMedianoche();
  }

  /**
   * ✅ NEW: Schedules automatic cleanup at midnight using DateHelper
   */
  private programarLimpiezaMedianoche(): void {
    const timestampActual = this.dateHelper.obtenerTimestampPeruano();
    const fechaActual = new Date(timestampActual);

    // Calculate midnight of the next day
    const medianoche = new Date(fechaActual);
    medianoche.setDate(fechaActual.getDate() + 1);
    medianoche.setHours(0, 0, 0, 0);

    const tiempoHastaMedianoche = medianoche.getTime() - timestampActual;

    console.log(
      `🌙 Scheduling midnight cleanup for: ${this.dateHelper.formatearTimestampLegible(
        medianoche.getTime()
      )} (in ${Math.round(tiempoHastaMedianoche / (1000 * 60))} minutes)`
    );

    const timeoutMedianoche = setTimeout(() => {
      // Clear previous day's data
      const fechaAyer = this.dateHelper.generarFechaString(
        fechaActual.getMonth() + 1,
        fechaActual.getDate() - 1,
        fechaActual.getFullYear()
      );

      console.log(
        `🌙 Executing midnight cleanup for date: ${fechaAyer}`
      );
      this.limpiarAsistenciasPorFecha(fechaAyer).catch(console.error);

      // Set up recursive daily cleanup
      const intervaloLimpiezaDiaria = setInterval(async () => {
        const timestampLimpieza = this.dateHelper.obtenerTimestampPeruano();
        const fechaLimpieza = new Date(timestampLimpieza);

        const fechaAyer = this.dateHelper.generarFechaString(
          fechaLimpieza.getMonth() + 1,
          fechaLimpieza.getDate() - 1,
          fechaLimpieza.getFullYear()
        );

        console.log(`🌙 Automatic daily cleanup for date: ${fechaAyer}`);
        await this.limpiarAsistenciasPorFecha(fechaAyer);
      }, 24 * 60 * 60 * 1000); // 24 hours

      this.intervalos.push(intervaloLimpiezaDiaria);
    }, tiempoHastaMedianoche);

    console.log(
      `Cache cleanup will be done at midnight today, ${timeoutMedianoche}`
    );
  }

  /**
   * ✅ NEW: Clears all maintenance intervals
   * 🧹 USEFUL: To clear resources when destroying the instance
   */
  public limpiarMantenimiento(): void {
    console.log(
      `🛑 Clearing ${this.intervalos.length} maintenance intervals`
    );

    this.intervalos.forEach((intervalo) => {
      clearInterval(intervalo);
    });

    this.intervalos = [];
  }

  /**
   * ✅ NEW: Gets detailed maintenance information
   */
  public obtenerInfoMantenimiento(): {
    intervalosActivos: number;
    proximaLimpieza: string;
    ultimaLimpieza: string | null;
  } {
    const timestampActual = this.dateHelper.obtenerTimestampPeruano();

    // Calculate next cleanup (next multiple of 5 minutes)
    const minutosActuales = new Date(timestampActual).getMinutes();
    const minutosProximaLimpieza = Math.ceil(minutosActuales / 5) * 5;
    const proximaLimpieza = new Date(timestampActual);
    proximaLimpieza.setMinutes(minutosProximaLimpieza, 0, 0);

    return {
      intervalosActivos: this.intervalos.length,
      proximaLimpieza: this.dateHelper.formatearTimestampLegible(
        proximaLimpieza.getTime()
      ),
      ultimaLimpieza: null, // You could store this in an instance variable
    };
  }
}
