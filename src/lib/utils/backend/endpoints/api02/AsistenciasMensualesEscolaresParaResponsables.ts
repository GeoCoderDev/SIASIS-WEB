import { MisEstudianteRelacionadoAsistenciasMensualesSuccessResponse } from "@/interfaces/shared/apis/api02/mis-estudiantes-relacionados/asistencias-mensuales/types";
import { EndpointSiasis } from "../EndpointSiasis";

export interface GetAsistenciasMensualesEscolaresParaResponsablesAPI02QueryParams {
  Mes: string;
}

export const Endpoint_Get_Asistencias_Mensuales_Escolares_Para_Responsables_API02 =
  new EndpointSiasis<
    "/api/mis-estudiantes-relacionados/:Id_Estudiante/asistencias-mensuales",
    MisEstudianteRelacionadoAsistenciasMensualesSuccessResponse,
    GetAsistenciasMensualesEscolaresParaResponsablesAPI02QueryParams
  >({
    siasisApi: "API02",
    metodoHttp: "GET",
    ruta: "/api/mis-estudiantes-relacionados/:Id_Estudiante/asistencias-mensuales",
  });
