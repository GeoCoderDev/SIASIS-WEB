import { ValidationErrorTypes } from "../../../../interfaces/shared/errors";
import { ValidationResult, ValidatorConfig } from "./types";

/**
 * Validator that groups multiple validations
 * @param data - Data to validate
 * @param validators - Array of validator configurations
 * @returns Validation result
 */
export function validateData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>,
  validators: ValidatorConfig[]
): ValidationResult {
  if (!data || typeof data !== "object") {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "An object with data to validate was expected",
    };
  }

  // We validate each field as appropriate
  for (const { field, validator } of validators) {
    // Determine if the field is present in the data
    const value = data[field];
    const required = Object.keys(data).includes(field);

    // Validate the field
    const result = validator(value, required);
    if (!result.isValid) {
      return {
        isValid: false,
        errorType: result.errorType,
        errorMessage: result.errorMessage,
      };
    }
  }

  return { isValid: true };
}
