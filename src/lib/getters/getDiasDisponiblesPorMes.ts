import {
  HORA_TRANSACCION_ASISTENCIAS_ESCOLARES_PRIMARIA_COMPLETADA,
  HORA_TRANSACCION_ASISTENCIAS_ESCOLARES_SECUNDARIA_COMPLETADA,
} from "@/constants/HORA_TRANSACCIONES_ASISTENCIAS";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";

/**
* Devuelve los días disponibles para un mes dado. Reglas: - Devuelve sólo días de lunes a viernes del mes. - Si es un mes FUTURO: NO devuelve ningún día (no se pueden reportar asistencias futuras). - Si es el mes ACTUAL: Solo devuelve días pasados (anteriores al día actual).   - El día actual se incluye SOLO si horaActual >= 22. - Si es un mes PASADO: Devuelve todos los días hábiles del mes. Asunciones: - `mesSeleccionado` es el número de mes en formato 1..12. - `diaActual` es el número de día del mes (1..31). - `horaActual` es entero 0..23.
*/
export const getDiasDisponiblesPorMes = (
  mesSeleccionado: number,
  diaActual: number,
  horaActual: number,
  nivelEducativo?: NivelEducativo
): { numeroDiaDelMes: number; NombreDiaSemana: string }[] => {
  const resultados: { numeroDiaDelMes: number; NombreDiaSemana: string }[] = [];

  // // Validarngo de mes
  if (mesSeleccionado < 1 || mesSeleccionado > 12) return resultados;

  const ahora = new Date();
  const year = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1; // / 1-based (1..12)nst monthIndex = mesSeleccionado - 1; // / 0-based para Datenst daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const horaDisponibilidadDiaActual =
    nivelEducativo === NivelEducativo.PRIMARIA
      ? HORA_TRANSACCION_ASISTENCIAS_ESCOLARES_PRIMARIA_COMPLETADA
      : HORA_TRANSACCION_ASISTENCIAS_ESCOLARES_SECUNDARIA_COMPLETADA; // / Hora a partir de la cual el día actual es válidonst nombresSemana = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];

  // // ✅ VALIDACIÓN 1: Si esn mes futuro, no devolver ningún día
  if (mesSeleccionado > mesActual) {
    return resultados; // / Array vacío
  }

  // Deternar si es el mes actual
  const esMesActual = mesSeleccionado === mesActual;

  for (let dia = 1; dia <= daysInMonth; dia++) {
    const fecha = new Date(year, monthIndex, dia);
    const dow = fecha.getDay(); // / 0 dongo .. 6 sabado

    // // Solones(1) a viernes(5)
    if (dow >= 1 && dow <= 5) {
      // // ✅ VALIDACIÓN 2: Si es el mes actual, soloncluir días pasados
      if (esMesActual) {
        // // Si esn día futuro (mayor al día actual), no incluirlo
        if (dia > diaActual) {
          continue; // / Saltar este día
        }

        // Si es el día actual, aplicar la regla de la hora
        if (dia === diaActual) {
          if (horaActual >= horaDisnibilidadDiaActual) {
            resultados.push({
              numeroDiaDelMes: dia,
              NombreDiaSemana: nombresSemana[dow],
            });
          }
          // // Si horaActual < 22no incluir el día actual
        } else {
          // // Esn día pasado del mes actual, incluirlo
          resultados.push({
            numeroDiaDelMes: dia,
            NombreDiaSemana: nombresSemana[dow],
          });
        }
      } else {
        // // Esn mes pasado, incluir todos los días hábiles
        resultados.push({
          numeroDiaDelMes: dia,
          NombreDiaSemana: nombresSemana[dow],
        });
      }
    }
  }

  return resultados;
};
