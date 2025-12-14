import { ValidationErrorTypes } from "../../../../interfaces/shared/errors";
import { ValidationResult } from "./types";

/**
 * Validates an email
 * @param value - Value to validate
 * @param required - Indicates if the field is mandatory
 * @returns Validation result
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateEmail(value: any, required: boolean): ValidationResult {
  if ((value === undefined || value === null) && required) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.FIELD_REQUIRED,
      errorMessage: "The email is required",
    };
  }

  if (value === undefined || value === null) {
    return { isValid: true };
  }

  if (typeof value !== "string") {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "The email must be a string",
    };
  }

  // RFC 5322 compliant email regex
  const emailRegex =
    /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(value)) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_EMAIL,
      errorMessage: "The email format is invalid",
    };
  }

  if (value.length > 70) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.STRING_TOO_LONG,
      errorMessage: "The email cannot exceed 70 characters",
    };
  }

  return { isValid: true };
}
