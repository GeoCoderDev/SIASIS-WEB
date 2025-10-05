import { GetAsistenciasEscolaresMensualesDeMiAulaSuccessResponse } from "@/interfaces/shared/apis/api02/mi-aula/asistencias-escolares-mensuales/types";
import { EndpointSiasis } from "../EndpointSiasis";

export interface GetAsistenciasMensualesEscolaresDeMiAulaAPI02QueryParams {
  Mes: string;
}

export const Endpoint_Get_Asistencias_Mensuales_Escolares_De_Mi_Aula_API02 =
  new EndpointSiasis<
    "/api/mi-aula/asistencias-escolares-mensuales",
    GetAsistenciasEscolaresMensualesDeMiAulaSuccessResponse,
    GetAsistenciasMensualesEscolaresDeMiAulaAPI02QueryParams
  >({
    siasisApi: "API02",
    metodoHttp: "GET",
    ruta: "/api/mi-aula/asistencias-escolares-mensuales",
  });
