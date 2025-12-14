import { ValidationErrorTypes } from "../../../../interfaces/shared/errors";
import { ValidationResult } from "./types";

/**
 * Validates a Peruvian DNI
 * @param value - Value to validate
 * @param required - Indicates if the field is mandatory
 * @returns Validation result
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateDNI(value: any, required: boolean): ValidationResult {
  if ((value === undefined || value === null) && required) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.FIELD_REQUIRED,
      errorMessage: "The DNI is required",
    };
  }

  if (value === undefined || value === null) {
    return { isValid: true };
  }

  if (typeof value !== "string") {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "The DNI must be a string",
    };
  }

  const dniRegex = /^\d{8}$/;
  if (!dniRegex.test(value)) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_DNI,
      errorMessage: "The DNI must contain exactly 8 numeric digits",
    };
  }

  return { isValid: true };
}
