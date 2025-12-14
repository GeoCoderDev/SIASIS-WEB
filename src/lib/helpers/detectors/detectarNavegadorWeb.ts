import { NavegadoresWeb } from "@/interfaces/shared/NavegadoresWeb";

/**
 * Detecta el navegador web actual basándose en el User Agent
 * @returns {NavegadoresWeb} El tipo de navegador detectado
 */
export function detectarNavegadorWeb(): NavegadoresWeb {
  // Verificar si estamos en un entorno del navegador
  if (typeof window === "undefined" || !window.navigator) {
    return NavegadoresWeb.Otro;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();

  // Detectar Edge (debe ir antes que Chrome porque Edge también contiene "chrome" en su UA)
  if (userAgent.includes("edg/") || userAgent.includes("edge/")) {
    return NavegadoresWeb.Edge;
  }

  // Detectar Chrome (debe ir después de Edge)
  if (userAgent.includes("chrome/") && !userAgent.includes("edg/")) {
    return NavegadoresWeb.Chrome;
  }

  // Detectar Firefox
  if (userAgent.includes("firefox/")) {
    return NavegadoresWeb.Firefox;
  }

  // Si no coincide con ninguno de los anteriores
  return NavegadoresWeb.Otro;
}

/**
 * Función que también proporciona información adicional del navegador
 * @returns {object} Objeto con el tipo de navegador y información adicional
 */
export function obtenerInfoNavegador() {
  const navegador = detectarNavegadorWeb();

  if (typeof window === "undefined" || !window.navigator) {
    return {
      navegador: NavegadoresWeb.Otro,
      userAgent: "",
      version: "",
      esMovil: false,
    };
  }

  const userAgent = window.navigator.userAgent;

  // Detectar si es móvil
  const esMovil =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    );

  // Intentar extraer la versión
  let version = "";
  switch (navegador) {
    case NavegadoresWeb.Chrome:
      const chromeMatch = userAgent.match(/chrome\/(\d+)/i);
      version = chromeMatch ? chromeMatch[1] : "";
      break;
    case NavegadoresWeb.Edge:
      const edgeMatch = userAgent.match(/edg\/(\d+)/i);
      version = edgeMatch ? edgeMatch[1] : "";
      break;
    case NavegadoresWeb.Firefox:
      const firefoxMatch = userAgent.match(/firefox\/(\d+)/i);
      version = firefoxMatch ? firefoxMatch[1] : "";
      break;
    default:
      version = "";
  }

  return {
    navegador,
    userAgent,
    version,
    esMovil,
  };
}
