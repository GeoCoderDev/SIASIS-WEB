/**
 * 🔄 UNIFIED ERROR TYPES - API01 & SIU01 COMPATIBLE
 *
 * ✅ Backward compatible with both components
 * ✅ Synchronized between projects
 * ✅ Additional types for attendance system
 *
 * Last update: 2024-12-19
 */

/**
 * Errors related to HTTP request parameters
 */
export enum RequestErrorTypes {
  INVALID_PARAMETERS = "INVALID_PARAMETERS",
  MISSING_PARAMETERS = "MISSING_PARAMETERS",
  REQUEST_FAILED = "REQUEST_FAILED",
  MALFORMED_REQUEST = "MALFORMED_REQUEST",
  PAYLOAD_TOO_LARGE = "PAYLOAD_TOO_LARGE",
  RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND", // Requested resource not found
  METHOD_NOT_ALLOWED = "METHOD_NOT_ALLOWED", // HTTP method not allowed
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
  TOKEN_REVOKED = "TOKEN_REVOKED", // 🆕 Revoked token
  TOKEN_NOT_ACTIVE_YET = "TOKEN_NOT_ACTIVE_YET", // 🆕 Token not yet active
}

/**
 * Errors related to users
 */
export enum UserErrorTypes {
  USER_NOT_FOUND = "USER_NOT_FOUND", // User not found
  USER_INACTIVE = "USER_INACTIVE", // The user is inactive
  INVALID_CREDENTIALS = "INVALID_CREDENTIALS",
  USER_ROLE_MISMATCH = "USER_ROLE_MISMATCH",
  USER_SUSPENDED = "USER_SUSPENDED", // 🆕 Suspended user
  USER_DELETED = "USER_DELETED", // 🆕 Deleted user
  UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS", // 🆕 Unauthorized access
}

/**
 * Errors related to roles and permissions
 */
export enum PermissionErrorTypes {
  ROLE_BLOCKED = "ROLE_BLOCKED", // The role is temporarily blocked
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS", // Insufficient permissions
  ROLE_NOT_FOUND = "ROLE_NOT_FOUND", // 🆕 Role not found
  PERMISSION_DENIED = "PERMISSION_DENIED", // 🆕 Permission explicitly denied
}

/**
 * Technical system errors
 */
export enum SystemErrorTypes {
  EXTERNAL_SERVICE_ERROR = "EXTERNAL_SERVICE_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR", // Error connecting to the database
  UNKNOWN_ERROR = "UNKNOWN_ERROR", // Unknown error
  SERVER_ERROR = "SERVER_ERROR", // 🆕 Internal server error
  SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE", // 🆕 Service unavailable
  MAINTENANCE_MODE = "MAINTENANCE_MODE", // 🆕 Maintenance mode
  RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED", // 🆕 Rate limit exceeded
  CONFIGURATION_ERROR = "CONFIGURATION_ERROR", // 🆕 Configuration error
}

/**
 * Errors related to data validations
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
  INVALID_DATE_FORMAT = "INVALID_DATE_FORMAT", // 🆕 Invalid date format
  DATE_OUT_OF_RANGE = "DATE_OUT_OF_RANGE", // 🆕 Date out of range
  INVALID_TIME_FORMAT = "INVALID_TIME_FORMAT", // 🆕 Invalid time format
  INVALID_ENUM_VALUE = "INVALID_ENUM_VALUE", // 🆕 Invalid enum value
}

/**
 * Errors related to data conflicts
 */
export enum DataConflictErrorTypes {
  VALUE_ALREADY_IN_USE = "CONFLICTO_VALOR_YA_EN_USO",
  RECORD_NOT_FOUND = "CONFLICTO_REGISTRO_NO_ENCONTRADO",
  RELATED_DATA_EXISTS = "CONFLICTO_DATOS_RELACIONADOS_EXISTEN",
  DATABASE_CONSTRAINT = "CONFLICTO_RESTRICCIÓN_BASE_DATOS",
  CONCURRENT_MODIFICATION = "CONFLICTO_MODIFICACIÓN_CONCURRENTE", // 🆕 Concurrent modification
  VERSION_MISMATCH = "CONFLICTO_VERSIÓN_NO_COINCIDE", // 🆕 Version mismatch
  DEPENDENCY_EXISTS = "CONFLICTO_DEPENDENCIA_EXISTE", // 🆕 Dependency exists
}

