import { MisEstudiantesRelacionadosSuccessResponseAPI02 } from "@/interfaces/shared/apis/api02/mis-estudiantes-relacionados/types";
import { EndpointSiasis } from "../EndpointSiasis";

export const Endpoint_Get_MisEstudiantesRelacionados_API02 = new EndpointSiasis<
  "/api/mis-estudiantes-relacionados",
  MisEstudiantesRelacionadosSuccessResponseAPI02
>({
  siasisApi: "API02",
  metodoHttp: "GET",
  ruta: "/api/mis-estudiantes-relacionados",
});


