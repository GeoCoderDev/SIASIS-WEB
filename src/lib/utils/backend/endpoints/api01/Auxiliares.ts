import { GetAuxiliaresSuccessResponse } from "@/interfaces/shared/apis/api01/auxiliares/types";
import { EndpointSiasis } from "../EndpointSiasis";

export const Endpoint_Get_Auxiliares_API01 = new EndpointSiasis<
  "/api/auxiliares",
  GetAuxiliaresSuccessResponse
>({
  siasisApi: "API01",
  metodoHttp: "GET",
  ruta: "/api/auxiliares",
});
