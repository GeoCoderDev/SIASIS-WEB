import { ValidationErrorTypes } from "../../../../interfaces/shared/errors";
import { ValidationResult } from "./types";

/**
 * Validates a Peruvian cell phone number
 * @param value - Value to validate
 * @param required - Indicates if the field is mandatory
 * @returns Validation result
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validatePhone(value: any, required: boolean): ValidationResult {
  if ((value === undefined || value === null) && required) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.FIELD_REQUIRED,
      errorMessage: "The cell phone number is required",
    };
  }

  if (value === undefined || value === null) {
    return { isValid: true };
  }

  if (typeof value !== "string") {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "The cell phone number must be a string",
    };
  }

  // Validate Peruvian cell phone format (9 digits starting with 9)
  const phoneRegex = /^9\d{8}$/;
  if (!phoneRegex.test(value)) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_PHONE,
      errorMessage:
        "The cell phone number must start with 9 and have 9 digits in total",
    };
  }

  return { isValid: true };
}
