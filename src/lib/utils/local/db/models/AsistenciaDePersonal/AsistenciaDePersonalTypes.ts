/* eslint-disable @typescript-eslint/no-explicit-any */
import { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";
import { Meses } from "@/interfaces/shared/Meses";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { TipoAsistencia } from "../../../../../../interfaces/shared/AsistenciaRequests";

// Re-export existing types for easier access
export { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
export { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";
export { RolesSistema } from "@/interfaces/shared/RolesSistema";
export { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
export { TipoAsistencia } from "../../../../../../interfaces/shared/AsistenciaRequests";

// Enumeration for the different types of staff
export enum TipoPersonal {
  DIRECTIVO = "directivo",
  PROFESOR_PRIMARIA = "profesor_primaria",
  PROFESOR_SECUNDARIA = "profesor_secundaria",
  AUXILIAR = "auxiliar",
  PERSONAL_ADMINISTRATIVO = "personal_administrativo",
}

// ========================================================================================
// ✅ UPDATED INTERFACES FOR SMART FLOW
// ========================================================================================

// Interfaces for entry/exit records
export interface RegistroEntradaSalida {
  timestamp: number;
  desfaseSegundos: number;
  estado: EstadosAsistenciaPersonal;
}

// ✅ UPDATED MAIN INTERFACE: Monthly attendance with mandatory field
export interface AsistenciaMensualPersonalLocal {
  Id_Registro_Mensual: number;
  mes: Meses;
  idUsuario_Personal: string;
  registros: Record<string, RegistroEntradaSalida>;
  // ✅ NEW MANDATORY FIELD for smart flow
  ultima_fecha_actualizacion: number; // Peruvian timestamp
}

// ✅ NEW INTERFACE: For raw data from API/DB (with nullable entries/exits)
export interface AsistenciaMensualPersonalRaw {
  Id_Registro_Mensual: number;
  Mes: number;
  idUsuario_Personal: string;
  Entradas: string | null; // ✅ ALLOWS NULL for 404s
  Salidas: string | null; // ✅ ALLOWS NULL for 404s
  ultima_fecha_actualizacion: number; // ✅ MANDATORY
}

// ✅ NEW INTERFACE: For query optimization
export interface EstrategiaConsulta {
  tipo: "MES_FUTURO" | "MES_ANTERIOR" | "MES_ACTUAL";
  estrategia:
    | "NO_CONSULTAR"
    | "REDIS_ENTRADAS"
    | "REDIS_COMPLETO"
    | "API_CONSOLIDADO"
    | "INDEXEDDB_OPTIMIZADO"
    | "LOGOUT_FORZADO";
  debeConsultar: boolean;
  razon: string;
  horaActual?: number;
  usarCache?: boolean;
}

// ✅ NEW INTERFACE: For validation of existing data
export interface ValidacionDatosExistentes {
  existeEnIndexedDB: boolean;
  tieneUltimaActualizacion: boolean;
  ultimaFechaActualizacion: number | null;
  debeConsultarAPI: boolean;
  razon: string;
}

// Interface for operation results
export interface OperationResult {
  exitoso: boolean;
  mensaje: string;
  datos?: any;
}

// ✅ UPDATED INTERFACE: Query with more information
export interface ConsultaAsistenciaResult {
  entrada?: AsistenciaMensualPersonalLocal;
  salida?: AsistenciaMensualPersonalLocal;
  encontrado: boolean;
  mensaje: string;
  // ✅ NEW FIELDS for diagnosis
  estrategiaUsada?: string;
  fuenteDatos?: "INDEXEDDB" | "API" | "REDIS" | "CACHE_LOCAL";
  optimizado?: boolean;
}

// Interface for synchronization verification
export interface SincronizacionResult {
  estanSincronizados: boolean;
  razon: string;
  diasEntrada: number;
  diasSalida: number;
  diasEscolaresEntrada: number;
  diasEscolaresSalida: number;
}

// ✅ UPDATED INTERFACE: Statistics with more information
export interface SincronizacionStats {
  totalRegistros: number;
  registrosNuevos: number;
  registrosExistentes: number;
  errores: number;
}

// Interface for service configuration
export interface AsistenciaPersonalConfig {
  setIsSomethingLoading?: (isLoading: boolean) => void;
  setError?: (error: any) => void;
  setSuccessMessage?: (message: any) => void;
}

// ✅ UPDATED INTERFACE: Cache with last update
export interface CacheData {
  clave: string;
  dni: string;
  actor: ActoresSistema;
  modoRegistro: ModoRegistro;
  tipoAsistencia: TipoAsistencia;
  timestamp: number;
  desfaseSegundos: number;
  estado: EstadosAsistenciaPersonal;
  fecha: string;
  timestampConsulta: number;
  // ✅ NEW FIELD
  ultima_fecha_actualizacion: number;
}

// Interface for cache query
export interface ConsultaCache {
  dni: string;
  actor: ActoresSistema;
  modoRegistro: ModoRegistro;
  tipoAsistencia: TipoAsistencia;
  fecha: string;
}

// ✅ UPDATED INTERFACE: Deletion with more details
export interface EliminacionResult {
  exitoso: boolean;
  mensaje: string;
  eliminadoLocal: boolean;
  eliminadoRedis: boolean;
  eliminadoCache: boolean;
}

// Interface for validation
export interface ValidacionResult {
  valido: boolean;
  errores: string[];
}

// Interface for marking verification
export interface MarcadoHoyResult {
  marcado: boolean;
  timestamp?: number;
  desfaseSegundos?: number;
  estado?: string;
}

// Interface for attendance marking parameters
export interface ParametrosMarcadoAsistencia {
  datos: {
    ModoRegistro: ModoRegistro;
    DNI: string;
    Rol: RolesSistema;
    Dia: number;
    Detalles?: {
      Timestamp: number;
      DesfaseSegundos: number;
    };
    esNuevoRegistro?: boolean;
  };
}

// Interface for deletion parameters
export interface ParametrosEliminacionAsistencia {
  idUsuario: string | number;
  rol: RolesSistema;
  modoRegistro: ModoRegistro;
  dia?: number;
  mes?: number;
  siasisAPI?: "API01" | "API02";
}

// ✅ UPDATED INTERFACE: Query with optimization options
export interface ParametrosConsultaAsistencia {
  rol: RolesSistema;
  idUsuario: string | number;
  mes: number;
  // ✅ NEW OPTIONAL PARAMETERS for smart flow
  forzarActualizacion?: boolean;
  saltarOptimizaciones?: boolean;
  estrategiaPersonalizada?: EstrategiaConsulta;
}

// ========================================================================================
// ✅ FIXED AND UPDATED TYPE GUARDS
// ========================================================================================

// ✅ FIXED: Used incorrect field
export function esAsistenciaMensualPersonal(
  obj: any
): obj is AsistenciaMensualPersonalLocal {
  return (
    obj &&
    typeof obj.Id_Registro_Mensual === "number" &&
    typeof obj.mes === "number" &&
    typeof obj.idUsuario_Personal === "string" && // ✅ FIXED: Was Dni_Personal
    typeof obj.registros === "object" &&
    typeof obj.ultima_fecha_actualizacion === "number" // ✅ NEW mandatory field
  );
}

// ✅ NEW: Type guard for raw API/DB data
export function esAsistenciaMensualPersonalRaw(
  obj: any
): obj is AsistenciaMensualPersonalRaw {
  return (
    obj &&
    typeof obj.Id_Registro_Mensual === "number" &&
    typeof obj.Mes === "number" &&
    typeof obj.idUsuario_Personal === "string" &&
    (typeof obj.Entradas === "string" || obj.Entradas === null) &&
    (typeof obj.Salidas === "string" || obj.Salidas === null) &&
    typeof obj.ultima_fecha_actualizacion === "number"
  );
}

export function esRegistroEntradaSalida(
  obj: any
): obj is RegistroEntradaSalida {
  return (
    obj &&
    typeof obj.timestamp === "number" &&
    typeof obj.desfaseSegundos === "number" &&
    typeof obj.estado === "string"
  );
}

// ✅ NEW: Type guard for query strategy
export function esEstrategiaConsulta(obj: any): obj is EstrategiaConsulta {
  return (
    obj &&
    typeof obj.tipo === "string" &&
    typeof obj.estrategia === "string" &&
    typeof obj.debeConsultar === "boolean" &&
    typeof obj.razon === "string"
  );
}

// ========================================================================================
// UPDATED CONSTANTS AND ENUMS
// ========================================================================================

// Useful constants
export const ROLES_VALIDOS_PERSONAL = [
  RolesSistema.ProfesorPrimaria,
  RolesSistema.ProfesorSecundaria,
  RolesSistema.Tutor,
  RolesSistema.Auxiliar,
  RolesSistema.PersonalAdministrativo,
] as const;

export const ESTADOS_ASISTENCIA_VALIDOS = [
  EstadosAsistenciaPersonal.En_Tiempo,
  EstadosAsistenciaPersonal.Tarde,
  EstadosAsistenciaPersonal.Cumplido,
  EstadosAsistenciaPersonal.Salida_Anticipada,
  EstadosAsistenciaPersonal.Falta,
  EstadosAsistenciaPersonal.Inactivo,
  EstadosAsistenciaPersonal.Sin_Registro,
] as const;

// ✅ NEW INTERFACE: For specific query of today's attendance
export interface ConsultaMiAsistenciaHoyResult {
  marcada: boolean;
  timestamp?: number;
  estado?: EstadosAsistenciaPersonal;
  fuente: "REGISTRO_MENSUAL" | "CACHE_LOCAL" | "REDIS" | "NO_ENCONTRADO";
  mensaje: string;
}

// ✅ NEW CONSTANTS for smart flow
// export const HORARIOS_CONSULTA = {
//   INICIO_DIA_ESCOLAR: 6,
//   FIN_ENTRADAS: 12,
//   FIN_DIA_ESCOLAR: 22,
//   TOLERANCIA_TEMPRANO: 30, // minutos
// } as const;

export const ESTRATEGIAS_CONSULTA = {
  NO_CONSULTAR: "NO_CONSULTAR",
  REDIS_ENTRADAS: "REDIS_ENTRADAS",
  REDIS_COMPLETO: "REDIS_COMPLETO",
  API_CONSOLIDADO: "API_CONSOLIDADO",
  INDEXEDDB_OPTIMIZADO: "INDEXEDDB_OPTIMIZADO",
  LOGOUT_FORZADO: "LOGOUT_FORZADO",
} as const;

export const TIPOS_CONSULTA = {
  MES_FUTURO: "MES_FUTURO",
  MES_ANTERIOR: "MES_ANTERIOR",
  MES_ACTUAL: "MES_ACTUAL",
} as const;

// ✅ NEW TYPES FOR BACKWARD COMPATIBILITY
export type TipoConsulta = keyof typeof TIPOS_CONSULTA;
export type EstrategiaConsultaTipo = keyof typeof ESTRATEGIAS_CONSULTA;