import { T_Eventos } from "@prisma/client";

// ✅ INTERFAZ ORIGINAL: Evento individual (sin cambios)
export type IEventoLocal = Pick<T_Eventos, "Id_Evento" | "Nombre"> & {
  Fecha_Inicio: string; // Formato YYYY-MM-DD
  Fecha_Conclusion: string; // Formato YYYY-MM-DD
  // ✅ NUEVOS CAMPOS CALCULADOS para indexación
  mes_año_inicio?: string; // Ejemplo: "2025-06"
  mes_año_conclusion?: string; // Ejemplo: "2025-06"
};

// ✅ NUEVA INTERFAZ: Eventos agrupados por mes con sincronización granular
export interface IEventosPorMes {
  clave_mes_año: string; // Clave primaria: "2025-06"
  año: number; // 2025
  mes: number; // 6 (junio)
  eventos: IEventoLocal[]; // Array de eventos del mes
  cantidad_eventos: number; // Número total de eventos
  ultima_actualizacion: number; // Timestamp de última sincronización
  fecha_creacion: number; // Timestamp de creación del registro
}

// ✅ INTERFAZ PARA FILTROS (actualizada)
export interface IEventoFilter {
  Id_Evento?: number;
  Nombre?: string;
  mes?: number; // Filtro por mes (1-12)
  año?: number; // Filtro por año (2024, 2025, etc.)
  // ✅ NUEVO: Filtro por clave mes-año
  clave_mes_año?: string; // "2025-06"
}

// ✅ INTERFAZ PARA RESPUESTA DE SINCRONIZACIÓN
export interface ISincronizacionEventos {
  sincronizado: boolean;
  eventos_actualizados: number;
  eventos_eliminados: number;
  eventos_nuevos: number;
  errores: number;
  mensaje: string;
  timestamp_sincronizacion: number;
}

// ✅ UTILIDAD: Función para generar clave mes-año
export const generarClaveMesAño = (mes: number, año: number): string => {
  return `${año}-${mes.toString().padStart(2, '0')}`;
};

// ✅ UTILIDAD: Función para extraer mes y año de una fecha YYYY-MM-DD
export const extraerMesAñoDeFecha = (fecha: string): { mes: number; año: number; clave: string } => {
  const [año, mes] = fecha.split('-').map(Number);
  return {
    mes,
    año,
    clave: generarClaveMesAño(mes, año)
  };
};

// ✅ UTILIDAD: Función para validar si un año debe ser eliminado
export const debeEliminarAño = (año: number): boolean => {
  const añoActual = new Date().getFullYear();
  return año !== añoActual;
};