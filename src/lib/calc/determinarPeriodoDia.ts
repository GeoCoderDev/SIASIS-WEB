// Define the enum for day periods

import { PeriodoDia } from "@/Assets/voice/others/SaludosDelDia";


/**
 * Determines if a timestamp corresponds to morning, afternoon or night according to the following ranges:
 * - Morning: 00:00 to 11:59 hours
 * - Afternoon: 12:00 to 17:59 hours
 * - Night: 18:00 to 23:59 hours
 *
 * @param fechaHora - Timestamp in ISO format or Date instance
 * @returns The day period (Morning, Afternoon or Night)
 */

export const determinarPeriodoDia = (
  fechaHora: string | Date | number
): PeriodoDia => {
  // Convert the parameter to Date object

  const fecha = new Date(fechaHora);

  // Get the hour (0-23)

  const hora = fecha.getHours();

  // Classify according to time range

  if (hora >= 0 && hora < 12) {
    return PeriodoDia.MAÑANA;
  } else if (hora >= 12 && hora < 18) {
    return PeriodoDia.TARDE;
  } else {
    return PeriodoDia.NOCHE;
  }
};
