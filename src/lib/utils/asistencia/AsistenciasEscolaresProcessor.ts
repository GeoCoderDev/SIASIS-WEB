import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";
import { HandlerResponsableAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerResponsableAsistenciaResponse";
import {
  AsistenciaProcesada,
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

export class AsistenciaProcessor {
  /**
   * Procesa las asistencias del servidor para mostrar en el calendario
   */
  static procesarAsistenciasDelServidor(
    asistencias: Record<number, AsistenciaEscolarDeUnDia | null>,
    nivel: NivelEducativo,
    handlerAsistencia?: HandlerResponsableAsistenciaResponse
  ): { [dia: number]: AsistenciaProcesada } {
    try {
      const asistenciasProcesadas: { [dia: number]: AsistenciaProcesada } = {};
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
        const asistenciaProcesada: AsistenciaProcesada = {
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

      return asistenciasProcesadas;
    } catch (error) {
      console.error("Error al procesar asistencias:", error);
      return {};
    }
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
    asistenciasDelMes: { [dia: number]: AsistenciaProcesada }
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
    [dia: number]: AsistenciaProcesada;
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
