import { useState, useCallback } from "react";
import { QueryParams } from "@/interfaces/shared/CustomObjects";
import { MethodHTTP } from "@/interfaces/MethodsHTTP";

import { logout } from "@/lib/utils/frontend/auth/logout";
import { FetchCancelable } from "@/lib/utils/FetchCancellable";
import { LogoutTypes } from "@/interfaces/LogoutTypes";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { SiasisAPIsGetRandomInstanceFunctions } from "@/lib/helpers/functions/SiasisAPIsRandomFunctions";

interface FetchSiasisAPIs {
  endpoint: string;
  method: MethodHTTP;
  queryParams?: QueryParams;
  body?: BodyInit | string | null;
  JSONBody?: boolean;
  userAutheticated?: boolean;
}

/**
 * Este hook recibe 2 parametros, el primero es la api a usar
 * @param siasisAPI
 * @param loggedUserRolForAPI01
 * @returns
 */
const useSiasisAPIs = (
  siasisAPI: SiasisAPIS,
  loggedUserRolForAPI01?: RolesSistema
) => {
  const getRandomInstanceForAPI =
    SiasisAPIsGetRandomInstanceFunctions[siasisAPI];

  const [fetchCancelables, setFetchCancelables] = useState<FetchCancelable[]>(
    []
  );

  const fetchSiasisAPI = useCallback(
    async ({
      JSONBody = true,
      body = null,
      endpoint,
      method = "GET",
      queryParams,
      userAutheticated = true,
    }: FetchSiasisAPIs) => {
      // Obtener token de manera asíncrona si el usuario debe estar autenticado
      let token: string | null = null;

      if (userAutheticated) {
        try {
          const { default: userStorage } = await import(
            "@/lib/utils/local/db/models/UserStorage"
          );
          token = await userStorage.getAuthToken();

          // Si se requiere autenticación pero no hay token, hacer logout
          if (!token) {
            logout(LogoutTypes.SESION_EXPIRADA);
            return;
          }
        } catch (error) {
          console.error("Error al obtener el token:", error);
          logout(LogoutTypes.ERROR_SISTEMA);
          return;
        }
      }

      // Preparar headers
      const headers: Record<string, string> = {};

      if (JSONBody) {
        headers["Content-Type"] = "application/json";
      }

      if (token && userAutheticated) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      // Crear la instancia FetchCancelable
      const fetchCancelable = new FetchCancelable(
        `${getRandomInstanceForAPI()}${endpoint}`,
        {
          method,
          headers,
          body,
        },
        queryParams
      );

      // Registrar la instancia para poder cancelarla posteriormente si es necesario
      setFetchCancelables((prev) => [...prev, fetchCancelable]);

      return fetchCancelable;
    },
    [getRandomInstanceForAPI]
  );

  // Función para cancelar todas las peticiones pendientes
  const cancelAllRequests = useCallback(() => {
    fetchCancelables.forEach((fetchCancelable) => fetchCancelable.cancel());
    setFetchCancelables([]);
  }, [fetchCancelables]);

  return { fetchSiasisAPI, fetchCancelables, cancelAllRequests };
};

export default useSiasisAPIs;
