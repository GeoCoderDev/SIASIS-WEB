// =========================================
// ROUTE: /api/login
// =========================================

import { Genero } from "../../../Genero";
import { RolesSistema } from "../../../RolesSistema";
import { ApiResponseBase } from "../../types";

/**
 * Body for the login request
 */
export interface LoginBody {
  Nombre_Usuario: string;
  Contraseña: string;
}

/**
 * Data returned on successful login
 */
export interface SuccessLoginData {
  Nombres: string;
  Apellidos: string;
  Genero?: Genero;
  Rol: RolesSistema;
  token: string;
  Google_Drive_Foto_ID: string | null;
}

export type ResponseSuccessLogin = ApiResponseBase & {
  data: SuccessLoginData;
};