/**
 * Errors related to files
 */
export enum FileErrorTypes {
  FILE_MISSING = "FILE_MISSING",
  INVALID_FILE_TYPE = "INVALID_FILE_TYPE",
  FILE_TOO_LARGE = "FILE_TOO_LARGE",
  FILE_UPLOAD_FAILED = "FILE_UPLOAD_FAILED",
  FILE_DELETE_FAILED = "FILE_DELETE_FAILED",
  FILE_CORRUPTED = "FILE_CORRUPTED", // 🆕 Corrupted file
  FILE_PROCESSING_FAILED = "FILE_PROCESSING_FAILED", // 🆕 Processing failed
  INSUFFICIENT_STORAGE = "INSUFFICIENT_STORAGE", // 🆕 Insufficient storage
}

/**
 * Errors related to authentication
 */
export enum AuthenticationErrorTypes {
  MAX_ATTEMPTS_EXCEEDED = "MAX_ATTEMPTS_EXCEEDED",
  VERIFICATION_FAILED = "VERIFICATION_FAILED",
  CHALLENGE_REQUIRED = "CHALLENGE_REQUIRED",
  OTP_INVALID = "OTP_INVALID",
  ACCOUNT_LOCKED = "ACCOUNT_LOCKED",
  TEMPORARY_BLOCKED = "TEMPORARY_BLOCKED",
  OTP_EXPIRED = "OTP_EXPIRED", // 🆕 Expired OTP
  OTP_ALREADY_USED = "OTP_ALREADY_USED", // 🆕 OTP already used
  AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED", // 🆕 Authentication required
}

/**
 * Errors related to data
 */
export enum DataErrorTypes {
  RECORD_NOT_FOUND = "RECORD_NOT_FOUND", // Specific record not found
  NO_DATA_AVAILABLE = "NO_DATA_AVAILABLE", // No data available for the period
  DATA_NOT_EXISTS = "DATA_NOT_EXISTS", // The data does not exist for the given parameters
  INVALID_DATA_FORMAT = "INVALID_DATA_FORMAT", // 🆕 Invalid data format
  DATA_CORRUPTED = "DATA_CORRUPTED", // 🆕 Corrupted data
  DATA_INCONSISTENT = "DATA_INCONSISTENT", // 🆕 Inconsistent data
}

/**
 * 🆕 Errors related to network and connectivity
 */
export enum NetworkErrorTypes {
  NETWORK_ERROR = "NETWORK_ERROR", // General network error
  CONNECTION_TIMEOUT = "CONNECTION_TIMEOUT", // Connection timeout
  TIMEOUT_ERROR = "TIMEOUT_ERROR", // Timeout error
  CONNECTION_REFUSED = "CONNECTION_REFUSED", // Connection refused
  DNS_ERROR = "DNS_ERROR", // DNS error
  OFFLINE = "OFFLINE", // No connection
  POOR_CONNECTION = "POOR_CONNECTION", // Weak connection
}

/**
 * 🆕 Errors related to synchronization (for attendance system)
 */
export enum SyncErrorTypes {
  SYNC_ERROR = "SYNC_ERROR", // General synchronization error
  SYNC_CONFLICT = "SYNC_CONFLICT", // Synchronization conflict
  SYNC_TIMEOUT = "SYNC_TIMEOUT", // Synchronization timeout
  SYNC_FAILED = "SYNC_FAILED", // Synchronization failed
  SYNC_INTERRUPTED = "SYNC_INTERRUPTED", // Synchronization interrupted
  SYNC_DATA_MISMATCH = "SYNC_DATA_MISMATCH", // Data does not match in synchronization
}

/**
 * 🆕 Errors related to cache
 */
