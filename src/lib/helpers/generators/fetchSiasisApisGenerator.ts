import { QueryParams } from "@/interfaces/shared/CustomObjects";
import { MethodHTTP } from "@/interfaces/MethodsHTTP";
import userStorage from "@/lib/utils/local/db/models/UserStorage";
import { logout } from "@/lib/utils/frontend/auth/logout";
import { FetchCancelable } from "@/lib/utils/FetchCancellable";
import { LogoutTypes } from "@/interfaces/LogoutTypes";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import { SiasisAPIsGetRandomInstanceFunctions } from "../functions/SiasisAPIsRandomFunctions";

interface FetchSiasisAPIs {
  endpoint: string;
  method: MethodHTTP;
  queryParams?: QueryParams;
  body?: BodyInit | string | null;
  JSONBody?: boolean;
  userAutheticated?: boolean;
}

interface FetchSiasisResult {
  fetchSiasisAPI: (
    config: FetchSiasisAPIs
  ) => Promise<FetchCancelable | undefined>;
  fetchCancelables: FetchCancelable[];
  cancelAllRequests: () => void;
}

/**
 * Generates functions to make requests to the system APIs
 * @param siasisAPI API to which requests will be made (API01 or API02)
 * @returns Object with functions to make requests and manage cancellations
 */
const fetchSiasisApiGenerator = (siasisAPI: SiasisAPIS): FetchSiasisResult => {
  const getRandomInstanceForAPI =
    SiasisAPIsGetRandomInstanceFunctions[siasisAPI];

  // Store the cancelable requests in a local variable
  let fetchCancelables: FetchCancelable[] = [];

  /**
   * Makes a request to the corresponding API
   */
  const fetchSiasisAPI = async ({
    JSONBody = true,
    body = null,
    endpoint,
    method = "GET",
    queryParams,
    userAutheticated = true,
  }: FetchSiasisAPIs): Promise<FetchCancelable | undefined> => {
    // Get token asynchronously if the user should be authenticated
    let token: string | null = null;

    if (userAutheticated && siasisAPI !== "SIU01 API") {
      try {
        token = await userStorage.getAuthToken();

        // If authentication is required but there's no token, logout
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

    // Prepare headers
    const headers: Record<string, string> = {};

    if (JSONBody) {
      headers["Content-Type"] = "application/json";
    }

    if (token && userAutheticated) {
      headers["Authorization"] = `Bearer ${token}`;
    }

    // Create the FetchCancelable instance
    const fetchCancelable = new FetchCancelable(
      `${getRandomInstanceForAPI()}${endpoint}`,
      {
        method,
        headers,
        body,
      },
      queryParams
    );

    // Register the instance to be able to cancel it later if necessary
    fetchCancelables.push(fetchCancelable);

    return fetchCancelable;
  };

  /**
   * Cancels all pending requests
   */
  const cancelAllRequests = () => {
    fetchCancelables.forEach((fetchCancelable) => fetchCancelable.cancel());
    fetchCancelables = [];
  };

  return { fetchSiasisAPI, fetchCancelables, cancelAllRequests };
};

export default fetchSiasisApiGenerator;
