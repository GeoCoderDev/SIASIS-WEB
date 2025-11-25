import {
  TiposIdentificadores,
  TiposIdentificadoresTextos,
} from "@/interfaces/shared/TiposIdentificadores";
import { ValidationErrorTypes } from "../../../../interfaces/shared/errors";
import { ValidationResult } from "./types";

/**
 * Validates a Peruvian DNI (reused auxiliary function)
 * @param dniValue - DNI value to validate
 * @returns DNI validation result
 */
function validateDNIPart(dniValue: string): ValidationResult {
  const dniRegex = /^\d{8}$/;
  if (!dniRegex.test(dniValue)) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_DNI,
      errorMessage: "The DNI must contain exactly 8 numeric digits",
    };
  }
  return { isValid: true };
}

/**
 * Validates a Foreigner's Card
 * @param carnetValue - Card value to validate
 * @returns Card validation result
 */
function validateCarnetExtranjeria(carnetValue: string): ValidationResult {
  // Foreigner's cards can have between 6 and 12 digits
  const carnetRegex = /^\d{6,12}$/;
  if (!carnetRegex.test(carnetValue)) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage:
        "The Foreigner's Card must contain between 6 and 12 numeric digits",
    };
  }
  return { isValid: true };
}

/**
 * Validates a School Code
 * @param codigoValue - Code value to validate
 * @returns Code validation result
 */
function validateCodigoEscuela(codigoValue: string): ValidationResult {
  // School codes can be alphanumeric and have variable length (4-20 characters)
  const codigoRegex = /^[A-Z0-9]{4,20}$/;
  if (!codigoRegex.test(codigoValue)) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage:
        "The School Code must contain between 4 and 20 uppercase alphanumeric characters",
    };
  }
  return { isValid: true };
}

/**
 * Validates a system actor ID
 * @param value - Value to validate
 * @param required - Indicates if the field is mandatory
 * @returns Validation result with identifier type information
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateIdActor(
  value: any,
  required: boolean
): ValidationResult & {
  tipoIdentificador?: TiposIdentificadores;
} {
  // Validate if required
  if ((value === undefined || value === null) && required) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.FIELD_REQUIRED,
      errorMessage: "The ID is required",
    };
  }

  // If not required and empty, it is valid
  if (value === undefined || value === null) {
    return { isValid: true };
  }

  // Validate that it is a string
  if (typeof value !== "string") {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "The ID must be a text string",
    };
  }

  const trimmedValue = value.trim();

  // Case 1: No hyphen - must be DNI
  if (!trimmedValue.includes("-")) {
    const dniValidation = validateDNIPart(trimmedValue);
    if (!dniValidation.isValid) {
      return {
        ...dniValidation,
        errorMessage: `ID without valid format: ${dniValidation.errorMessage}`,
      };
    }

    return {
      isValid: true,
      tipoIdentificador: TiposIdentificadores.DNI,
    };
  }

  // Case 2: With hyphen - validate format and type
  const parts = trimmedValue.split("-");

  // Must have exactly 2 parts
  if (parts.length !== 2) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage:
        "The ID must have the format: identifier-type (e.g., 12345678-1)",
    };
  }

  const [identificador, tipoStr] = parts;

  // Validate that the type is numeric
  const tipoNum = parseInt(tipoStr, 10);
  if (
    isNaN(tipoNum) ||
    !Object.values(TiposIdentificadores).includes(tipoNum)
  ) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: `Invalid identifier type: ${tipoStr}. Must be 1 (DNI), 2 (Foreigner's Card) or 3 (School Code)`,
    };
  }

  // Validate the identifier according to its type
  let validationResult: ValidationResult;

  switch (tipoNum) {
    case TiposIdentificadores.DNI:
      validationResult = validateDNIPart(identificador);
      break;

    case TiposIdentificadores.CARNET_EXTRANJERIA:
      validationResult = validateCarnetExtranjeria(identificador);
      break;

    case TiposIdentificadores.CODIGO_ESCUELA:
      validationResult = validateCodigoEscuela(identificador);
      break;

    default:
      return {
        isValid: false,
        errorType: ValidationErrorTypes.INVALID_FORMAT,
        errorMessage: "Unsupported identifier type",
      };
  }

  // If specific validation fails, return the error
  if (!validationResult.isValid) {
    return {
      ...validationResult,
      errorMessage: `Invalid ${TiposIdentificadoresTextos[tipoNum]}: ${validationResult.errorMessage}`,
    };
  }

  // If all is valid
  return {
    isValid: true,
    tipoIdentificador: tipoNum as TiposIdentificadores,
  };
}

// Auxiliary function to get only the identifier without the type
export function extractIdentificador(idActor: string): string {
  if (!idActor.includes("-")) {
    return idActor;
  }
  return idActor.split("-")[0];
}

// Auxiliary function to get the identifier type
export function extractTipoIdentificador(
  idActor: string
): TiposIdentificadores {
  if (!idActor.includes("-")) {
    return TiposIdentificadores.DNI;
  }

  const tipo = parseInt(idActor.split("-")[1], 10);
  return tipo as TiposIdentificadores;
}