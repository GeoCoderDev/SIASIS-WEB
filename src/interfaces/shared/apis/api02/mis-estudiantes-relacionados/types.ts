import { T_Estudiantes } from "@prisma/client";
import { SuccessResponseAPIBase } from "../../types";


// Interfaz para la respuesta de estudiantes
export interface EstudianteDelResponsable extends T_Estudiantes {
  Tipo_Relacion: string;
}

export interface MisEstudiantesRelacionadosSuccessResponseAPI02 extends SuccessResponseAPIBase {
  data: EstudianteDelResponsable[];
  total: number;
}

export interface MisEstudiantesRelacionadosErrorResponseAPI02 {
  success: false;
  message: string;
  errorType: string;
  details?: any;}