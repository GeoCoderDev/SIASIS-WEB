import { ENTORNO } from "@/constants/ENTORNO";
import { NOMBRE_INSTITUCION } from "@/constants/NOMBRE_INSITITUCION";
import { NOMBRE_ACTUAL_SISTEMA } from "@/constants/NOMBRE_SISTEMA";
import { Entorno } from "@/interfaces/shared/Entornos";
import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { TiposIdentificadores } from "@/interfaces/shared/TiposIdentificadores";
import CryptoJS from "crypto-js";

// 🔧 Configuration constants
const VALIDAR_NOMBRE_SISTEMA = false;
const VALIDAR_INSTITUCION = true;
const VALIDAR_AÑO = true;
const VALIDAR_TIPO_IDENTIFICADOR = true;

const MOSTRAR_LOGS = ENTORNO !== Entorno.PRODUCCION;

// 📝 Auxiliary function for conditional logs
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

// 🎯 Function to create compact hash for verification
function crearHashCompacto(datos: string): string {
  const secreto =
    process.env.NEXT_PUBLIC_ENCRIPTACION_CADENAS_DE_DATOS_PARA_QR_KEY;
  if (!secreto) {
    throw new Error(
      "Environment variable NEXT_PUBLIC_ENCRIPTACION_CADENAS_DE_DATOS_PARA_QR_KEY not found"
    );
  }
  return CryptoJS.SHA256(datos + secreto)
    .toString()
    .substring(0, 8);
}

// 🔍 Function to verify hash
function verificarHash(datos: string, hashEsperado: string): boolean {
  try {
    return crearHashCompacto(datos) === hashEsperado;
  } catch {
    return false;
  }
}

// 🗜️ Function to compress data
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

// 🔄 Function to decompress data
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

    const sistema = sistemaCode === "A" ? NOMBRE_ACTUAL_SISTEMA : "UNKNOWN";
    const institucion =
      institucionCode === "I" ? NOMBRE_INSTITUCION : "UNKNOWN";

    let nivel: string;
    if (nivelCode === "P") {
      nivel = "P";
    } else if (nivelCode === "S") {
      nivel = "S";
    } else {
      logError(`❌ Invalid level: '${nivelCode}'`);
      return null;
    }

    const grado = parseInt(gradoStr);
    if (isNaN(grado) || grado < 1 || grado > 6) {
      logError(`❌ Invalid grade: '${gradoStr}'`);
      return null;
    }

    const tipoIdentificador = parseInt(tipoIdentificadorStr);
    if (
      isNaN(tipoIdentificador) ||
      tipoIdentificador < 1 ||
      tipoIdentificador > 3
    ) {
      logError(`❌ Invalid identifier type: '${tipoIdentificadorStr}'`);
      return null;
    }

    const añoCorto = parseInt(añoStr);
    if (isNaN(añoCorto)) {
      logError(`❌ Invalid year: '${añoStr}'`);
      return null;
    }
    const año = 2000 + añoCorto;

    if (!identificador || identificador.length === 0) {
      logError(`❌ Empty identifier`);
      return null;
    }

    log(`✅ Decoded data:`, {
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
    logError(`❌ Decompression error:`, error);
    return null;
  }
}

// 🔗 Base62 encoding functions
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
    if (charIndex === -1) throw new Error("Invalid character in Base62");
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

// 🏷️ Function to normalize student ID
function normalizarIdEstudiante(idEstudiante: string): string {
  return !idEstudiante.includes("-")
    ? `${idEstudiante}-${TiposIdentificadores.DNI}`
    : idEstudiante;
}

