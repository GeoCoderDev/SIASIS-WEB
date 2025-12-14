import { ValidationErrorTypes } from "../../../../interfaces/shared/errors";
import { ValidationResult } from "./types";

/**
 * Validates names
 * @param value - Value to validate
 * @param required - Indicates if the field is mandatory
 * @returns Validation result
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateNames(value: any, required: boolean): ValidationResult {
  if ((value === undefined || value === null) && required) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.FIELD_REQUIRED,
      errorMessage: "The Names field is required",
    };
  }

  if (value === undefined || value === null) {
    return { isValid: true };
  }

  if (typeof value !== "string") {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "The Names field must be a string",
    };
  }

  // Allows letters, spaces, apostrophes, and hyphens (for compound names)
  const nameRegex = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s'-]{2,60}$/;
  if (!nameRegex.test(value)) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_NAME,
      errorMessage:
        "The Names field must be between 2 and 60 characters and can only contain letters, spaces, apostrophes, and hyphens",
    };
  }

  return { isValid: true };
}
