import { NavegadoresWeb } from "@/interfaces/shared/NavegadoresWeb";

/**
 * Detects the current web browser based on User Agent
 * @returns {NavegadoresWeb} The detected browser type
 */
export function detectarNavegadorWeb(): NavegadoresWeb {
  // Check if we're in a browser environment
  if (typeof window === "undefined" || !window.navigator) {
    return NavegadoresWeb.Otro;
  }

  const userAgent = window.navigator.userAgent.toLowerCase();

  // Detect Edge (must come before Chrome because Edge also contains "chrome" in its UA)
  if (userAgent.includes("edg/") || userAgent.includes("edge/")) {
    return NavegadoresWeb.Edge;
  }

  // Detect Chrome (must come after Edge)
  if (userAgent.includes("chrome/") && !userAgent.includes("edg/")) {
    return NavegadoresWeb.Chrome;
  }

  // Detect Firefox
  if (userAgent.includes("firefox/")) {
    return NavegadoresWeb.Firefox;
  }

  // If it doesn't match any of the above
  return NavegadoresWeb.Otro;
}

/**
 * Function that also provides additional browser information
 * @returns {object} Object with browser type and additional information
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

  // Detect if it's mobile
  const esMovil =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      userAgent
    );

  // Try to extract the version
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
