import { LogoutTypes, ErrorDetailsForLogout } from "@/interfaces/LogoutTypes";

import { formatErrorDetailsForUrl } from "@/lib/helpers/parsers/errorDetailsInURL";

/**
 * Closes the user session and redirects to the login page
 * @param logoutType Type of logout
 * @param errorDetails Additional error details for debugging
 */
export const logout = async (
  logoutType: LogoutTypes = LogoutTypes.DECISION_USUARIO,
  errorDetails?: ErrorDetailsForLogout
): Promise<void> => {
  try {
    // Try to close session on the server
    await fetch("/api/auth/close", { method: "DELETE" });

    // Clear local storage
    localStorage.clear();
    const { default: userStorage } = await import(
      "@/lib/utils/local/db/models/UserStorage"
    );
    await userStorage.clearUserData();

    // Build redirect URL
    let redirectUrl = "/login";

    // Add parameters if not a voluntary logout
    if (logoutType !== LogoutTypes.DECISION_USUARIO) {
      redirectUrl += `?LOGOUT_TYPE=${logoutType}`;

      // Add error details if available
      if (errorDetails) {
        redirectUrl += `&ERROR_DETAILS=${formatErrorDetailsForUrl(
          errorDetails
        )}`;
      }
    }

    // Redirect the user
    window.location.href = redirectUrl;
  } catch (error) {
    console.error("Error during logout:", error);

    // In case of error in the logout process, force redirect
    window.location.href = `/login?LOGOUT_TYPE=${LogoutTypes.ERROR_SISTEMA}`;
  }
};
