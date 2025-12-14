import { MethodHTTP } from "@/interfaces/MethodsHTTP";
import {
  ErrorResponseAPIBase,
  SuccessResponseAPIBase,
} from "@/interfaces/shared/apis/types";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import { CustomApiError } from "@/lib/errors/custom/ApiError";

// ============================================
// UTILITY TYPES AVANZADAS
// ============================================

type ExtractorDeParametrosDeRuta<T extends string> =
  T extends `${infer Start}/:${infer Param}/${infer Rest}`
    ? { [K in Param]: string } & ExtractorDeParametrosDeRuta<`/${Rest}`>
    : T extends `${infer Start}/:${infer Param}`
    ? { [K in Param]: string }
    : T extends `/${infer Rest}`
    ? ExtractorDeParametrosDeRuta<Rest>
    : {};

// Verificar si un objeto está vacío
type IsEmptyObject<T> = keyof T extends never ? true : false;

// Extraer campos obligatorios de una interface
type RequiredKeys<T> = {
  [K in keyof T]-?: {} extends Pick<T, K> ? never : K;
}[keyof T];

// Verificar si hay campos obligatorios
type HasRequiredFields<T> = RequiredKeys<T> extends never ? false : true;

// Hacer queryParams opcional solo si todos los campos son opcionales
type ConditionalQueryParams<TQuery> = HasRequiredFields<TQuery> extends true
  ? { queryParams: TQuery } // Obligatorio si hay campos requeridos
  : { queryParams?: TQuery }; // Opcional si todos son opcionales

// Verificar si tanto routeParams como queryParams son opcionales
type BothParamsOptional<TRoute extends string, TQuery> = IsEmptyObject<
  ExtractorDeParametrosDeRuta<TRoute>
> extends true
  ? HasRequiredFields<TQuery> extends true
    ? false // queryParams es obligatorio
    : true // Ambos son opcionales
  : false; // routeParams es obligatorio

// Parámetros condicionales mejorados
type GetFullPathParams<TRoute extends string, TQuery> = BothParamsOptional<
  TRoute,
  TQuery
> extends true
  ? [
      params?: {
        routeParams?: ExtractorDeParametrosDeRuta<TRoute>;
        queryParams?: TQuery;
      }
    ] // Completamente opcional
  : IsEmptyObject<ExtractorDeParametrosDeRuta<TRoute>> extends true
  ? [params: ConditionalQueryParams<TQuery>] // Solo queryParams
  : HasRequiredFields<TQuery> extends true
  ? [
      params: {
        routeParams: ExtractorDeParametrosDeRuta<TRoute>;
        queryParams: TQuery;
      }
    ] // Ambos obligatorios
  : [
      params: {
        routeParams: ExtractorDeParametrosDeRuta<TRoute>;
        queryParams?: TQuery;
      }
    ]; // routeParams obligatorio, queryParams opcional

// Hacer body condicional según si tiene campos obligatorios
type ConditionalBody<TBody> = HasRequiredFields<TBody> extends true
  ? { body: TBody } // Obligatorio si hay campos requeridos
  : keyof TBody extends never
  ? {} // Sin body si es objeto vacío
  : { body?: TBody }; // Opcional si todos los campos son opcionales

// Verificar si todos los parámetros son opcionales (CORREGIDO)
type AllParamsOptional<TRoute extends string, TQuery, TBody> = IsEmptyObject<
  ExtractorDeParametrosDeRuta<TRoute>
> extends true
  ? HasRequiredFields<TQuery> extends true
    ? false // queryParams es obligatorio
    : HasRequiredFields<TBody> extends true
    ? false // body es obligatorio - ESTO ES LO IMPORTANTE
    : keyof TBody extends never
    ? true // No hay body y todo es opcional
    : true // Body existe pero todos sus campos son opcionales
  : false; // routeParams es obligatorio

