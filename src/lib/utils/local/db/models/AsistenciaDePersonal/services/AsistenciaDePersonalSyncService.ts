/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AsistenciaMensualPersonalLocal,
  ModoRegistro,
  RolesSistema,
  OperationResult,
  ConsultaAsistenciaResult,
  SincronizacionStats,
  RegistroEntradaSalida,
  ActoresSistema,
  TipoPersonal,
} from "../AsistenciaDePersonalTypes";

import { AsistenciaCompletaMensualDePersonal } from "@/interfaces/shared/apis/api01/personal/types";
import {
  AsistenciaDiariaDePersonalResultado,
  ConsultarAsistenciasDePersonalTomadasPorRolEnRedisResponseBody,
  TipoAsistencia,
  //   DetallesAsistenciaUnitariaPersonal,
} from "@/interfaces/shared/AsistenciaRequests";
import { AsistenciaDePersonalRepository } from "./AsistenciaDePersonalRepository";
import { AsistenciaDePersonalValidator } from "./AsistenciaDePersonalValidator";
import { AsistenciaDePersonalAPIClient } from "./AsistenciaDePersonalAPIClient";
import { AsistenciaDePersonalMapper } from "./AsistenciaDePersonalMapper";
import { AsistenciaDePersonalCacheManager } from "./AsistenciaDePersonalCacheManager";
import { AsistenciaDateHelper } from "../../utils/AsistenciaDateHelper";
import { Meses } from "@/interfaces/shared/Meses";
import { DIAS_ESCOLARES_MINIMOS_VERIFICACION } from "@/constants/DIAS_ESCOLARES_MINIMOS_VERIFICACION";

/**
 * 🎯 RESPONSIBILITY: Data synchronization and coordination
 * - Synchronize data between API, cache, and local database
 * - Force full synchronization
 * - Process data from multiple sources
 * - Resolve synchronization conflicts
 *
 * ✅ FIXED:
 * - All modified records automatically update timestamp
 * - All date logic delegated to DateHelper (SRP)
 * - Consistency in timestamp handling
 */
export class AsistenciaPersonalSyncService {
  private repository: AsistenciaDePersonalRepository;
  private validator: AsistenciaDePersonalValidator;
  private apiClient: AsistenciaDePersonalAPIClient;
  private mapper: AsistenciaDePersonalMapper;
  private cacheManager: AsistenciaDePersonalCacheManager;
  private dateHelper: AsistenciaDateHelper;

  constructor(
    repository: AsistenciaDePersonalRepository,
    validator: AsistenciaDePersonalValidator,
    apiClient: AsistenciaDePersonalAPIClient,
    mapper: AsistenciaDePersonalMapper,
    cacheManager: AsistenciaDePersonalCacheManager,
    dateHelper: AsistenciaDateHelper
  ) {
    this.repository = repository;
    this.validator = validator;
    this.apiClient = apiClient;
    this.mapper = mapper;
    this.cacheManager = cacheManager;
    this.dateHelper = dateHelper;
  }

