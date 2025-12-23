import { LogoutTypes, ErrorDetailsForLogout } from "@/interfaces/LogoutTypes";

import { formatErrorDetailsForUrl } from "@/lib/helpers/parsers/errorDetailsInURL";

/**
* Cierra la sesión del usuario y redirige a la página de login @param logoutType Tipo de cierre de sesión @param errorDetails Detalles adicionales del error para debugging
*/
export const logout = async (
  logoutType: LogoutTypes = LogoutTypes.DECISION_USUARIO,
  errorDetails?: ErrorDetailsForLogout
): Promise<void> => {
  try {
    // //ntentar cerrar sesión en el servidor
    await fetch("/api/auth/close", { method: "DELETE" });

    // // Limpiar almanamiento local
    localStorage.clear();
    const { default: userStorage } = await import(
      "@/lib/utils/local/db/models/UserStorage"
    );
    await userStorage.clearUserData();

    // //nstruir URL de redirección
    let redirectUrl = "/login";

    // // Agregar parámetros sno es cierre voluntario
    if (logoutType !== LogoutTypes.DECISION_USUARIO) {
      redirectUrl += `?LOGOUT_TYPE=${logoutType}`;

      // // Agregar detalles de error si esn disponibles
      if (errorDetails) {
        redirectUrl += `&ERROR_DETAILS=${formatErrorDetailsForUrl(
          errorDetails
        )}`;
      }
    }

    // // Redirigir al usuariondow.location.href = redirectUrl;
  } catch (error) {
    console.error("Error durante el cierre de sesión:", error);

    // //n caso de error en el proceso de cierre, forzar redirección
    window.location.href = `/login?LOGOUT_TYPE=${LogoutTypes.ERROR_SISTEMA}`;
  }
};
