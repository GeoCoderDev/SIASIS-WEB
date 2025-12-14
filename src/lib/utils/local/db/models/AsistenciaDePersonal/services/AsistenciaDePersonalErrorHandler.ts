import { logout } from "@/lib/utils/frontend/auth/logout";
import { LogoutTypes, ErrorDetailsForLogout } from "@/interfaces/LogoutTypes";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import AllErrorTypes, {
  DataConflictErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
  DataErrorTypes,
  SyncErrorTypes,
  NetworkErrorTypes,
  StorageErrorTypes,
  PermissionErrorTypes,
} from "@/interfaces/shared/errors";

/**
 * 🎯 RESPONSIBILITY: Centralized error handling
 * - Classify error types
 * - Decide recovery strategies
 * - Handle logout when necessary
 * - Provide useful error messages
 * - Log errors for debugging
 */
export class AsistenciaDePersonalErrorHandler {
  private setIsSomethingLoading?: (isLoading: boolean) => void;
  private setError?: (error: ErrorResponseAPIBase | null) => void;
  private setSuccessMessage?: (message: MessageProperty | null) => void;

  constructor(
    setIsSomethingLoading?: (isLoading: boolean) => void,
    setError?: (error: ErrorResponseAPIBase | null) => void,
    setSuccessMessage?: (message: MessageProperty | null) => void
  ) {
    this.setIsSomethingLoading = setIsSomethingLoading;
    this.setError = setError;
    this.setSuccessMessage = setSuccessMessage;
  }

  /**
   * Handles errors according to their type and performs logout if necessary
   */
  public handleError(
    error: unknown,
    operacion: string,
    detalles?: Record<string, any>
  ): void {
    console.error(`Error en AsistenciaDePersonalIDB (${operacion}):`, error);

    const errorDetails: ErrorDetailsForLogout = {
      origen: `AsistenciaDePersonalIDB.${operacion}`,
      mensaje: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      contexto: JSON.stringify(detalles || {}),
      siasisComponent: "CLN01",
    };

    let logoutType: LogoutTypes;

    if (error instanceof Error) {
      if (error.name === "QuotaExceededError") {
        logoutType = LogoutTypes.ERROR_BASE_DATOS;
      } else if (error.name === "AbortError") {
        logoutType = LogoutTypes.ERROR_BASE_DATOS;
      } else {
        logoutType = LogoutTypes.ERROR_SISTEMA;
      }
    } else {
      logoutType = LogoutTypes.ERROR_SISTEMA;
    }

    logout(logoutType, errorDetails);
  }

