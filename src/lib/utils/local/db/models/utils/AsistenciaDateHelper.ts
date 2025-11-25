import { DIA_ESCOLAR_MINIMO_PARA_CONSULTAR_API } from "@/constants/DISPONIBILLIDAD_IDS_RDP02_GENERADOS";
import {
  DIAS_SEMANA,
  HORARIOS_CONSULTA,
} from "@/constants/HORARIOS_CONSULTA_INTELIGENTE";
import store from "@/global/store";

/**
 * 🎯 RESPONSIBILITY: Handling of dates and temporal logic
 * - Get current date from Redux
 * - Calculate school days
 * - Validate date ranges
 * - Determine API query logic
 * - Methods for intelligent query flow
 */
export class AsistenciaDateHelper {
  /**
   * Gets the current date from the Redux state
   * @returns Date object with the current date according to the global state or null if it cannot be obtained.
   */
  public obtenerFechaHoraActualDesdeRedux(): Date | null {
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
        "Error getting date from Redux in AsistenciaPersonalDateHelper:",
        error
      );
      return null;
    }
  }

  /**
   * ✅ NEW: Evaluates if it should query the API according to the last update (flowchart flow)
   */
  public evaluarNecesidadConsultaSegunTimestamp(
    ultimaActualizacion: number,
    mesConsultado: number
  ): {
    debeConsultar: boolean;
    razon: string;
    esConsultaNecesaria: boolean;
    esDatoFinalizado: boolean;
  } {
    try {
      const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
      if (!fechaActual) {
        return {
          debeConsultar: true,
          razon: "Could not get current date - query for security",
          esConsultaNecesaria: true,
          esDatoFinalizado: false,
        };
      }

      const mesActual = fechaActual.getMonth() + 1;
      const fechaUltimaActualizacion = new Date(ultimaActualizacion);
      const mesUltimaActualizacion = fechaUltimaActualizacion.getMonth() + 1;

      // Case 1: Queried month is before the current one
      if (mesConsultado < mesActual) {
        if (mesUltimaActualizacion > mesConsultado) {
          return {
            debeConsultar: false,
            razon:
              "FINALIZED data - last update was in a later month",
            esConsultaNecesaria: false,
            esDatoFinalizado: true,
          };
        } else if (mesUltimaActualizacion === mesConsultado) {
          return {
            debeConsultar: true,
            razon:
              "Data was updated in the same month - may have changed",
            esConsultaNecesaria: true,
            esDatoFinalizado: false,
          };
        } else {
          return {
            debeConsultar: true,
            razon:
              "Data may be incomplete - last update before the queried month",
            esConsultaNecesaria: true,
            esDatoFinalizado: false,
          };
        }
      }

      // Case 2: Queried month is the current one
      if (mesConsultado === mesActual) {
        // For the current month, apply schedule logic
        return this.evaluarConsultaMesActualSegunHorario(ultimaActualizacion);
      }

      // Case 3: Future month (should not get here if validated before)
      return {
        debeConsultar: false,
        razon: "Future month - FORCED LOGOUT",
        esConsultaNecesaria: false,
        esDatoFinalizado: false,
      };
    } catch (error) {
      console.error("Error evaluating need for query:", error);
      return {
        debeConsultar: true,
        razon: "Error in evaluation - query for security",
        esConsultaNecesaria: true,
        esDatoFinalizado: false,
      };
    }
  }

  /**
   * ✅ NEW: Gets the current time range
   */
  public obtenerRangoHorarioActual(): {
    rango: "EARLY_MORNING" | "ENTRIES" | "FULL" | "CONSOLIDATED";
    inicio: number;
    fin: number;
    descripcion: string;
  } {
    const horaActual = this.obtenerHoraActual() || 0;

    if (horaActual < 6) {
      return {
        rango: "EARLY_MORNING",
        inicio: 0,
        fin: 5,
        descripcion: "00:00-05:59 - Early morning without queries",
      };
    } else if (horaActual >= 6 && horaActual < 12) {
      return {
        rango: "ENTRIES",
        inicio: 6,
        fin: 11,
        descripcion: "06:00-11:59 - Entries only",
      };
    } else if (horaActual >= 12 && horaActual < 22) {
      return {
        rango: "FULL",
        inicio: 12,
        fin: 21,
        descripcion: "12:00-21:59 - Entries and exits",
      };
    } else {
      return {
        rango: "CONSOLIDATED",
        inicio: 22,
        fin: 23,
        descripcion: "22:00-23:59 - Consolidated data",
      };
    }
  }

  /**
   * ✅ FIXED: 45-minute control by range
   */
  public yaSeConsultoEnRangoActual(ultimaFechaActualizacion: number): {
    yaConsultado: boolean;
    rangoActual: string;
    rangoUltimaConsulta: string;
    razon: string;
    minutosTranscurridos: number;
  } {
    try {
      const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
      if (!fechaActual) {
        return {
          yaConsultado: false,
          rangoActual: "UNKNOWN",
          rangoUltimaConsulta: "UNKNOWN",
          razon: "Could not get current date",
          minutosTranscurridos: 0,
        };
      }

      const horaActual = fechaActual.getHours();
      const fechaHoyString = this.obtenerFechaStringActual();
      const fechaUltimaActualizacionString =
        this.convertirTimestampAFechaString(ultimaFechaActualizacion);
      const fechaUltimaActualizacion = new Date(ultimaFechaActualizacion);
      const horaUltimaActualizacion = fechaUltimaActualizacion.getHours();

      // Calculate minutes elapsed
      const diferenciaMs = fechaActual.getTime() - ultimaFechaActualizacion;
      const minutosTranscurridos = Math.floor(diferenciaMs / (1000 * 60));

      console.log(
        `🔍 Range control: last=${fechaUltimaActualizacionString} ${horaUltimaActualizacion}:xx, current=${fechaHoyString} ${horaActual}:xx, elapsed=${minutosTranscurridos}min`
      );

      // If the last update is not from today, you can definitely query
      if (fechaHoyString !== fechaUltimaActualizacionString) {
        const rangoActual = this.obtenerNombreRango(horaActual);
        return {
          yaConsultado: false,
          rangoActual,
          rangoUltimaConsulta: "DIFFERENT_DAY",
          razon: `Last update is not from today (${fechaUltimaActualizacionString} vs today ${fechaHoyString})`,
          minutosTranscurridos,
        };
      }

      // Both dates are today, compare ranges and time
      const rangoActual = this.obtenerNombreRango(horaActual);
      const rangoUltimaConsulta = this.obtenerNombreRango(
        horaUltimaActualizacion
      );

      // ✅ NEW LOGIC: Check 45 minutes + range change
      if (rangoActual === rangoUltimaConsulta && minutosTranscurridos < 45) {
        return {
          yaConsultado: true,
          rangoActual,
          rangoUltimaConsulta,
          razon: `Already queried in range ${rangoActual} ${minutosTranscurridos}min ago (< 45min limit)`,
          minutosTranscurridos,
        };
      }

      // If range changed OR 45+ minutes have passed, you can query
      const razonCambio =
        rangoActual !== rangoUltimaConsulta
          ? `Range change: ${rangoUltimaConsulta} → ${rangoActual}`
          : `Same range ${rangoActual} but ${minutosTranscurridos}min have passed (≥ 45min)`;

      return {
        yaConsultado: false,
        rangoActual,
        rangoUltimaConsulta,
        razon: razonCambio,
        minutosTranscurridos,
      };
    } catch (error) {
      console.error("Error checking query range:", error);
      return {
        yaConsultado: false,
        rangoActual: "ERROR",
        rangoUltimaConsulta: "ERROR",
        razon: "Error in verification",
        minutosTranscurridos: 0,
      };
    }
  }

  /**
   * ✅ NEW: Gets the range name according to the time using constants
   */
  private obtenerNombreRango(hora: number): string {
    if (hora < HORARIOS_CONSULTA.INICIO_DIA_ESCOLAR) {
      return "EARLY_MORNING";
    } else if (
      hora >= HORARIOS_CONSULTA.INICIO_DIA_ESCOLAR &&
      hora < HORARIOS_CONSULTA.SEPARACION_ENTRADAS_SALIDAS
    ) {
      return "ENTRIES";
    } else if (
      hora >= HORARIOS_CONSULTA.SEPARACION_ENTRADAS_SALIDAS &&
      hora < HORARIOS_CONSULTA.FIN_CONSOLIDACION
    ) {
      return "FULL";
    } else {
      return "CONSOLIDATED";
    }
  }

  /**
   * ✅ NEW: Gets details of the current time range using constants
   */
  public obtenerRangoHorarioActualConConstantes(): {
    rango: string;
    inicio: number;
    fin: number;
    descripcion: string;
  } {
    const horaActual = this.obtenerHoraActual() || 0;

    if (horaActual < HORARIOS_CONSULTA.INICIO_DIA_ESCOLAR) {
      return {
        rango: "EARLY_MORNING",
        inicio: 0,
        fin: HORARIOS_CONSULTA.INICIO_DIA_ESCOLAR - 1,
        descripcion: `00:00-${String(
          HORARIOS_CONSULTA.INICIO_DIA_ESCOLAR - 1
        ).padStart(2, "0")}:59 - Early morning without queries`,
      };
    } else if (
      horaActual >= HORARIOS_CONSULTA.INICIO_DIA_ESCOLAR &&
      horaActual < HORARIOS_CONSULTA.SEPARACION_ENTRADAS_SALIDAS
    ) {
      return {
        rango: "ENTRIES",
        inicio: HORARIOS_CONSULTA.INICIO_DIA_ESCOLAR,
        fin: HORARIOS_CONSULTA.SEPARACION_ENTRADAS_SALIDAS - 1,
        descripcion: `${String(HORARIOS_CONSULTA.INICIO_DIA_ESCOLAR).padStart(
          2,
          "0"
        )}:00-${String(
          HORARIOS_CONSULTA.SEPARACION_ENTRADAS_SALIDAS - 1
        ).padStart(2, "0")}:59 - Entries only`,
      };
    } else if (
      horaActual >= HORARIOS_CONSULTA.SEPARACION_ENTRADAS_SALIDAS &&
      horaActual < HORARIOS_CONSULTA.FIN_CONSOLIDACION
    ) {
      return {
        rango: "FULL",
        inicio: HORARIOS_CONSULTA.SEPARACION_ENTRADAS_SALIDAS,
        fin: HORARIOS_CONSULTA.FIN_CONSOLIDACION - 1,
        descripcion: `${String(
          HORARIOS_CONSULTA.SEPARACION_ENTRADAS_SALIDAS
        ).padStart(2, "0")}:00-${String(
          HORARIOS_CONSULTA.FIN_CONSOLIDACION - 1
        ).padStart(2, "0")}:59 - Entries and exits`,
      };
    } else {
      return {
        rango: "CONSOLIDATED",
        inicio: HORARIOS_CONSULTA.FIN_CONSOLIDACION,
        fin: 23,
        descripcion: `${String(HORARIOS_CONSULTA.FIN_CONSOLIDACION).padStart(
          2,
          "0"
        )}:00-23:59 - Consolidated data`,
      };
    }
  }

  /**
   * ✅ NEW: Generates a key for query control by range
   */
  public generarClaveControlConsulta(
    idUsuario: string | number,
    mes: number,
    rango: string
  ): string {
    const fecha = this.obtenerFechaStringActual() || "unknown";
    return `query:${fecha}:${mes}:${idUsuario}:${rango}`;
  }

  /**
   * ✅ FIXED: Evaluate query for current month - ALWAYS query Redis during school hours
   */
  private evaluarConsultaMesActualSegunHorario(ultimaActualizacion: number): {
    debeConsultar: boolean;
    razon: string;
    esConsultaNecesaria: boolean;
    esDatoFinalizado: boolean;
  } {
    const horaActual = this.obtenerHoraActual();
    const esFinDeSemana = this.esFinDeSemana();

    const fechaUltimaActualizacionString =
      this.convertirTimestampAFechaString(ultimaActualizacion);
    const fechaHoyString = this.obtenerFechaStringActual();

    console.log(`⏰ Evaluating current month query:`, {
      horaActual,
      esFinDeSemana,
      fechaHoy: fechaHoyString,
      fechaUltimaActualizacion: fechaUltimaActualizacionString,
      timestampOriginal: ultimaActualizacion,
    });

    if (horaActual === null) {
      return {
        debeConsultar: true,
        razon: "Could not get current time",
        esConsultaNecesaria: true,
        esDatoFinalizado: false,
      };
    }

    // Weekend
    if (esFinDeSemana) {
      const fueViernesCompleto =
        this.fueActualizadoViernesCompleto(ultimaActualizacion);

      if (fueViernesCompleto) {
        return {
          debeConsultar: false,
          razon:
            "Weekend - Friday data complete (updated after 20:00)",
          esConsultaNecesaria: false,
          esDatoFinalizado: false,
        };
      } else {
        return {
          debeConsultar: true,
          razon: "Weekend - Friday data incomplete",
          esConsultaNecesaria: true,
          esDatoFinalizado: false,
        };
      }
    }

    // School day
    if (horaActual < 6) {
      return {
        debeConsultar: false,
        razon: "Before 6:00 AM - no new attendances",
        esConsultaNecesaria: false,
        esDatoFinalizado: false,
      };
    }

    if (horaActual >= 22) {
      return {
        debeConsultar: true,
        razon: "After 22:00 - consolidated data in PostgreSQL",
        esConsultaNecesaria: true,
        esDatoFinalizado: false,
      };
    }

    // ✅ FIXED: Between 6:00 and 22:00 - ALWAYS query Redis for current day's data
    // API data is historical, Redis has current day's data
    return {
      debeConsultar: true,
      razon: `School hours (${horaActual}:xx) - Query Redis for current day's data (API has historical data until ${fechaUltimaActualizacionString})`,
      esConsultaNecesaria: true,
      esDatoFinalizado: false,
    };
  }

  // ========================================================================================
  // METHODS FOR INTELLIGENT FLOW
  // ========================================================================================

  /**
   * Gets the current hour from Redux (0-23)
   */
  public obtenerHoraActual(): number | null {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
    return fechaActual ? fechaActual.getHours() : null;
  }

  /**
   * Checks if it's the weekend (Saturday or Sunday)
   */
  public esFinDeSemana(): boolean {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) return false;

    const diaSemana = fechaActual.getDay(); // 0=sunday, 6=saturday
    return diaSemana === 0 || diaSemana === 6;
  }

  /**
   * Gets Peruvian timestamp (Peru time as a number)
   * For the mandatory field `ultima_fecha_actualizacion`
   */
  public obtenerTimestampPeruano(): number {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) {
      console.warn("Could not get date from Redux, using Date.now()");
      return Date.now();
    }

    return fechaActual.getTime();
  }

  /**
   * ✅ NEW: Extracts the month from a timestamp
   */
  public extraerMesDeTimestamp(timestamp: number): number {
    try {
      const fecha = new Date(timestamp);
      return fecha.getMonth() + 1; // 1-12
    } catch (error) {
      console.error("Error extracting month from timestamp:", error);
      return 0;
    }
  }

  /**
   * ✅ NEW: Checks if the last update was on a Friday >= 20:00
   */
  public fueActualizadoViernesCompleto(timestamp: number): boolean {
    try {
      const fecha = new Date(timestamp);
      const diaSemana = fecha.getDay();
      const hora = fecha.getHours();

      const esViernes = diaSemana === DIAS_SEMANA.VIERNES; // ✅ USE CONSTANT
      const esHoraCompleta = hora >= HORARIOS_CONSULTA.VIERNES_COMPLETO; // ✅ USE CONSTANT

      console.log(
        `📅 Checking for complete Friday: ${fecha.toLocaleString(
          "es-PE"
        )} - Day: ${diaSemana} (friday=${esViernes}), Hour: ${hora} (complete=${esHoraCompleta})`
      );

      return esViernes && esHoraCompleta;
    } catch (error) {
      console.error("Error checking for complete Friday:", error);
      return false;
    }
  }
  /**
   * ✅ NEW: Gets the last N school days of the current month
   */
  public obtenerUltimosDiasEscolares(cantidadDias: number = 5): number[] {
    try {
      const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
      if (!fechaActual) {
        console.warn("Could not get current date for school days");
        return [];
      }

      const anio = fechaActual.getFullYear();
      const mes = fechaActual.getMonth(); // 0-11
      const diaActual = fechaActual.getDate();

      const diasEscolares: number[] = [];
      let diasEncontrados = 0;

      // Search backwards from yesterday until N school days are found
      for (
        let dia = diaActual - 1;
        dia >= 1 && diasEncontrados < cantidadDias;
        dia--
      ) {
        const fecha = new Date(anio, mes, dia);
        const diaSemana = fecha.getDay(); // 0=sunday, 6=saturday

        // If it's a school day (Monday to Friday)
        if (diaSemana >= 1 && diaSemana <= 5) {
          diasEscolares.unshift(dia); // Add to the beginning to maintain chronological order
          diasEncontrados++;
        }
      }

      console.log(
        `📅 Last ${cantidadDias} school days found:`,
        diasEscolares
      );
      return diasEscolares;
    } catch (error) {
      console.error("Error getting last school days:", error);
      return [];
    }
  }

  /**
   * ✅ NEW: Checks if a date is a school day (without specific time)
   */
  public esDiaEscolarFecha(dia: number, mes?: number, anio?: number): boolean {
    try {
      const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
      if (!fechaActual) return false;

      const mesActual = mes !== undefined ? mes - 1 : fechaActual.getMonth(); // Convert to 0-11
      const anioActual = anio || fechaActual.getFullYear();

      const fecha = new Date(anioActual, mesActual, dia);
      const diaSemana = fecha.getDay(); // 0=sunday, 6=saturday

      return diaSemana >= 1 && diaSemana <= 5; // Only Monday to Friday
    } catch (error) {
      console.error("Error checking school day:", error);
      return false;
    }
  }

  /**
   * ✅ UPDATED: Use constants for schedules
   */
  public determinarEstrategiaSegunHorario(): {
    estrategia:
      | "DO_NOT_QUERY"
      | "REDIS_ENTRIES"
      | "REDIS_FULL"
      | "API_CONSOLIDATED";
    razon: string;
    debeConsultar: boolean;
  } {
    const horaActual = this.obtenerHoraActual();

    if (horaActual === null) {
      return {
        estrategia: "API_CONSOLIDATED",
        razon: "Could not get current time - use API for security",
        debeConsultar: true,
      };
    }

    // ✅ USE CONSTANTS instead of hardcoded numbers
    if (horaActual < HORARIOS_CONSULTA.INICIO_DIA_ESCOLAR) {
      return {
        estrategia: "DO_NOT_QUERY",
        razon: `Before ${String(
          HORARIOS_CONSULTA.INICIO_DIA_ESCOLAR
        ).padStart(2, "0")}:00 - No new attendances`,
        debeConsultar: false,
      };
    }

    if (horaActual >= HORARIOS_CONSULTA.FIN_CONSOLIDACION) {
      return {
        estrategia: "API_CONSOLIDATED",
        razon: `After ${String(
          HORARIOS_CONSULTA.FIN_CONSOLIDACION
        ).padStart(2, "0")}:00 - Consolidated data in PostgreSQL`,
        debeConsultar: true,
      };
    }

    if (horaActual < HORARIOS_CONSULTA.SEPARACION_ENTRADAS_SALIDAS) {
      return {
        estrategia: "REDIS_ENTRIES",
        razon: `${String(HORARIOS_CONSULTA.INICIO_DIA_ESCOLAR).padStart(
          2,
          "0"
        )}:00-${String(
          HORARIOS_CONSULTA.SEPARACION_ENTRADAS_SALIDAS - 1
        ).padStart(2, "0")}:59 - Query Redis for entries only`,
        debeConsultar: true,
      };
    }

    return {
      estrategia: "REDIS_FULL",
      razon: `${String(HORARIOS_CONSULTA.SEPARACION_ENTRADAS_SALIDAS).padStart(
        2,
        "0"
      )}:00-${String(HORARIOS_CONSULTA.FIN_CONSOLIDACION - 1).padStart(
        2,
        "0"
      )}:59 - Query Redis for entries and exits`,
      debeConsultar: true,
    };
  }

  /**
   * ✅ NEW: Validates if it should query API for previous month according to last update
   */
  public debeConsultarAPIMesAnteriorSegunTimestamp(
    ultimaActualizacion: number,
    mesConsultado: number
  ): {
    debeConsultar: boolean;
    razon: string;
    esDatoFinalizado: boolean;
  } {
    try {
      const mesActualizacion = this.extraerMesDeTimestamp(ultimaActualizacion);

      if (mesActualizacion === mesConsultado) {
        return {
          debeConsultar: true,
          razon:
            "Data was updated in the same queried month - may have changed",
          esDatoFinalizado: false,
        };
      } else if (mesActualizacion > mesConsultado) {
        return {
          debeConsultar: false,
          razon:
            "Data finalized - last update was in a later month than queried",
          esDatoFinalizado: true,
        };
      } else {
        return {
          debeConsultar: true,
          razon:
            "Data may be incomplete - last update was before the queried month",
          esDatoFinalizado: false,
        };
      }
    } catch (error) {
      console.error("Error evaluating query by timestamp:", error);
      return {
        debeConsultar: true,
        razon: "Error evaluating - query API for security",
        esDatoFinalizado: false,
      };
    }
  }

  /**
   * Validate if it's school hours
   * Combines existing logic with new validations
   */
  public validarHorarioEscolar(): {
    esHorarioEscolar: boolean;
    esDiaEscolar: boolean;
    horaActual: number;
    razon: string;
  } {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();

    if (!fechaActual) {
      return {
        esHorarioEscolar: false,
        esDiaEscolar: false,
        horaActual: 0,
        razon: "Could not get date from Redux",
      };
    }

    const horaActual = fechaActual.getHours();
    const diaSemana = fechaActual.getDay(); // 0=sunday, 6=saturday
    const esDiaEscolar = diaSemana >= 1 && diaSemana <= 5; // Monday to Friday

    // Validate school hours (6:00 AM - 10:00 PM)
    const esHorarioEscolar = horaActual >= 6 && horaActual < 22;

    let razon = "";
    if (!esDiaEscolar) {
      razon = "It's the weekend";
    } else if (!esHorarioEscolar) {
      razon =
        horaActual < 6
          ? "Too early (before 6:00 AM)"
          : "Too late (after 10:00 PM)";
    } else {
      razon = "Valid school hours";
    }

    return {
      esHorarioEscolar: esHorarioEscolar && esDiaEscolar,
      esDiaEscolar,
      horaActual,
      razon,
    };
  }

  /**
   * Determines query type according to month
   */
  public determinarTipoConsulta(mes: number): {
    tipo: "FUTURE_MONTH" | "PREVIOUS_MONTH" | "CURRENT_MONTH";
    debeLogout: boolean;
    razon: string;
  } {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();

    if (!fechaActual) {
      return {
        tipo: "CURRENT_MONTH",
        debeLogout: false,
        razon: "Could not get date from Redux",
      };
    }

    const mesActual = fechaActual.getMonth() + 1;

    if (mes > mesActual) {
      return {
        tipo: "FUTURE_MONTH",
        debeLogout: true,
        razon: "Query of future month not allowed - forced logout",
      };
    } else if (mes < mesActual) {
      return {
        tipo: "PREVIOUS_MONTH",
        debeLogout: false,
        razon: "Previous month - apply IndexedDB optimization",
      };
    } else {
      return {
        tipo: "CURRENT_MONTH",
        debeLogout: false,
        razon: "Current month - apply schedule logic",
      };
    }
  }

  /**
   * Determines query strategy for current month
   */
  public determinarEstrategiaConsultaMesActual(): {
    estrategia:
      | "DO_NOT_QUERY"
      | "REDIS_ENTRIES"
      | "REDIS_FULL"
      | "API_CONSOLIDATED";
    razon: string;
    horaActual: number;
  } {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();

    if (!fechaActual) {
      return {
        estrategia: "API_CONSOLIDATED",
        razon: "Could not get date from Redux - use API for security",
        horaActual: 0,
      };
    }

    const horaActual = fechaActual.getHours();
    const esFinDeSemana = this.esFinDeSemana();

    // ✅ FIXED: Weekends DO allow queries
    if (esFinDeSemana) {
      // On weekends, use consolidated API data
      return {
        estrategia: "API_CONSOLIDATED",
        razon: "Weekend - use consolidated API data",
        horaActual,
      };
    }

    // Schedule logic for school days
    if (horaActual < 6) {
      return {
        estrategia: "API_CONSOLIDATED", // ✅ CHANGED: DO NOT block, use API
        razon: "Before 6:00 AM - use consolidated API data",
        horaActual,
      };
    } else if (horaActual >= 6 && horaActual < 12) {
      return {
        estrategia: "REDIS_ENTRIES",
        razon:
          "Entry hours (6:00-12:00) - query Redis for entries",
        horaActual,
      };
    } else if (horaActual >= 12 && horaActual < 22) {
      return {
        estrategia: "REDIS_FULL",
        razon:
          "Full hours (12:00-22:00) - query Redis for entries and exits",
        horaActual,
      };
    } else {
      return {
        estrategia: "API_CONSOLIDATED",
        razon: "After 22:00 - consolidated data in PostgreSQL",
        horaActual,
      };
    }
  }

  /**
   * Validates if it should query API for previous month
   */
  public debeConsultarAPIMesAnterior(
    existeEnIndexedDB: boolean,
    ultimaFechaActualizacion: number | null,
    mesConsultado: number
  ): {
    debeConsultar: boolean;
    razon: string;
  } {
    if (!existeEnIndexedDB) {
      return {
        debeConsultar: true,
        razon: "Does not exist in IndexedDB - initial query required",
      };
    }

    if (!ultimaFechaActualizacion) {
      return {
        debeConsultar: true,
        razon: "Record without update date - requires update",
      };
    }

    // Extract month from last update
    const fechaActualizacion = new Date(ultimaFechaActualizacion);
    const mesActualizacion = fechaActualizacion.getMonth() + 1;

    if (mesActualizacion === mesConsultado) {
      return {
        debeConsultar: true,
        razon:
          "Data was updated in the same queried month - may have changed",
      };
    } else {
      return {
        debeConsultar: false,
        razon:
          "Data from finalized month - do not query API (optimization applied)",
      };
    }
  }

  /**
   * Create timestamp with current Peru date
   */
  public crearTimestampActual(): number {
    return this.obtenerTimestampPeruano();
  }

  /**
   * Check if a date is in the past
   */
  public esFechaPasada(timestamp: number): boolean {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) return false;

    return timestamp < fechaActual.getTime();
  }

  /**
   * Get difference in days between two timestamps
   */
  public obtenerDiferenciaDias(timestamp1: number, timestamp2: number): number {
    const diferenciaMilisegundos = Math.abs(timestamp1 - timestamp2);
    return Math.floor(diferenciaMilisegundos / (1000 * 60 * 60 * 24));
  }

  // ========================================================================================
  // ORIGINAL METHODS (NO CHANGES)
  // ========================================================================================

  /**
   * Calculates the school day of the month (not counting weekends)
   */
  public calcularDiaEscolarDelMes(): number {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux() || new Date();
    const anio = fechaActual.getFullYear();
    const mes = fechaActual.getMonth(); // 0-11
    const diaActual = fechaActual.getDate();

    let diaEscolar = 0;

    // Count only business days (Monday to Friday) from the beginning of the month until today
    for (let dia = 1; dia <= diaActual; dia++) {
      const fecha = new Date(anio, mes, dia);
      const diaSemana = fecha.getDay(); // 0=sunday, 1=monday, ..., 6=saturday

      // If it's a business day (Monday to Friday)
      if (diaSemana >= 1 && diaSemana <= 5) {
        diaEscolar++;
      }
    }

    return diaEscolar;
  }

  /**
   * Determines if we should query the API based on the school day
   */
  public debeConsultarAPI(diaEscolar: number): boolean {
    // If we are on the first school day of the month, it is safe that there are no IDs in PostgreSQL
    if (diaEscolar <= 1) {
      return false;
    }

    // From the second school day, it is likely that we already have records with IDs
    return diaEscolar >= DIA_ESCOLAR_MINIMO_PARA_CONSULTAR_API;
  }

  /**
   * Gets all previous business days of the current month (using Redux date)
   */
  public obtenerDiasLaboralesAnteriores(): number[] {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();

    if (!fechaActual) {
      console.error("Could not get date from Redux");
      return [];
    }

    const anio = fechaActual.getFullYear();
    const mes = fechaActual.getMonth(); // 0-11
    const diaActual = fechaActual.getDate();

    const diasLaborales: number[] = [];

    // Search for business days (Monday to Friday) from the beginning of the month until YESTERDAY
    for (let dia = 1; dia < diaActual; dia++) {
      // Note: dia < diaActual (not <=)
      const fecha = new Date(anio, mes, dia);
      const diaSemana = fecha.getDay(); // 0=sunday, 1=monday, ..., 6=saturday

      // If it's a business day (Monday to Friday)
      if (diaSemana >= 1 && diaSemana <= 5) {
        diasLaborales.push(dia);
      }
    }

    return diasLaborales;
  }

  /**
   * Function to check if a day is a school day (Monday to Friday)
   */
  public esDiaEscolar(dia: string, fechaRef?: Date): boolean {
    const fechaActual = fechaRef || this.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) return false;

    const diaNumero = parseInt(dia);
    if (isNaN(diaNumero)) return false;

    const añoActual = fechaActual.getFullYear();
    const mesActual = fechaActual.getMonth(); // 0-11

    const fecha = new Date(añoActual, mesActual, diaNumero);
    const diaSemana = fecha.getDay(); // 0=sunday, 1=monday, ..., 6=saturday
    return diaSemana >= 1 && diaSemana <= 5; // Only Monday to Friday
  }

  /**
   * Checks if it's a query for the current month
   */
  public esConsultaMesActual(mes: number): boolean {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) return false;

    return mes === fechaActual.getMonth() + 1;
  }

  /**
   * Gets the current month
   */
  public obtenerMesActual(): number | null {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
    return fechaActual ? fechaActual.getMonth() + 1 : null;
  }

  /**
   * Gets the current day
   */
  public obtenerDiaActual(): number | null {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
    return fechaActual ? fechaActual.getDate() : null;
  }

  /**
   * ✅ FIXED: Get current date string without double timezone conversion
   */
  public obtenerFechaStringActual(): string | null {
    const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) return null;

    // ✅ FIXED: Use local methods to avoid UTC conversion
    const año = fechaActual.getFullYear();
    const mes = (fechaActual.getMonth() + 1).toString().padStart(2, "0");
    const dia = fechaActual.getDate().toString().padStart(2, "0");

    const fechaString = `${año}-${mes}-${dia}`;

    console.log(
      `📅 Generated string date: ${fechaString} (from Redux: ${fechaActual.toLocaleString(
        "es-PE"
      )})`
    );

    return fechaString;
  }

  /**
   * ✅ FIXED: Convert timestamp to date string without timezone issues
   */
  public convertirTimestampAFechaString(timestamp: number): string {
    const fecha = new Date(timestamp);

    // ✅ FIXED: Use local methods to avoid UTC conversion
    const año = fecha.getFullYear();
    const mes = (fecha.getMonth() + 1).toString().padStart(2, "0");
    const dia = fecha.getDate().toString().padStart(2, "0");

    const fechaString = `${año}-${mes}-${dia}`;

    console.log(
      `🔄 Timestamp ${timestamp} converted to date: ${fechaString} (date object: ${fecha.toLocaleString(
        "es-PE"
      )})`
    );

    return fechaString;
  }

  /**
   * Converts a specific date to a YYYY-MM-DD format string
   */
  public convertirFechaAString(fecha: Date): string {
    return fecha.toISOString().split("T")[0];
  }

  /**
   * ✅ FIXED: Generate date string for specific month and day
   */
  public generarFechaString(mes: number, dia: number, año?: number): string {
    const añoFinal =
      año ||
      this.obtenerFechaHoraActualDesdeRedux()?.getFullYear() ||
      new Date().getFullYear();

    const fechaString = `${añoFinal}-${mes.toString().padStart(2, "0")}-${dia
      .toString()
      .padStart(2, "0")}`;

    console.log(
      `🎯 Manually generated date string: ${fechaString} (month: ${mes}, day: ${dia}, year: ${añoFinal})`
    );

    return fechaString;
  }

  /**
   * Gets complete information of the current date
   * Replaces direct access to Redux from other classes
   */
  public obtenerInfoFechaActual(): {
    fechaActual: Date;
    mesActual: number;
    diaActual: number;
    añoActual: number;
    esHoy: boolean;
  } | null {
    try {
      const fechaActual = this.obtenerFechaHoraActualDesdeRedux();

      if (!fechaActual) {
        console.error(
          "Could not get date from Redux in obtenerInfoFechaActual"
        );
        return null;
      }

      return {
        fechaActual,
        mesActual: fechaActual.getMonth() + 1,
        diaActual: fechaActual.getDate(),
        añoActual: fechaActual.getFullYear(),
        esHoy: true, // It's always "today" as it comes from real-time Redux
      };
    } catch (error) {
      console.error("Error getting current date information:", error);
      return null;
    }
  }

  /**
   * Checks if a timestamp is too old (more than 24 hours)
   * Useful for detecting outdated data
   */
  public esTimestampMuyAntiguo(
    timestamp: number,
    horasLimite: number = 24
  ): boolean {
    try {
      const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
      if (!fechaActual) {
        console.warn(
          "Could not get current date to check for old timestamp"
        );
        return false;
      }

      const timestampActual = fechaActual.getTime();
      const diferenciaMilisegundos = timestampActual - timestamp;
      const diferenciaHoras = diferenciaMilisegundos / (1000 * 60 * 60);

      const esAntiguo = diferenciaHoras > horasLimite;

      if (esAntiguo) {
        console.log(
          `⏰ Old timestamp detected: ${diferenciaHoras.toFixed(
            1
          )} hours difference (limit: ${horasLimite}h)`
        );
      }

      return esAntiguo;
    } catch (error) {
      console.error("Error checking if timestamp is old:", error);
      return false;
    }
  }

  /**
   * Formats a timestamp to readable text in Spanish-Peru
   */
  public formatearTimestampLegible(timestamp: number): string {
    try {
      const fecha = new Date(timestamp);
      return fecha.toLocaleString("es-PE", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      });
    } catch (error) {
      console.error("Error formatting timestamp:", error);
      return "Invalid date";
    }
  }

  /**
   * Calculates difference between two timestamps in a readable format
   */
  public calcularDiferenciaTimestamps(
    timestamp1: number,
    timestamp2: number
  ): {
    milisegundos: number;
    segundos: number;
    minutos: number;
    horas: number;
    dias: number;
    textoLegible: string;
  } {
    try {
      const diferenciaMilisegundos = Math.abs(timestamp1 - timestamp2);
      const segundos = Math.floor(diferenciaMilisegundos / 1000);
      const minutos = Math.floor(segundos / 60);
      const horas = Math.floor(minutos / 60);
      const dias = Math.floor(horas / 24);

      let textoLegible = "";
      if (dias > 0) {
        textoLegible = `${dias} day${dias > 1 ? "s" : ""}`;
      } else if (horas > 0) {
        textoLegible = `${horas} hour${horas > 1 ? "s" : ""}`;
      } else if (minutos > 0) {
        textoLegible = `${minutos} minute${minutos > 1 ? "s" : ""}`;
      } else {
        textoLegible = `${segundos} second${segundos > 1 ? "s" : ""}`;
      }

      return {
        milisegundos: diferenciaMilisegundos,
        segundos,
        minutos,
        horas,
        dias,
        textoLegible,
      };
    } catch (error) {
      console.error("Error calculating timestamp difference:", error);
      return {
        milisegundos: 0,
        segundos: 0,
        minutos: 0,
        horas: 0,
        dias: 0,
        textoLegible: "Error in calculation",
      };
    }
  }

  /**
   * Gets information about the temporal state of the queried month
   */
  public obtenerEstadoTemporalMes(mes: number): {
    tipo: "FUTURE_MONTH" | "PREVIOUS_MONTH" | "CURRENT_MONTH";
    descripcion: string;
    debeLogout: boolean;
    esConsultaValida: boolean;
  } {
    try {
      const fechaActual = this.obtenerFechaHoraActualDesdeRedux();

      if (!fechaActual) {
        return {
          tipo: "CURRENT_MONTH",
          descripcion: "Could not get date from Redux",
          debeLogout: false,
          esConsultaValida: false,
        };
      }

      const mesActual = fechaActual.getMonth() + 1;

      if (mes > mesActual) {
        return {
          tipo: "FUTURE_MONTH",
          descripcion: `Query of future month (${mes} > ${mesActual}) - Not allowed`,
          debeLogout: true,
          esConsultaValida: false,
        };
      } else if (mes < mesActual) {
        return {
          tipo: "PREVIOUS_MONTH",
          descripcion: `Query of previous month (${mes} < ${mesActual}) - IndexedDB optimization applicable`,
          debeLogout: false,
          esConsultaValida: true,
        };
      } else {
        return {
          tipo: "CURRENT_MONTH",
          descripcion: `Query of current month (${mes}) - Apply schedule logic`,
          debeLogout: false,
          esConsultaValida: true,
        };
      }
    } catch (error) {
      console.error("Error getting temporal state of the month:", error);
      return {
        tipo: "CURRENT_MONTH",
        descripcion: "Error determining temporal state",
        debeLogout: false,
        esConsultaValida: false,
      };
    }
  }

  /**
   * Validates if a date is within the current academic year
   */
  public esFechaDelAñoAcademico(timestamp: number): boolean {
    try {
      const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
      if (!fechaActual) return false;

      const fechaConsultada = new Date(timestamp);
      const añoActual = fechaActual.getFullYear();
      const añoConsultado = fechaConsultada.getFullYear();

      // Academic year generally goes from March of one year to February of the next
      // For simplicity, we validate that it is within the current or previous year
      return añoConsultado === añoActual || añoConsultado === añoActual - 1;
    } catch (error) {
      console.error("Error validating academic year date:", error);
      return false;
    }
  }

  /**
   * Gets timestamp range for a specific month
   */
  public obtenerRangoTimestampsMes(
    mes: number,
    año?: number
  ): {
    inicioMes: number;
    finMes: number;
    diasEnMes: number;
  } | null {
    try {
      const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
      const añoFinal =
        año || fechaActual?.getFullYear() || new Date().getFullYear();

      // First day of the month at 00:00:00
      const inicioMes = new Date(añoFinal, mes - 1, 1, 0, 0, 0, 0).getTime();

      // Last day of the month at 23:59:59
      const ultimoDia = new Date(añoFinal, mes, 0).getDate();
      const finMes = new Date(
        añoFinal,
        mes - 1,
        ultimoDia,
        23,
        59,
        59,
        999
      ).getTime();

      return {
        inicioMes,
        finMes,
        diasEnMes: ultimoDia,
      };
    } catch (error) {
      console.error("Error getting month timestamp range:", error);
      return null;
    }
  }

  /**
   * Create timestamp for a specific day of the current month
   */
  public crearTimestampParaDia(
    dia: number,
    hora: number = 0,
    minutos: number = 0
  ): number | null {
    try {
      const fechaActual = this.obtenerFechaHoraActualDesdeRedux();
      if (!fechaActual) return null;

      const nuevaFecha = new Date(fechaActual);
      nuevaFecha.setDate(dia);
      nuevaFecha.setHours(hora, minutos, 0, 0);

      return nuevaFecha.getTime();
    } catch (error) {
      console.error("Error creating timestamp for specific day:", error);
      return null;
    }
  }
}
