import { EndpointSiasis } from "../EndpointSiasis";
import { GetPersonalAdministrativoSuccessResponse } from "@/interfaces/shared/apis/api01/personal-administrativo/types";

export const Endpoint_Get_Personal_Administrativo_API01 = new EndpointSiasis<
  "/api/personal-administrativo",
  GetPersonalAdministrativoSuccessResponse
>({
  siasisApi: "API01",
  metodoHttp: "GET",
  ruta: "/api/personal-administrativo",
});
