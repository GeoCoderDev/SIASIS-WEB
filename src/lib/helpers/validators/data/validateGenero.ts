import { ValidationErrorTypes } from "../../../../interfaces/shared/errors";
import { ValidationResult } from "./types";

/**
 * Validates the gender (M or F)
 * @param value - Value to validate
 * @param required - Indicates if the field is mandatory
 * @returns Validation result
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateGender(
  value: any,
  required: boolean
): ValidationResult {
  if ((value === undefined || value === null) && required) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.FIELD_REQUIRED,
      errorMessage: "The gender is required",
    };
  }

  if (value === undefined || value === null) {
    return { isValid: true };
  }

  if (typeof value !== "string") {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "The gender must be a string",
    };
  }

  if (value !== "M" && value !== "F") {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_GENDER,
      errorMessage: "The gender must be 'M' for male or 'F' for female",
    };
  }

  return { isValid: true };
}