  /**
   * Forces full synchronization from the API
   * Deletes both local records and replaces them with fresh data from the API
   * ✅ FIXED: Date handling delegated to DateHelper
   */
  public async forzarSincronizacionCompleta(
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number
  ): Promise<{
    entrada?: AsistenciaMensualPersonalLocal;
    salida?: AsistenciaMensualPersonalLocal;
    sincronizado: boolean;
    mensaje: string;
  }> {
    try {
      const tipoPersonal = this.mapper.obtenerTipoPersonalDesdeRolOActor(rol);

      console.log(
        `🔄 FORCING FULL SYNC for ${idUsuario} - month ${mes}`
      );

      // STEP 1: Delete both local records (entry and exit)
      console.log("🗑️ Deleting unsynchronized local records...");
      await Promise.allSettled([
        this.repository.eliminarRegistroMensual(
          tipoPersonal,
          ModoRegistro.Entrada,
          idUsuario,
          mes
        ),
        this.repository.eliminarRegistroMensual(
          tipoPersonal,
          ModoRegistro.Salida,
          idUsuario,
          mes
        ),
      ]);

      // STEP 2: Query API for fresh data
      console.log("📡 Querying API for fresh data...");
      const asistenciaAPI =
        await this.apiClient.consultarAsistenciasConReintentos(
          rol,
          idUsuario,
          mes
        );

      if (!asistenciaAPI) {
        console.log(
          "❌ API did not return data after forced synchronization"
        );
        return {
          sincronizado: false,
          mensaje:
            "No data was found in the API after synchronization",
        };
      }

      // STEP 3: Process and save BOTH types of records from the API
      console.log("💾 Saving fresh data from the API...");
      await this.procesarYGuardarAsistenciaDesdeAPI(asistenciaAPI);

      // STEP 4: Verify that both records were saved correctly
      const [nuevaEntrada, nuevaSalida] = await Promise.all([
        this.repository.obtenerRegistroMensual(
          tipoPersonal,
          ModoRegistro.Entrada,
          idUsuario,
          mes,
          asistenciaAPI.Id_Registro_Mensual_Entrada
        ),
        this.repository.obtenerRegistroMensual(
          tipoPersonal,
          ModoRegistro.Salida,
          idUsuario,
          mes,
          asistenciaAPI.Id_Registro_Mensual_Salida
        ),
      ]);

      // STEP 5: Verify that the synchronization was successful
      const verificacion = this.validator.verificarSincronizacionEntradaSalida(
        nuevaEntrada,
        nuevaSalida
      );

      if (verificacion.estanSincronizados) {
        console.log(
          `✅ Data synchronized: ${verificacion.diasEscolaresEntrada} historical school days + current day and allowed weekends`
        );
        return {
          entrada: nuevaEntrada || undefined,
          salida: nuevaSalida || undefined,
          sincronizado: true,
          mensaje: `Data synchronized successfully: ${verificacion.diasEscolaresEntrada} historical school days`,
        };
      } else {
        console.log(`❌ Synchronization failed: ${verificacion.razon}`);
        return {
          entrada: nuevaEntrada || undefined,
          salida: nuevaSalida || undefined,
          sincronizado: false,
          mensaje: `Synchronization error: ${verificacion.razon}`,
        };
      }
    } catch (error) {
      console.error("❌ Error during forced synchronization:", error);
      return {
        sincronizado: false,
        mensaje: `Error during synchronization: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * 🔄 INTEGRATES orphan attendances from the temporary cache with newly fetched API data
   */
  private async integrarAsistenciasHuerfanasDesdeAPI(
    asistenciaAPI: AsistenciaCompletaMensualDePersonal,
    tipoPersonal: TipoPersonal,
    timestampPeruanoActual: number,
    modoRegistroSolicitado?: ModoRegistro
  ): Promise<void> {
    try {
      const infoFechaActual = this.dateHelper.obtenerInfoFechaActual();

      if (
        !infoFechaActual ||
        !this.dateHelper.esDiaEscolar(infoFechaActual.diaActual.toString())
      ) {
        console.log(
          "📅 Not a current school day, skipping temporary cache integration"
        );
        return;
      }

      const actor = this.mapper.obtenerActorDesdeRol(asistenciaAPI.Rol);
      const fechaHoy = this.dateHelper.obtenerFechaStringActual();
      const diaActual = infoFechaActual.diaActual;

      if (!fechaHoy) return;

      // Determine which records to process
      const modosAProcesar = modoRegistroSolicitado
        ? [modoRegistroSolicitado]
        : [ModoRegistro.Entrada, ModoRegistro.Salida];

      for (const modoRegistro of modosAProcesar) {
        try {
          // Query temporary cache for this mode
          const asistenciaCache =
            await this.consultarCacheTemporalParaIntegracion(
              actor,
              modoRegistro,
              asistenciaAPI.ID_Usuario,
              fechaHoy
            );

          if (asistenciaCache) {
            // Get the newly saved monthly record
            const idReal =
              modoRegistro === ModoRegistro.Entrada
                ? asistenciaAPI.Id_Registro_Mensual_Entrada
                : asistenciaAPI.Id_Registro_Mensual_Salida;

            const registroMensual =
              await this.repository.obtenerRegistroMensual(
                tipoPersonal,
                modoRegistro,
                asistenciaAPI.ID_Usuario,
                asistenciaAPI.Mes,
                idReal
              );

            if (
              registroMensual &&
              !registroMensual.registros[diaActual.toString()]
            ) {
              // Add current day's attendance
              const registroDia: RegistroEntradaSalida = {
                timestamp: asistenciaCache.timestamp,
                desfaseSegundos: asistenciaCache.desfaseSegundos,
                estado: asistenciaCache.estado,
              };

              await this.repository.actualizarRegistroExistente(
                tipoPersonal,
                modoRegistro,
                asistenciaAPI.ID_Usuario,
                asistenciaAPI.Mes,
                diaActual,
                registroDia,
                idReal
              );

              // Clean from temporary cache
              await this.limpiarAsistenciaHuerfanaDelCache(
                actor,
                modoRegistro,
                asistenciaAPI.ID_Usuario,
                fechaHoy
              );

              console.log(
                `✅ Orphan attendance of ${modoRegistro} integrated after API: ${asistenciaCache.estado}`
              );
            }
          }
        } catch (error) {
          console.error(
            `❌ Error integrating ${modoRegistro} from cache:`,
            error
          );
          // Continue with the next mode
        }
      }
    } catch (error) {
      console.error(
        "❌ General error in integration of orphan attendances from API:",
        error
      );
    }
  }

  /**
   * 🔍 QUERY temporary cache for integration
   */
  private async consultarCacheTemporalParaIntegracion(
    actor: ActoresSistema,
    modoRegistro: ModoRegistro,
    idUsuario: string | number,
    fecha: string
  ): Promise<any> {
    try {
      // Dynamically import to avoid circular dependencies
      const { AsistenciasTomadasHoyIDB } = await import(
        "../../AsistenciasTomadasHoy/AsistenciasTomadasHoyIDB"
      );
      const cacheAsistenciasHoy = new AsistenciasTomadasHoyIDB(this.dateHelper);

      return await cacheAsistenciasHoy.consultarAsistencia({
        idUsuario,
        actor,
        modoRegistro,
        tipoAsistencia: TipoAsistencia.ParaPersonal,
        fecha,
      });
    } catch (error) {
      console.error("❌ Error querying temporary cache:", error);
      return null;
    }
  }

  /**
   * 🗑️ CLEAN orphan attendance from the temporary cache
   */
  private async limpiarAsistenciaHuerfanaDelCache(
    actor: ActoresSistema,
    modoRegistro: ModoRegistro,
    dni: string,
    fecha: string
  ): Promise<void> {
    try {
      // ✅ FIXED: Delete only the specific attendance, not the entire date
      await this.cacheManager.eliminarAsistenciaDelCache(
        dni,
        this.mapper.obtenerRolDesdeActor(actor), // You will need this method
        modoRegistro,
        fecha
      );

      console.log(
        `🗑️ Specific orphan attendance deleted from cache: ${actor}-${modoRegistro}-${dni}-${fecha}`
      );
    } catch (error) {
      console.error(
        "❌ Error cleaning specific orphan attendance from cache:",
        error
      );
    }
  }

  /**
   * Processes and saves attendance from the API
   * ✅ FIXED: Guaranteed automatic timestamp
   */
  public async procesarYGuardarAsistenciaDesdeAPI(
    asistenciaAPI: AsistenciaCompletaMensualDePersonal,
    modoRegistroSolicitado?: ModoRegistro
  ): Promise<OperationResult> {
    try {
      const tipoPersonal = this.mapper.obtenerTipoPersonalDesdeRolOActor(
        asistenciaAPI.Rol
      );

      // ✅ NEW: Get current Peruvian timestamp ONCE for consistency
      const timestampPeruanoActual = this.dateHelper.obtenerTimestampPeruano();
      console.log(
        `💾 Processing API data with timestamp: ${timestampPeruanoActual} (${new Date(
          timestampPeruanoActual
        ).toLocaleString("es-PE")})`
      );

      const procesarYGuardar = async (modoRegistro: ModoRegistro) => {
        const registrosData =
          modoRegistro === ModoRegistro.Entrada
            ? asistenciaAPI.Entradas
            : asistenciaAPI.Salidas;

        const idReal =
          modoRegistro === ModoRegistro.Entrada
            ? asistenciaAPI.Id_Registro_Mensual_Entrada
            : asistenciaAPI.Id_Registro_Mensual_Salida;

        const registrosProcesados = this.mapper.procesarRegistrosJSON(
          registrosData,
          modoRegistro
        );

        if (Object.keys(registrosProcesados).length > 0) {
          // ✅ FIXED: ALWAYS use current timestamp for API data
          const registroParaGuardar: AsistenciaMensualPersonalLocal = {
            Id_Registro_Mensual: idReal,
            mes: asistenciaAPI.Mes,
            idUsuario_Personal: asistenciaAPI.ID_Usuario,
            registros: registrosProcesados,
            ultima_fecha_actualizacion: timestampPeruanoActual, // ✅ GUARANTEED TIMESTAMP
          };

          console.log(
            `💾 Saving ${modoRegistro} with ${
              Object.keys(registrosProcesados).length
            } processed days`
          );

          await this.repository.guardarRegistroMensual(
            tipoPersonal,
            modoRegistro,
            registroParaGuardar
          );
        } else {
          console.log(`⚠️ No data to save in ${modoRegistro}`);
        }
      };

      if (modoRegistroSolicitado) {
        await procesarYGuardar(modoRegistroSolicitado);
      } else {
        await Promise.all([
          procesarYGuardar(ModoRegistro.Entrada),
          procesarYGuardar(ModoRegistro.Salida),
        ]);
      }

      // ✅ NEW: Integrate orphan attendances from the temporary cache after saving API data
      if (this.dateHelper.esConsultaMesActual(asistenciaAPI.Mes)) {
        console.log(
          "🔄 Integrating possible orphan attendances from the temporary cache..."
        );

        await this.integrarAsistenciasHuerfanasDesdeAPI(
          asistenciaAPI,
          tipoPersonal,
          timestampPeruanoActual,
          modoRegistroSolicitado
        );
      }

      return {
        exitoso: true,
        mensaje:
          "API data processed, saved and synchronized with temporary cache successfully",
      };
    } catch (error) {
      console.error("Error processing API data:", error);
      return {
        exitoso: false,
        mensaje: `Error processing API data: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * ✅ NEW: Auto-correction of inconsistent local data
   */
  private async autoCorregirDatosLocalesInconsistentes(
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number,
    razonInconsistencia: string
  ): Promise<ConsultaAsistenciaResult> {
    try {
      console.log(
        `🔧 Starting auto-correction for ${idUsuario} - month ${mes}: ${razonInconsistencia}`
      );

      const tipoPersonal = this.mapper.obtenerTipoPersonalDesdeRolOActor(rol);

      // Delete corrupt local data
      await Promise.allSettled([
        this.repository.eliminarRegistroMensual(
          tipoPersonal,
          ModoRegistro.Entrada,
          idUsuario,
          mes
        ),
        this.repository.eliminarRegistroMensual(
          tipoPersonal,
          ModoRegistro.Salida,
          idUsuario,
          mes
        ),
      ]);

      console.log("🧹 Inconsistent local data deleted");

      // Get fresh data from the API
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        `Auto-correction: ${razonInconsistencia}`
      );
    } catch (error) {
      console.error("❌ Error in auto-correction:", error);
      return {
        encontrado: false,
        mensaje: `Error in auto-correction: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      };
    }
  }

  /**
   * Forces update from the API by deleting local data
   * ✅ NO CHANGES: Already delegated correctly
   */
  public async forzarActualizacionDesdeAPI(
    rol: RolesSistema,
    dni: string,
    mes: number
  ): Promise<ConsultaAsistenciaResult> {
    try {
      const tipoPersonal = this.mapper.obtenerTipoPersonalDesdeRolOActor(rol);

      console.log(
        `🔄 Forcing update from API for ${rol} ${dni} - month ${mes}...`
      );

      // Delete existing local records
      await Promise.all([
        this.repository.eliminarRegistroMensual(
          tipoPersonal,
          ModoRegistro.Entrada,
          dni,
          mes
        ),
        this.repository.eliminarRegistroMensual(
          tipoPersonal,
          ModoRegistro.Salida,
          dni,
          mes
        ),
      ]);

      // Query API and save
      return await this.obtenerAsistenciaMensualConAPI(rol, dni, mes);
    } catch (error) {
      console.error("Error forcing update from API:", error);

      return {
        encontrado: false,
        mensaje: "Error forcing data update",
      };
    }
  }

  /**
   * 🎯 FIXED FLOW according to flowchart - ALWAYS show data
   */
  public async obtenerAsistenciaMensualConAPI(
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number
  ): Promise<ConsultaAsistenciaResult> {
    try {
      // 🚨 STEP 1: Verify future month (FORCED LOGOUT)
      const estadoTemporal = this.dateHelper.obtenerEstadoTemporalMes(mes);

      if (estadoTemporal.tipo === "MES_FUTURO") {
        console.error(`🚨 FORCED LOGOUT: ${estadoTemporal.descripcion}`);
        throw new Error(
          "Querying a future month is not allowed - session closed for security"
        );
      }

      const tipoPersonal = this.mapper.obtenerTipoPersonalDesdeRolOActor(rol);
      console.log(
        `🎯 Fixed flow started: ${rol} ${idUsuario} - ${estadoTemporal.descripcion}`
      );

      // 📅 BRANCH: PREVIOUS MONTH
      if (estadoTemporal.tipo === "MES_ANTERIOR") {
        return await this.procesarConsultaMesAnteriorCorregido(
          tipoPersonal,
          rol,
          idUsuario,
          mes
        );
      }

      // 📅 BRANCH: CURRENT MONTH
      return await this.procesarConsultaMesActualCorregido(
        tipoPersonal,
        rol,
        idUsuario,
        mes
      );
    } catch (error) {
      console.error("❌ Error in fixed flow:", error);
      return {
        encontrado: false,
        mensaje:
          error instanceof Error
            ? error.message
            : "Error in attendance query",
      };
    }
  }

  /**
   * ✅ FIXED: Previous month with 45-minute control
   */
  private async procesarConsultaMesAnteriorCorregido(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number
  ): Promise<ConsultaAsistenciaResult> {
    console.log(`📅 Processing previous month with 45min control: ${mes}`);

    // STEP 1: Query IndexedDB
    const [registroEntrada, registroSalida] = await Promise.all([
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Entrada,
        idUsuario,
        mes
      ),
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Salida,
        idUsuario,
        mes
      ),
    ]);

    // ✅ NEW: Validate consistency BEFORE proceeding
    if (registroEntrada || registroSalida) {
      const validacionConsistencia =
        await this.validator.validarConsistenciaEntradaSalida(
          registroEntrada,
          registroSalida,
          mes,
          idUsuario
        );

      if (validacionConsistencia.requiereCorreccion) {
        console.warn(
          `⚠️ Inconsistent data detected for ${idUsuario} - month ${mes}: ${validacionConsistencia.razon}`
        );
        console.log(
          "🗑️ Deleting inconsistent records and querying API..."
        );

        // Delete inconsistent records
        await Promise.allSettled([
          this.repository.eliminarRegistroMensual(
            tipoPersonal,
            ModoRegistro.Entrada,
            idUsuario,
            mes
          ),
          this.repository.eliminarRegistroMensual(
            tipoPersonal,
            ModoRegistro.Salida,
            idUsuario,
            mes
          ),
        ]);

        // Force API query
        return await this.consultarAPIYGuardar(
          rol,
          idUsuario,
          mes,
          `Correction for inconsistency: ${validacionConsistencia.razon}`
        );
      }

      console.log(`✅ Consistent data: ${validacionConsistencia.razon}`);
    }

    // STEP 2: If it does NOT exist in IndexedDB → Query API
    if (!registroEntrada && !registroSalida) {
      console.log("📡 Does not exist in IndexedDB - Querying API");
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        "First query for previous month"
      );
    }

    // STEP 3: If it EXISTS → Check 45-minute control first
    const registro = registroEntrada || registroSalida;
    const controlRango = this.dateHelper.yaSeConsultoEnRangoActual(
      registro!.ultima_fecha_actualizacion
    );

    if (controlRango.yaConsultado) {
      console.log(
        `⏭️ Previous month - ${controlRango.razon} - Use existing data`
      );
      return {
        entrada: registroEntrada!,
        salida: registroSalida!,
        encontrado: true,
        mensaje: `Previous month - ${controlRango.razon}`,
        fuenteDatos: "INDEXEDDB",
        optimizado: true,
      };
    }

    // STEP 4: Verify month timestamp logic
    const mesUltimaActualizacion = this.dateHelper.extraerMesDeTimestamp(
      registro!.ultima_fecha_actualizacion
    );

    if (mesUltimaActualizacion === mes) {
      console.log(`🔄 45min control passed + same month ${mes} - Query API`);
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        `Update previous month - ${controlRango.razon}`
      );
    } else if (mesUltimaActualizacion > mes) {
      console.log(
        `✅ FINALIZED data (month ${mesUltimaActualizacion} > ${mes}) - Use IndexedDB`
      );
      return {
        entrada: registroEntrada!,
        salida: registroSalida!,
        encontrado: true,
        mensaje: "Finalized data",
        fuenteDatos: "INDEXEDDB",
        optimizado: true,
      };
    } else {
      console.log(
        `⚠️ Incomplete data (month ${mesUltimaActualizacion} < ${mes}) - Query API`
      );
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        `Incomplete data - ${controlRango.razon}`
      );
    }
  }

  /**
   * ✅ FIXED: Current month following exact flowchart
   */
  private async procesarConsultaMesActualCorregido(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number
  ): Promise<ConsultaAsistenciaResult> {
    console.log(`📅 Processing corrected current month: ${mes}`);

    const diaActual = this.dateHelper.obtenerDiaActual() || 1;
    const esFinDeSemana = this.dateHelper.esFinDeSemana();

    // STEP 1: Is today a school day? (exact flowchart)
    if (!esFinDeSemana) {
      // YES - School day
      return await this.procesarDiaEscolarCorregido(
        tipoPersonal,
        rol,
        idUsuario,
        mes,
        diaActual
      );
    } else {
      // NO - Weekend
      return await this.procesarFinDeSemanaCorregido(
        tipoPersonal,
        rol,
        idUsuario,
        mes,
        diaActual
      );
    }
  }

  /**
   * ✅ FIXED: Weekend with coverage verification + 45min
   */
  private async procesarFinDeSemanaCorregido(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number,
    diaActual: number
  ): Promise<ConsultaAsistenciaResult> {
    console.log("🏖️ Processing weekend with 45min control");

    // Search for existing records
    const [registroEntrada, registroSalida] = await Promise.all([
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Entrada,
        idUsuario,
        mes
      ),
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Salida,
        idUsuario,
        mes
      ),
    ]);

    if (registroEntrada || registroSalida) {
      const validacionConsistencia =
        await this.validator.validarConsistenciaEntradaSalida(
          registroEntrada,
          registroSalida,
          mes,
          idUsuario
        );

      if (validacionConsistencia.requiereCorreccion) {
        console.warn(
          `⚠️ Inconsistent data detected for ${idUsuario} - month ${mes}
          }: ${validacionConsistencia.razon}`
        );

        await Promise.allSettled([
          this.repository.eliminarRegistroMensual(
            tipoPersonal,
            ModoRegistro.Entrada,
            idUsuario,
            mes
          ),
          this.repository.eliminarRegistroMensual(
            tipoPersonal,
            ModoRegistro.Salida,
            idUsuario,
            mes
          ),
        ]);

        return await this.consultarAPIYGuardar(
          rol,
          idUsuario,
          mes,
          `Correction for inconsistency: ${validacionConsistencia.razon}`
        );
      }
    }

    // If there are NO records → Query API obligatorily
    if (!registroEntrada && !registroSalida) {
      console.log("📡 Weekend WITHOUT data - Mandatory API query");
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        "Weekend without data - mandatory API query"
      );
    }

    const registro = registroEntrada || registroSalida;

    // ✅ NEW: Check 45-minute control first
    const controlRango = this.dateHelper.yaSeConsultoEnRangoActual(
      registro!.ultima_fecha_actualizacion
    );

    if (controlRango.yaConsultado) {
      console.log(`⏭️ Weekend - ${controlRango.razon} - DO NOT query`);
      return await this.cacheManager.combinarDatosHistoricosYActuales(
        registroEntrada,
        registroSalida,
        rol,
        idUsuario,
        true,
        diaActual,
        `Weekend - ${controlRango.razon}`
      );
    }

    // ✅ NEW: Verify coverage of the last 5 school days
    const ultimosDiasEscolares = this.dateHelper.obtenerUltimosDiasEscolares(5);

    if (ultimosDiasEscolares.length > 0) {
      const verificacionEntrada = registroEntrada
        ? await this.repository.verificarDatosEnUltimosDiasEscolares(
            tipoPersonal,
            ModoRegistro.Entrada,
            idUsuario,
            mes,
            ultimosDiasEscolares
          )
        : { tieneDatosSuficientes: false };

      const verificacionSalida = registroSalida
        ? await this.repository.verificarDatosEnUltimosDiasEscolares(
            tipoPersonal,
            ModoRegistro.Salida,
            idUsuario,
            mes,
            ultimosDiasEscolares
          )
        : { tieneDatosSuficientes: false };

      const tieneDatosSuficientes =
        verificacionEntrada.tieneDatosSuficientes ||
        verificacionSalida.tieneDatosSuficientes;

      if (tieneDatosSuficientes) {
        console.log(
          "✅ Weekend - Sufficient coverage in the last 5 days - DO NOT query API"
        );
        return await this.cacheManager.combinarDatosHistoricosYActuales(
          registroEntrada,
          registroSalida,
          rol,
          idUsuario,
          true,
          diaActual,
          "Weekend - sufficient coverage in the last 5 school days"
        );
      }
    }

    // Was the last update on a full Friday (>= 8 PM)?
    const viernesCompleto = this.dateHelper.fueActualizadoViernesCompleto(
      registro!.ultima_fecha_actualizacion
    );

    if (viernesCompleto) {
      console.log(
        "✅ Weekend - Friday data complete (8:00 PM+) - DO NOT query API"
      );
      return await this.cacheManager.combinarDatosHistoricosYActuales(
        registroEntrada,
        registroSalida,
        rol,
        idUsuario,
        true,
        diaActual,
        "Weekend - Friday data complete (updated after 8:00 PM)"
      );
    } else {
      console.log(
        "🔄 Weekend - Conditions to query API met"
      );
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        "Weekend - incomplete data or insufficient coverage"
      );
    }
  }

  /**
   * ✅ FIXED: School day following flowchart
   */
  private async procesarDiaEscolarCorregido(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number,
    diaActual: number
  ): Promise<ConsultaAsistenciaResult> {
    const horaActual = this.dateHelper.obtenerHoraActual() || 0;
    console.log(`🏫 Processing school day: hour ${horaActual}`);

    // STEP 1: Current time < 06:00? (exact flowchart)
    if (horaActual < 6) {
      console.log("🌙 Early morning - Verify historical data");
      return await this.procesarMadrugadaConDatosHistoricos(
        tipoPersonal,
        rol,
        idUsuario,
        mes,
        diaActual
      );
    }

    // STEP 2: Current time >= 22:00? (exact flowchart)
    if (horaActual >= 22) {
      console.log("🌃 Consolidated data - Query API");
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        "After 10:00 PM - consolidated data in PostgreSQL"
      );
    }

    // STEP 3: 06:00 <= Time < 22:00 - Redis/IndexedDB logic
    console.log("🏫 School hours - Apply Redis/IndexedDB logic");
    return await this.procesarHorarioEscolarConVerificacion(
      tipoPersonal,
      rol,
      idUsuario,
      mes,
      diaActual,
      horaActual
    );
  }

  /**
   * ✅ NEW: Processes school hours with verification of historical data
   */
  private async procesarHorarioEscolarConVerificacion(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number,
    diaActual: number,
    horaActual: number
  ): Promise<ConsultaAsistenciaResult> {
    // Use existing logic
    return await this.verificarDatosHistoricosYProceder(
      tipoPersonal,
      rol,
      idUsuario,
      mes,
      diaActual,
      {
        estrategia: horaActual < 12 ? "REDIS_ENTRADAS" : "REDIS_COMPLETO",
        razon: `School hours ${horaActual}:xx`,
      }
    );
  }

  /**
   * 🆕 NEW: Early morning handling with guaranteed historical data
   */
  private async procesarMadrugadaConDatosHistoricos(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number,
    diaActual: number
  ): Promise<ConsultaAsistenciaResult> {
    console.log("🌙 Processing early morning - there should ALWAYS be data");

    // Search for historical data in IndexedDB
    const [registroEntrada, registroSalida] = await Promise.all([
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Entrada,
        idUsuario,
        mes
      ),
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Salida,
        idUsuario,
        mes
      ),
    ]);

    // If there is NO historical data → Query API obligatorily
    if (!registroEntrada && !registroSalida) {
      console.log(
        "📡 Early morning WITHOUT historical data - Mandatory API query"
      );
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        "Early morning without historical data - mandatory API query"
      );
    }

    // If there IS historical data → Check the last school days
    const ultimosDiasEscolares = this.dateHelper.obtenerUltimosDiasEscolares(5);

    if (ultimosDiasEscolares.length === 0) {
      console.log(
        "📊 Could not get school days - Use existing data"
      );
      return await this.cacheManager.combinarDatosHistoricosYActuales(
        registroEntrada,
        registroSalida,
        rol,
        idUsuario,
        false, // Not the current month for cache purposes
        diaActual,
        "Early morning with existing historical data (without school day verification)"
      );
    }

    // Verify coverage in the last 5 school days
    const verificacionEntrada = registroEntrada
      ? await this.repository.verificarDatosEnUltimosDiasEscolares(
          tipoPersonal,
          ModoRegistro.Entrada,
          idUsuario,
          mes,
          ultimosDiasEscolares
        )
      : { tieneDatosSuficientes: false };

    const verificacionSalida = registroSalida
      ? await this.repository.verificarDatosEnUltimosDiasEscolares(
          tipoPersonal,
          ModoRegistro.Salida,
          idUsuario,
          mes,
          ultimosDiasEscolares
        )
      : { tieneDatosSuficientes: false };

    const tieneDatosSuficientes =
      verificacionEntrada.tieneDatosSuficientes ||
      verificacionSalida.tieneDatosSuficientes;

    if (!tieneDatosSuficientes) {
      console.log(
        "⚠️ Early morning - Insufficient data in the last 5 school days - Update from API"
      );
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        "Early morning - insufficient data in the last 5 school days"
      );
    }

    // Sufficient data - Use historical data
    console.log("✅ Early morning - Sufficient historical data");
    return await this.cacheManager.combinarDatosHistoricosYActuales(
      registroEntrada,
      registroSalida,
      rol,
      idUsuario,
      false,
      diaActual,
      "Early morning with sufficient historical data"
    );
  }

  /**
   * ✅ NEW: Processes previous month with smart logic
   */
  private async procesarConsultaMesAnteriorInteligente(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number
  ): Promise<ConsultaAsistenciaResult> {
    console.log(`📅 Processing smart previous month: ${mes}`);

    // Search in IndexedDB
    const [registroEntrada, registroSalida] = await Promise.all([
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Entrada,
        idUsuario,
        mes
      ),
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Salida,
        idUsuario,
        mes
      ),
    ]);

    // If it does not exist in IndexedDB → Query API
    if (!registroEntrada && !registroSalida) {
      console.log(
        "📡 Does not exist in IndexedDB - Querying API for the first time"
      );
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        "First query for previous month"
      );
    }

    // If it exists → Check according to last update (KEY LOGIC OF THE FLOWCHART)
    const registro = registroEntrada || registroSalida;
    if (!registro) {
      return {
        encontrado: false,
        mensaje: "Error getting existing record",
      };
    }

    const evaluacion = this.dateHelper.evaluarNecesidadConsultaSegunTimestamp(
      registro.ultima_fecha_actualizacion,
      mes
    );

    if (evaluacion.esDatoFinalizado) {
      console.log(`✅ Finalized data - ${evaluacion.razon}`);
      return {
        entrada: registroEntrada!,
        salida: registroSalida!,
        encontrado: true,
        mensaje: `Finalized data obtained from IndexedDB: ${evaluacion.razon}`,
        fuenteDatos: "INDEXEDDB",
        optimizado: true,
      };
    }

    if (evaluacion.esConsultaNecesaria) {
      console.log(`🔄 Query needed - ${evaluacion.razon}`);
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        `Update: ${evaluacion.razon}`
      );
    }

    // Use existing data
    console.log(`📋 Using existing data - ${evaluacion.razon}`);
    return {
      entrada: registroEntrada!,
      salida: registroSalida!,
      encontrado: true,
      mensaje: `Data obtained from IndexedDB: ${evaluacion.razon}`,
      fuenteDatos: "INDEXEDDB",
      optimizado: true,
    };
  }

  /**
   * ✅ NEW: Processes current month with smart logic
   */
  /**
   * ✅ FIXED: Process smart current month - Do not avoid Redis for "recent" data
   */
  private async procesarConsultaMesActualInteligente(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number
  ): Promise<ConsultaAsistenciaResult> {
    console.log(`📅 Processing smart current month: ${mes}`);

    // Search for existing records
    const [registroEntrada, registroSalida] = await Promise.all([
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Entrada,
        idUsuario,
        mes
      ),
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Salida,
        idUsuario,
        mes
      ),
    ]);

    const registro = registroEntrada || registroSalida;

    // If there are no records → Apply schedule logic
    if (!registro) {
      console.log("📭 No existing records - Apply schedule logic");
      return await this.aplicarLogicaHorarios(
        tipoPersonal,
        rol,
        idUsuario,
        mes
      );
    }

    // ✅ FIXED: If there are records → ALWAYS apply schedule logic for current month
    // Historical records do not prevent querying Redis for the current day
    console.log(
      `📊 Historical records found - Apply schedule logic to get current day's data`
    );
    return await this.aplicarLogicaHorarios(tipoPersonal, rol, idUsuario, mes);
  }

  /**
   * ✅ MODIFIED: Applies schedule logic with verification of historical data
   */
  private async aplicarLogicaHorarios(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number
  ): Promise<ConsultaAsistenciaResult> {
    const estrategia = this.dateHelper.determinarEstrategiaSegunHorario();
    console.log(
      `⏰ Applied strategy: ${estrategia.estrategia} - ${estrategia.razon}`
    );

    const diaActual = this.dateHelper.obtenerDiaActual() || 1;

    switch (estrategia.estrategia) {
      case "NO_CONSULTAR":
        return await this.obtenerDatosHistoricosSinConsulta(
          tipoPersonal,
          rol,
          idUsuario,
          mes,
          diaActual,
          estrategia.razon
        );

      case "API_CONSOLIDADO":
        return await this.consultarAPIYGuardar(
          rol,
          idUsuario,
          mes,
          estrategia.razon
        );

      case "REDIS_ENTRADAS":
      case "REDIS_COMPLETO":
        // ✅ NEW LOGIC: Verify historical data before querying only Redis
        return await this.verificarDatosHistoricosYProceder(
          tipoPersonal,
          rol,
          idUsuario,
          mes,
          diaActual,
          estrategia
        );

      default:
        console.warn(`⚠️ Unrecognized strategy: ${estrategia.estrategia}`);
        return await this.consultarAPIYGuardar(
          rol,
          idUsuario,
          mes,
          "Fallback strategy"
        );
    }
  }

  /**
   * ✅ FIXED: Verify historical data and proceed according to flowchart
   */
  private async verificarDatosHistoricosYProceder(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number,
    diaActual: number,
    estrategia: any
  ): Promise<ConsultaAsistenciaResult> {
    console.log(
      `🔍 Verifying historical data before applying: ${estrategia.estrategia}`
    );

    // STEP 1: Search for existing records
    const [registroEntrada, registroSalida] = await Promise.all([
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Entrada,
        idUsuario,
        mes
      ),
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Salida,
        idUsuario,
        mes
      ),
    ]);

    // ✅ NEW: Validate consistency if records exist
    if (registroEntrada || registroSalida) {
      const validacionConsistencia =
        await this.validator.validarConsistenciaEntradaSalida(
          registroEntrada,
          registroSalida,
          mes,
          idUsuario
        );

      if (validacionConsistencia.requiereCorreccion) {
        console.warn(
          `⚠️ Inconsistent data detected: ${validacionConsistencia.razon}`
        );
        console.log(
          "🗑️ Deleting inconsistent records and querying API..."
        );

        // Delete inconsistent records
        await Promise.allSettled([
          this.repository.eliminarRegistroMensual(
            tipoPersonal,
            ModoRegistro.Entrada,
            idUsuario,
            mes
          ),
          this.repository.eliminarRegistroMensual(
            tipoPersonal,
            ModoRegistro.Salida,
            idUsuario,
            mes
          ),
        ]);

        // Force full API query
        console.log("📡 Forcing API query due to inconsistency...");
        return await this.consultarAPIYGuardar(
          rol,
          idUsuario,
          mes,
          `Correction for inconsistency: ${validacionConsistencia.razon}`
        );
      }

      console.log(`✅ Consistent data: ${validacionConsistencia.razon}`);
    }

    // STEP 2: If there are NO monthly records → API + Redis
    if (!registroEntrada && !registroSalida) {
      console.log(`📭 No monthly records → API + Redis`);
      return await this.consultarAPILuegoRedis(rol, idUsuario, mes, estrategia);
    }

    // STEP 3: If there are records → Check the last 5 school days
    const ultimosDiasEscolares = this.dateHelper.obtenerUltimosDiasEscolares(
      DIAS_ESCOLARES_MINIMOS_VERIFICACION
    );

    if (ultimosDiasEscolares.length === 0) {
      console.log(`📅 Could not get school days → Only Redis`);
      return await this.consultarSoloRedis(
        tipoPersonal,
        rol,
        idUsuario,
        mes,
        diaActual,
        estrategia
      );
    }

    // STEP 4: Verify historical data coverage
    const verificacionEntrada = registroEntrada
      ? await this.repository.verificarDatosEnUltimosDiasEscolares(
          tipoPersonal,
          ModoRegistro.Entrada,
          idUsuario,
          mes,
          ultimosDiasEscolares
        )
      : { tieneDatosSuficientes: false };

    const verificacionSalida = registroSalida
      ? await this.repository.verificarDatosEnUltimosDiasEscolares(
          tipoPersonal,
          ModoRegistro.Salida,
          idUsuario,
          mes,
          ultimosDiasEscolares
        )
      : { tieneDatosSuficientes: false };

    // STEP 5: Decide according to coverage (at least ONE must have data)
    const tieneDatosSuficientes =
      verificacionEntrada.tieneDatosSuficientes ||
      verificacionSalida.tieneDatosSuficientes;

    if (!tieneDatosSuficientes) {
      console.log(`⚠️ No data in the last 5 school days → API + Redis`);
      return await this.consultarAPILuegoRedis(rol, idUsuario, mes, estrategia);
    }

    // STEP 6: Sufficient data → Only Redis
    console.log(`✅ Sufficient historical data → Only Redis`);
    return await this.consultarSoloRedis(
      tipoPersonal,
      rol,
      idUsuario,
      mes,
      diaActual,
      estrategia
    );
  }

