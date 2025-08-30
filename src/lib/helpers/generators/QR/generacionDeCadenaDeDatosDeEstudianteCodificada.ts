import { ENTORNO } from "@/constants/ENTORNO";
import { NOMBRE_INSTITUCION } from "@/constants/NOMBRE_INSITITUCION";
import { NOMBRE_ACTUAL_SISTEMA } from "@/constants/NOMBRE_SISTEMA";
import { Entorno } from "@/interfaces/shared/Entornos";
import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { TiposIdentificadores } from "@/interfaces/shared/TiposIdentificadores";
import CryptoJS from "crypto-js";

// 🔧 Constantes de configuración
const VALIDAR_NOMBRE_SISTEMA = false;
const VALIDAR_INSTITUCION = true;
const VALIDAR_AÑO = true;
const VALIDAR_TIPO_IDENTIFICADOR = true;

const MOSTRAR_LOGS = ENTORNO !== Entorno.PRODUCCION;

// 📝 Función auxiliar para logs condicionales
function log(...args: any[]): void {
  if (MOSTRAR_LOGS) {
    console.log(...args);
  }
}

function logError(...args: any[]): void {
  if (MOSTRAR_LOGS) {
    console.error(...args);
  }
}

function logWarn(...args: any[]): void {
  if (MOSTRAR_LOGS) {
    console.warn(...args);
  }
}

// 🎯 Función para crear hash de verificación
function crearHashCompacto(datos: string): string {
  const secreto =
    process.env.NEXT_PUBLIC_ENCRIPTACION_CADENAS_DE_DATOS_PARA_QR_KEY;
  if (!secreto) {
    throw new Error(
      "Variable de entorno NEXT_PUBLIC_ENCRIPTACION_CADENAS_DE_DATOS_PARA_QR_KEY no encontrada"
    );
  }
  return CryptoJS.SHA256(datos + secreto)
    .toString()
    .substring(0, 8);
}

// 🔍 Función para verificar hash
function verificarHash(datos: string, hashEsperado: string): boolean {
  try {
    return crearHashCompacto(datos) === hashEsperado;
  } catch {
    return false;
  }
}

// 🗜️ Función para comprimir datos
function comprimirDatos(
  sistema: string,
  institucion: string,
  nivel: string,
  grado: number,
  identificador: string,
  tipoIdentificador: number,
  año: number
): string {
  const sistemaCode = sistema === NOMBRE_ACTUAL_SISTEMA ? "A" : "X";
  const institucionCode = institucion === NOMBRE_INSTITUCION ? "I" : "X";
  const nivelCode =
    nivel === "PRIMARIA" || nivel === "P"
      ? "P"
      : nivel === "SECUNDARIA" || nivel === "S"
      ? "S"
      : "X";
  const añoCode = (año % 100).toString().padStart(2, "0");

  return `${sistemaCode}${institucionCode}${nivelCode}${grado}${tipoIdentificador}${añoCode}${identificador}`;
}

// 🔄 Función para descomprimir datos
function descomprimirDatos(datosComprimidos: string): {
  sistema: string;
  institucion: string;
  nivel: NivelEducativo;
  grado: number;
  identificador: string;
  tipoIdentificador: number;
  año: number;
} | null {
  try {
    if (datosComprimidos.length < 7) return null;

    const sistemaCode = datosComprimidos[0];
    const institucionCode = datosComprimidos[1];
    const nivelCode = datosComprimidos[2];
    const gradoStr = datosComprimidos[3];
    const tipoIdentificadorStr = datosComprimidos[4];
    const añoStr = datosComprimidos.substring(5, 7);
    const identificador = datosComprimidos.substring(7);

    const sistema = sistemaCode === "A" ? NOMBRE_ACTUAL_SISTEMA : "DESCONOCIDO";
    const institucion =
      institucionCode === "I" ? NOMBRE_INSTITUCION : "DESCONOCIDA";

    let nivel: string;
    if (nivelCode === "P") {
      nivel = "P";
    } else if (nivelCode === "S") {
      nivel = "S";
    } else {
      logError(`❌ Nivel inválido: '${nivelCode}'`);
      return null;
    }

    const grado = parseInt(gradoStr);
    if (isNaN(grado) || grado < 1 || grado > 6) {
      logError(`❌ Grado inválido: '${gradoStr}'`);
      return null;
    }

    const tipoIdentificador = parseInt(tipoIdentificadorStr);
    if (
      isNaN(tipoIdentificador) ||
      tipoIdentificador < 1 ||
      tipoIdentificador > 3
    ) {
      logError(`❌ Tipo identificador inválido: '${tipoIdentificadorStr}'`);
      return null;
    }

    const añoCorto = parseInt(añoStr);
    if (isNaN(añoCorto)) {
      logError(`❌ Año inválido: '${añoStr}'`);
      return null;
    }
    const año = 2000 + añoCorto;

    if (!identificador || identificador.length === 0) {
      logError(`❌ Identificador vacío`);
      return null;
    }

    log(`✅ Datos decodificados:`, {
      sistema,
      institucion,
      nivel,
      grado,
      identificador,
      tipoIdentificador,
      año,
    });

    return {
      sistema,
      institucion,
      nivel: nivel as NivelEducativo,
      grado,
      identificador,
      tipoIdentificador,
      año,
    };
  } catch (error) {
    logError(`❌ Error en descompresión:`, error);
    return null;
  }
}

