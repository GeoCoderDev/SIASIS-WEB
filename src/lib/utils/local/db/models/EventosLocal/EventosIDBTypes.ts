import { T_Eventos } from "@prisma/client";

// ✅ ORIGINAL INTERFACE: Individual event (no changes)
export type IEventoLocal = Pick<T_Eventos, "Id_Evento" | "Nombre"> & {
  Fecha_Inicio: string; // YYYY-MM-DD format
  Fecha_Conclusion: string; // YYYY-MM-DD format
  // ✅ NEW CALCULATED FIELDS for indexing
  mes_año_inicio?: string; // Example: "2025-06"
  mes_año_conclusion?: string; // Example: "2025-06"
};

// ✅ NEW INTERFACE: Events grouped by month with granular synchronization
export interface IEventosPorMes {
  clave_mes_año: string; // Primary key: "2025-06"
  año: number; // 2025
  mes: number; // 6 (June)
  eventos: IEventoLocal[]; // Array of events for the month
  cantidad_eventos: number; // Total number of events
  ultima_actualizacion: number; // Timestamp of last synchronization
  fecha_creacion: number; // Timestamp of record creation
}

// ✅ INTERFACE FOR FILTERS (updated)
export interface IEventoFilter {
  Id_Evento?: number;
  Nombre?: string;
  mes?: number; // Filter by month (1-12)
  año?: number; // Filter by year (2024, 2025, etc.)
  // ✅ NEW: Filter by month-year key
  clave_mes_año?: string; // "2025-06"
}

// ✅ INTERFACE FOR SYNCHRONIZATION RESPONSE
export interface ISincronizacionEventos {
  sincronizado: boolean;
  eventos_actualizados: number;
  eventos_eliminados: number;
  eventos_nuevos: number;
  errores: number;
  mensaje: string;
  timestamp_sincronizacion: number;
}

// ✅ UTILITY: Function to generate month-year key
export const generarClaveMesAño = (mes: number, año: number): string => {
  return `${año}-${mes.toString().padStart(2, '0')}`;
};

// ✅ UTILITY: Function to extract month and year from a YYYY-MM-DD date
export const extraerMesAñoDeFecha = (fecha: string): { mes: number; año: number; clave: string } => {
  const [año, mes] = fecha.split('-').map(Number);
  return {
    mes,
    año,
    clave: generarClaveMesAño(mes, año)
  };
};

// ✅ UTILITY: Function to validate if a year should be deleted
export const debeEliminarAño = (año: number): boolean => {
  const añoActual = new Date().getFullYear();
  return año !== añoActual;
};