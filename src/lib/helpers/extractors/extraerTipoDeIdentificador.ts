import { LogoutTypes } from "@/interfaces/LogoutTypes";
import { logout } from "@/lib/utils/frontend/auth/logout";

// 🏷️ Enum for identifier types
export enum TiposIdentificadores {
  DNI = 1,
  CARNET_EXTRANJERIA = 2,
  CODIGO_ESCUELA = 3,
}

// 📝 Mapping of types to descriptive texts
export const TiposIdentificadoresTextos: Record<TiposIdentificadores, string> =
  {
    [TiposIdentificadores.DNI]: "DNI",
    [TiposIdentificadores.CARNET_EXTRANJERIA]: "Carnet de Extranjería",
    [TiposIdentificadores.CODIGO_ESCUELA]: "Código de Escuela",
  };

/**
 * 🔍 Function to extract the identifier type based on what comes after the hyphen
 * If the type doesn't exist or is invalid, it automatically closes the session
 *
 * @param identificador - Identifier in format {identifier}-{type}
 * @returns TiposIdentificadores - The valid identifier type
 *
 * @example
 * // Usage examples:
 * extraerTipoDeIdentificador("12345678-1")    // → TiposIdentificadores.DNI (1)
 * extraerTipoDeIdentificador("A123456-2")     // → TiposIdentificadores.CARNET_EXTRANJERIA (2)
 * extraerTipoDeIdentificador("ESC123-3")      // → TiposIdentificadores.CODIGO_ESCUELA (3)
 * extraerTipoDeIdentificador("12345678-5")    // → Closes session (invalid type)
 * extraerTipoDeIdentificador("12345678")      // → TiposIdentificadores.DNI (compatibility)
 */
export function extraerTipoDeIdentificador(
  identificador: string
): TiposIdentificadores {
  // 🧹 Clean the identifier of whitespace
  const identificadorLimpio = identificador.trim();

  // 🔍 Case 1: 8-digit DNI without hyphen (backwards compatibility)
  if (/^\d{8}$/.test(identificadorLimpio)) {
    return TiposIdentificadores.DNI;
  }

  // 🔍 Case 2: Format with hyphen {identifier}-{type}
  const partesIdentificador = identificadorLimpio.split("-");

  // ❌ If it doesn't have a hyphen or has incorrect format, assume DNI for compatibility
  if (partesIdentificador.length !== 2) {
    return TiposIdentificadores.DNI;
  }

  // 📊 Extract the numeric type from the part after the hyphen
  const tipoNumerico = parseInt(partesIdentificador[1], 10);

  // ✅ Verify that the extracted type exists in the enum
  const tiposValidos = Object.values(TiposIdentificadores) as number[];

  if (tiposValidos.includes(tipoNumerico)) {
    return tipoNumerico as TiposIdentificadores;
  }

  // 🚨 INVALID TYPE: Close session for security
  console.error(
    `Invalid identifier type found: ${tipoNumerico} in identifier: ${identificador}`
  );

  // 🚪 Close session with error details
  logout(LogoutTypes.ERROR_DATOS_CORRUPTOS, {
    codigo: "INVALID_IDENTIFIER_TYPE",
    origen: "extraerTipoDeIdentificador",
    mensaje: `Invalid identifier type: ${tipoNumerico}`,
    timestamp: Date.now(),
    contexto: `Received identifier: ${identificador}`,
  });

  // This point will never be reached because logout redirects, but TypeScript requires it
  throw new Error("Session closed due to invalid identifier type");
}
