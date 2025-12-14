/* eslint-disable @typescript-eslint/no-explicit-any */
import { Meses } from "@/interfaces/shared/Meses";
import {
  OperationResult,
  ActoresSistema,
  ModoRegistro,
  TipoAsistencia,
  EstadosAsistenciaPersonal,
  RolesSistema,
  AsistenciaMensualPersonalLocal,
  RegistroEntradaSalida,
} from "../AsistenciaDePersonalTypes";
import {
  AsistenciaPersonalHoy,
  AsistenciasTomadasHoyIDB,
  ConsultaAsistenciaHoy,
} from "../../AsistenciasTomadasHoy/AsistenciasTomadasHoyIDB";
import { AsistenciaDateHelper } from "../../utils/AsistenciaDateHelper";
import { AsistenciaDePersonalMapper } from "./AsistenciaDePersonalMapper";
import IndexedDBConnection from "../../../IndexedDBConnection";
import { AsistenciaDePersonalAPIClient } from "./AsistenciaDePersonalAPIClient";
import { AsistenciaDePersonalValidator } from "./AsistenciaDePersonalValidator";

/**
 * 🎯 RESPONSIBILITY: Attendance cache management
 * - Manage today's attendance cache (local Redis)
 * - Integrate cache data with monthly records
 * - Query and update cache
 * - Clean up obsolete cache
 * - 🆕 AUTOMATICALLY DELETE records from the previous day in each CRUD operation
 */
export class AsistenciaDePersonalCacheManager {
  private cacheAsistenciasHoy: AsistenciasTomadasHoyIDB;
  private mapper: AsistenciaDePersonalMapper;
  private dateHelper: AsistenciaDateHelper;
  private ultimaLimpiezaDiaAnterior: string | null = null; // 🆕 Avoids duplicate cleanups
  private apiClient: AsistenciaDePersonalAPIClient;
  private validator: AsistenciaDePersonalValidator;

  constructor(
    mapper: AsistenciaDePersonalMapper,
    dateHelper: AsistenciaDateHelper,
    apiClient: AsistenciaDePersonalAPIClient,
    validator: AsistenciaDePersonalValidator
  ) {
    this.mapper = mapper;
    this.dateHelper = dateHelper;
    this.apiClient = apiClient;
    this.cacheAsistenciasHoy = new AsistenciasTomadasHoyIDB(this.dateHelper);
    this.validator = validator;
    this.limpiarControlesRedisAntiguos();
    // Initialize cache maintenance routines
    // this.cacheAsistenciasHoy.inicializarMantenimiento();
  }

  private async limpiarDiasAnterioresAutomaticamente(): Promise<void> {
    try {
      const fechaHoy = this.dateHelper.obtenerFechaStringActual();

      if (!fechaHoy) {
        console.warn(
          "⚠️ Could not get the current date for automatic cleanup"
        );
        return;
      }

      // 🚀 OPTIMIZATION: Avoid duplicate cleanups on the same day
      if (this.ultimaLimpiezaDiaAnterior === fechaHoy) {
        console.log(
          `⏭️ Cleanup of previous days already executed today: ${fechaHoy}`
        );
        return;
      }

      console.log(
        `🧹 Cleaning ALL attendances prior to: ${fechaHoy}`
      );

      // ✅ A SINGLE CALL deletes everything prior to today
      const eliminadas =
        await this.cacheAsistenciasHoy.limpiarAsistenciasAnterioresA(fechaHoy);

      // 📝 MARK as executed to avoid duplicates
      this.ultimaLimpiezaDiaAnterior = fechaHoy;

      console.log(
        `✅ Automatic cleanup completed: ${eliminadas} records deleted`
      );
    } catch (error) {
      console.error(
        "❌ Error in automatic cleanup of previous days:",
        error
      );
    }
  }

