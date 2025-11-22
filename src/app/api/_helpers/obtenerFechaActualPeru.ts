import { ENTORNO } from "@/constants/ENTORNO";
import {
  OFFSET_DIAS_ADICIONALES_SIU01,
  OFFSET_HORAS_ADICIONALES_SIU01,
  OFFSET_MINUTOS_ADICIONALES_SIU01,
  OFFSET_SEGUNDOS_ADICIONALES_SIU01,
} from "@/constants/mocks/OFFSET_FECHAS_HORAS_SIU01";
import { ZONA_HORARIA_LOCAL } from "@/constants/ZONA_HORARIA_LOCAL";
import { Entorno } from "@/interfaces/shared/Entornos";
import getRandomAPI03IntanceURL from "@/lib/helpers/functions/getRandomAPI03InstanceURL";

const API03_ACTIVADO_SEGUN_ENTORNO: Record<Entorno, boolean> = {
  [Entorno.LOCAL]: true,
  [Entorno.DESARROLLO]: true,
  [Entorno.CERTIFICACION]: true,
  [Entorno.PRODUCCION]: false,
  [Entorno.TEST]: false,
};

const USAR_API03 = API03_ACTIVADO_SEGUN_ENTORNO[ENTORNO];

const obtenerHoraAPI03 = async (): Promise<Date> => {
  const response = await fetch(
    `${getRandomAPI03IntanceURL()}/api/time?timezone=${ZONA_HORARIA_LOCAL}`
  );

  if (!response.ok) {
    throw new Error(`Error getting time from API03: ${response.status}`);
  }

  const data = await response.json();
  return new Date(data.serverTime);
};

/**
 * Gets the current date and time in Peru applying mocking offsets if necessary
 * @returns Date object adjusted with Peru timezone and development offsets
 */
export async function obtenerFechaHoraActualPeru(): Promise<Date> {
  let fechaPerú: Date;

  if (USAR_API03) {
    try {
      // Use time from API03
      fechaPerú = await obtenerHoraAPI03();
      fechaPerú.setHours(fechaPerú.getHours() - 5);
    } catch (error) {
      console.warn("Error getting time from API03, using local time:", error);
      // Fallback to local time if API fails
      fechaPerú = new Date();
      // Peru is in UTC-5
      fechaPerú.setHours(fechaPerú.getHours() - 5);
    }
  } else {
    // Use browser local time
    fechaPerú = new Date();
    // Peru is in UTC-5
    fechaPerú.setHours(fechaPerú.getHours() - 5);
  }

  // Apply additional offsets only in local environment for testing/mocking
  if (ENTORNO === Entorno.LOCAL) {
    fechaPerú.setDate(fechaPerú.getDate() + OFFSET_DIAS_ADICIONALES_SIU01);
    fechaPerú.setHours(fechaPerú.getHours() + OFFSET_HORAS_ADICIONALES_SIU01);
    fechaPerú.setMinutes(fechaPerú.getMinutes() + OFFSET_MINUTOS_ADICIONALES_SIU01);
    fechaPerú.setSeconds(fechaPerú.getSeconds() + OFFSET_SEGUNDOS_ADICIONALES_SIU01);
  }

  return fechaPerú;
}

/**
 * Function to get the current date in Peru in YYYY-MM-DD format
 * Maintains backwards compatibility with the original function
 */
export async function obtenerFechaActualPeru(): Promise<string> {
  const fechaPerú = await obtenerFechaHoraActualPeru();
  return fechaPerú.toISOString().split("T")[0];
}