// 🔗 Funciones de codificación Base62
function codificarBase62(numero: bigint): string {
  const alfabeto =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  if (numero === 0n) return "0";

  let resultado = "";
  let num = numero;
  while (num > 0) {
    resultado = alfabeto[Number(num % 62n)] + resultado;
    num = num / 62n;
  }
  return resultado;
}

function decodificarBase62(texto: string): bigint {
  const alfabeto =
    "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
  let resultado = 0n;
  for (let i = 0; i < texto.length; i++) {
    const charIndex = alfabeto.indexOf(texto[i]);
    if (charIndex === -1) throw new Error("Carácter inválido en Base62");
    resultado = resultado * 62n + BigInt(charIndex);
  }
  return resultado;
}

function stringANumero(str: string): bigint {
  let resultado = 0n;
  for (let i = 0; i < str.length; i++) {
    resultado = resultado * 256n + BigInt(str.charCodeAt(i));
  }
  return resultado;
}

function numeroAString(num: bigint): string {
  if (num === 0n) return "";
  const bytes: number[] = [];
  let numero = num;
  while (numero > 0) {
    bytes.unshift(Number(numero % 256n));
    numero = numero / 256n;
  }
  return String.fromCharCode(...bytes);
}

// 🏷️ Función para normalizar ID del estudiante
function normalizarIdEstudiante(idEstudiante: string): string {
  return !idEstudiante.includes("-")
    ? `${idEstudiante}-${TiposIdentificadores.DNI}`
    : idEstudiante;
}

// 🎯 Función principal para generar QR
export function generarCadenaDeDatosDeEstudianteCodificada(
  estudiante: EstudianteConAulaYRelacion
): string {
  if (!estudiante.aula) {
    throw new Error("El estudiante no tiene aula asignada");
  }

  const añoActual = new Date().getFullYear();
  const identificadorNormalizado = normalizarIdEstudiante(
    estudiante.Id_Estudiante
  );
  const [identificador, tipoIdentificador] =
    identificadorNormalizado.split("-");

  log("📝 Datos originales:", {
    sistema: NOMBRE_ACTUAL_SISTEMA,
    institucion: NOMBRE_INSTITUCION,
    nivel: estudiante.aula.Nivel,
    grado: estudiante.aula.Grado,
    identificador,
    tipoIdentificador: parseInt(tipoIdentificador),
    año: añoActual,
  });

  const datosComprimidos = comprimirDatos(
    NOMBRE_ACTUAL_SISTEMA,
    NOMBRE_INSTITUCION,
    estudiante.aula.Nivel,
    estudiante.aula.Grado,
    identificador,
    parseInt(tipoIdentificador),
    añoActual
  );
  log("🗜️ Datos comprimidos:", datosComprimidos);

  const hashVerificacion = crearHashCompacto(datosComprimidos);
  log("🔐 Hash de verificación:", hashVerificacion);

  const datosCombinados = datosComprimidos + hashVerificacion;
  log("🔗 Datos combinados:", datosCombinados);

  const numero = stringANumero(datosCombinados);
  const resultado = codificarBase62(numero);

  log("✅ Resultado final:", resultado, `(${resultado.length} caracteres)`);

  if (resultado.length > 20) {
    logWarn("⚠️ El QR resultó más largo de 20 caracteres.");
  }

  return resultado;
}

// 🔍 Interfaz para resultado de decodificación
interface ResultadoDecodificacion {
  exito: boolean;
  identificadorEstudiante?: string;
  datosDecodificados?: {
    sistema: string;
    institucion: string;
    nivel: NivelEducativo;
    grado: number;
    identificador: string;
    tipoIdentificador: number;
    año: number;
  };
  error?: string;
}

