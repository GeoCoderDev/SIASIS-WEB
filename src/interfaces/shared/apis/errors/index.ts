/**
 * Errors related to HTTP request parameters
 */
export enum RequestErrorTypes {
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  MISSING_PARAMETERS = "MISSING_PARAMETERS",
  REQUEST_FAILED = "REQUEST_FAILED",
}

/**
 * Errors related to authentication tokens
 */
export enum TokenErrorTypes {
  TOKEN_UNAUTHORIZED = "TOKEN_UNAUTHORIZED",
  TOKEN_MISSING = "TOKEN_MISSING", // Token not provided
  TOKEN_INVALID_FORMAT = "TOKEN_INVALID_FORMAT", // Invalid Bearer format
  TOKEN_EXPIRED = "TOKEN_EXPIRED", // Expired token
  TOKEN_MALFORMED = "TOKEN_MALFORMED", // Malformed token (not decodable)
  TOKEN_INVALID_SIGNATURE = "TOKEN_INVALID_SIGNATURE", // Invalid signature
  TOKEN_WRONG_ROLE = "TOKEN_WRONG_ROLE", // Token has the wrong role
}

/**
 * Errors related to users
 */
export enum UserErrorTypes {
  USER_NOT_FOUND = "USER_NOT_FOUND", // User not found
  USER_INACTIVE = "USER_INACTIVE", // The user is inactive
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
}

/**
 * Errors related to roles and permissions
 */
export enum PermissionErrorTypes {
  ROLE_BLOCKED = "ROLE_BLOCKED", // The role is temporarily blocked
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS", // Insufficient permissions
}

/**
 * Technical system errors
 */
export enum SystemErrorTypes {
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR", // Error connecting to the database
  UNKNOWN_ERROR = "UNKNOWN_ERROR", // Unknown error
}

// Errors related to data validations

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
