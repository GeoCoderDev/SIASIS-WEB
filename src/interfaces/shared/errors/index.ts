/**
* 🔄 TIPOS DE ERROR UNIFICADOS - API01 & SIU01 COMPATIBLE ✅ Retrocompatible con ambos componentes ✅ Sincronizado entre proyectos ✅ Tipos adicionales para sistema de asistencia Última actualización: 2024-12-19
*/

/**
* Errores relacionados con parámetros de solicitudes HTTP
*/
export enum RequestErrorTypes {
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  MISSING_PARAMETERS = "MISSING_PARAMETERS",
  REQUEST_FAILED = "REQUEST_FAILED",
  MALFORMED_REQUEST = "MALFORMED_REQUEST",
  PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND", // / Recurso solicitadno encontrado
  METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED", // / Método HTTno permitido
}

/**
* Errores relacionados con tokens de autenticación
*/
export enum TokenErrorTypes {
  TOKEN_UNAUTHORIZED = "TOKEN_UNAUTHORIZED",
  TOKEN_MISSING = "TOKEN_MISSING", // / No se proporcnó token
  TOKEN_INVALID_FORMAT = "TOKEN_INVALID_FORMAT", // / Formato Bearernválido
  TOKEN_EXPIRED = "TOKEN_EXPIRED", // / Ton expirado
  TOKEN_MALFORMED = "TOKEN_MALFORMED", // / Ton mal formado (no decodificable)
  TOKEN_INVALID_SIGNATURE = "TOKEN_INVALID_SIGNATURE", // / Firmanválida
  TOKEN_WRONG_ROLE = "TOKEN_WRONG_ROLE", // / Ton tiene rol equivocado
  TOKEN_REVOKED = "TOKEN_REVOKED", // / 🆕 Ton revocado
  TOKEN_NOT_ACTIVE_YET = "TOKEN_NOT_ACTIVE_YET", // / 🆕 Ton aún no activo
}

/**
* Errores relacionados con usuarios
*/
export enum UserErrorTypes {
  USER_NOT_FOUND = "USER_NOT_FOUND", // / Usuarino encontrado
  USER_INACTIVE = "USER_INACTIVE", // / El usuario estánactivo
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  USER_ROLE_MISMATCH = "USER_ROLE_MISMATCH",
  USER_SUSPENDED = "USER_SUSPENDED", // / 🆕 Usuario susndido
  USER_DELETED = "USER_DELETED", // / 🆕 Usuario elinado
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS", // / 🆕 Accesno autorizado
}

/**
* Errores relacionados con roles y permisos
*/
export enum PermissionErrorTypes {
  ROLE_BLOCKED = "ROLE_BLOCKED", // / El rol está temporalnte bloqueado
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS", // /n permisos suficientes
  ROLE_NOT_FOUND = "ROLE_NOT_FOUND", // / 🆕 Rono encontrado
  PERMISSION_DENIED = "PERMISSION_DENIED", // / 🆕 Permisonegado explícitamente
}

/**
* Errores técnicos del sistema
*/
export enum SystemErrorTypes {
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR", // / Error alnectar con la base de datos
  UNKNOWN_ERROR = "UNKNOWN_ERROR", // / Error desnocido
  SERVER_ERROR = "SERVER_ERROR", // / 🆕 Errornterno del servidor
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE", // / 🆕 Servicino disponible
  MAINTENANCE_MODE = "MAINTENANCE_MODE", // / 🆕 Modontenimiento
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED", // / 🆕 Límite de velocidad excedido
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR", // 🆕 Error denfiguración
}

/**
* Errores relacionados a validaciones de datos
*/
export enum ValidationErrorTypes {
  INVALID_USER_IDENTIFIER = "INVALID_USER_IDENTIFIER",
  INVALID_GENDER = "INVALID_GENDER",
  INVALID_PHONE = "INVALID_PHONE",
  INVALID_EMAIL = "INVALID_EMAIL",
  INVALID_USERNAME = "INVALID_USERNAME",
  INVALID_NAME = "INVALID_NAME",
  INVALID_LASTNAME = "INVALID_LASTNAME",
  STRING_TOO_LONG = "STRING_TOO_LONG",
  FIELD_REQUIRED = "FIELD_REQUIRED",
  INVALID_FORMAT = "INVALID_FORMAT",
  REQUIRED_FIELDS = "REQUIRED_FIELDS",
  INVALID_REFERENCE = "INVALID_REFERENCE",
  VALUE_ALREADY_EXISTS = "VALUE_ALREADY_EXISTS",
  INVALID_DNI = "INVALID_DNI",
  INVALID_DATE_FORMAT = "INVALID_DATE_FORMAT", // / 🆕 Formato de fechanválido
  DATE_OUT_OF_RANGE = "DATE_OUT_OF_RANGE", // / 🆕 Fecha fuera dengo
  INVALID_TIME_FORMAT = "INVALID_TIME_FORMAT", // / 🆕 Formato de horanválido
  INVALID_ENUM_VALUE = "INVALID_ENUM_VALUE", // / 🆕 Valor denumeración inválido
}

