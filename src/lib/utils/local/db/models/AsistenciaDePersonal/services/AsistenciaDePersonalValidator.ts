import { AsistenciaMensualPersonalLocal } from "../AsistenciaDePersonalTypes";
import { AsistenciaDateHelper } from "../../utils/AsistenciaDateHelper";

/**
 * 🎯 RESPONSIBILITY: Data validations and verifications
 * - Verify record synchronization
 * - Validate data integrity
 * - Verify record existence
 * - Check for necessary updates
 */
export class AsistenciaDePersonalValidator {
  private dateHelper: AsistenciaDateHelper;

  constructor(dateHelper: AsistenciaDateHelper) {
    this.dateHelper = dateHelper;
  }

  /**
   * Checks if entry and exit records are synchronized
   * CRITERION: They must have the same number of SCHOOL days recorded (EXCLUDING THE CURRENT DAY)
   * SCHOOL DAYS: Monday to Friday only (weekends are ignored)
   * REASON: During the current day there may be entries but no exits yet
   */
  public verificarSincronizacionEntradaSalida(
    registroEntrada: AsistenciaMensualPersonalLocal | null,
    registroSalida: AsistenciaMensualPersonalLocal | null
  ): {
    estanSincronizados: boolean;
    razon: string;
    diasEntrada: number;
    diasSalida: number;
    diasEscolaresEntrada: number;
    diasEscolaresSalida: number;
  } {
    // Get current day from Redux
    const fechaActualRedux = this.dateHelper.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActualRedux) {
      console.error(
        "❌ Could not get date from Redux to verify synchronization"
      );
      // Fallback: use all days if we cannot get the current date
      const diasEntrada = registroEntrada
        ? Object.keys(registroEntrada.registros || {}).length
        : 0;
      const diasSalida = registroSalida
        ? Object.keys(registroSalida.registros || {}).length
        : 0;

      return {
        estanSincronizados: diasEntrada === diasSalida,
        razon:
          diasEntrada === diasSalida
            ? `Both have ${diasEntrada} days (without checking current day or school days)`
            : `Different quantity: entry=${diasEntrada}, exit=${diasSalida} (without checking current day or school days)`,
        diasEntrada,
        diasSalida,
        diasEscolaresEntrada: diasEntrada,
        diasEscolaresSalida: diasSalida,
      };
    }

    const diaActual = fechaActualRedux.getDate().toString();

    // Function to count school days excluding the current day
    const contarDiasEscolaresSinActual = (
      registro: AsistenciaMensualPersonalLocal | null
    ): number => {
      if (!registro || !registro.registros) return 0;

      const diasEscolaresSinActual = Object.keys(registro.registros).filter(
        (dia) => {
          return (
            dia !== diaActual &&
            this.dateHelper.esDiaEscolar(dia, fechaActualRedux)
          );
        }
      );

      return diasEscolaresSinActual.length;
    };

    // Count days in each record (including current day and weekends for info)
    const diasEntrada = registroEntrada
      ? Object.keys(registroEntrada.registros || {}).length
      : 0;
    const diasSalida = registroSalida
      ? Object.keys(registroSalida.registros || {}).length
      : 0;

    // Count only school days excluding the current day (this is important for synchronization)
    const diasEscolaresEntrada = contarDiasEscolaresSinActual(registroEntrada);
    const diasEscolaresSalida = contarDiasEscolaresSinActual(registroSalida);

    console.log(
      `🔍 Verifying synchronization of school days (current day: ${diaActual}):`
    );
    console.log(
      `   📊 Entry: ${diasEntrada} total days → ${diasEscolaresEntrada} historical school days`
    );
    console.log(
      `   📊 Exit: ${diasSalida} total days → ${diasEscolaresSalida} historical school days`
    );

    // Verification: Only compare school days before the current one
    if (diasEscolaresEntrada === diasEscolaresSalida) {
      console.log(
        `✅ SYNCHRONIZED: Both have ${diasEscolaresEntrada} historical school days`
      );
      return {
        estanSincronizados: true,
        razon: `Both records have ${diasEscolaresEntrada} historical school days (excluding weekends and current day)`,
        diasEntrada,
        diasSalida,
        diasEscolaresEntrada,
        diasEscolaresSalida,
      };
    }

