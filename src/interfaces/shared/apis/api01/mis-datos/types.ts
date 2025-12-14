// =========================================
// ROUTE: /api/mis-datos
// =========================================

import {
  T_Aulas,
  T_Auxiliares,
  T_Directivos,
  T_Personal_Administrativo,
  T_Profesores_Primaria,
  T_Profesores_Secundaria,
  // T_Responsables,
} from "@prisma/client";
import { ErrorResponseAPIBase, SuccessResponseAPIBase } from "../../types";
import { Genero } from "../../../Genero";
import {
  AuxiliarSinContraseña,
  DirectivoSinContraseña,
  PersonalAdministrativoSinContraseña,
  ProfesorPrimariaSinContraseña,
  ProfesorSecundariaSinContraseña,
} from "../../shared/others/types";

// -----------------------------------------
//                GET METHOD
// -----------------------------------------

/**
 * Principal's Data
 */
export type MisDatosDirectivo = DirectivoSinContraseña & {
  Genero: Genero;
};

/**
 * Primary School Teacher's Data with optional classroom
 */
export type MisDatosProfesorPrimaria = ProfesorPrimariaSinContraseña & {
  Genero: Genero;
  Aula: Omit<
    T_Aulas,
    "Id_Profesor_Primaria" | "Id_Profesor_Secundaria"
  > | null;
};

/**
 * Assistant's Data
 */
export type MisDatosAuxiliar = AuxiliarSinContraseña & {
  Genero: Genero;
};

/**
 * Secondary School Teacher's Data
 */
export type MisDatosProfesorSecundaria = ProfesorSecundariaSinContraseña & {
  Genero: Genero;
};

/**
 * Tutor's Data (Secondary school teacher with classroom)
 */
export type MisDatosTutor = ProfesorSecundariaSinContraseña & {
  Genero: Genero;
  Aula: Omit<T_Aulas, "Id_Profesor_Primaria" | "Id_Profesor_Secundaria">;
};

/**
 * Administrative Staff's Data
 */
export type MisDatosPersonalAdministrativo =
  PersonalAdministrativoSinContraseña & { Genero: Genero };

export type ObtenerMisDatosSuccessAPI01Data =
  | MisDatosDirectivo
  | MisDatosProfesorPrimaria
  | MisDatosAuxiliar
  | MisDatosProfesorSecundaria
  | MisDatosTutor
  | MisDatosPersonalAdministrativo;

export interface MisDatosSuccessResponseAPI01 extends SuccessResponseAPIBase {
  data: ObtenerMisDatosSuccessAPI01Data;
}

export type MisDatosErrorResponseAPI01 = ErrorResponseAPIBase;

// -----------------------------------------
//                PUT METHOD
// -----------------------------------------

export type ActualizarMisDatosDirectivoRequestBody = Partial<
  Pick<T_Directivos, "Identificador_Nacional" | "Nombres" | "Apellidos" | "Genero" | "Celular">
> & { Genero: Genero };

export type ActualizarMisDatosProfesorPrimariaRequestBody = Partial<
  Pick<T_Profesores_Primaria, "Correo_Electronico" | "Celular">
>;

export type ActualizarMisDatosAuxiliarRequestBody = Partial<
  Pick<T_Auxiliares, "Correo_Electronico" | "Celular">
>;

export type ActualizarMisDatosProfesorSecundariaRequestBody = Partial<
  Pick<T_Profesores_Secundaria, "Correo_Electronico" | "Celular">
>;

export type ActualizarMisDatosTutorRequestBody = Partial<
  Pick<T_Profesores_Secundaria, "Celular">
>;

export type ActualizarMisDatosPersonalAdministrativoRequestBody = Partial<
  Pick<T_Personal_Administrativo, "Celular">
>;

export type ActualizarMisDatoUsuarioRequestBodyAPI01 =
  | ActualizarMisDatosDirectivoRequestBody
  | ActualizarMisDatosProfesorPrimariaRequestBody
  | ActualizarMisDatosAuxiliarRequestBody
  | ActualizarMisDatosProfesorSecundariaRequestBody
  | ActualizarMisDatosTutorRequestBody
  | ActualizarMisDatosPersonalAdministrativoRequestBody;

// Interface for successful response
export interface ActualizarUsuarioSuccessResponseAPI01
  extends SuccessResponseAPIBase {
  success: true;
  message: string;
  data: ActualizarMisDatoUsuarioRequestBodyAPI01; // The data that was updated
}
