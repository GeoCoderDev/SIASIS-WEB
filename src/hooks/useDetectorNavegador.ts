import { NavegadoresWeb } from "@/interfaces/shared/NavegadoresWeb";
import { detectarNavegadorWeb } from "@/lib/helpers/detectors/detectarNavegadorWeb";

/**
 * Custom React hook that detects the browser
 * @returns {NavegadoresWeb} The detected browser type
 */
export function useBrowserDetector(): NavegadoresWeb {
  // Only detect on the client, not on the server
  if (typeof window === "undefined") {
    return NavegadoresWeb.Otro;
  }

  return detectarNavegadorWeb();
}