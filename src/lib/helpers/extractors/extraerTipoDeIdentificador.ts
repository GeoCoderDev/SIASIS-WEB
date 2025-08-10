import { LogoutTypes } from "@/interfaces/LogoutTypes";
import { logout } from "@/lib/utils/frontend/auth/logout";

// 🏷️ Enum para los tipos de identificadores
export enum TiposIdentificadores {
  DNI = 1,
  CARNET_EXTRANJERIA = 2,
  CODIGO_ESCUELA = 3,
}

// 📝 Mapeo de tipos a textos descriptivos
export const TiposIdentificadoresTextos: Record<TiposIdentificadores, string> =
  {
    [TiposIdentificadores.DNI]: "DNI",
    [TiposIdentificadores.CARNET_EXTRANJERIA]: "Carnet de Extranjería",
    [TiposIdentificadores.CODIGO_ESCUELA]: "Código de Escuela",
  };

/**
 * 🔍 Función para extraer el tipo de identificador basándose en lo que viene después del guión
 * Si el tipo no existe o es inválido, cierra la sesión automáticamente
 *
 * @param identificador - Identificador en formato {identificador}-{tipo}
 * @returns TiposIdentificadores - El tipo de identificador válido
 *
 * @example
 * // Ejemplos de uso:
 * extraerTipoDeIdentificador("12345678-1")    // → TiposIdentificadores.DNI (1)
 * extraerTipoDeIdentificador("A123456-2")     // → TiposIdentificadores.CARNET_EXTRANJERIA (2)
 * extraerTipoDeIdentificador("ESC123-3")      // → TiposIdentificadores.CODIGO_ESCUELA (3)
 * extraerTipoDeIdentificador("12345678-5")    // → Cierra sesión (tipo inválido)
 * extraerTipoDeIdentificador("12345678")      // → TiposIdentificadores.DNI (compatibilidad)
 */
export function extraerTipoDeIdentificador(
  identificador: string
): TiposIdentificadores {
  // 🧹 Limpiar el identificador de espacios en blanco
  const identificadorLimpio = identificador.trim();

  // 🔍 Caso 1: DNI de 8 dígitos sin guión (compatibilidad hacia atrás)
  if (/^\d{8}$/.test(identificadorLimpio)) {
    return TiposIdentificadores.DNI;
  }

  // 🔍 Caso 2: Formato con guión {identificador}-{tipo}
  const partesIdentificador = identificadorLimpio.split("-");

  // ❌ Si no tiene guión o tiene formato incorrecto, asumir DNI por compatibilidad
  if (partesIdentificador.length !== 2) {
    return TiposIdentificadores.DNI;
  }

  // 📊 Extraer el tipo numérico de la parte después del guión
  const tipoNumerico = parseInt(partesIdentificador[1], 10);

  // ✅ Verificar que el tipo extraído existe en el enum
  const tiposValidos = Object.values(TiposIdentificadores) as number[];

  if (tiposValidos.includes(tipoNumerico)) {
    return tipoNumerico as TiposIdentificadores;
  }

  // 🚨 TIPO INVÁLIDO: Cerrar sesión por seguridad
  console.error(
    `Tipo de identificador inválido encontrado: ${tipoNumerico} en identificador: ${identificador}`
  );

  // 🚪 Cerrar sesión con detalles del error
  logout(LogoutTypes.ERROR_DATOS_CORRUPTOS, {
    codigo: "INVALID_IDENTIFIER_TYPE",
    origen: "extraerTipoDeIdentificador",
    mensaje: `Tipo de identificador inválido: ${tipoNumerico}`,
    timestamp: Date.now(),
    contexto: `Identificador recibido: ${identificador}`,
  });

  // Este punto nunca se alcanzará porque logout redirige, pero TypeScript lo requiere
  throw new Error("Sesión cerrada por tipo de identificador inválido");
}