// Parámetros para realizarPeticion (CORREGIDO - body siempre se evalúa)
type RealizarPeticionParams<TRoute extends string, TQuery, TBody> =
  // Si hay campos obligatorios en body, siempre incluir body como obligatorio
  HasRequiredFields<TBody> extends true
    ? IsEmptyObject<ExtractorDeParametrosDeRuta<TRoute>> extends true
      ? HasRequiredFields<TQuery> extends true
        ? [params: { queryParams: TQuery; body: TBody }] // queryParams + body obligatorios
        : [params: { body: TBody; queryParams?: TQuery }] // body obligatorio, queryParams opcional
      : HasRequiredFields<TQuery> extends true
      ? [
          params: {
            routeParams: ExtractorDeParametrosDeRuta<TRoute>;
            queryParams: TQuery;
            body: TBody;
          }
        ] // Todos obligatorios
      : [
          params: {
            routeParams: ExtractorDeParametrosDeRuta<TRoute>;
            body: TBody;
            queryParams?: TQuery;
          }
        ] // routeParams + body obligatorios, queryParams opcional
    : // Si body no tiene campos obligatorios, usar la lógica anterior
    AllParamsOptional<TRoute, TQuery, TBody> extends true
    ? [
        params?: {
          routeParams?: ExtractorDeParametrosDeRuta<TRoute>;
          queryParams?: TQuery;
        } & ConditionalBody<TBody>
      ] // Completamente opcional
    : IsEmptyObject<ExtractorDeParametrosDeRuta<TRoute>> extends true
    ? HasRequiredFields<TQuery> extends true
      ? [params: { queryParams: TQuery } & ConditionalBody<TBody>] // queryParams obligatorio
      : [params?: { queryParams?: TQuery } & ConditionalBody<TBody>] // queryParams opcional
    : HasRequiredFields<TQuery> extends true
    ? [
        params: {
          routeParams: ExtractorDeParametrosDeRuta<TRoute>;
          queryParams: TQuery;
        } & ConditionalBody<TBody>
      ] // routeParams + queryParams obligatorios
    : [
        params: {
          routeParams: ExtractorDeParametrosDeRuta<TRoute>;
          queryParams?: TQuery;
        } & ConditionalBody<TBody>
      ]; // routeParams obligatorio, queryParams opcional

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

// Interface para fetchSiasisAPI (basada en tu ejemplo)
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
// CLASE CON MÉTODO realizarPeticion COMPLETO
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
      // Hay parámetros de ruta
      routeParams =
        (params as any)?.routeParams ||
        ({} as ExtractorDeParametrosDeRuta<TRoute>);
      queryParams = (params as any)?.queryParams;
    } else {
      // No hay parámetros de ruta
      routeParams = {} as ExtractorDeParametrosDeRuta<TRoute>;
      queryParams = (params as any)?.queryParams;
    }

    let path = this.ruta as string;

    // Reemplazar parámetros de ruta
    Object.entries(routeParams as Record<string, string>).forEach(
      ([key, value]) => {
        path = path.replace(`:${key}`, encodeURIComponent(value));
      }
    );

    // Agregar query parameters
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
   * Realiza la petición HTTP utilizando fetchSiasisAPI
   * Reutiliza getFullPath para construir la URL
   * TResponse ya está tipado desde el genérico de la clase
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

      // Construir la ruta usando getFullPath
      const { rutaCompleta, metodoHttp } = this.getFullPath(
        params as any // Cast necesario debido a la complejidad de tipos
      );

      // Obtener el generador de fetch
      const { fetchSiasisAPI } = fetchSiasisApiGenerator(this.siasisApi);

      // Preparar parámetros para la petición
      const fetchParams: FetchSiasisAPIParams = {
        endpoint: rutaCompleta,
        method: metodoHttp,
      };

      // Agregar body si existe y el método lo permite
      if (body && ["POST", "PUT", "PATCH"].includes(metodoHttp)) {
        fetchParams.body = body;
        fetchParams.headers = {
          "Content-Type": "application/json",
          ...fetchParams.headers,
        };
      }

      // Crear la petición cancelable
      const fetchCancelable = await fetchSiasisAPI(fetchParams);

      if (!fetchCancelable) {
        throw new Error(
          `No se pudo crear la petición para ${metodoHttp} ${rutaCompleta}`
        );
      }

      // Realizar la petición
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

      // Procesar la respuesta
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
