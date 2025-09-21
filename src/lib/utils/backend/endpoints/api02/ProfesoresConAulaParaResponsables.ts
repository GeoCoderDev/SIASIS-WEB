import { ProfesorConAulaSuccessResponse } from "@/interfaces/shared/apis/api02/profesores-con-aula/types";
import { EndpointSiasis } from "../EndpointSiasis";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";

export interface ProfesoresConAulaParaResponsablesAPI02QueryParams {
  Id_Profesor: string;
  Nivel: NivelEducativo;
}

export const Endpoint_Profesores_Con_Aula_Para_Responsables_API02 =
  new EndpointSiasis<
    "/api/profesores-con-aula",
    ProfesorConAulaSuccessResponse,
    ProfesoresConAulaParaResponsablesAPI02QueryParams
  >({
    siasisApi: "API02",
    metodoHttp: "GET",
    ruta: "/api/profesores-con-aula",
  });
