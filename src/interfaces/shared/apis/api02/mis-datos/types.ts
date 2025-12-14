import { T_Responsables } from "@prisma/client";
import { ApiResponseBase, ErrorResponseAPIBase, SuccessResponseAPIBase } from "../../types";

// -----------------------------------------
//                GET METHOD
// -----------------------------------------

/**
 * Guardian's Data
 */
export type MisDatosResponsable = Omit<T_Responsables, "Contraseña">;

/**
 * Data for guardians (API02)
 * Responds to: /api/mis-datos for guardian role
 */
export type MisDatosSuccessAPI02Data = MisDatosResponsable;

/**
 * Complete response for guardians
 */
export interface SuccesMisDatosResponseAPI02 extends ApiResponseBase {
  data: MisDatosSuccessAPI02Data;
}

// -----------------------------------------
//                PUT METHOD
// -----------------------------------------

export type ActualizarMisDatosResponsableRequestBody = Partial<
  Pick<T_Responsables, "Celular">
>;

export type ActualizarMisDatoUsuarioRequestBodyAPI02 =
  ActualizarMisDatosResponsableRequestBody;

// Interface for successful response
export interface ActualizarUsuarioSuccessResponseAPI02
  extends SuccessResponseAPIBase {
  success: true;
  message: string;
  data: ActualizarMisDatoUsuarioRequestBodyAPI02; // The data that was updated
}

export type ObtenerMisDatosSuccessAPI02Data = MisDatosResponsable;

export interface MisDatosSuccessResponseAPI02 extends SuccessResponseAPIBase {
  data: ObtenerMisDatosSuccessAPI02Data;
}

// Interface for successful response
export interface ActualizarUsuarioSuccessResponseAPI02
  extends SuccessResponseAPIBase {
  success: true;
  message: string;
  data: ActualizarMisDatoUsuarioRequestBodyAPI02; // The data that was updated
}



export type MisDatosErrorResponseAPI02 = ErrorResponseAPIBase;