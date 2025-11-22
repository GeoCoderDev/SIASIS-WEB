import { MethodHTTP } from "@/interfaces/MethodsHTTP";
import {
  ErrorResponseAPIBase,
  SuccessResponseAPIBase,
} from "@/interfaces/shared/apis/types";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import { CustomApiError } from "@/lib/errors/custom/ApiError";

// ============================================
// ADVANCED UTILITY TYPES
// ============================================

type ExtractorDeParametrosDeRuta<T extends string> =
  T extends `${infer Start}/:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ExtractorDeParametrosDeRuta<`/${Rest}`>
    : T extends `${infer Start}/:${infer Param}`
    ? { [K in Param]: string }
    : T extends `/${infer Rest}`
    ? ExtractorDeParametrosDeRuta<Rest>
    : {};

// Check if an object is empty
type IsEmptyObject<T> = keyof T extends never ? true : false;

// Extract required fields from an interface
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

// Check if there are required fields
type HasRequiredFields<T> = RequiredKeys<T> extends never ? false : true;

// Make queryParams optional only if all fields are optional
type ConditionalQueryParams<TQuery> = HasRequiredFields<TQuery> extends true
  ? { queryParams: TQuery } // Required if there are required fields
  : { queryParams?: TQuery }; // Optional if all are optional

// Check if both routeParams and queryParams are optional
type BothParamsOptional<TRoute extends string, TQuery> = IsEmptyObject<
  ExtractorDeParametrosDeRuta<TRoute>
> extends true
  ? HasRequiredFields<TQuery> extends true
    ? false // queryParams is required
    : true // Both are optional
  : false; // routeParams is required

// Improved conditional parameters
type GetFullPathParams<TRoute extends string, TQuery> = BothParamsOptional<
  TRoute,
  TQuery
> extends true
  ? [
      params?: {
        routeParams?: ExtractorDeParametrosDeRuta<TRoute>;
        queryParams?: TQuery;
      }
    ] // Completely optional
  : IsEmptyObject<ExtractorDeParametrosDeRuta<TRoute>> extends true
  ? [params: ConditionalQueryParams<TQuery>] // Only queryParams
  : HasRequiredFields<TQuery> extends true
  ? [
      params: {
        routeParams: ExtractorDeParametrosDeRuta<TRoute>;
        queryParams: TQuery;
      }
    ] // Both required
  : [
      params: {
        routeParams: ExtractorDeParametrosDeRuta<TRoute>;
        queryParams?: TQuery;
      }
    ]; // routeParams required, queryParams optional

// Make body conditional based on whether it has required fields
type ConditionalBody<TBody> = HasRequiredFields<TBody> extends true
  ? { body: TBody } // Required if there are required fields
  : keyof TBody extends never
  ? {} // No body if it's an empty object
  : { body?: TBody }; // Optional if all fields are optional

// Check if all parameters are optional (CORRECTED)
type AllParamsOptional<TRoute extends string, TQuery, TBody> = IsEmptyObject<
  ExtractorDeParametrosDeRuta<TRoute>
> extends true
  ? HasRequiredFields<TQuery> extends true
    ? false // queryParams is required
    : HasRequiredFields<TBody> extends true
    ? false // body is required - THIS IS IMPORTANT
    : keyof TBody extends never
    ? true // No body and everything is optional
    : true // Body exists but all its fields are optional
  : false; // routeParams is required

// Parameters for realizarPeticion (CORRECTED - body is always evaluated)
type RealizarPeticionParams<TRoute extends string, TQuery, TBody> =
  // If there are required fields in body, always include body as required
  HasRequiredFields<TBody> extends true
    ? IsEmptyObject<ExtractorDeParametrosDeRuta<TRoute>> extends true
      ? HasRequiredFields<TQuery> extends true
        ? [params: { queryParams: TQuery; body: TBody }] // queryParams + body required
        : [params: { body: TBody; queryParams?: TQuery }] // body required, queryParams optional
      : HasRequiredFields<TQuery> extends true
      ? [
          params: {
            routeParams: ExtractorDeParametrosDeRuta<TRoute>;
            queryParams: TQuery;
            body: TBody;
          }
        ] // All required
      : [
          params: {
            routeParams: ExtractorDeParametrosDeRuta<TRoute>;
            body: TBody;
            queryParams?: TQuery;
          }
        ] // routeParams + body required, queryParams optional
    : // If body doesn't have required fields, use the previous logic
    AllParamsOptional<TRoute, TQuery, TBody> extends true
    ? [
        params?: {
          routeParams?: ExtractorDeParametrosDeRuta<TRoute>;
          queryParams?: TQuery;
        } & ConditionalBody<TBody>
      ] // Completely optional
    : IsEmptyObject<ExtractorDeParametrosDeRuta<TRoute>> extends true
    ? HasRequiredFields<TQuery> extends true
      ? [params: { queryParams: TQuery } & ConditionalBody<TBody>] // queryParams required
      : [params?: { queryParams?: TQuery } & ConditionalBody<TBody>] // queryParams optional
    : HasRequiredFields<TQuery> extends true
    ? [
        params: {
          routeParams: ExtractorDeParametrosDeRuta<TRoute>;
          queryParams: TQuery;
        } & ConditionalBody<TBody>
      ] // routeParams + queryParams required
    : [
        params: {
          routeParams: ExtractorDeParametrosDeRuta<TRoute>;
          queryParams?: TQuery;
        } & ConditionalBody<TBody>
      ]; // routeParams required, queryParams optional

// ============================================
// INTERFACES
// ============================================

export interface EndpointSiasisParams<
  TRoute extends string,
  TQuery,
  TBody,
  TResponse
> {
  siasisApi: SiasisAPIS;
  metodoHttp: MethodHTTP;
  ruta: TRoute;
  queryParamsFormatter?: (params: TQuery) => string;
}

export interface RutaEndpointSiasis {
  siasisAPI: SiasisAPIS;
  metodoHttp: MethodHTTP;
  rutaCompleta: string;
}

export interface ApiSuccessResponse<T = any> extends SuccessResponseAPIBase {
  success: true;
  data: T;
}

export interface ApiErrorResponse extends ErrorResponseAPIBase {
  success: false;
  error?: string;
  details?: any;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

// Interface for fetchSiasisAPI (based on your example)
interface FetchSiasisAPIParams {
  endpoint: string;
  method: MethodHTTP;
  body?: any;
  headers?: Record<string, string>;
}

interface FetchCancelable {
  fetch(): Promise<Response>;
  cancel(): void;
}

// ============================================
// CLASS WITH COMPLETE realizarPeticion METHOD
// ============================================

export class EndpointSiasis<
  TRoute extends string,
  TResponse = any,
  TQuery = {},
  TBody = {}
> {
  private siasisApi: SiasisAPIS;
  private metodoHttp: MethodHTTP;
  private ruta: TRoute;
  private queryParamsFormatter?: (params: TQuery) => string;

  constructor({
    siasisApi,
    metodoHttp,
    ruta,
    queryParamsFormatter,
  }: EndpointSiasisParams<TRoute, TQuery, TBody, TResponse>) {
    this.siasisApi = siasisApi;
    this.metodoHttp = metodoHttp;
    this.ruta = ruta;
    this.queryParamsFormatter = queryParamsFormatter;
  }

  getFullPath(...args: GetFullPathParams<TRoute, TQuery>): RutaEndpointSiasis {
    const params = args[0];
    const hasRouteParams = this.ruta.includes(":");

    let routeParams: ExtractorDeParametrosDeRuta<TRoute>;
    let queryParams: TQuery | undefined;

    if (hasRouteParams) {
      // There are route parameters
      routeParams =
        (params as any)?.routeParams ||
        ({} as ExtractorDeParametrosDeRuta<TRoute>);
      queryParams = (params as any)?.queryParams;
    } else {
      // There are no route parameters
      routeParams = {} as ExtractorDeParametrosDeRuta<TRoute>;
      queryParams = (params as any)?.queryParams;
    }

    let path = this.ruta as string;

    // Replace route parameters
    Object.entries(routeParams as Record<string, string>).forEach(
      ([key, value]) => {
        path = path.replace(`:${key}`, encodeURIComponent(value));
      }
    );

    // Add query parameters
    const queryString =
      queryParams && this.queryParamsFormatter
        ? this.queryParamsFormatter(queryParams)
        : queryParams
        ? new URLSearchParams(queryParams as any).toString()
        : "";

    return {
      siasisAPI: this.siasisApi,
      metodoHttp: this.metodoHttp,
      rutaCompleta: queryString ? `${path}?${queryString}` : path,
    };
  }

  /**
   * Performs the HTTP request using fetchSiasisAPI
   * Reuses getFullPath to build the URL
   * TResponse is already typed from the class generic
   */
  async realizarPeticion(
    ...args: RealizarPeticionParams<TRoute, TQuery, TBody>
  ): Promise<TResponse> {
    try {
      const { default: fetchSiasisApiGenerator } = await import(
        "@/lib/helpers/generators/fetchSiasisApisGenerator"
      );

      const params = args[0];
      const body = (params as any)?.body;

      // Build the route using getFullPath
      const { rutaCompleta, metodoHttp } = this.getFullPath(
        params as any // Cast necesario debido a la complejidad de tipos
      );

      // Get the fetch generator
      const { fetchSiasisAPI } = fetchSiasisApiGenerator(this.siasisApi);

      // Prepare parameters for the request
      const fetchParams: FetchSiasisAPIParams = {
        endpoint: rutaCompleta,
        method: metodoHttp,
      };

      // Add body if it exists and the method allows it
      if (body && ["POST", "PUT", "PATCH"].includes(metodoHttp)) {
        fetchParams.body = body;
        fetchParams.headers = {
          "Content-Type": "application/json",
          ...fetchParams.headers,
        };
      }

      // Create the cancelable request
      const fetchCancelable = await fetchSiasisAPI(fetchParams);

      if (!fetchCancelable) {
        throw new Error(
          `No se pudo crear la petición para ${metodoHttp} ${rutaCompleta}`
        );
      }

      // Perform the request
      const response = await fetchCancelable.fetch();

      if (!response.ok) {
        const errorPersonalizado = new CustomApiError(
          `Error HTTP ${response.status}: ${response.statusText} en ${metodoHttp} ${rutaCompleta}`,
          {
            metodoHttp,
            ruta: rutaCompleta,
            statusCode: response.status,
            statusText: response.statusText,
          }
        );

        throw errorPersonalizado;
      }

      // Process the response
      const objectResponse = (await response.json()) as ApiResponse<TResponse>;

      if (!objectResponse.success) {
        throw new Error(
          `Error en respuesta de API: ${objectResponse.message}${
            objectResponse.error ? ` - ${objectResponse.error}` : ""
          }`
        );
      }

      return objectResponse as TResponse;
    } catch (error) {
      console.error(
        `Error en petición ${this.metodoHttp} ${this.ruta}:`,
        error
      );
      throw error;
    }
  }
}
