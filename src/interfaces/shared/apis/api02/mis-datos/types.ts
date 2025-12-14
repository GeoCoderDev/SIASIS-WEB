import { T_Responsables } from "@prisma/client";
import { ApiResponseBase, ErrorResponseAPIBase, SuccessResponseAPIBase } from "../../types";

// -----------------------------------------
//                METODO GET
// -----------------------------------------

/**
 * Datos de Responsable
 */
export type MisDatosResponsable = Omit<T_Responsables, "Contraseña">;

/**
 * Datos para responsables (API02)
 * Responde a: /api/mis-datos para rol de responsable
 */
export type MisDatosSuccessAPI02Data = MisDatosResponsable;

/**
 * Respuesta completa para responsables
 */
export interface SuccesMisDatosResponseAPI02 extends ApiResponseBase {
  data: MisDatosSuccessAPI02Data;
}

// -----------------------------------------
//                METODO PUT
// -----------------------------------------

export type ActualizarMisDatosResponsableRequestBody = Partial<
  Pick<T_Responsables, "Celular">
>;

export type ActualizarMisDatoUsuarioRequestBodyAPI02 =
  ActualizarMisDatosResponsableRequestBody;

// Interfaz para la respuesta exitosa
export interface ActualizarUsuarioSuccessResponseAPI02
  extends SuccessResponseAPIBase {
  success: true;
  message: string;
  data: ActualizarMisDatoUsuarioRequestBodyAPI02; // Los datos que se actualizaron
}

export type ObtenerMisDatosSuccessAPI02Data = MisDatosResponsable;

export interface MisDatosSuccessResponseAPI02 extends SuccessResponseAPIBase {
  data: ObtenerMisDatosSuccessAPI02Data;
}

// Interfaz para la respuesta exitosa
export interface ActualizarUsuarioSuccessResponseAPI02
  extends SuccessResponseAPIBase {
  success: true;
  message: string;
  data: ActualizarMisDatoUsuarioRequestBodyAPI02; // Los datos que se actualizaron
}



export type MisDatosErrorResponseAPI02 = ErrorResponseAPIBase;