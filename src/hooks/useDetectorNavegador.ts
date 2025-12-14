import { NavegadoresWeb } from "@/interfaces/shared/NavegadoresWeb";
import { detectarNavegadorWeb } from "@/lib/helpers/detectors/detectarNavegadorWeb";

/**
 * Hook personalizado para React que detecta el navegador
 * @returns {NavegadoresWeb} El tipo de navegador detectado
 */
export function useDetectorNavegador(): NavegadoresWeb {
  // Solo detectar en el cliente, no en el servidor
  if (typeof window === "undefined") {
    return NavegadoresWeb.Otro;
  }

  return detectarNavegadorWeb();
}