/**
* Errores relacionados con conflictos de datos
*/
export enum DataConflictErrorTypes {
  VALUE_ALREADY_IN_USE = "CONFLICTO_VALOR_YA_EN_USO",
  RECORD_NOT_FOUND = "CONFLICTO_REGISTRO_NO_ENCONTRADO",
  RELATED_DATA_EXISTS = "CONFLICTO_DATOS_RELACIONADOS_EXISTEN",
  DATABASE_CONSTRAINT = "CONFLICTO_RESTRICCIÓN_BASE_DATOS",
  CONCURRENT_MODIFICATION = "CONFLICTO_MODIFICACIÓN_CONCURRENTE", // / 🆕 Modificacn concurrente
  VERSION_MISMATCH = "CONFLICTO_VERSIÓN_NO_COINCIDE", // / 🆕 Versn no coincide
  DEPENDENCY_EXISTS = "CONFLICTO_DEPENDENCIA_EXISTE", // / 🆕 Existe dendencia
}

/**
* Errores relacionados con archivos
*/
export enum FileErrorTypes {
  FILE_MISSING = "FILE_MISSING",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  FILE_UPLOAD_FAILED = "FILE_UPLOAD_FAILED",
  FILE_DELETE_FAILED = "FILE_DELETE_FAILED",
  FILE_CORRUPTED = "FILE_CORRUPTED", // / 🆕 Archivo corrupto
  FILE_PROCESSING_FAILED = "FILE_PROCESSING_FAILED", // 🆕 Procesamnto falló
  INSUFFICIENT_STORAGE = "INSUFFICIENT_STORAGE", // / 🆕 Almanamiento insuficiente
}

/**
* Errores relacionados con autenticación
*/
export enum AuthenticationErrorTypes {
  MAX_ATTEMPTS_EXCEEDED = "MAX_ATTEMPTS_EXCEEDED",
  VERIFICATION_FAILED = "VERIFICATION_FAILED",
  CHALLENGE_REQUIRED = "CHALLENGE_REQUIRED",
  OTP_INVALID = "OTP_INVALID",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  TEMPORARY_BLOCKED = "TEMPORARY_BLOCKED",
  OTP_EXPIRED = "OTP_EXPIRED", // / 🆕 OTP expirado
  OTP_ALREADY_USED = "OTP_ALREADY_USED", // 🆕 OTP ya usado
  AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED", // 🆕 Aunticación requerida
}

/**
* Errores relacionados con datos
*/
export enum DataErrorTypes {
  RECORD_NOT_FOUND = "RECORD_NOT_FOUND", // / Registro específicno encontrado
  NO_DATA_AVAILABLE = "NO_DATA_AVAILABLE", // / No hay datos disnibles para el período
  DATA_NOT_EXISTS = "DATA_NOT_EXISTS", // / Los datono existen para los parámetros dados
  INVALID_DATA_FORMAT = "INVALID_DATA_FORMAT", // / 🆕 Formato de datosnválido
  DATA_CORRUPTED = "DATA_CORRUPTED", // / 🆕 Datos corruptos
  DATA_INCONSISTENT = "DATA_INCONSISTENT", // 🆕 Datosnconsistentes
}

/**
* 🆕 Errores relacionados con red y conectividad
*/
export enum NetworkErrorTypes {
  NETWORK_ERROR = "NETWORK_ERROR", // / Error de redneral
  CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT", // / Tiempo denexión agotado
  TIMEOUT_ERROR = "TIMEOUT_ERROR", // / Error de tiempo de espera
  CONNECTION_REFUSED = "CONNECTION_REFUSED", //nexión rechazada
  DNS_ERROR = "DNS_ERROR", // / Error de DNS
  OFFLINE = "OFFLINE", //n conexión
  POOR_CONNECTION = "POOR_CONNECTION", // /nexión débil
}

/**
* 🆕 Errores relacionados con sincronización (para sistema de asistencia)
*/
export enum SyncErrorTypes {
  SYNC_ERROR = "SYNC_ERROR", // / Error dencronización general
  SYNC_CONFLICT = "SYNC_CONFLICT", // /nflicto de sincronización
  SYNC_TIMEOUT = "SYNC_TIMEOUT", // / Tiempo dencronización agotado
  SYNC_FAILED = "SYNC_FAILED", // /ncronización falló
  SYNC_INTERRUPTED = "SYNC_INTERRUPTED", // /ncronización interrumpida
  SYNC_DATA_MISMATCH = "SYNC_DATA_MISMATCH", // / Datono coinciden en sincronización
}