// 🔍 Función para decodificar QR - VERSIÓN MEJORADA SIN THROWS
export function decodificarCadenaQREstudiante(
  cadenaQR: string
): ResultadoDecodificacion {
  try {
    log("🔍 Iniciando decodificación de:", cadenaQR);

    // Validación básica de entrada
    if (!cadenaQR || cadenaQR.trim().length === 0) {
      logError("💥 Error: Cadena QR vacía");
      return {
        exito: false,
        error: "Código QR no válido",
      };
    }

    let numero: bigint;
    try {
      numero = decodificarBase62(cadenaQR);
      log("🔢 Número decodificado:", numero.toString());
    } catch (error) {
      logError("💥 Error en decodificación Base62:", error);
      return {
        exito: false,
        error: "Código QR no válido",
      };
    }

    let datosCombinados: string;
    try {
      datosCombinados = numeroAString(numero);
      log("🔗 Datos combinados recuperados:", datosCombinados);
    } catch (error) {
      logError("💥 Error al convertir número a string:", error);
      return {
        exito: false,
        error: "Código QR no válido",
      };
    }

    if (datosCombinados.length < 9) {
      logError(
        "💥 Error: QR demasiado corto, longitud:",
        datosCombinados.length
      );
      return {
        exito: false,
        error: "Código QR no válido",
      };
    }

    const hashRecibido = datosCombinados.slice(-8);
    const datosComprimidos = datosCombinados.slice(0, -8);

    log("🔐 Hash recibido:", hashRecibido);
    log("🗜️ Datos comprimidos recuperados:", datosComprimidos);

    if (!verificarHash(datosComprimidos, hashRecibido)) {
      logError("💥 Error: Hash inválido - verificación de integridad fallida");
      return {
        exito: false,
        error: "Código QR no válido",
      };
    }

    log("✅ Hash verificado correctamente");

    const datosDescomprimidos = descomprimirDatos(datosComprimidos);
    if (!datosDescomprimidos) {
      logError("💥 Error: No se pudieron descomprimir los datos");
      return {
        exito: false,
        error: "Código QR no válido",
      };
    }

    log("📊 Datos descomprimidos:", datosDescomprimidos);

    // Validaciones con mensajes específicos y amigables
    const añoActual = new Date().getFullYear();

    if (
      VALIDAR_NOMBRE_SISTEMA &&
      datosDescomprimidos.sistema !== NOMBRE_ACTUAL_SISTEMA
    ) {
      logError(
        `💥 Error: Sistema incorrecto. Esperado: ${NOMBRE_ACTUAL_SISTEMA}, Recibido: ${datosDescomprimidos.sistema}`
      );
      return {
        exito: false,
        error:
          "Genera nuevamente el QR puesto que el nombre del sistema cambió",
      };
    }

    if (
      VALIDAR_INSTITUCION &&
      datosDescomprimidos.institucion !== NOMBRE_INSTITUCION
    ) {
      logError(
        `💥 Error: Institución incorrecta. Esperado: ${NOMBRE_INSTITUCION}, Recibido: ${datosDescomprimidos.institucion}`
      );
      return {
        exito: false,
        error: "Este código QR no pertenece a esta institución",
      };
    }

    if (VALIDAR_AÑO && datosDescomprimidos.año !== añoActual) {
      logError(
        `💥 Error: Año incorrecto. Esperado: ${añoActual}, Recibido: ${datosDescomprimidos.año}`
      );
      return {
        exito: false,
        error: `Este código QR pertenece al año ${datosDescomprimidos.año}, debe ser del año actual ${añoActual}`,
      };
    }

    if (
      VALIDAR_TIPO_IDENTIFICADOR &&
      !Object.values(TiposIdentificadores).includes(
        datosDescomprimidos.tipoIdentificador
      )
    ) {
      logError(
        `💥 Error: Tipo de identificador inválido: ${datosDescomprimidos.tipoIdentificador}`
      );
      return {
        exito: false,
        error: "Código QR no válido",
      };
    }

    if (
      datosDescomprimidos.nivel !== "P" &&
      datosDescomprimidos.nivel !== "S"
    ) {
      logError(
        `💥 Error: Nivel educativo inválido: ${datosDescomprimidos.nivel}`
      );
      return {
        exito: false,
        error: "Código QR no válido",
      };
    }

    const identificadorEstudiante = `${datosDescomprimidos.identificador}-${datosDescomprimidos.tipoIdentificador}`;

    log("✅ Decodificación exitosa:", identificadorEstudiante);
    return {
      exito: true,
      identificadorEstudiante,
      datosDecodificados: datosDescomprimidos,
      error: undefined, // Explícitamente undefined para éxito
    };
  } catch (error) {
    logError("💥 Error inesperado durante decodificación:", error);
    return {
      exito: false,
      error: "Código QR no válido",
    };
  }
}