    // Desynchronized: Different number of school days
    console.log(
      `❌ DESYNCHRONIZED: Entry=${diasEscolaresEntrada} school days, Exit=${diasEscolaresSalida} school days`
    );
    return {
      estanSincronizados: false,
      razon: `Different number of historical school days: entry=${diasEscolaresEntrada}, exit=${diasEscolaresSalida} (only Monday-Friday, excluding current day)`,
      diasEntrada,
      diasSalida,
      diasEscolaresEntrada,
      diasEscolaresSalida,
    };
  }

  /**
   * ✅ NEW: Validates consistency between number of entries and exits
   * There can only be a maximum of 1 difference (entry without exit for the current day)
   */
  public async validarConsistenciaEntradaSalida(
    registroEntrada: AsistenciaMensualPersonalLocal | null,
    registroSalida: AsistenciaMensualPersonalLocal | null,
    mes: number,
    idUsuario: string | number
  ): Promise<{
    esConsistente: boolean;
    diferencia: number;
    cantidadEntradas: number;
    cantidadSalidas: number;
    razon: string;
    requiereCorreccion: boolean;
  }> {
    try {
      // Count entries
      const cantidadEntradas = registroEntrada
        ? Object.keys(registroEntrada.registros).length
        : 0;

      // Count exits
      const cantidadSalidas = registroSalida
        ? Object.keys(registroSalida.registros).length
        : 0;

      const diferencia = Math.abs(cantidadEntradas - cantidadSalidas);
      const esConsistente = diferencia <= 1;

      let razon = "";
      let requiereCorreccion = false;

      if (diferencia === 0) {
        razon = `Perfect: ${cantidadEntradas} entries = ${cantidadSalidas} exits`;
      } else if (diferencia === 1) {
        const mayor =
          cantidadEntradas > cantidadSalidas ? "entries" : "exits";
        razon = `Acceptable: 1 more ${mayor} (possibly current day not completed)`;
      } else {
        razon = `INCONSISTENT: ${diferencia} difference (${cantidadEntradas} entries vs ${cantidadSalidas} exits)`;
        requiereCorreccion = true;
      }

      // Detailed log for debugging
      if (!esConsistente) {
        console.warn(
          `⚠️ Inconsistency detected for ${idUsuario} - month ${mes}: ${razon}`
        );

        // Show details of recorded days
        if (registroEntrada && cantidadEntradas > 0) {
          const diasEntrada = Object.keys(registroEntrada.registros).sort(
            (a, b) => parseInt(a) - parseInt(b)
          );
          console.warn(`📅 Days with entry: ${diasEntrada.join(", ")}`);
        }

        if (registroSalida && cantidadSalidas > 0) {
          const diasSalida = Object.keys(registroSalida.registros).sort(
            (a, b) => parseInt(a) - parseInt(b)
          );
          console.warn(`📅 Days with exit: ${diasSalida.join(", ")}`);
        }
      }

      return {
        esConsistente,
        diferencia,
        cantidadEntradas,
        cantidadSalidas,
        razon,
        requiereCorreccion,
      };
    } catch (error) {
      console.error("Error validating entry/exit consistency:", error);
      return {
        esConsistente: false,
        diferencia: -1,
        cantidadEntradas: 0,
        cantidadSalidas: 0,
        razon: `Validation error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
        requiereCorreccion: true,
      };
    }
  }

  /**
   * Checks if local records need updating
   */
  public verificarSiNecesitaActualizacion(
    registroEntrada: AsistenciaMensualPersonalLocal | null,
    registroSalida: AsistenciaMensualPersonalLocal | null,
    diaActual: number
  ): boolean {
    // Calculate the last recorded day in both records
    let ultimoDiaEntrada = 0;
    let ultimoDiaSalida = 0;

    if (registroEntrada && registroEntrada.registros) {
      const diasEntrada = Object.keys(registroEntrada.registros)
        .map((d) => parseInt(d))
        .filter((d) => !isNaN(d));
      ultimoDiaEntrada = diasEntrada.length > 0 ? Math.max(...diasEntrada) : 0;
    }

    if (registroSalida && registroSalida.registros) {
      const diasSalida = Object.keys(registroSalida.registros)
        .map((d) => parseInt(d))
        .filter((d) => !isNaN(d));
      ultimoDiaSalida = diasSalida.length > 0 ? Math.max(...diasSalida) : 0;
    }

    const ultimoDiaLocal = Math.max(ultimoDiaEntrada, ultimoDiaSalida);

    // If the last local day is less than the current day - 1, it needs an update
    // (we leave a margin of 1 day to avoid constant queries)
    const necesitaActualizacion = ultimoDiaLocal < diaActual - 1;

    console.log(`🔍 Update verification:`, {
      ultimoDiaEntrada,
      ultimoDiaSalida,
      ultimoDiaLocal,
      diaActual,
      necesitaActualizacion,
    });

    return necesitaActualizacion;
  }

  /**
   * Checks if the monthly record has ALL previous working days
   */
  public verificarRegistroMensualCompleto(
    registroMensual: AsistenciaMensualPersonalLocal | null,
    diasLaboralesAnteriores: number[]
  ): boolean {
    if (!registroMensual || !registroMensual.registros) {
      return false;
    }

    // If there are no previous working days (first working day of the month), consider complete
    if (diasLaboralesAnteriores.length === 0) {
      return true;
    }

    // Verify that ALL previous working days are recorded
    for (const diaLaboral of diasLaboralesAnteriores) {
      const diaRegistrado = registroMensual.registros[diaLaboral.toString()];
      if (!diaRegistrado) {
        console.log(
          `❌ Missing working day ${diaLaboral} in monthly record`
        );
        return false;
      }
    }

    console.log(
      `✅ All previous working days are recorded: [${diasLaboralesAnteriores.join(
        ", "
      )}]`
    );
    return true;
  }

  /**
   * Checks if a record has historical data
   */
  public tieneRegistrosHistoricos(
    registroEntrada: AsistenciaMensualPersonalLocal | null,
    registroSalida: AsistenciaMensualPersonalLocal | null
  ): boolean {
    const sincronizacion = this.verificarSincronizacionEntradaSalida(
      registroEntrada,
      registroSalida
    );

    return (
      sincronizacion.diasEscolaresEntrada > 0 ||
      sincronizacion.diasEscolaresSalida > 0
    );
  }

  /**
   * Validates that a monthly record has the correct structure
   */
  public validarEstructuraRegistroMensual(
    registro: AsistenciaMensualPersonalLocal | null
  ): { valido: boolean; errores: string[] } {
    const errores: string[] = [];

    if (!registro) {
      errores.push("The record is null");
      return { valido: false, errores };
    }

    if (typeof registro.Id_Registro_Mensual !== "number") {
      errores.push("Id_Registro_Mensual must be a number");
    }

    if (
      typeof registro.mes !== "number" ||
      registro.mes < 1 ||
      registro.mes > 12
    ) {
      errores.push("The month must be a number between 1 and 12");
    }

    if (
      typeof registro.idUsuario_Personal !== "string" ||
      registro.idUsuario_Personal.length !== 8
    ) {
      errores.push("Dni_Personal must be an 8-character string");
    }

    if (!registro.registros || typeof registro.registros !== "object") {
      errores.push("records must be an object");
    }

    return {
      valido: errores.length === 0,
      errores,
    };
  }

  /**
   * Checks if a specific day is recorded
   */
  public existeDiaEnRegistro(
    registro: AsistenciaMensualPersonalLocal | null,
    dia: number
  ): boolean {
    if (!registro || !registro.registros) {
      return false;
    }

    return registro.registros.hasOwnProperty(dia.toString());
  }

  /**
   * Counts the total number of recorded days (including weekends)
   */
  public contarTotalDiasRegistrados(
    registro: AsistenciaMensualPersonalLocal | null
  ): number {
    if (!registro || !registro.registros) {
      return 0;
    }

    return Object.keys(registro.registros).length;
  }

  /**
   * Counts only the recorded school days (Monday to Friday)
   */
  public contarDiasEscolaresRegistrados(
    registro: AsistenciaMensualPersonalLocal | null
  ): number {
    if (!registro || !registro.registros) {
      return 0;
    }

    const diasEscolares = Object.keys(registro.registros).filter((dia) =>
      this.dateHelper.esDiaEscolar(dia)
    );

    return diasEscolares.length;
  }
}