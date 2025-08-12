import { PersonalDelColegio } from "@/interfaces/shared/PersonalDelColegio";
import { EndpointSiasis } from "../EndpointSiasis";
import { Meses } from "@/interfaces/shared/Meses";
import { GetAsistenciaMensualDePersonalSuccessResponse } from "@/interfaces/shared/apis/api01/personal/types";

export interface GetAsistenciasMensualesDePersonalAPI01QueryParams {
  Rol: PersonalDelColegio;
  ID: string | number;
  Mes: Meses;
}

export const Endpoint_Get_Asistencias_Mensuales_De_Personal_API01 =
  new EndpointSiasis<
    "/api/personal/asistencias-mensuales",
    GetAsistenciaMensualDePersonalSuccessResponse,
    GetAsistenciasMensualesDePersonalAPI01QueryParams
  >({
    siasisApi: "API01",
    metodoHttp: "GET",
    ruta: "/api/personal/asistencias-mensuales",
  });
