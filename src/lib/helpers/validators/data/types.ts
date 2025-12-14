import { ValidationErrorTypes } from "../../../../interfaces/shared/errors";

/**
 * Type for validation results
 */
export type ValidationResult = {
  isValid: boolean;
  errorType?: ValidationErrorTypes;
  errorMessage?: string;
};

/**
 * Type for validators configured in the system
 */
export type ValidatorConfig = {
  field: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  validator: (value: any, required: boolean) => ValidationResult;
};
