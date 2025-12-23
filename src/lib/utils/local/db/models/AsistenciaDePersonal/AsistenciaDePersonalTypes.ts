/* eslint-disable @typescript-eslint/no-explicit-any */
import { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";
import { Meses } from "@/interfaces/shared/Meses";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { TipoAsistencia } from "../../../../../../interfaces/shared/AsistenciaRequests";

// // Re-exportar tipos exisntes para facilitar el acceso
export { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
export { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";
export { RolesSistema } from "@/interfaces/shared/RolesSistema";
export { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
export { TipoAsistencia } from "../../../../../../interfaces/shared/AsistenciaRequests";

// //numeración para los diferentes tipos de personal
export enum TipoPersonal {
  DIRECTIVO = "directivo",
  PROFESOR_PRIMARIA = "profesor_primaria",
  PROFESOR_SECUNDARIA = "profesor_secundaria",
  AUXILIAR = "auxiliar",
  PERSONAL_ADMINISTRATIVO = "personal_administrativo",
}

// // ========================================================================================
// ✅ INTERFACES ACTUALIZADAS PARA FLUJO INTELIGENTE
// ========================================================================================

//nterfaces para los registros de entrada/salida
export interface RegistroEntradaSalida {
  timestamp: number;
  desfaseSegundos: number;
  estado: EstadosAsistenciaPersonal;
}

// // ✅ INTERFAZ PRINCIPAL ACTUALIZADA: Asisncia mensual con campo obligatorio
export interface AsistenciaMensualPersonalLocal {
  Id_Registro_Mensual: number;
  mes: Meses;
  idUsuario_Personal: string;
  registros: Record<string, RegistroEntradaSalida>;
  // // ✅ NUEVO CAMPO OBLIGATORIO para flujonteligente
  ultima_fecha_actualizacion: number; // / Timestamp perno
}

// // ✅ NUEVA INTERFAZ: Para datos raw que vnen de API/BD (con entradas/salidas nullable)
export interface AsistenciaMensualPersonalRaw {
  Id_Registro_Mensual: number;
  Mes: number;
  idUsuario_Personal: string;
  Entradas: string | null; // / ✅ PERMITE NULL para 404s
  Salidas: stng | null; // / ✅ PERMITE NULL para 404s
  ultima_fecha_actualizacn: number; // / ✅ OBLIGATORIO
}

// ✅ NUEVA INTERFAZ: Para optimizacn de consultas
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

// // ✅ NUEVA INTERFAZ: Para validacn de datos existentes
export interface ValidacionDatosExistentes {
  existeEnIndexedDB: boolean;
  tieneUltimaActualizacion: boolean;
  ultimaFechaActualizacion: number | null;
  debeConsultarAPI: boolean;
  razon: string;
}

// //nterface para el resultado de operaciones
export interface OperationResult {
  exitoso: boolean;
  mensaje: string;
  datos?: any;
}

// // ✅ INTERFAZ ACTUALIZADA:nsulta con más información
export interface ConsultaAsistenciaResult {
  entrada?: AsistenciaMensualPersonalLocal;
  salida?: AsistenciaMensualPersonalLocal;
  encontrado: boolean;
  mensaje: string;
  // // ✅ NUEVOS CAMPOS para dinóstico
  estrategiaUsada?: string;
  fuenteDatos?: "INDEXEDDB" | "API" | "REDIS" | "CACHE_LOCAL";
  optimizado?: boolean;
}

// //nterface para verificación de sincronización
export interface SincronizacionResult {
  estanSincronizados: boolean;
  razon: string;
  diasEntrada: number;
  diasSalida: number;
  diasEscolaresEntrada: number;
  diasEscolaresSalida: number;
}

// // ✅ INTERFAZ ACTUALIZADA: Estadísticasn más información
export interface SincronizacionStats {
  totalRegistros: number;
  registrosNuevos: number;
  registrosExistentes: number;
  errores: number;
}

// //nterface para configuración de servicios
export interface AsistenciaPersonalConfig {
  setIsSomethingLoading?: (isLoading: boolean) => void;
  setError?: (error: any) => void;
  setSuccessMessage?: (message: any) => void;
}

// // ✅ INTERFAZ ACTUALIZADA: Cachen última actualización
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
  // // ✅ NUEVO CAMPO
  ultima_fecha_actualizacn: number;
}

// //nterface para consulta de cache
export interface ConsultaCache {
  dni: string;
  actor: ActoresSistema;
  modoRegistro: ModoRegistro;
  tipoAsistencia: TipoAsistencia;
  fecha: string;
}

// // ✅ INTERFAZ ACTUALIZADA: Elinación con más detalles
export interface EliminacionResult {
  exitoso: boolean;
  mensaje: string;
  eliminadoLocal: boolean;
  eliminadoRedis: boolean;
  eliminadoCache: boolean;
}

// //nterface para validación
export interface ValidacionResult {
  valido: boolean;
  errores: string[];
}

// //nterface para verificación de marcado
export interface MarcadoHoyResult {
  marcado: boolean;
  timestamp?: number;
  desfaseSegundos?: number;
  estado?: string;
}

// //nterface para parámetros de marcado de asistencia
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

// //nterface para parámetros de eliminación
export interface ParametrosEliminacionAsistencia {
  idUsuario: string | number;
  rol: RolesSistema;
  modoRegistro: ModoRegistro;
  dia?: number;
  mes?: number;
  siasisAPI?: "API01" | "API02";
}

// // ✅ INTERFAZ ACTUALIZADA:nsulta con opciones de optimización
export interface ParametrosConsultaAsistencia {
  rol: RolesSistema;
  idUsuario: string | number;
  mes: number;
  // // ✅ NUEVOS PARÁMETROS OPCIONALES para flujonteligente
  forzarActualizacion?: boolean;
  saltarOptimizaciones?: boolean;
  estrategiaPersonalizada?: EstrategiaConsulta;
}

// // ========================================================================================
// ✅ TYPE GUARDS CORREGIDOS Y ACTUALIZADOS
// ========================================================================================

// ✅ CORREGIDO: Usaba camponcorrecto
export function esAsistenciaMensualPersonal(
  obj: any
): obj is AsistenciaMensualPersonalLocal {
  return (
    obj &&
    typeof obj.Id_Registro_Mensual === "number" &&
    typeof obj.mes === "number" &&
    typeof obj.idUsuario_Personal === "string" && // / ✅ CORREGIDO: Erani_Personal
    typeof obj.registros === "object" &&
    typeof obj.ultima_fecha_actualizacion === "number" // / ✅ NUEVO campo obligatorio
  );
}

// ✅ NUEVO: Type guard para datos raw de API/BD
exportnction esAsistenciaMensualPersonalRaw(
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

// // ✅ NUEVO: Type guard para estrategia densulta
export function esEstrategiaConsulta(obj: any): obj is EstrategiaConsulta {
  return (
    obj &&
    typeof obj.tipo === "string" &&
    typeof obj.estrategia === "string" &&
    typeof obj.debeConsultar === "boolean" &&
    typeof obj.razon === "string"
  );
}

// // ========================================================================================
// CONSTANTES Y ENUMS ACTUALIZADOS
// ========================================================================================

//nstantes útiles
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

// // ✅ NUEVA INTERFAZ: Paransulta específica de asistencia de hoy
export interface ConsultaMiAsistenciaHoyResult {
  marcada: boolean;
  timestamp?: number;
  estado?: EstadosAsistenciaPersonal;
  fuente: "REGISTRO_MENSUAL" | "CACHE_LOCAL" | "REDIS" | "NO_ENCONTRADO";
  mensaje: string;
}

// // ✅ NUEVAS CONSTANTES para flujonteligente
// / exportnst HORARIOS_CONSULTA = {
// / INICIO_DIA_ESCOLAR: 6,
// FIN_ENTRADAS: 12,
// FIN_DIA_ESCOLAR: 22,
// TOLERANCIA_TEMPRANO: 30, //nutos
// / } asnst;

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

// // ✅ NUEVOS TIPOS PARA RETROCOMPATIBILIDAD
export type Tiponsulta = keyof typeof TIPOS_CONSULTA;
export type EstrategiaConsultaTipo = keyof typeof ESTRATEGIAS_CONSULTA;