  /**
   * ✅ FIXED: Query cache with correct date
   */
  public async consultarCacheAsistenciaHoy(
    actor: ActoresSistema,
    modoRegistro: ModoRegistro,
    idUsuario: string,
    fecha: string
  ): Promise<AsistenciaPersonalHoy | null> {
    try {
      // 🆕 Automatically clean previous day
      await this.limpiarDiasAnterioresAutomaticamente();

      const consulta: ConsultaAsistenciaHoy = {
        idUsuario,
        actor,
        modoRegistro,
        tipoAsistencia: TipoAsistencia.ParaPersonal,
        fecha,
      };

      console.log(
        `🔍 Querying cache with VERIFIED date: ${fecha} - ${actor} - ${modoRegistro} - ${idUsuario}`
      );

      const resultado = await this.cacheAsistenciasHoy.consultarAsistencia(
        consulta
      );

      if (resultado) {
        console.log(
          `✅ Encontrado en cache: ${idUsuario} - ${modoRegistro} - ${fecha} - ${
            (resultado as AsistenciaPersonalHoy).estado
          }`
        );
      } else {
        console.log(
          `❌ No encontrado en cache: ${idUsuario} - ${modoRegistro} - ${fecha}`
        );
      }

      return resultado as AsistenciaPersonalHoy | null;
    } catch (error) {
      console.error("Error al consultar cache de asistencias:", error);
      return null;
    }
  }

