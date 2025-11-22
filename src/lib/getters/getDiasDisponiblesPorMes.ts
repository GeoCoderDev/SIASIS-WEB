import {
  HORA_TRANSACCION_ASISTENCIAS_ESCOLARES_PRIMARIA_COMPLETADA,
  HORA_TRANSACCION_ASISTENCIAS_ESCOLARES_SECUNDARIA_COMPLETADA,
} from "@/constants/HORA_TRANSACCIONES_ASISTENCIAS";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";

/**
 * Returns available days for a given month.
 * Rules:
 * - Returns only Monday to Friday days of the month.
 * - If it's a FUTURE month: Does NOT return any day (future attendance cannot be reported).
 * - If it's the CURRENT month: Only returns past days (before the current day).
 *   - The current day is included ONLY if horaActual >= 22.
 * - If it's a PAST month: Returns all business days of the month.
 *
 * Assumptions:
 * - `mesSeleccionado` is the month number in format 1..12.
 * - `diaActual` is the day number of the month (1..31).
 * - `horaActual` is an integer 0..23.
 */
export const getDiasDisponiblesPorMes = (
  mesSeleccionado: number,
  diaActual: number,
  horaActual: number,
  nivelEducativo?: NivelEducativo
): { numeroDiaDelMes: number; NombreDiaSemana: string }[] => {
  const resultados: { numeroDiaDelMes: number; NombreDiaSemana: string }[] = [];

  // Validate month range
  if (mesSeleccionado < 1 || mesSeleccionado > 12) return resultados;

  const ahora = new Date();
  const year = ahora.getFullYear();
  const mesActual = ahora.getMonth() + 1; // 1-based (1..12)
  const monthIndex = mesSeleccionado - 1; // 0-based para Date
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const horaDisponibilidadDiaActual =
    nivelEducativo === NivelEducativo.PRIMARIA
      ? HORA_TRANSACCION_ASISTENCIAS_ESCOLARES_PRIMARIA_COMPLETADA
      : HORA_TRANSACCION_ASISTENCIAS_ESCOLARES_SECUNDARIA_COMPLETADA; // Hour from which the current day is valid

  const nombresSemana = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];

  // ✅ VALIDATION 1: If it's a future month, don't return any day
  if (mesSeleccionado > mesActual) {
    return resultados; // Empty array
  }

  // Determine if it's the current month
  const esMesActual = mesSeleccionado === mesActual;

  for (let dia = 1; dia <= daysInMonth; dia++) {
    const fecha = new Date(year, monthIndex, dia);
    const dow = fecha.getDay(); // 0 Sunday .. 6 Saturday

    // Only Monday(1) to Friday(5)
    if (dow >= 1 && dow <= 5) {
      // ✅ VALIDATION 2: If it's the current month, only include past days
      if (esMesActual) {
        // If it's a future day (greater than current day), don't include it
        if (dia > diaActual) {
          continue; // Skip this day
        }

        // If it's the current day, apply the hour rule
        if (dia === diaActual) {
          if (horaActual >= horaDisponibilidadDiaActual) {
            resultados.push({
              numeroDiaDelMes: dia,
              NombreDiaSemana: nombresSemana[dow],
            });
          }
          // If horaActual < 22, don't include the current day
        } else {
          // It's a past day of the current month, include it
          resultados.push({
            numeroDiaDelMes: dia,
            NombreDiaSemana: nombresSemana[dow],
          });
        }
      } else {
        // It's a past month, include all business days
        resultados.push({
          numeroDiaDelMes: dia,
          NombreDiaSemana: nombresSemana[dow],
        });
      }
    }
  }

  return resultados;
};