  /**
   * ✅ NEW: Query API first, then Redis
   */
  private async consultarAPILuegoRedis(
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number,
    estrategia: any
  ): Promise<ConsultaAsistenciaResult> {
    // STEP 1: Query API for historical data
    console.log(`📡 STEP 1: Querying API for historical data...`);
    const resultadoAPI = await this.consultarAPIYGuardar(
      rol,
      idUsuario,
      mes,
      `${estrategia.razon} + No sufficient historical data`
    );

    if (!resultadoAPI.encontrado) {
      console.log(`❌ API did not return data`);
      return resultadoAPI;
    }

    // STEP 2: Now query Redis for current day's data
    console.log(`☁️ STEP 2: Querying Redis for current day's data...`);
    const tipoPersonal = this.mapper.obtenerTipoPersonalDesdeRolOActor(rol);
    const diaActual = this.dateHelper.obtenerDiaActual() || 1;

    return await this.consultarSoloRedis(
      tipoPersonal,
      rol,
      idUsuario,
      mes,
      diaActual,
      {
        ...estrategia,
        razon: `${estrategia.razon} + Post-API: querying Redis for today`,
      }
    );
  }

  /**
   * ✅ OPTIMIZED: Query only Redis with smart cache integration
   */
  private async consultarSoloRedis(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number,
    diaActual: number,
    estrategia: any
  ): Promise<ConsultaAsistenciaResult> {
    // ✅ CENTRALIZED GLOBAL CONTROL
    const controlGlobal = this.cacheManager.yaSeConsultoRedisEnRango(
      idUsuario,
      estrategia.estrategia
    );

    if (controlGlobal.yaConsultado) {
      console.log(
        `⏭️ GLOBAL CONTROL: ${controlGlobal.razon} - Skipping Redis query`
      );

      // Get current records and combine with existing cache
      const [registroEntrada, registroSalida] = await Promise.all([
        this.repository.obtenerRegistroMensual(
          tipoPersonal,
          ModoRegistro.Entrada,
          idUsuario,
          mes
        ),
        this.repository.obtenerRegistroMensual(
          tipoPersonal,
          ModoRegistro.Salida,
          idUsuario,
          mes
        ),
      ]);

      return await this.cacheManager.combinarDatosHistoricosYActuales(
        registroEntrada,
        registroSalida,
        rol,
        idUsuario,
        true,
        diaActual,
        `${estrategia.razon} + ${controlGlobal.razon}`
      );
    }

    console.log(
      `🔓 GLOBAL CONTROL: ${controlGlobal.razon} - Proceeding with Redis query`
    );

    // Get current records
    let [registroEntrada, registroSalida] = await Promise.all([
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Entrada,
        idUsuario,
        mes
      ),
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Salida,
        idUsuario,
        mes
      ),
    ]);

    // Verify data in local cache (for optimization)
    const fechaHoy = this.dateHelper.obtenerFechaStringActual();
    const actor = this.mapper.obtenerActorDesdeRol(rol);

    let tieneEntradaHoy = false;
    let tieneSalidaHoy = false;

    if (fechaHoy) {
      const [entradaLocal, salidaLocal] = await Promise.all([
        this.cacheManager.consultarCacheAsistenciaHoyDirecto(
          actor,
          ModoRegistro.Entrada,
          idUsuario,
          fechaHoy
        ),
        this.cacheManager.consultarCacheAsistenciaHoyDirecto(
          actor,
          ModoRegistro.Salida,
          idUsuario,
          fechaHoy
        ),
      ]);

      tieneEntradaHoy = !!entradaLocal;
      tieneSalidaHoy = !!salidaLocal;

      // If I already have all the necessary data, do not query Redis but mark as queried
      if (estrategia.estrategia === "REDIS_ENTRADAS" && tieneEntradaHoy) {
        console.log(
          "✅ I already have the complete local entry - marking as queried and skipping Redis"
        );
        this.cacheManager.marcarConsultaRedisRealizada(idUsuario);
        return await this.cacheManager.combinarDatosHistoricosYActuales(
          registroEntrada,
          registroSalida,
          rol,
          idUsuario,
          true,
          diaActual,
          "Complete entry data in local cache"
        );
      }

      if (
        estrategia.estrategia === "REDIS_COMPLETO" &&
        tieneEntradaHoy &&
        tieneSalidaHoy
      ) {
        console.log(
          "✅ I already have the complete local entry and exit - marking as queried and skipping Redis"
        );
        this.cacheManager.marcarConsultaRedisRealizada(idUsuario);
        return await this.cacheManager.combinarDatosHistoricosYActuales(
          registroEntrada,
          registroSalida,
          rol,
          idUsuario,
          true,
          diaActual,
          "Complete data in local cache"
        );
      }
    }

    // ✅ QUERY REDIS API
    console.log(`📡 Querying Redis API: ${estrategia.estrategia}`);

    const necesitaEntradas =
      estrategia.estrategia === "REDIS_ENTRADAS" ||
      (estrategia.estrategia === "REDIS_COMPLETO" && !tieneEntradaHoy);
    const necesitaSalidas =
      estrategia.estrategia === "REDIS_COMPLETO" && !tieneSalidaHoy;

    let mensajeConsulta = "";
    let datosRedisObtenidos = false;

    if (necesitaEntradas || necesitaSalidas) {
      try {
        const datosRedis =
          await this.apiClient.consultarRedisCompletoPorPersona(
            rol,
            idUsuario,
            necesitaSalidas
          );

        // ✅ MARK QUERY AS PERFORMED IMMEDIATELY
        this.cacheManager.marcarConsultaRedisRealizada(idUsuario);

        if (datosRedis.encontradoEntrada || datosRedis.encontradoSalida) {
          const integracion =
            await this.cacheManager.integrarDatosDirectosDeRedis(
              registroEntrada,
              registroSalida,
              datosRedis,
              rol,
              idUsuario,
              diaActual
            );

          if (integracion.integrado) {
            console.log(`✅ Redis API data integrated successfully`);
            datosRedisObtenidos = true;
            mensajeConsulta = `Data updated from Redis API: ${integracion.mensaje}`;
            registroEntrada = integracion.entrada || registroEntrada;
            registroSalida = integracion.salida || registroSalida;
          }
        }

        if (!datosRedisObtenidos) {
          console.log(`📭 No new data found in Redis API`);
          mensajeConsulta = "No new data found in Redis API";
        }
      } catch (error) {
        console.error(`❌ Error querying Redis API:`, error);
        // Mark as queried even if there is an error to avoid immediate retries
        this.cacheManager.marcarConsultaRedisRealizada(idUsuario);
        mensajeConsulta = "Error querying Redis API";
      }
    }

    return await this.cacheManager.combinarDatosHistoricosYActuales(
      registroEntrada,
      registroSalida,
      rol,
      idUsuario,
      true,
      diaActual,
      `${estrategia.razon} + ${mensajeConsulta}`
    );
  }

  /**
   * ✅ NEW: Processes query for previous month
   */
  private async procesarConsultaMesAnterior(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number
  ): Promise<ConsultaAsistenciaResult> {
    console.log(`📅 Processing previous month: ${mes}`);

    // Search in IndexedDB
    const [registroEntrada, registroSalida] = await Promise.all([
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Entrada,
        idUsuario,
        mes
      ),
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Salida,
        idUsuario,
        mes
      ),
    ]);

    // If it does not exist in IndexedDB → Query API
    if (!registroEntrada && !registroSalida) {
      console.log(
        "📡 Does not exist in IndexedDB - Querying API for the first time"
      );
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        "First query for previous month"
      );
    }

    // If it exists → Check according to last update
    const registro = registroEntrada || registroSalida;
    if (!registro) {
      return {
        encontrado: false,
        mensaje: "Error getting existing record",
      };
    }

    const evaluacion =
      this.dateHelper.debeConsultarAPIMesAnteriorSegunTimestamp(
        registro.ultima_fecha_actualizacion,
        mes
      );

    if (evaluacion.esDatoFinalizado) {
      console.log(`✅ Finalized data - ${evaluacion.razon}`);
      return {
        entrada: registroEntrada!,
        salida: registroSalida!,
        encontrado: true,
        mensaje: `Finalized data obtained from IndexedDB: ${evaluacion.razon}`,
        fuenteDatos: "INDEXEDDB",
        optimizado: true,
      };
    }

    if (evaluacion.debeConsultar) {
      console.log(`🔄 Updating data - ${evaluacion.razon}`);
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        `Update: ${evaluacion.razon}`
      );
    }

    // Return existing data
    return {
      entrada: registroEntrada!,
      salida: registroSalida!,
      encontrado: true,
      mensaje: "Data obtained from IndexedDB (no update needed)",
      fuenteDatos: "INDEXEDDB",
      optimizado: true,
    };
  }

  /**
   * ✅ NEW: Processes query for current month
   */
  private async procesarConsultaMesActual(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number
  ): Promise<ConsultaAsistenciaResult> {
    console.log(`📅 Processing current month: ${mes}`);

    const esFinDeSemana = this.dateHelper.esFinDeSemana();
    const diaActual = this.dateHelper.obtenerDiaActual();

    if (!diaActual) {
      throw new Error("Could not get current day");
    }

    // 🏖️ WEEKEND LOGIC
    if (esFinDeSemana) {
      return await this.procesarFinDeSemana(
        tipoPersonal,
        rol,
        idUsuario,
        mes,
        diaActual
      );
    }

    // 🏫 SCHOOL DAY LOGIC
    return await this.procesarDiaEscolar(
      tipoPersonal,
      rol,
      idUsuario,
      mes,
      diaActual
    );
  }

  /**
   * ✅ NEW: Processes logic for weekend
   */
  private async procesarFinDeSemana(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number,
    diaActual: number
  ): Promise<ConsultaAsistenciaResult> {
    console.log("🏖️ Processing weekend");

    // Search for existing records
    const [registroEntrada, registroSalida] = await Promise.all([
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Entrada,
        idUsuario,
        mes
      ),
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Salida,
        idUsuario,
        mes
      ),
    ]);

    const registro = registroEntrada || registroSalida;

    // If there are no records → Query API
    if (!registro) {
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        "First query on a weekend"
      );
    }

    // Check if last update was a full Friday
    const viernesCompleto = this.dateHelper.fueActualizadoViernesCompleto(
      registro.ultima_fecha_actualizacion
    );

    if (viernesCompleto) {
      console.log("✅ Friday's data is complete - Do not query API");
      return await this.cacheManager.combinarDatosHistoricosYActuales(
        registroEntrada,
        registroSalida,
        rol,
        idUsuario,
        true,
        diaActual,
        "Friday's data is complete (updated after 8:00 PM)"
      );
    } else {
      console.log("🔄 Friday's data is incomplete - Query API");
      return await this.consultarAPIYGuardar(
        rol,
        idUsuario,
        mes,
        "Weekend update - Friday's data is incomplete"
      );
    }
  }

  /**
   * ✅ NEW: Processes logic for school day
   */
  private async procesarDiaEscolar(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number,
    diaActual: number
  ): Promise<ConsultaAsistenciaResult> {
    console.log("🏫 Processing school day");

    const estrategia = this.dateHelper.determinarEstrategiaSegunHorario();
    console.log(
      `⏰ Determined strategy: ${estrategia.estrategia} - ${estrategia.razon}`
    );

    switch (estrategia.estrategia) {
      case "NO_CONSULTAR":
        return await this.obtenerDatosHistoricosSinConsulta(
          tipoPersonal,
          rol,
          idUsuario,
          mes,
          diaActual,
          estrategia.razon
        );

      case "API_CONSOLIDADO":
        return await this.consultarAPIYGuardar(
          rol,
          idUsuario,
          mes,
          estrategia.razon
        );

      case "REDIS_ENTRADAS":
      case "REDIS_COMPLETO":
        return await this.consultarRedisYCombinar(
          tipoPersonal,
          rol,
          idUsuario,
          mes,
          diaActual,
          estrategia
        );

      default:
        throw new Error(`Strategy not implemented: ${estrategia.estrategia}`);
    }
  }

  /**
   * ✅ NEW: Gets historical data without querying APIs
   */
  private async obtenerDatosHistoricosSinConsulta(
    tipoPersonal: TipoPersonal,
    rol: RolesSistema,
    idUsuario: string | number,
    mes: number,
    diaActual: number,
    razon: string
  ): Promise<ConsultaAsistenciaResult> {
    const [registroEntrada, registroSalida] = await Promise.all([
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Entrada,
        idUsuario,
        mes
      ),
      this.repository.obtenerRegistroMensual(
        tipoPersonal,
        ModoRegistro.Salida,
        idUsuario,
        mes
      ),
    ]);

    return await this.cacheManager.combinarDatosHistoricosYActuales(
      registroEntrada,
      registroSalida,
      rol,
      idUsuario,
      true,
      diaActual,
      `Historical data without query: ${razon}`
    );
  }

  /**