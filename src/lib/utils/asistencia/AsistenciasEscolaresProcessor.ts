import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";
import { HandlerResponsableAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerResponsableAsistenciaResponse";
import {
  AsistenciaEscolarProcesada,
  DiaCalendario,
  EstadisticasMes,
  HorarioEscolar,
  TOLERANCIA_SEGUNDOS_PRIMARIA,
  TOLERANCIA_SEGUNDOS_SECUNDARIA,
} from "../../../app/(interfaz)/(responsable)/mis-estudiantes-relacionados/[Id_Estudiante]/asistencias-mensuales/types";
import {
  CONTROL_ASISTENCIA_DE_SALIDA_PRIMARIA,
  CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA,
} from "@/constants/ASISTENCIA_ENTRADA_SALIDA_ESCOLAR";
import { HorarioTomaAsistencia } from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";
import { alterarUTCaZonaPeruana } from "@/lib/helpers/alteradores/alterarUTCaZonaPeruana";
import { IEventoLocal } from "../local/db/models/EventosLocal/EventosIDB";

// 🆕 Interface to map days with their events
interface DiaConEvento {
  dia: number;
  evento: IEventoLocal;
}

export class AsistenciaProcessor {
  /**
   * Processes server attendances to display on the calendar
   * ⚠️ IMPORTANT: Events have ABSOLUTE PRIORITY over any attendance data
   */
  static procesarAsistenciasDelServidor(
    asistencias: Record<number, AsistenciaEscolarDeUnDia | null>,
    nivel: NivelEducativo,
    handlerAsistencia?: HandlerResponsableAsistenciaResponse,
    eventosDelMes?: IEventoLocal[],
    mes?: number,
    año?: number
  ): { [dia: number]: AsistenciaEscolarProcesada } {
    try {
      const asistenciasProcesadas: { [dia: number]: AsistenciaEscolarProcesada } = {};
      const toleranciaSegundos =
        nivel === NivelEducativo.PRIMARIA
          ? TOLERANCIA_SEGUNDOS_PRIMARIA
          : TOLERANCIA_SEGUNDOS_SECUNDARIA;
      const controlaEntrada = true; // Always active
      const controlaSalida =
        nivel === NivelEducativo.PRIMARIA
          ? CONTROL_ASISTENCIA_DE_SALIDA_PRIMARIA
          : CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA;

      // Get real schedule if available
      const horarioEscolar = handlerAsistencia?.getHorarioEscolar(nivel)!;

      // 1️⃣ PROCESS ATTENDANCES NORMALLY
      Object.entries(asistencias).forEach(([diaStr, datosAsistencia]) => {
        const dia = parseInt(diaStr);

        // Case: inactive day (null value)
        if (datosAsistencia === null) {
          asistenciasProcesadas[dia] = {
            estado: EstadosAsistenciaEscolar.Inactivo,
          };
          return;
        }

        const datosObjeto = datosAsistencia as any;
        const asistenciaProcesada: AsistenciaEscolarProcesada = {
          estado: EstadosAsistenciaEscolar.Inactivo, // Default
        };

        // Process entry
        if (controlaEntrada && datosObjeto[ModoRegistro.Entrada]) {
          const desfaseSegundos =
            datosObjeto[ModoRegistro.Entrada].DesfaseSegundos;

          asistenciaProcesada.entrada = {
            desfaseSegundos,
            esValido: true,
            hora: this.calcularHoraConDesfase(
              desfaseSegundos,
              horarioEscolar,
              ModoRegistro.Entrada
            ),
          };

          // Determine status based on entry
          if (desfaseSegundos === null) {
            asistenciaProcesada.estado = EstadosAsistenciaEscolar.Falta;
          } else if (desfaseSegundos <= toleranciaSegundos) {
            asistenciaProcesada.estado = EstadosAsistenciaEscolar.Temprano;
          } else {
            asistenciaProcesada.estado = EstadosAsistenciaEscolar.Tarde;
          }
        }

        // Process exit (if enabled)
        if (controlaSalida && datosObjeto[ModoRegistro.Salida]) {
          const desfaseSegundos =
            datosObjeto[ModoRegistro.Salida].DesfaseSegundos;

          asistenciaProcesada.salida = {
            desfaseSegundos,
            esValido: true,
            hora: this.calcularHoraConDesfase(
              desfaseSegundos,
              horarioEscolar,
              ModoRegistro.Salida
            ),
          };
        }

        asistenciasProcesadas[dia] = asistenciaProcesada;
      });

      // 2️⃣ APPLY EVENTS (ABSOLUTE PRIORITY)
      // If there are events and we have month/year, replace the days with events
      if (eventosDelMes && eventosDelMes.length > 0 && mes && año) {
        console.log(
          `[EVENTOS] 🎯 Applying ${eventosDelMes.length} events to month ${mes}/${año}`
        );

        // 🆕 Get map of days with their events (including full information)
        const diasConEventos = this.obtenerDiasConEventosDetallado(
          eventosDelMes,
          mes,
          año
        );

        console.log(
          `[EVENTOS] 📅 Days with events:`,
          Array.from(diasConEventos.keys()).sort((a, b) => a - b)
        );

        // Replace ALL days with events, including event information
        diasConEventos.forEach((evento, dia) => {
          asistenciasProcesadas[dia] = {
            estado: EstadosAsistenciaEscolar.Evento,
            // 🆕 Add event information
            eventoInfo: {
              nombre: evento.Nombre,
              fechaInicio: evento.Fecha_Inicio,
              fechaConclusion: evento.Fecha_Conclusion,
            },
          };
        });

        console.log(
          `[EVENTOS] ✅ ${diasConEventos.size} days marked as events`
        );
      }

      return asistenciasProcesadas;
    } catch (error) {
      console.error("Error processing attendances:", error);
      return {};
    }
  }

  /**
   * 🆕 Gets all days that are within events WITH FULL INFORMATION
   * Returns a Map where the key is the day and the value is the full event
   */
  private static obtenerDiasConEventosDetallado(
    eventos: IEventoLocal[],
    mes: number,
    año: number
  ): Map<number, IEventoLocal> {
    const diasConEventos = new Map<number, IEventoLocal>();

    eventos.forEach((evento) => {
      try {
        // Create dates with Peruvian time zone (without time to avoid timezone issues)
        const fechaInicio = new Date(evento.Fecha_Inicio + "T00:00:00");
        const fechaFin = new Date(evento.Fecha_Conclusion + "T00:00:00");

        console.log(
          `[EVENTO] 📌 "${evento.Nombre}": ${evento.Fecha_Inicio} → ${evento.Fecha_Conclusion}`
        );

        // Iterate day by day from start to end
        let fechaActual = new Date(fechaInicio);

        while (fechaActual <= fechaFin) {
          // Only add days that belong to the queried month
          const mesActual = fechaActual.getMonth() + 1;
          const añoActual = fechaActual.getFullYear();

          if (mesActual === mes && añoActual === año) {
            const dia = fechaActual.getDate();

            // Only school days (Monday to Friday)
            const diaSemana = fechaActual.getDay();
            if (diaSemana >= 1 && diaSemana <= 5) {
              // Save the full event associated with this day
              diasConEventos.set(dia, evento);
              console.log(`[EVENTO] ✓ Day ${dia} marked: "${evento.Nombre}"`);
            } else {
              console.log(`[EVENTO] ⊗ Day ${dia} is a weekend, skipped`);
            }
          }

          // Move to the next day
          fechaActual.setDate(fechaActual.getDate() + 1);
        }
      } catch (error) {
        console.error(`[EVENTO] ❌ Error processing event:`, evento, error);
      }
    });

    return diasConEventos;
  }

  /**
   * 🆕 Alternative method if you only need the Set of numbers (without event info)
   * Keep for compatibility but use obtenerDiasConEventosDetallado
   */
  private static obtenerDiasConEventos(
    eventos: IEventoLocal[],
    mes: number,
    año: number
  ): Set<number> {
    const diasMap = this.obtenerDiasConEventosDetallado(eventos, mes, año);
    return new Set(diasMap.keys());
  }

  /**
   * Calculates the real time based on the schedule and offset
   */
  private static calcularHoraConDesfase(
    desfaseSegundos: number | null,
    horarioEscolar: HorarioTomaAsistencia,
    modoRegistro: ModoRegistro
  ): string | undefined {
    if (desfaseSegundos === null || !horarioEscolar) {
      return undefined;
    }

    try {
      // Use real schedule from the handler
      const horarioBase =
        modoRegistro === ModoRegistro.Entrada
          ? horarioEscolar.Inicio
          : horarioEscolar.Fin;

      const fecha = new Date(alterarUTCaZonaPeruana(horarioBase));
      console.log("%c" + fecha, "color: green; font-size:1rem;");

      // Apply offset
      fecha.setSeconds(fecha.getSeconds() + desfaseSegundos);

      return fecha.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Error calculating time with offset:", error);
      return undefined;
    }
  }

  /**
   * Converts handler schedule to simple format
   */
  static convertirHorarioHandler(
    horarioHandler: any
  ): HorarioEscolar | undefined {
    if (!horarioHandler) return undefined;

    try {
      const inicio = new Date(alterarUTCaZonaPeruana(horarioHandler.Inicio));
      const fin = new Date(alterarUTCaZonaPeruana(horarioHandler.Fin));

      return {
        inicio: inicio.toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
        }),
        fin: fin.toLocaleTimeString("es-PE", {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };
    } catch (error) {
      console.error("Error converting schedule:", error);
      return undefined;
    }
  }

  /**
   * Gets the days of the month organized for the calendar
   */
  static obtenerDiasDelMes(
    mes: number,
    asistenciasDelMes: { [dia: number]: AsistenciaEscolarProcesada }
  ): DiaCalendario[] {
    const fechaActual = new Date();
    const año = fechaActual.getFullYear();
    const diasEnMes = new Date(año, mes, 0).getDate();

    const dias: DiaCalendario[] = [];

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fecha = new Date(año, mes - 1, dia);
      const diaSemana = fecha.getDay(); // 0=sunday, 1=monday, ..., 6=saturday

      const esDiaEscolar = diaSemana >= 1 && diaSemana <= 5; // Only Monday to Friday

      if (esDiaEscolar) {
        dias.push({
          dia,
          asistencia: asistenciasDelMes[dia],
          esDiaEscolar,
        });
      }
    }

    return dias;
  }

  /**
   * Calculates the statistics for the month
   */
  static calcularEstadisticasMes(asistenciasDelMes: {
    [dia: number]: AsistenciaEscolarProcesada;
  }): EstadisticasMes {
    const valores = Object.values(asistenciasDelMes);

    return {
      totalDias: valores.length,
      asistencias: valores.filter(
        (a) => a.estado === EstadosAsistenciaEscolar.Temprano
      ).length,
      tardanzas: valores.filter(
        (a) => a.estado === EstadosAsistenciaEscolar.Tarde
      ).length,
      faltas: valores.filter((a) => a.estado === EstadosAsistenciaEscolar.Falta)
        .length,
      inactivos: valores.filter(
        (a) => a.estado === EstadosAsistenciaEscolar.Inactivo
      ).length,
      eventos: valores.filter(
        (a) => a.estado === EstadosAsistenciaEscolar.Evento
      ).length,
      vacaciones: valores.filter(
        (a) => a.estado === EstadosAsistenciaEscolar.Vacaciones
      ).length,
    };
  }

  /**
   * Gets the status text to display on the calendar
   */
  static obtenerTextoEstado(estado: EstadosAsistenciaEscolar): string {
    switch (estado) {
      case EstadosAsistenciaEscolar.Temprano:
        return "A";
      case EstadosAsistenciaEscolar.Tarde:
        return "T";
      case EstadosAsistenciaEscolar.Falta:
        return "F";
      case EstadosAsistenciaEscolar.Inactivo:
        return "-";
      case EstadosAsistenciaEscolar.Evento:
        return "E";
      case EstadosAsistenciaEscolar.Vacaciones:
        return "V";
      default:
        return "";
    }
  }

  /**
   * Checks if the exit should be shown for a specific level
   */
  static debeMostrarSalida(nivel: NivelEducativo): boolean {
    return nivel === NivelEducativo.PRIMARIA
      ? CONTROL_ASISTENCIA_DE_SALIDA_PRIMARIA
      : CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA;
  }

  /**
   * Gets real school schedule using the handler
   */
  static obtenerHorarioEscolar(
    nivel: NivelEducativo,
    handlerAsistencia?: HandlerResponsableAsistenciaResponse
  ): HorarioEscolar | undefined {
    if (!handlerAsistencia) return undefined;

    const horarioHandler = handlerAsistencia.getHorarioEscolar(nivel);
    return this.convertirHorarioHandler(horarioHandler);
  }
}