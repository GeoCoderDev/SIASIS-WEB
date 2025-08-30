import {
  TiposIdentificadores,
  TiposIdentificadoresTextos,
} from "@/interfaces/shared/TiposIdentificadores";
import { ValidationErrorTypes } from "../../../../interfaces/shared/errors";
import { ValidationResult } from "./types";

/**
 * Valida un DNI peruano (función auxiliar reutilizada)
 * @param dniValue - Valor del DNI a validar
 * @returns Resultado de la validación del DNI
 */
function validateDNIPart(dniValue: string): ValidationResult {
  const dniRegex = /^\d{8}$/;
  if (!dniRegex.test(dniValue)) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_DNI,
      errorMessage: "El DNI debe contener exactamente 8 dígitos numéricos",
    };
  }
  return { isValid: true };
}

/**
 * Valida un Carnet de Extranjería
 * @param carnetValue - Valor del carnet a validar
 * @returns Resultado de la validación del carnet
 */
function validateCarnetExtranjeria(carnetValue: string): ValidationResult {
  // Los carnets de extranjería pueden tener entre 6 y 12 dígitos
  const carnetRegex = /^\d{6,12}$/;
  if (!carnetRegex.test(carnetValue)) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage:
        "El Carnet de Extranjería debe contener entre 6 y 12 dígitos numéricos",
    };
  }
  return { isValid: true };
}

/**
 * Valida un Código de Escuela
 * @param codigoValue - Valor del código a validar
 * @returns Resultado de la validación del código
 */
function validateCodigoEscuela(codigoValue: string): ValidationResult {
  // Los códigos de escuela pueden ser alfanuméricos y tener longitud variable (4-20 caracteres)
  const codigoRegex = /^[A-Z0-9]{4,20}$/;
  if (!codigoRegex.test(codigoValue)) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage:
        "El Código de Escuela debe contener entre 4 y 20 caracteres alfanuméricos en mayúsculas",
    };
  }
  return { isValid: true };
}

/**
 * Valida un ID de actor del sistema
 * @param value - Valor a validar
 * @param required - Indica si el campo es obligatorio
 * @returns Resultado de la validación con información del tipo de identificador
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function validateIdActor(
  value: any,
  required: boolean
): ValidationResult & {
  tipoIdentificador?: TiposIdentificadores;
} {
  // Validar si es requerido
  if ((value === undefined || value === null) && required) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.FIELD_REQUIRED,
      errorMessage: "El ID es requerido",
    };
  }

  // Si no es requerido y está vacío, es válido
  if (value === undefined || value === null) {
    return { isValid: true };
  }

  // Validar que sea string
  if (typeof value !== "string") {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: "El ID debe ser una cadena de texto",
    };
  }

  const trimmedValue = value.trim();

  // Caso 1: Sin guión - debe ser DNI
  if (!trimmedValue.includes("-")) {
    const dniValidation = validateDNIPart(trimmedValue);
    if (!dniValidation.isValid) {
      return {
        ...dniValidation,
        errorMessage: `ID sin formato válido: ${dniValidation.errorMessage}`,
      };
    }

    return {
      isValid: true,
      tipoIdentificador: TiposIdentificadores.DNI,
    };
  }

  // Caso 2: Con guión - validar formato y tipo
  const parts = trimmedValue.split("-");

  // Debe tener exactamente 2 partes
  if (parts.length !== 2) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage:
        "El ID debe tener el formato: identificador-tipo (ej: 12345678-1)",
    };
  }

  const [identificador, tipoStr] = parts;

  // Validar que el tipo sea numérico
  const tipoNum = parseInt(tipoStr, 10);
  if (
    isNaN(tipoNum) ||
    !Object.values(TiposIdentificadores).includes(tipoNum)
  ) {
    return {
      isValid: false,
      errorType: ValidationErrorTypes.INVALID_FORMAT,
      errorMessage: `Tipo de identificador inválido: ${tipoStr}. Debe ser 1 (DNI), 2 (Carnet de Extranjería) o 3 (Código de Escuela)`,
    };
  }

  // Validar el identificador según su tipo
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
        errorMessage: "Tipo de identificador no soportado",
      };
  }

  // Si la validación específica falla, retornar el error
  if (!validationResult.isValid) {
    return {
      ...validationResult,
      errorMessage: `${TiposIdentificadoresTextos[tipoNum]} inválido: ${validationResult.errorMessage}`,
    };
  }

  // Si todo es válido
  return {
    isValid: true,
    tipoIdentificador: tipoNum as TiposIdentificadores,
  };
}

// Función auxiliar para obtener solo el identificador sin el tipo
export function extractIdentificador(idActor: string): string {
  if (!idActor.includes("-")) {
    return idActor;
  }
  return idActor.split("-")[0];
}

// Función auxiliar para obtener el tipo de identificador
export function extractTipoIdentificador(
  idActor: string
): TiposIdentificadores {
  if (!idActor.includes("-")) {
    return TiposIdentificadores.DNI;
  }

  const tipo = parseInt(idActor.split("-")[1], 10);
  return tipo as TiposIdentificadores;
}