// 🎯 Main function to generate QR
export function generarCadenaDeDatosDeEstudianteCodificada(
  estudiante: EstudianteConAulaYRelacion
): string {
  if (!estudiante.aula) {
    throw new Error("The student does not have an assigned classroom");
  }

  const añoActual = new Date().getFullYear();
  const identificadorNormalizado = normalizarIdEstudiante(
    estudiante.Id_Estudiante
  );
  const [identificador, tipoIdentificador] =
    identificadorNormalizado.split("-");

  log("📝 Original data:", {
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
  log("🗜️ Compressed data:", datosComprimidos);

  const hashVerificacion = crearHashCompacto(datosComprimidos);
  log("🔐 Verification hash:", hashVerificacion);

  const datosCombinados = datosComprimidos + hashVerificacion;
  log("🔗 Combined data:", datosCombinados);

  const numero = stringANumero(datosCombinados);
  const resultado = codificarBase62(numero);

  log("✅ Final result:", resultado, `(${resultado.length} characters)`);

  if (resultado.length > 20) {
    logWarn("⚠️ The QR resulted in more than 20 characters.");
  }

  return resultado;
}

// 🔍 Interface for decoding result
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

// 🔍 Function to decode QR - IMPROVED VERSION WITHOUT THROWS
export function decodificarCadenaQREstudiante(
  cadenaQR: string
): ResultadoDecodificacion {
  try {
    log("🔍 Starting decoding of:", cadenaQR);

    // Basic input validation
    if (!cadenaQR || cadenaQR.trim().length === 0) {
      logError("💥 Error: Empty QR string");
      return {
        exito: false,
        error: "Invalid QR code",
      };
    }

    let numero: bigint;
    try {
      numero = decodificarBase62(cadenaQR);
      log("🔢 Decoded number:", numero.toString());
    } catch (error) {
      logError("💥 Error in Base62 decoding:", error);
      return {
        exito: false,
        error: "Invalid QR code",
      };
    }

    let datosCombinados: string;
    try {
      datosCombinados = numeroAString(numero);
      log("🔗 Recovered combined data:", datosCombinados);
    } catch (error) {
      logError("💥 Error converting number to string:", error);
      return {
        exito: false,
        error: "Invalid QR code",
      };
    }

    if (datosCombinados.length < 9) {
      logError(
        "💥 Error: QR too short, length:",
        datosCombinados.length
      );
      return {
        exito: false,
        error: "Invalid QR code",
      };
    }

    const hashRecibido = datosCombinados.slice(-8);
    const datosComprimidos = datosCombinados.slice(0, -8);

    log("🔐 Received hash:", hashRecibido);
    log("🗜️ Recovered compressed data:", datosComprimidos);

    if (!verificarHash(datosComprimidos, hashRecibido)) {
      logError("💥 Error: Invalid hash - integrity verification failed");
      return {
        exito: false,
        error: "Invalid QR code",
      };
    }

    log("✅ Hash verified correctly");

    const datosDescomprimidos = descomprimirDatos(datosComprimidos);
    if (!datosDescomprimidos) {
      logError("💥 Error: Could not decompress data");
      return {
        exito: false,
        error: "Invalid QR code",
      };
    }

    log("📊 Decompressed data:", datosDescomprimidos);

    // Validations with specific and friendly messages
    const añoActual = new Date().getFullYear();

    if (
      VALIDAR_NOMBRE_SISTEMA &&
      datosDescomprimidos.sistema !== NOMBRE_ACTUAL_SISTEMA
    ) {
      logError(
        `💥 Error: Incorrect system. Expected: ${NOMBRE_ACTUAL_SISTEMA}, Received: ${datosDescomprimidos.sistema}`
      );
      return {
        exito: false,
        error:
          "Generate the QR again as the system name changed",
      };
    }

    if (
      VALIDAR_INSTITUCION &&
      datosDescomprimidos.institucion !== NOMBRE_INSTITUCION
    ) {
      logError(
        `💥 Error: Incorrect institution. Expected: ${NOMBRE_INSTITUCION}, Received: ${datosDescomprimidos.institucion}`
      );
      return {
        exito: false,
        error: "This QR code does not belong to this institution",
      };
    }

    if (VALIDAR_AÑO && datosDescomprimidos.año !== añoActual) {
      logError(
        `💥 Error: Incorrect year. Expected: ${añoActual}, Received: ${datosDescomprimidos.año}`
      );
      return {
        exito: false,
        error: `This QR code belongs to year ${datosDescomprimidos.año}, it must be from current year ${añoActual}`,
      };
    }

    if (
      VALIDAR_TIPO_IDENTIFICADOR &&
      !Object.values(TiposIdentificadores).includes(
        datosDescomprimidos.tipoIdentificador
      )
    ) {
      logError(
        `💥 Error: Invalid identifier type: ${datosDescomprimidos.tipoIdentificador}`
      );
      return {
        exito: false,
        error: "Invalid QR code",
      };
    }

    if (
      datosDescomprimidos.nivel !== "P" &&
      datosDescomprimidos.nivel !== "S"
    ) {
      logError(
        `💥 Error: Invalid educational level: ${datosDescomprimidos.nivel}`
      );
      return {
        exito: false,
        error: "Invalid QR code",
      };
    }

    const identificadorEstudiante = `${datosDescomprimidos.identificador}-${datosDescomprimidos.tipoIdentificador}`;

    log("✅ Successful decoding:", identificadorEstudiante);
    return {
      exito: true,
      identificadorEstudiante,
      datosDecodificados: datosDescomprimidos,
      error: undefined, // Explicitly undefined for success
    };
  } catch (error) {
    logError("💥 Unexpected error during decoding:", error);
    return {
      exito: false,
      error: "Invalid QR code",
    };
  }
}