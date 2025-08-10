import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { EndpointSiasis } from "../EndpointSiasis";
import { GetAulasSuccessResponse } from "@/interfaces/shared/apis/api02/aulas/types";

export interface GetAulasAPI02QueryParams {
  nivel?: NivelEducativo;
  grado?: number;
  idsAulas?: string[];
}

export const Endpoint_Get_Aulas_API02 = new EndpointSiasis<
  "/api/aulas",
  GetAulasSuccessResponse,
  GetAulasAPI02QueryParams
>({
  siasisApi: "API02",
  metodoHttp: "GET",
  ruta: "/api/aulas",
  queryParamsFormatter: ({
    grado,
    idsAulas,
    nivel,
  }: GetAulasAPI02QueryParams) => {
    const params = new URLSearchParams();
    if (nivel) {
      params.append("nivel", nivel);
    }
    if (grado) {
      params.append("grado", grado.toString());
    }
    if (idsAulas) {
      params.append("idsAulas", idsAulas.join(","));
    }
    return params.toString();
  },
});