  /**
   * Handles IndexedDB operation errors adapted to the current pattern
   */
  public handleIndexedDBError(error: unknown, operacion: string): void {
    console.error(`Error in IndexedDB operation (${operacion}):`, error);

    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = `Error during ${operacion}`;

    if (error instanceof Error) {
      if (error.name === "ConstraintError") {
        errorType = DataConflictErrorTypes.VALUE_ALREADY_IN_USE;
        message = `Constraint error during ${operacion}: duplicate value`;
      } else if (error.name === "NotFoundError") {
        errorType = UserErrorTypes.USER_NOT_FOUND;
        message = `Resource not found during ${operacion}`;
      } else if (error.name === "QuotaExceededError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Storage exceeded during ${operacion}`;
      } else if (error.name === "TransactionInactiveError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Inactive transaction during ${operacion}`;
      } else {
        message = error.message || message;
      }
    }

    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
    });
  }

  /**
   * Sets a success message using the current pattern
   */
  public handleSuccess(message: string): void {
    const successResponse: MessageProperty = { message };
    this.setSuccessMessage?.(successResponse);
  }

  /**
   * Handles specific API errors
   */
  public handleAPIError(error: any, operacion: string): void {
    console.error(`Error in API operation (${operacion}):`, error);

    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = `Error during ${operacion}`;

    // Specific HTTP errors
    if (error?.response?.status === 404) {
      errorType = DataErrorTypes.NO_DATA_AVAILABLE;
      message = `No data found for ${operacion}`;
    } else if (error?.response?.status === 401) {
      errorType = UserErrorTypes.INVALID_CREDENTIALS;
      message = `Not authorized for ${operacion}`;
    } else if (error?.response?.status === 403) {
      errorType = PermissionErrorTypes.INSUFFICIENT_PERMISSIONS;
      message = `No permissions for ${operacion}`;
    } else if (error?.response?.status === 500) {
      errorType = SystemErrorTypes.SERVER_ERROR;
      message = `Server error during ${operacion}`;
    } else if (error?.code === "NETWORK_ERROR") {
      errorType = NetworkErrorTypes.NETWORK_ERROR;
      message = `Connection error during ${operacion}`;
    } else if (error?.code === "TIMEOUT") {
      errorType = NetworkErrorTypes.TIMEOUT_ERROR;
      message = `Timeout during ${operacion}`;
    } else if (error instanceof Error) {
      message = error.message || message;
    }

    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
    });
  }

  /**
   * Handles cache errors
   */
  public handleCacheError(error: unknown, operacion: string): void {
    console.error(`Error in cache operation (${operacion}):`, error);

    let errorType: AllErrorTypes = SystemErrorTypes.DATABASE_ERROR;
    let message = `Error in cache during ${operacion}`;

    if (error instanceof Error) {
      if (error.name === "QuotaExceededError") {
        errorType = StorageErrorTypes.STORAGE_FULL;
        message = `Cache full during ${operacion}`;
      } else if (error.name === "NotFoundError") {
        errorType = DataErrorTypes.NO_DATA_AVAILABLE;
        message = `Not found in cache during ${operacion}`;
      } else {
        message = error.message || message;
      }
    }

    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
    });
  }

  /**
   * Handles synchronization errors
   */
  public handleSyncError(error: unknown, operacion: string): void {
    console.error(`Error in synchronization (${operacion}):`, error);

    let errorType: AllErrorTypes = SyncErrorTypes.SYNC_ERROR;
    let message = `Synchronization error during ${operacion}`;

    if (error instanceof Error) {
      if (
        error.message.includes("network") ||
        error.message.includes("fetch")
      ) {
        errorType = NetworkErrorTypes.NETWORK_ERROR;
        message = `Network error during synchronization for ${operacion}`;
      } else if (error.message.includes("timeout")) {
        errorType = NetworkErrorTypes.TIMEOUT_ERROR;
        message = `Timeout during synchronization for ${operacion}`;
      } else {
        message = error.message || message;
      }
    }

    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
    });
  }

  /**
   * Determines if an error requires logout
   */
  public shouldLogout(error: unknown): boolean {
    if (error instanceof Error) {
      // Critical errors that require logout
      const criticalErrors = [
        "QuotaExceededError",
        "SecurityError",
        "InvalidStateError",
      ];

      return criticalErrors.includes(error.name);
    }

    // API errors that require logout
    if (error && typeof error === "object") {
      const apiError = error as any;
      if (
        apiError.response?.status === 401 ||
        apiError.response?.status === 403
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Gets the appropriate logout type for the error
   */
  public getLogoutType(error: unknown): LogoutTypes {
    if (error instanceof Error) {
      if (error.name === "QuotaExceededError" || error.name === "AbortError") {
        return LogoutTypes.ERROR_BASE_DATOS;
      }
      if (error.name === "SecurityError") {
        return LogoutTypes.ERROR_SEGURIDAD;
      }
    }

    if (error && typeof error === "object") {
      const apiError = error as any;
      if (
        apiError.response?.status === 401 ||
        apiError.response?.status === 403
      ) {
        return LogoutTypes.ERROR_AUTENTICACION;
      }
    }

    return LogoutTypes.ERROR_SISTEMA;
  }

  /**
   * Logs an error for debugging without showing it to the user
   */
  public logError(
    error: unknown,
    context: string,
    metadata?: Record<string, any>
  ): void {
    console.error(`[${context}] Error registrado:`, {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      metadata: metadata || {},
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Creates a user-friendly error message
   */
  public createUserFriendlyMessage(error: unknown, operacion: string): string {
    if (error instanceof Error) {
      switch (error.name) {
        case "QuotaExceededError":
          return "Local storage is full. Please free up space or contact the administrator.";
        case "NetworkError":
          return "No internet connection. Please check your connection and try again.";
        case "TimeoutError":
          return "The operation took too long. Please try again in a few moments.";
        case "NotFoundError":
          return "The requested data was not found.";
        default:
          return `Error during ${operacion}. If the problem persists, please contact technical support.`;
      }
    }

    return `An unexpected error occurred during ${operacion}. Please try again.`;
  }

  /**
   * Handles errors with a recovery strategy
   */
  public handleErrorWithRecovery(
    error: unknown,
    operacion: string,
    recoveryStrategy?: () => Promise<void>
  ): void {
    const userMessage = this.createUserFriendlyMessage(error, operacion);

    this.setError?.({
      success: false,
      message: userMessage,
      errorType: SystemErrorTypes.UNKNOWN_ERROR,
    });

    // Execute recovery strategy if provided
    if (recoveryStrategy) {
      recoveryStrategy().catch((recoveryError) => {
        console.error("Error in recovery strategy:", recoveryError);
      });
    }

    // Decide whether to logout
    if (this.shouldLogout(error)) {
      const logoutType = this.getLogoutType(error);
      const errorDetails: ErrorDetailsForLogout = {
        origen: `AsistenciaPersonalErrorHandler.${operacion}`,
        mensaje: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
        contexto: JSON.stringify({ operacion }),
        siasisComponent: "CLN01",
      };

      logout(logoutType, errorDetails);
    }
  }

  /**
   * Handles validation errors
   */
  public handleValidationError(errores: string[], operacion: string): void {
    const message = `Validation errors during ${operacion}: ${errores.join(
      ", "
    )}`;

    this.setError?.({
      success: false,
      message,
      errorType: DataErrorTypes.INVALID_DATA_FORMAT,
    });
  }

  // ✅ FIXED - AsistenciaDePersonalErrorHandler.ts
  public clearErrors(): void {
    this.setError?.(null);
    // ❌ DO NOT end loading here
    // this.setIsSomethingLoading?.(false);
  }

  // ✅ NEW separate method if you need to clear loading
  public clearErrorsAndLoading(): void {
    this.setError?.(null);
    this.setIsSomethingLoading?.(false);
  }

  /**
   * Sets loading state
   */
  public setLoading(isLoading: boolean): void {
    this.setIsSomethingLoading?.(isLoading);
  }
}