export enum CacheErrorTypes {
  CACHE_ERROR = "CACHE_ERROR", // General cache error
  CACHE_MISS = "CACHE_MISS", // Cache miss
  CACHE_EXPIRED = "CACHE_EXPIRED", // Expired cache
  CACHE_CORRUPTED = "CACHE_CORRUPTED", // Corrupted cache
  CACHE_FULL = "CACHE_FULL", // Cache full
  CACHE_UNAVAILABLE = "CACHE_UNAVAILABLE", // Cache unavailable
}

/**
 * 🆕 Errors related to local storage
 */
export enum StorageErrorTypes {
  STORAGE_FULL = "STORAGE_FULL", // Storage full
  STORAGE_ERROR = "STORAGE_ERROR", // General storage error
  STORAGE_UNAVAILABLE = "STORAGE_UNAVAILABLE", // Storage unavailable
  STORAGE_CORRUPTED = "STORAGE_CORRUPTED", // Corrupted storage
  QUOTA_EXCEEDED = "QUOTA_EXCEEDED", // Quota exceeded
  INDEXEDDB_ERROR = "INDEXEDDB_ERROR", // Specific IndexedDB error
}

/**
 * 🆕 Errors related to attendance operations
 */
export enum AttendanceErrorTypes {
  ATTENDANCE_ALREADY_MARKED = "ATTENDANCE_ALREADY_MARKED", // Attendance already marked
  ATTENDANCE_WINDOW_CLOSED = "ATTENDANCE_WINDOW_CLOSED", // Attendance window closed
  INVALID_ATTENDANCE_TIME = "INVALID_ATTENDANCE_TIME", // Invalid attendance time
  ATTENDANCE_NOT_FOUND = "ATTENDANCE_NOT_FOUND", // Attendance not found
  ATTENDANCE_LOCKED = "ATTENDANCE_LOCKED", // Attendance locked
  SCHEDULE_CONFLICT = "SCHEDULE_CONFLICT", // Schedule conflict
}

/**
 * Union type that includes all error types
 * ✅ Backward compatible with previous versions
 * ✅ Extensible for new error types
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
  | NetworkErrorTypes // 🆕
  | SyncErrorTypes // 🆕
  | CacheErrorTypes // 🆕
  | StorageErrorTypes // 🆕
  | AttendanceErrorTypes; // 🆕

export default AllErrorTypes;

// ================================================================
// 🔄 EXPORTS FOR BACKWARD COMPATIBILITY
// ================================================================

/**
 * 🆕 Error groups to facilitate handling
 */
export const ErrorGroups = {
  // Critical errors that require immediate logout
  CRITICAL_ERRORS: [
    TokenErrorTypes.TOKEN_EXPIRED,
    TokenErrorTypes.TOKEN_REVOKED,
    AuthenticationErrorTypes.ACCOUNT_LOCKED,
    UserErrorTypes.USER_SUSPENDED,
    UserErrorTypes.USER_DELETED,
  ],

  // Connectivity errors that allow retrying
  CONNECTIVITY_ERRORS: [
    NetworkErrorTypes.NETWORK_ERROR,
    NetworkErrorTypes.CONNECTION_TIMEOUT,
    NetworkErrorTypes.TIMEOUT_ERROR,
    NetworkErrorTypes.CONNECTION_REFUSED,
    NetworkErrorTypes.OFFLINE,
  ],

  // Data errors that require synchronization
  SYNC_REQUIRED_ERRORS: [
    SyncErrorTypes.SYNC_CONFLICT,
    SyncErrorTypes.SYNC_DATA_MISMATCH,
    DataErrorTypes.DATA_INCONSISTENT,
    CacheErrorTypes.CACHE_CORRUPTED,
  ],

  // Storage errors that require cleanup
  STORAGE_CLEANUP_ERRORS: [
    StorageErrorTypes.STORAGE_FULL,
    StorageErrorTypes.QUOTA_EXCEEDED,
    CacheErrorTypes.CACHE_FULL,
  ],

  // Validation errors that the user can correct
  USER_CORRECTABLE_ERRORS: [
    ...Object.values(ValidationErrorTypes),
    RequestErrorTypes.INVALID_PARAMETERS,
    RequestErrorTypes.MISSING_PARAMETERS,
  ],
} as const;