/**
* 🆕 Errores relacionados con cache
*/
export enum CacheErrorTypes {
  CACHE_ERROR = "CACHE_ERROR", // / Error de cacheneral
  CACHE_MISS = "CACHE_MISS", // / Cache miss
  CACHE_EXPIRED = "CACHE_EXPIRED", // Cache expirado
  CACHE_CORRUPTED = "CACHE_CORRUPTED", // Cache corrupto
  CACHE_FULL = "CACHE_FULL", // Cache lno
  CACHE_UNAVAILABLE = "CACHE_UNAVAILABLE", // / Cachno disponible
}

/**
* 🆕 Errores relacionados con almacenamiento local
*/
export enum StorageErrorTypes {
  STORAGE_FULL = "STORAGE_FULL", // / Almanamiento lleno
  STORAGE_ERROR = "STORAGE_ERROR", // / Error de almanamiento general
  STORAGE_UNAVAILABLE = "STORAGE_UNAVAILABLE", // / Almanamiento no disponible
  STORAGE_CORRUPTED = "STORAGE_CORRUPTED", // / Almanamiento corrupto
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED", // / Cuota excedida
  INDEXEDDB_ERROR = "INDEXEDDB_ERROR", // Error específico dendexedDB
}

/**
* 🆕 Errores relacionados con operaciones de asistencia
*/
export enum AttendanceErrorTypes {
  ATTENDANCE_ALREADY_MARKED = "ATTENDANCE_ALREADY_MARKED", // / Asisncia ya marcada
  ATTENDANCE_WINDOW_CLOSED = "ATTENDANCE_WINDOW_CLOSED", // /ntana de asistencia cerrada
  INVALID_ATTENDANCE_TIME = "INVALID_ATTENDANCE_TIME", // / Hora de asisncia inválida
  ATTENDANCE_NOT_FOUND = "ATTENDANCE_NOT_FOUND", // / Asisncia no encontrada
  ATTENDANCE_LOCKED = "ATTENDANCE_LOCKED", // / Asisncia bloqueada
  SCHEDULE_CONFLICT = "SCHEDULE_CONFLICT", // /nflicto de horario
}

/**
* Tipo unión que incluye todos los tipos de error ✅ Retrocompatible con versiones anteriores ✅ Extensible para nuevos tipos de error
*/
type AllErrorTypes =
  | RequestErrorTypes
  | TokenErrorTypes
  | UserErrorTypes
  | PermissionErrorTypes
  | SystemErrorTypes
  | ValidationErrorTypes
  | DataConflictErrorTypes
  | FileErrorTypes
  | DataErrorTypes
  | AuthenticationErrorTypes
  | NetworkErrorTypes // / 🆕
  |ncErrorTypes // / 🆕
  | CacheErrorTypes // 🆕
  | StorageErrorTypes // 🆕
  | AtndanceErrorTypes; // / 🆕

export default AllErrorTypes;

// ================================================================
// 🔄 EXPORTACIONES PARA RETROCOMPATIBILIDAD
// ================================================================

/**
* 🆕 Grupos de errores para facilitar elnejo
*/
export const ErrorGroups = {
  // // Errores críticos que requien logout inmediato
  CRITICAL_ERRORS: [
    TokenErrorTypes.TOKEN_EXPIRED,
    TokenErrorTypes.TOKEN_REVOKED,
    AuthenticationErrorTypes.ACCOUNT_LOCKED,
    UserErrorTypes.USER_SUSPENDED,
    UserErrorTypes.USER_DELETED,
  ],

  // // Errores denectividad que permiten reintento
  CONNECTIVITY_ERRORS: [
    NetworkErrorTypes.NETWORK_ERROR,
    NetworkErrorTypes.CONNECTION_TIMEOUT,
    NetworkErrorTypes.TIMEOUT_ERROR,
    NetworkErrorTypes.CONNECTION_REFUSED,
    NetworkErrorTypes.OFFLINE,
  ],

  // // Errores de datos que requien sincronización
  SYNC_REQUIRED_ERRORS: [
    SyncErrorTypes.SYNC_CONFLICT,
    SyncErrorTypes.SYNC_DATA_MISMATCH,
    DataErrorTypes.DATA_INCONSISTENT,
    CacheErrorTypes.CACHE_CORRUPTED,
  ],

  // // Errores de almanamiento que requieren limpieza
  STORAGE_CLEANUP_ERRORS: [
    StorageErrorTypes.STORAGE_FULL,
    StorageErrorTypes.QUOTA_EXCEEDED,
    CacheErrorTypes.CACHE_FULL,
  ],

  // // Errores de validacn que el usuario puede corregir
  USER_CORRECTABLE_ERRORS: [
    ...Object.values(ValidationErrorTypes),
    RequestErrorTypes.INVALID_PARAMETERS,
    RequestErrorTypes.MISSING_PARAMETERS,
  ],
} as const;
