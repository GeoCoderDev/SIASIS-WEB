import { ValidationErrorTypes } from "../../../../interfaces/shared/errors";
import { ValidationResult } from "./types";

/**
 * Validates current password (only checks length)
 * @param value - Value to validate
 * @param required - Indicates if the field is required
 * @returns Validation result
 */
export function validateCurrentPassword(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
  required: boolean
): ValidationResult {
  if ((value === undefined || value === null) && required) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.FIELD_REQUIRED,
      errorMessage: "Current password is required",
    };
  }

  if (value === undefined || value === null) {
    return { isValid: true };
  }

  if (typeof value !== "string") {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "Current password must be a text string",
    };
  }

  // Only validate length for current password
  if (value.length < 8) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "Current password must have at least 8 characters",
    };
  }

  return { isValid: true };
}

/**
 * Validates a new password with basic requirements
 * @param value - Value to validate
 * @param required - Indicates if the field is required
 * @returns Validation result
 */
export function validatePassword(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  value: any,
  required: boolean
): ValidationResult {
  if ((value === undefined || value === null) && required) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.FIELD_REQUIRED,
      errorMessage: "Password is required",
    };
  }

  if (value === undefined || value === null) {
    return { isValid: true };
  }

  if (typeof value !== "string") {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "Passwords must be a text string",
    };
  }

  // Validate length (between 8 and 20 characters)
  if (value.length < 8 || value.length > 20) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "Passwords must be between 8 and 20 characters",
    };
  }

  // Validate that it contains at least one letter and one number (minimum requirement)
  if (!/[a-zA-Z]/.test(value) || !/[0-9]/.test(value)) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage:
        "Passwords must contain at least one letter and one number",
    };
  }

  return { isValid: true };
}
