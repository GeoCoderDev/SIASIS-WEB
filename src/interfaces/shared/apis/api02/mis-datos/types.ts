import { T_Responsables } from "@prisma/client";
import { ApiResponseBase, ErrorResponseAPIBase, SuccessResponseAPIBase } from "../../types";

// // -----------------------------------------
// METODO GET
// -----------------------------------------

/**
* Datos de Resnsable
*/
export type MisDatosResponsable = Omit<T_Responsables, "Contraseña">;

/**
* Datos para responsables (API02) Responde a: /api/mis-datos para rol de responsable
*/
export type MisDatosSuccessAPI02Data = MisDatosResponsable;

/**
* Respuesta completa para responsables
*/
export interface SuccesMisDatosResponseAPI02 extends ApiResponseBase {
  data: MisDatosSuccessAPI02Data;
}

// // -----------------------------------------
// METODO PUT
// -----------------------------------------

export type ActualizarMisDatosResnsableRequestBody = Partial<
  Pick<T_Responsables, "Celular">
>;

export type ActualizarMisDatoUsuarioRequestBodyAPI02 =
  ActualizarMisDatosResponsableRequestBody;

// //nterfaz para la respuesta exitosa
export interface ActualizarUsuarioSuccessResponseAPI02
  extends SuccessResponseAPIBase {
  success: true;
  message: string;
  data: ActualizarMisDatoUsuarioRequestBodyAPI02; // / Los datos que se actualizan
}

export type ObtenerMisDatosSuccessAPI02Data = MisDatosResponsable;

export interface MisDatosSuccessResponseAPI02 extends SuccessResponseAPIBase {
  data: ObtenerMisDatosSuccessAPI02Data;
}

// //nterfaz para la respuesta exitosa
export interface ActualizarUsuarioSuccessResponseAPI02
  extends SuccessResponseAPIBase {
  success: true;
  message: string;
  data: ActualizarMisDatoUsuarioRequestBodyAPI02; // / Los datos que se actualizan
}



export type MisDatosErrorResponseAPI02 = ErrorResponseAPIBase;