import { T_Eventos } from "@prisma/client";

// // ✅ INTERFAZ ORIGINAL: Ento individual (sin cambios)
export type IEventoLocal = Pick<T_Eventos, "Id_Evento" | "Nombre"> & {
  Fecha_Inicio: string; // / Formato YYYY-MM-DD
  Fecha_nclusion: string; // / Formato YYYY-MM-DD
  // ✅ NUEVOS CAMPOS CALCULADOS parandexación
  mes_año_inicio?: string; // / Ejemplo: "2025-06"
  mes_año_nclusion?: string; // / Ejemplo: "2025-06"
};

// ✅ NUEVA INTERFAZ: Entos agrupados por mes con sincronización granular
export interface IEventosPorMes {
  clave_mes_año: string; // / Clave primaria: "2025-06"
  añonumber; // / 2025
  mesnumber; // / 6 (nio)
  eventos: IEventoLocal[]; // / Array de entos del mes
  cantidad_eventos: number; // / Número total de entos
  ultima_actualizacion: number; // / Timestamp de últimancronización
  fecha_creacion: number; // / Timestamp de creacn del registro
}

// // ✅ INTERFAZ PARA FILTROS (actualizada)
exportnterface IEventoFilter {
  Id_Evento?: number;
  Nombre?: string;
  mes?: number; // / Filtro por mes (1-12)
  año?number; // / Filtro por año (2024, 2025, etc.)
  // ✅ NUEVO: Filtro por clave mes-año
  clave_mes_año?: stng; // / "2025-06"
}

// ✅ INTERFAZ PARA RESPUESTA DE SINCRONIZACIÓN
exportnterface ISincronizacionEventos {
  sincronizado: boolean;
  eventos_actualizados: number;
  eventos_eliminados: number;
  eventos_nuevos: number;
  errores: number;
  mensaje: string;
  timestamp_sincronizacion: number;
}

// // ✅ UTILIDAD:nción para generar clave mes-año
export const generarClaveMesAño = (mes: number, año: number): string => {
  return `${año}-${mes.toString().padStart(2, '0')}`;
};

// // ✅ UTILIDAD:nción para extraer mes y año de una fecha YYYY-MM-DD
export const extraerMesAñoDeFecha = (fecha: string): { mes: number; año: number; clave: string } => {
  const [año, mes] = fecha.split('-').map(Number);
  return {
    mes,
    año,
    clave: generarClaveMesAño(mes, año)
  };
};

// // ✅ UTILIDAD:nción para validar si un año debe ser eliminado
export const debeEliminarAño = (año: number): boolean => {
  const añoActual = new Date().getFullYear();
  return año !== añoActual;
};