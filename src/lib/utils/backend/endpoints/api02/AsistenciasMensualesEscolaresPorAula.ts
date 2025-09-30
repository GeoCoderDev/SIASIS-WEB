import { GetAsistenciasMensualesDeUnAulaSuccessResponse } from "@/interfaces/shared/apis/api02/aulas/asistencias-escolares-mensuales/types";
import { EndpointSiasis } from "../EndpointSiasis";

export interface GetAsistenciasMensualesEscolaresPorAulaAPI02QueryParams {
  Mes: number;
}

export const Endpoint_Get_Asistencias_Mensuales_Escolares_Por_Aula_API02 =
  new EndpointSiasis<
    "/api/aulas/:Id_Aula/asistencias-escolares-mensuales",
    GetAsistenciasMensualesDeUnAulaSuccessResponse,
    GetAsistenciasMensualesEscolaresPorAulaAPI02QueryParams
  >({
    siasisApi: "API02",
    metodoHttp: "GET",
    ruta: "/api/aulas/:Id_Aula/asistencias-escolares-mensuales",
  });

