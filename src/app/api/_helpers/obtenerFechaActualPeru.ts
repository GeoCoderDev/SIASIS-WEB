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
    throw new Error(`Error al obtener hora de API03: ${response.status}`);
  }

  const data = await response.json();
  return new Date(data.serverTime);
};

/**
 * Obtiene la fecha y hora actual en Perú aplicando offsets de mockeo si es necesario
 * @returns Date object ajustado con la zona horaria de Perú y offsets de desarrollo
 */
export async function obtenerFechaHoraActualPeru(): Promise<Date> {
  let fechaPerú: Date;

  if (USAR_API03) {
    try {
      // Usar hora de la API03
      fechaPerú = await obtenerHoraAPI03();
      fechaPerú.setHours(fechaPerú.getHours() - 5);
    } catch (error) {
      console.warn("Error al obtener hora de API03, usando hora local:", error);
      // Fallback a hora local si falla la API
      fechaPerú = new Date();
      // Perú está en UTC-5
      fechaPerú.setHours(fechaPerú.getHours() - 5);
    }
  } else {
    // Usar hora local del navegador
    fechaPerú = new Date();
    // Perú está en UTC-5
    fechaPerú.setHours(fechaPerú.getHours() - 5);
  }

  // Aplicar offsets adicionales solo en entorno local para testing/mockeo
  if (ENTORNO === Entorno.LOCAL) {
    fechaPerú.setDate(fechaPerú.getDate() + OFFSET_DIAS_ADICIONALES_SIU01);
    fechaPerú.setHours(fechaPerú.getHours() + OFFSET_HORAS_ADICIONALES_SIU01);
    fechaPerú.setMinutes(fechaPerú.getMinutes() + OFFSET_MINUTOS_ADICIONALES_SIU01);
    fechaPerú.setSeconds(fechaPerú.getSeconds() + OFFSET_SEGUNDOS_ADICIONALES_SIU01);
  }

  return fechaPerú;
}

/**
 * Función para obtener la fecha actual en Perú en formato YYYY-MM-DD
 * Mantiene retrocompatibilidad con la función original
 */
export async function obtenerFechaActualPeru(): Promise<string> {
  const fechaPerú = await obtenerFechaHoraActualPeru();
  return fechaPerú.toISOString().split("T")[0];
}