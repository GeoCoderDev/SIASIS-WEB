/**
* Errores relacionados con parámetros de solicitudes HTTP
*/
export enum RequestErrorTypes {
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  MISSING_PARAMETERS = "MISSING_PARAMETERS",
  REQUEST_FAILED = "REQUEST_FAILED",
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
}

/**
* Errores relacionados con usuarios
*/
export enum UserErrorTypes {
  USER_NOT_FOUND = "USER_NOT_FOUND", // / Usuarino encontrado
  USER_INACTIVE = "USER_INACTIVE", // / El usuario estánactivo
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
}

/**
* Errores relacionados con roles y permisos
*/
export enum PermissionErrorTypes {
  ROLE_BLOCKED = "ROLE_BLOCKED", // / El rol está temporalnte bloqueado
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS", // /n permisos suficientes
}

/**
* Errores técnicos del sistema
*/
export enum SystemErrorTypes {
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR", // / Error alnectar con la base de datos
  UNKNOWN_ERROR = "UNKNOWN_ERROR", // / Error desnocido
}

// // Errores relacnados a validaciones de datos

export enum ValidationErrorTypes {
  INVALID_ID = "INVALID_ID",
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
}

export enum DataConflictErrorTypes {
  VALUE_ALREADY_IN_USE = "CONFLICTO_VALOR_YA_EN_USO",
  RECORD_NOT_FOUND = "CONFLICTO_REGISTRO_NO_ENCONTRADO",
  RELATED_DATA_EXISTS = "CONFLICTO_DATOS_RELACIONADOS_EXISTEN",
  DATABASE_CONSTRAINT = "CONFLICTO_RESTRICCIÓN_BASE_DATOS",
}

export enum FileErrorTypes {
  FILE_MISSING = "FILE_MISSING",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  FILE_UPLOAD_FAILED = "FILE_UPLOAD_FAILED",
  FILE_DELETE_FAILED = "FILE_DELETE_FAILED",
}

export enum AuthenticationErrorTypes {
  MAX_ATTEMPTS_EXCEEDED = "MAX_ATTEMPTS_EXCEEDED",
  VERIFICATION_FAILED = "VERIFICATION_FAILED",
  CHALLENGE_REQUIRED = "CHALLENGE_REQUIRED",
  OTP_INVALID = "OTP_INVALID",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  TEMPORARY_BLOCKED = "TEMPORARY_BLOCKED",
}

type AllErrorTypes =
  | RequestErrorTypes
  | TokenErrorTypes
  | UserErrorTypes
  | PermissionErrorTypes
  | SystemErrorTypes
  | ValidationErrorTypes
  | DataConflictErrorTypes
  | FileErrorTypes
  | AuthenticationErrorTypes;

export default AllErrorTypes;
