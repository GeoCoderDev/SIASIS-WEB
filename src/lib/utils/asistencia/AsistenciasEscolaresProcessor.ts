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

// 🆕 Interfaz para mapear días con sus eventos
interface DiaConEvento {
  dia: number;
  evento: IEventoLocal;
}

export class AsistenciaProcessor {
  /**
   * Procesa las asistencias del servidor para mostrar en el calendario
   * ⚠️ IMPORTANTE: Los eventos tienen PRIORIDAD ABSOLUTA sobre cualquier dato de asistencia
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
      const controlaEntrada = true; // Siempre activo
      const controlaSalida =
        nivel === NivelEducativo.PRIMARIA
          ? CONTROL_ASISTENCIA_DE_SALIDA_PRIMARIA
          : CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA;

      // Obtener horario real si está disponible
      const horarioEscolar = handlerAsistencia?.getHorarioEscolar(nivel)!;

      // 1️⃣ PROCESAR ASISTENCIAS NORMALMENTE
      Object.entries(asistencias).forEach(([diaStr, datosAsistencia]) => {
        const dia = parseInt(diaStr);

        // Caso: día inactivo (valor null)
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

        // Procesar entrada
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

          // Determinar estado basado en entrada
          if (desfaseSegundos === null) {
            asistenciaProcesada.estado = EstadosAsistenciaEscolar.Falta;
          } else if (desfaseSegundos <= toleranciaSegundos) {
            asistenciaProcesada.estado = EstadosAsistenciaEscolar.Temprano;
          } else {
            asistenciaProcesada.estado = EstadosAsistenciaEscolar.Tarde;
          }
        }

        // Procesar salida (si está habilitado)
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

      // 2️⃣ APLICAR EVENTOS (PRIORIDAD ABSOLUTA)
      // Si hay eventos y tenemos mes/año, reemplazar los días con eventos
      if (eventosDelMes && eventosDelMes.length > 0 && mes && año) {
        console.log(
          `[EVENTOS] 🎯 Aplicando ${eventosDelMes.length} eventos al mes ${mes}/${año}`
        );

        // 🆕 Obtener mapa de días con sus eventos (incluyendo información completa)
        const diasConEventos = this.obtenerDiasConEventosDetallado(
          eventosDelMes,
          mes,
          año
        );

        console.log(
          `[EVENTOS] 📅 Días con eventos:`,
          Array.from(diasConEventos.keys()).sort((a, b) => a - b)
        );

        // Reemplazar TODOS los días con eventos, incluyendo información del evento
        diasConEventos.forEach((evento, dia) => {
          asistenciasProcesadas[dia] = {
            estado: EstadosAsistenciaEscolar.Evento,
            // 🆕 Agregar información del evento
            eventoInfo: {
              nombre: evento.Nombre,
              fechaInicio: evento.Fecha_Inicio,
              fechaConclusion: evento.Fecha_Conclusion,
            },
          };
        });

        console.log(
          `[EVENTOS] ✅ ${diasConEventos.size} días marcados como eventos`
        );
      }

      return asistenciasProcesadas;
    } catch (error) {
      console.error("Error al procesar asistencias:", error);
      return {};
    }
  }

  /**
   * 🆕 Obtiene todos los días que están dentro de eventos CON INFORMACIÓN COMPLETA
   * Retorna un Map donde la clave es el día y el valor es el evento completo
   */
  private static obtenerDiasConEventosDetallado(
    eventos: IEventoLocal[],
    mes: number,
    año: number
  ): Map<number, IEventoLocal> {
    const diasConEventos = new Map<number, IEventoLocal>();

    eventos.forEach((evento) => {
      try {
        // Crear fechas con zona horaria peruana (sin hora para evitar problemas de timezone)
        const fechaInicio = new Date(evento.Fecha_Inicio + "T00:00:00");
        const fechaFin = new Date(evento.Fecha_Conclusion + "T00:00:00");

        console.log(
          `[EVENTO] 📌 "${evento.Nombre}": ${evento.Fecha_Inicio} → ${evento.Fecha_Conclusion}`
        );

        // Iterar día por día desde inicio hasta fin
        let fechaActual = new Date(fechaInicio);

        while (fechaActual <= fechaFin) {
          // Solo agregar días que pertenecen al mes consultado
          const mesActual = fechaActual.getMonth() + 1;
          const añoActual = fechaActual.getFullYear();

          if (mesActual === mes && añoActual === año) {
            const dia = fechaActual.getDate();

            // Solo días escolares (lunes a viernes)
            const diaSemana = fechaActual.getDay();
            if (diaSemana >= 1 && diaSemana <= 5) {
              // Guardar el evento completo asociado a este día
              diasConEventos.set(dia, evento);
              console.log(`[EVENTO] ✓ Día ${dia} marcado: "${evento.Nombre}"`);
            } else {
              console.log(`[EVENTO] ⊗ Día ${dia} es fin de semana, omitido`);
            }
          }

          // Avanzar al siguiente día
          fechaActual.setDate(fechaActual.getDate() + 1);
        }
      } catch (error) {
        console.error(`[EVENTO] ❌ Error procesando evento:`, evento, error);
      }
    });

    return diasConEventos;
  }

  /**
   * 🆕 Método alternativo si necesitas solo el Set de números (sin info del evento)
   * Mantener por compatibilidad pero usa obtenerDiasConEventosDetallado
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
   * Calcula la hora real basada en el horario y desfase
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
      // Usar horario real del handler
      const horarioBase =
        modoRegistro === ModoRegistro.Entrada
          ? horarioEscolar.Inicio
          : horarioEscolar.Fin;

      const fecha = new Date(alterarUTCaZonaPeruana(horarioBase));
      console.log("%c" + fecha, "color: green; font-size:1rem;");

      // Aplicar desfase
      fecha.setSeconds(fecha.getSeconds() + desfaseSegundos);

      return fecha.toLocaleTimeString("es-PE", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (error) {
      console.error("Error al calcular hora con desfase:", error);
      return undefined;
    }
  }

  /**
   * Convierte horario del handler a formato simple
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
      console.error("Error al convertir horario:", error);
      return undefined;
    }
  }

  /**
   * Obtiene los días del mes organizados para el calendario
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
      const diaSemana = fecha.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado

      const esDiaEscolar = diaSemana >= 1 && diaSemana <= 5; // Solo lunes a viernes

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
   * Calcula las estadísticas del mes
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
   * Obtiene el texto del estado para mostrar en el calendario
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
   * Verifica si se debe mostrar la salida para un nivel específico
   */
  static debeMostrarSalida(nivel: NivelEducativo): boolean {
    return nivel === NivelEducativo.PRIMARIA
      ? CONTROL_ASISTENCIA_DE_SALIDA_PRIMARIA
      : CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA;
  }

  /**
   * Obtiene horario escolar real usando el handler
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
