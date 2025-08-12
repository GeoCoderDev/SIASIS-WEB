import { PersonalDelColegio } from "@/interfaces/shared/PersonalDelColegio";
import { EndpointSiasis } from "../EndpointSiasis";
import { GetGenericUsersSuccessResponse } from "@/interfaces/shared/apis/api01/usuarios-genericos/types";

export interface GetUsuariosGenericosAPI01QueryParams {
  Rol: PersonalDelColegio;
  Criterio: string;
  Limite: number;
}

export const Endpoint_Get_Usuarios_Genericos_API01 = new EndpointSiasis<
  "/api/usuarios-genericos",
  GetGenericUsersSuccessResponse,
  GetUsuariosGenericosAPI01QueryParams
>({
  siasisApi: "API01",
  metodoHttp: "GET",
  ruta: "/api/usuarios-genericos",
});