  /**
   * Saves attendance in the cache
   * 🆕 INCLUDES automatic cleanup of the previous day
   */
  public async guardarAsistenciaEnCache(
    asistencia: AsistenciaPersonalHoy
  ): Promise<OperationResult> {
    try {
      // 🆕 Automatically clean previous day
      await this.limpiarDiasAnterioresAutomaticamente();

      await this.cacheAsistenciasHoy.guardarAsistencia(asistencia);

      return {
        exitoso: true,
        mensaje: "Attendance saved in cache successfully",
        datos: asistencia.clave,
      };
    } catch (error) {
      console.error("Error saving attendance in cache:", error);
      return {
        exitoso: false,
        mensaje: `Error saving to cache: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * ✅ NEW: Integrates direct data from Redis with historical records
   */
  public async integrarDatosDirectosDeRedis(
    registroEntrada: AsistenciaMensualPersonalLocal | null,
    registroSalida: AsistenciaMensualPersonalLocal | null,
    datosRedis: {
      entrada?: any;
      salida?: any;
      encontradoEntrada: boolean;
      encontradoSalida: boolean;
    },
    rol: RolesSistema,
    idUsuario: string | number,
    diaActual: number
  ): Promise<{
    entrada?: AsistenciaMensualPersonalLocal;
    salida?: AsistenciaMensualPersonalLocal;
    integrado: boolean;
    mensaje: string;
  }> {
    try {
      await this.limpiarDiasAnterioresAutomaticamente();

      let entradaFinal = registroEntrada;
      let salidaFinal = registroSalida;
      let integrado = false;

      const fechaHoy = this.dateHelper.obtenerFechaStringActual();
      if (!fechaHoy) {
        return {
          entrada: entradaFinal || undefined,
          salida: salidaFinal || undefined,
          integrado: false,
          mensaje: "Could not get current date",
        };
      }

      const actor = this.mapper.obtenerActorDesdeRol(rol);

      // Integrate entry from Redis
      if (datosRedis.encontradoEntrada && datosRedis.entrada?.Resultados) {
        const resultado = Array.isArray(datosRedis.entrada.Resultados)
          ? datosRedis.entrada.Resultados[0]
          : datosRedis.entrada.Resultados;

        if (resultado?.AsistenciaMarcada && resultado.Detalles) {
          const timestamp =
            resultado.Detalles.Timestamp ||
            this.dateHelper.obtenerTimestampPeruano();
          const desfaseSegundos = resultado.Detalles.DesfaseSegundos || 0;
          const estado = this.mapper.determinarEstadoAsistencia(
            desfaseSegundos,
            ModoRegistro.Entrada
          );

          // ✅ CREATE AND SAVE IN LOCAL CACHE
          const asistenciaEntrada = this.crearAsistenciaParaCache(
            String(idUsuario),
            actor,
            ModoRegistro.Entrada,
            timestamp,
            desfaseSegundos,
            estado,
            fechaHoy
          );

          await this.guardarAsistenciaEnCache(asistenciaEntrada);

          // ✅ INTEGRATE INTO MONTHLY RECORD
          entradaFinal = this.integrarDatosDeCacheEnRegistroMensual(
            entradaFinal,
            asistenciaEntrada,
            diaActual,
            ModoRegistro.Entrada,
            idUsuario,
            fechaHoy
          );

          integrado = true;
          console.log(
            `✅ Entry integrated from Redis and saved in cache: ${estado}`
          );
        }
      }

      // Integrate exit from Redis
      if (datosRedis.encontradoSalida && datosRedis.salida?.Resultados) {
        const resultado = Array.isArray(datosRedis.salida.Resultados)
          ? datosRedis.salida.Resultados[0]
          : datosRedis.salida.Resultados;

        if (resultado?.AsistenciaMarcada && resultado.Detalles) {
          const timestamp =
            resultado.Detalles.Timestamp ||
            this.dateHelper.obtenerTimestampPeruano();
          const desfaseSegundos = resultado.Detalles.DesfaseSegundos || 0;
          const estado = this.mapper.determinarEstadoAsistencia(
            desfaseSegundos,
            ModoRegistro.Salida
          );

          // ✅ CREATE AND SAVE IN LOCAL CACHE
          const asistenciaSalida = this.crearAsistenciaParaCache(
            String(idUsuario),
            actor,
            ModoRegistro.Salida,
            timestamp,
            desfaseSegundos,
            estado,
            fechaHoy
          );

          await this.guardarAsistenciaEnCache(asistenciaSalida);

          // ✅ INTEGRATE INTO MONTHLY RECORD
          salidaFinal = this.integrarDatosDeCacheEnRegistroMensual(
            salidaFinal,
            asistenciaSalida,
            diaActual,
            ModoRegistro.Salida,
            idUsuario,
            fechaHoy
          );

          integrado = true;
          console.log(
            `✅ Exit integrated from Redis and saved in cache: ${estado}`
          );
        }
      }

      const mensaje = integrado
        ? "Data integrated from Redis and saved in local cache"
        : "No new data found in Redis";

      return {
        entrada: entradaFinal || undefined,
        salida: salidaFinal || undefined,
        integrado,
        mensaje,
      };
    } catch (error) {
      console.error("❌ Error integrating direct data from Redis:", error);
      return {
        entrada: registroEntrada || undefined,
        salida: registroSalida || undefined,
        integrado: false,
        mensaje: `Integration error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Integrates cache data into the monthly record
   * ✅ NO CHANGES: No additional cleanup required
   */
  public integrarDatosDeCacheEnRegistroMensual(
    registroMensual: AsistenciaMensualPersonalLocal | null,
    datosCache: AsistenciaPersonalHoy,
    diaActual: number,
    modoRegistro: ModoRegistro,
    idUsuario: string | number,
    fecha: string
  ): AsistenciaMensualPersonalLocal {
    // If there is no monthly record, create a new one
    if (!registroMensual) {
      const fechaObj = new Date(fecha);
      const mes = (fechaObj.getMonth() + 1) as Meses;

      console.log(
        `📝 Creating new monthly record for ${idUsuario} - month ${mes}`
      );

      registroMensual = {
        Id_Registro_Mensual: 0, // Temporary ID
        mes,
        idUsuario_Personal: String(idUsuario),
        registros: {},
        ultima_fecha_actualizacion: this.dateHelper.obtenerTimestampPeruano(),
      };
    }

    // Add/update the current day with cache data
    const registroDia: RegistroEntradaSalida = {
      timestamp: datosCache.timestamp,
      desfaseSegundos: datosCache.desfaseSegundos,
      estado: datosCache.estado,
    };

    registroMensual.registros[diaActual.toString()] = registroDia;

    console.log(
      `🔄 Day ${diaActual} integrated from cache: ${datosCache.estado} (timestamp: ${datosCache.timestamp})`
    );

    return registroMensual;
  }

  /**
   * Combines historical data (IndexedDB) with current day data (Redis cache)
   * 🆕 INCLUDES automatic cleanup of the previous day
   */
  public async combinarDatosHistoricosYActuales(
    registroEntrada: AsistenciaMensualPersonalLocal | null,
    registroSalida: AsistenciaMensualPersonalLocal | null,
    rol: RolesSistema,
    idUsuario: string | number,
    esConsultaMesActual: boolean,
    diaActual: number,
    mensajeBase: string
  ): Promise<{
    entrada?: AsistenciaMensualPersonalLocal;
    salida?: AsistenciaMensualPersonalLocal;
    encontrado: boolean;
    mensaje: string;
  }> {
    // 🆕 Automatically clean previous day
    await this.limpiarDiasAnterioresAutomaticamente();

    let entradaFinal = registroEntrada;
    let salidaFinal = registroSalida;
    let encontradoEnCache = false;

    // Cache integration: Only for current month queries
    if (esConsultaMesActual) {
      console.log(
        `🔍 Querying Redis cache for the current day (${diaActual})...`
      );

      const actor = this.mapper.obtenerActorDesdeRol(rol);
      const fechaHoy = this.dateHelper.obtenerFechaStringActual();

      if (fechaHoy) {
        // Query cache for current day's entry and exit
        const [entradaCache, salidaCache] = await Promise.all([
          this.consultarCacheAsistenciaHoyDirecto(
            actor,
            ModoRegistro.Entrada,
            idUsuario,
            fechaHoy
          ),
          this.consultarCacheAsistenciaHoyDirecto(
            actor,
            ModoRegistro.Salida,
            idUsuario,
            fechaHoy
          ),
        ]);

        // Integrate entry from cache
        if (entradaCache) {
          console.log(`📱 Current day's entry found in cache`);
          entradaFinal = this.integrarDatosDeCacheEnRegistroMensual(
            entradaFinal,
            entradaCache,
            diaActual,
            ModoRegistro.Entrada,
            idUsuario,
            fechaHoy
          );
          encontradoEnCache = true;
        }

        // Integrate exit from cache
        if (salidaCache) {
          console.log(`📱 Current day's exit found in cache`);
          salidaFinal = this.integrarDatosDeCacheEnRegistroMensual(
            salidaFinal,
            salidaCache,
            diaActual,
            ModoRegistro.Salida,
            idUsuario,
            fechaHoy
          );
          encontradoEnCache = true;
        }
      }
    }

    const encontrado = !!(entradaFinal || salidaFinal);
    let mensaje = mensajeBase;

    if (encontradoEnCache) {
      mensaje += " + data for the current day from Redis cache";
    }

    return {
      entrada: entradaFinal || undefined,
      salida: salidaFinal || undefined,
      encontrado,
      mensaje,
    };
  }

  // ✅ NEW: Centralized control of Redis queries
  private static consultasRedisControlGlobal: Map<string, number> = new Map();

  /**
   * ✅ NEW: Checks if Redis has already been queried for this person/date/range
   */
  private generarClaveControlRedis(
    idUsuario: string | number,
    fecha: string,
    rango: string
  ): string {
    return `redis_control:${fecha}:${rango}:${idUsuario}`;
  }

  /**
   * ✅ NEW: Checks if Redis has already been queried in this range
   */
  public yaSeConsultoRedisEnRango(
    idUsuario: string | number,
    estrategia: string
  ): {
    yaConsultado: boolean;
    ultimaConsulta: number | null;
    razon: string;
  } {
    const fechaHoy = this.dateHelper.obtenerFechaStringActual();
    const rangoActual =
      this.dateHelper.obtenerRangoHorarioActualConConstantes();

    if (!fechaHoy) {
      return {
        yaConsultado: false,
        ultimaConsulta: null,
        razon: "Could not get current date",
      };
    }

    const claveControl = this.generarClaveControlRedis(
      idUsuario,
      fechaHoy,
      rangoActual.rango
    );
    const ultimaConsulta =
      AsistenciaDePersonalCacheManager.consultasRedisControlGlobal.get(
        claveControl
      );

    if (!ultimaConsulta) {
      return {
        yaConsultado: false,
        ultimaConsulta: null,
        razon: `First Redis query for ${estrategia} in range ${rangoActual.rango}`,
      };
    }

    const controlRango =
      this.dateHelper.yaSeConsultoEnRangoActual(ultimaConsulta);

    return {
      yaConsultado: controlRango.yaConsultado,
      ultimaConsulta,
      razon: `${controlRango.razon} (global control)`,
    };
  }

  /**
   * ✅ NEW: Marks that Redis was queried at this moment
   */
  public marcarConsultaRedisRealizada(idUsuario: string | number): void {
    const fechaHoy = this.dateHelper.obtenerFechaStringActual();
    const rangoActual =
      this.dateHelper.obtenerRangoHorarioActualConConstantes();
    const timestampActual = this.dateHelper.obtenerTimestampPeruano();

    if (fechaHoy) {
      const claveControl = this.generarClaveControlRedis(
        idUsuario,
        fechaHoy,
        rangoActual.rango
      );
      AsistenciaDePersonalCacheManager.consultasRedisControlGlobal.set(
        claveControl,
        timestampActual
      );

      console.log(
        `🔒 Redis query marked: ${claveControl} - ${this.dateHelper.formatearTimestampLegible(
          timestampActual
        )}`
      );
    }
  }

  /**
   * ✅ NEW: Cleans up Redis query controls from previous days
   */
  public limpiarControlesRedisAntiguos(): void {
    const fechaHoy = this.dateHelper.obtenerFechaStringActual();
    if (!fechaHoy) return;

    const clavesAEliminar: string[] = [];

    for (const [
      clave,
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      timestamp,
    ] of AsistenciaDePersonalCacheManager.consultasRedisControlGlobal.entries()) {
      if (clave.includes("redis_control:") && !clave.includes(fechaHoy)) {
        clavesAEliminar.push(clave);
      }
    }

    clavesAEliminar.forEach((clave) => {
      AsistenciaDePersonalCacheManager.consultasRedisControlGlobal.delete(
        clave
      );
    });

    if (clavesAEliminar.length > 0) {
      console.log(
        `🧹 Cleanup of old Redis controls: ${clavesAEliminar.length} deleted`
      );
    }
  }

  /**
   * 🎯 SMART QUERY: Checks local cache first, then Redis if necessary
   * ✅ FULL INTEGRATION with AsistenciasTomadasHoyIDB according to flowchart
   */
  public async consultarAsistenciaConFallbackRedis(
    rol: RolesSistema,
    idUsuario: string | number,
    modoRegistro: ModoRegistro,
    estrategia: "REDIS_ENTRADAS" | "REDIS_COMPLETO"
  ): Promise<{
    encontrado: boolean;
    datos?: AsistenciaPersonalHoy;
    fuente: "CACHE_LOCAL" | "REDIS" | "NO_ENCONTRADO";
    mensaje: string;
  }> {
    try {
      // 🆕 Automatically clean previous day
      await this.limpiarDiasAnterioresAutomaticamente();

      const actor = this.mapper.obtenerActorDesdeRol(rol);
      const fechaHoy = this.dateHelper.obtenerFechaStringActual();

      if (!fechaHoy) {
        return {
          encontrado: false,
          fuente: "NO_ENCONTRADO",
          mensaje: "Could not get current date",
        };
      }

      console.log(
        `🔍 Smart query: ${idUsuario} - ${modoRegistro} - strategy: ${estrategia}`
      );

      // STEP 1: Query local cache (AsistenciasTomadasHoy)
      const datosCache = await this.consultarCacheAsistenciaHoyDirecto(
        actor,
        modoRegistro,
        idUsuario,
        fechaHoy
      );

      if (datosCache) {
        console.log(
          `✅ Found in local cache: ${datosCache.estado} (${datosCache.dni})`
        );
        return {
          encontrado: true,
          datos: datosCache,
          fuente: "CACHE_LOCAL",
          mensaje: "Data obtained from local cache",
        };
      }

      // STEP 2: Validate if Redis should be queried according to the strategy
      const debeConsultarTipoRegistro =
        estrategia === "REDIS_COMPLETO" ||
        (estrategia === "REDIS_ENTRADAS" &&
          modoRegistro === ModoRegistro.Entrada);

      if (!debeConsultarTipoRegistro) {
        console.log(
          `⏭️ It is not appropriate to query ${modoRegistro} with strategy ${estrategia}`
        );
        return {
          encontrado: false,
          fuente: "NO_ENCONTRADO",
          mensaje: `${modoRegistro} not included in strategy ${estrategia}`,
        };
      }

      // STEP 3: Query Redis as a fallback
      console.log(`☁️ Querying Redis as a fallback for ${modoRegistro}...`);

      const resultadoRedis = await this.apiClient.consultarRedisEspecifico(
        rol,
        idUsuario,
        modoRegistro
      );

      if (resultadoRedis.encontrado && resultadoRedis.datos?.Resultados) {
        const resultado = Array.isArray(resultadoRedis.datos.Resultados)
          ? resultadoRedis.datos.Resultados[0]
          : resultadoRedis.datos.Resultados;

        if (resultado?.AsistenciaMarcada && resultado.Detalles) {
          // Create attendance from Redis data
          const timestamp =
            resultado.Detalles.Timestamp ||
            this.dateHelper.obtenerTimestampPeruano();
          const desfaseSegundos = resultado.Detalles.DesfaseSegundos || 0;
          const estado = this.mapper.determinarEstadoAsistencia(
            desfaseSegundos,
            modoRegistro
          );

          const asistenciaDesdeRedis = this.crearAsistenciaParaCache(
            String(idUsuario),
            actor,
            modoRegistro,
            timestamp,
            desfaseSegundos,
            estado,
            fechaHoy
          );

          // Save in local cache for future queries
          await this.guardarAsistenciaEnCache(asistenciaDesdeRedis);

          console.log(
            `✅ Found in Redis and saved in cache: ${estado} (${idUsuario})`
          );

          return {
            encontrado: true,
            datos: asistenciaDesdeRedis,
            fuente: "REDIS",
            mensaje: "Data obtained from Redis and saved in local cache",
          };
        }
      }

      console.log(`📭 Not found in local cache or Redis`);
      return {
        encontrado: false,
        fuente: "NO_ENCONTRADO",
        mensaje: "Attendance not found in local cache or Redis",
      };
    } catch (error) {
      console.error("❌ Error in smart query:", error);
      return {
        encontrado: false,
        fuente: "NO_ENCONTRADO",
        mensaje: `Query error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * 🆕 DIRECT METHOD to query the cache without automatic cleanup
   * 🎯 PURPOSE: Avoid recursive cleanup calls
   */
  public async consultarCacheAsistenciaHoyDirecto(
    actor: ActoresSistema,
    modoRegistro: ModoRegistro,
    idUsuario: string | number,
    fecha: string
  ): Promise<AsistenciaPersonalHoy | null> {
    try {
      const consulta: ConsultaAsistenciaHoy = {
        idUsuario,
        actor,
        modoRegistro,
        tipoAsistencia: TipoAsistencia.ParaPersonal,
        fecha,
      };

      const resultado = await this.cacheAsistenciasHoy.consultarAsistencia(
        consulta
      );

      return resultado as AsistenciaPersonalHoy | null;
    } catch (error) {
      console.error(
        "Error querying attendance cache (direct):",
        error
      );
      return null;
    }
  }

  /**
   * Gets only data for the current day when there is no historical data
   * 🆕 INCLUDES automatic cleanup of the previous day
   */
  public async obtenerSoloDatosDelDiaActual(
    rol: RolesSistema,
    idUsuario: string | number,
    diaActual: number
  ): Promise<{
    entrada?: AsistenciaMensualPersonalLocal;
    salida?: AsistenciaMensualPersonalLocal;
    encontrado: boolean;
    mensaje: string;
  }> {
    // 🆕 Automatically clean previous day
    await this.limpiarDiasAnterioresAutomaticamente();

    const actor = this.mapper.obtenerActorDesdeRol(rol);
    const fechaHoy = this.dateHelper.obtenerFechaStringActual();

    if (!fechaHoy) {
      return {
        encontrado: false,
        mensaje: "Could not get current date",
      };
    }

    console.log(
      `🔍 Searching for current day data in cache for ${idUsuario} - ${fechaHoy}`
    );

    const [entradaCache, salidaCache] = await Promise.all([
      this.consultarCacheAsistenciaHoyDirecto(
        actor,
        ModoRegistro.Entrada,
        idUsuario,
        fechaHoy
      ),
      this.consultarCacheAsistenciaHoyDirecto(
        actor,
        ModoRegistro.Salida,
        idUsuario,
        fechaHoy
      ),
    ]);

    let entrada: AsistenciaMensualPersonalLocal | undefined;
    let salida: AsistenciaMensualPersonalLocal | undefined;

    if (entradaCache) {
      entrada = this.integrarDatosDeCacheEnRegistroMensual(
        null,
        entradaCache,
        diaActual,
        ModoRegistro.Entrada,
        idUsuario,
        fechaHoy
      );
      console.log(
        `✅ Current day's entry found in cache: ${entradaCache.estado}`
      );
    }

    if (salidaCache) {
      salida = this.integrarDatosDeCacheEnRegistroMensual(
        null,
        salidaCache,
        diaActual,
        ModoRegistro.Salida,
        idUsuario,
        fechaHoy
      );
      console.log(
        `✅ Current day's exit found in cache: ${salidaCache.estado}`
      );
    }

    const encontrado = !!(entrada || salida);

    if (encontrado) {
      console.log(
        `🎯 Current day's data found in cache: entry=${!!entrada}, exit=${!!salida}`
      );
    } else {
      console.log(
        `❌ No current day data found in cache for ${idUsuario}`
      );
    }

    return {
      entrada,
      salida,
      encontrado,
      mensaje: encontrado
        ? "Only current day data found in Redis cache"
        : "No attendance records found for the consulted month",
    };
  }

  /**
   * Creates attendance for the cache from registration data
   * ✅ NO CHANGES: No additional cleanup required
   */
  public crearAsistenciaParaCache(
    dni: string,
    rol: ActoresSistema | RolesSistema,
    modoRegistro: ModoRegistro,
    timestamp: number,
    desfaseSegundos: number,
    estado: EstadosAsistenciaPersonal,
    fecha: string
  ): AsistenciaPersonalHoy {
    const clave = this.mapper.generarClaveCache(
      rol as ActoresSistema,
      modoRegistro,
      dni,
      fecha
    );

    return {
      clave,
      dni,
      actor: rol as ActoresSistema,
      modoRegistro,
      tipoAsistencia: TipoAsistencia.ParaPersonal,
      timestamp,
      desfaseSegundos,
      estado,
      fecha,
      timestampConsulta: this.dateHelper.obtenerTimestampPeruano(),
    };
  }

  /**
   * Deletes attendance from today's attendance cache
   * 🆕 INCLUDES automatic cleanup of the previous day
   */
  public async eliminarAsistenciaDelCache(
    idUsuario: string | number,
    rol: RolesSistema,
    modoRegistro: ModoRegistro,
    fecha: string
  ): Promise<OperationResult> {
    try {
      // 🆕 Automatically clean previous day
      await this.limpiarDiasAnterioresAutomaticamente();

      const actor = this.mapper.obtenerActorDesdeRol(rol);
      const consulta: ConsultaAsistenciaHoy = {
        idUsuario,
        actor,
        modoRegistro,
        tipoAsistencia: TipoAsistencia.ParaPersonal,
        fecha,
      };

      // Check if it exists in the cache
      const asistenciaCache =
        await this.cacheAsistenciasHoy.consultarAsistencia(consulta);

      if (!asistenciaCache) {
        console.log(
          `🗄️ Attendance not found in cache for ${idUsuario} - ${modoRegistro} - ${fecha}`
        );
        return {
          exitoso: false,
          mensaje: "Attendance not found in cache",
        };
      }

      // Delete from cache using the key
      const clave = this.mapper.generarClaveCache(
        actor,
        modoRegistro,
        idUsuario,
        fecha
      );
      await this.eliminarAsistenciaEspecificaDelCache(clave);

      console.log(`✅ Attendance deleted from cache: ${clave}`);
      return {
        exitoso: true,
        mensaje: "Attendance deleted from cache successfully",
        datos: clave,
      };
    } catch (error) {
      console.error("Error deleting attendance from cache:", error);
      return {
        exitoso: false,
        mensaje: `Error deleting from cache: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Deletes a specific attendance from the cache by key
   * ✅ NO CHANGES: Auxiliary method that does not require cleaning
   */
  private async eliminarAsistenciaEspecificaDelCache(
    clave: string
  ): Promise<void> {
    try {
      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        "asistencias_tomadas_hoy",
        "readwrite"
      );

      return new Promise<void>((resolve, reject) => {
        const request = store.delete(clave);

        request.onsuccess = () => {
          console.log(`🗑️ Attendance deleted from cache: ${clave}`);
          resolve();
        };

        request.onerror = (event) => {
          reject(
            new Error(
              `Error deleting attendance from cache: ${
                (event.target as IDBRequest).error
              }`
            )
          );
        };
      });
    } catch (error) {
      console.error(
        "Error deleting specific attendance from cache:",
        error
      );
      throw error;
    }
  }

  /**
   * Clears the cache of expired attendances
   * 🆕 INCLUDES automatic cleanup of the previous day
   */
  public async limpiarCacheVencido(): Promise<OperationResult> {
    try {
      // 🆕 Automatically clean previous day
      await this.limpiarDiasAnterioresAutomaticamente();

      // The cache self-cleans, but we can force the cleanup
      const ahora = Date.now();
      const TIEMPO_EXPIRACION = 24 * 60 * 60 * 1000; // 24 hours

      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        "asistencias_tomadas_hoy",
        "readwrite"
      );

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const registros = request.result as AsistenciaPersonalHoy[];
          let eliminados = 0;

          const promesasEliminacion = registros
            .filter((registro) => {
              const tiempoTranscurrido = ahora - registro.timestampConsulta;
              return tiempoTranscurrido > TIEMPO_EXPIRACION;
            })
            .map((registro) => {
              eliminados++;
              return this.eliminarAsistenciaEspecificaDelCache(registro.clave);
            });

          Promise.all(promesasEliminacion)
            .then(() => {
              resolve({
                exitoso: true,
                mensaje: `Cache cleaned: ${eliminados} records deleted`,
                datos: { eliminados },
              });
            })
            .catch((error) => {
              reject(error);
            });
        };

        request.onerror = (event) => {
          reject(
            new Error(
              `Error getting records from cache: ${
                (event.target as IDBRequest).error
              }`
            )
          );
        };
      });
    } catch (error) {
      console.error("Error cleaning expired cache:", error);
      return {
        exitoso: false,
        mensaje: `Error cleaning cache: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Gets cache statistics
   * 🆕 INCLUDES automatic cleanup of the previous day
   */
  public async obtenerEstadisticasCache(): Promise<{
    totalRegistros: number;
    registrosHoy: number;
    registrosVencidos: number;
  }> {
    try {
      // 🆕 Automatically clean previous day
      await this.limpiarDiasAnterioresAutomaticamente();

      await IndexedDBConnection.init();
      const store = await IndexedDBConnection.getStore(
        "asistencias_tomadas_hoy",
        "readonly"
      );

      return new Promise((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          const registros = request.result as AsistenciaPersonalHoy[];
          const ahora = Date.now();
          const TIEMPO_EXPIRACION = 24 * 60 * 60 * 1000; // 24 hours
          const fechaHoy = this.dateHelper.obtenerFechaStringActual();

          let registrosHoy = 0;
          let registrosVencidos = 0;

          registros.forEach((registro) => {
            if (registro.fecha === fechaHoy) {
              registrosHoy++;
            }

            const tiempoTranscurrido = ahora - registro.timestampConsulta;
            if (tiempoTranscurrido > TIEMPO_EXPIRACION) {
              registrosVencidos++;
            }
          });

          resolve({
            totalRegistros: registros.length,
            registrosHoy,
            registrosVencidos,
          });
        };

        request.onerror = (event) => {
          reject(
            new Error(
              `Error getting cache statistics: ${
                (event.target as IDBRequest).error
              }`
            )
          );
        };
      });
    } catch (error) {
      console.error("Error getting cache statistics:", error);
      return {
        totalRegistros: 0,
        registrosHoy: 0,
        registrosVencidos: 0,
      };
    }
  }

  /**
   * 🆕 PUBLIC METHOD to force cleanup of the previous day
   * 🎯 USEFUL: For cases where manual cleanup is needed
   */
  public async forzarLimpiezaDiaAnterior(): Promise<OperationResult> {
    try {
      const fechaHoy = this.dateHelper.obtenerFechaStringActual();
      if (!fechaHoy) {
        return {
          exitoso: false,
          mensaje: "Could not get current date",
        };
      }

      const fechaHoyObj = new Date(fechaHoy);
      const fechaAyer = new Date(fechaHoyObj);
      fechaAyer.setDate(fechaHoyObj.getDate() - 1);

      const fechaAyerString = fechaAyer.toISOString().split("T")[0];

      console.log(`🧹 Forcing cleanup of the previous day: ${fechaAyerString}`);

      await this.cacheAsistenciasHoy.limpiarAsistenciasPorFecha(
        fechaAyerString
      );

      // Reset the cleanup control to allow the next automatic one
      this.ultimaLimpiezaDiaAnterior = null;

      return {
        exitoso: true,
        mensaje: `Forced cleanup completed for: ${fechaAyerString}`,
        datos: { fechaLimpiada: fechaAyerString },
      };
    } catch (error) {
      console.error("Error forcing cleanup of the previous day:", error);
      return {
        exitoso: false,
        mensaje: `Error forcing cleanup: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * 🆕 PUBLIC METHOD to get cleanup information
   * 📊 PURPOSE: Monitoring and debugging of the automatic cleanup system
   */
  public obtenerInfoLimpiezaAutomatica(): {
    ultimaLimpiezaDiaAnterior: string | null;
    fechaHoy: string | null;
    requiereLimpieza: boolean;
  } {
    const fechaHoy = this.dateHelper.obtenerFechaStringActual();
    const requiereLimpieza = this.ultimaLimpiezaDiaAnterior !== fechaHoy;

    return {
      ultimaLimpiezaDiaAnterior: this.ultimaLimpiezaDiaAnterior,
      fechaHoy,
      requiereLimpieza,
    };
  }
}
