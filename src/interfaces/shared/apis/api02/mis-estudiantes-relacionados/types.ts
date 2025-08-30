
import { SuccessResponseAPIBase } from "../../types";
import { EstudianteDelResponsable } from "@/interfaces/shared/Estudiantes";

export interface MisEstudiantesRelacionadosSuccessResponseAPI02
  extends SuccessResponseAPIBase {
  data: EstudianteDelResponsable[];
  total: number;
}

export interface MisEstudiantesRelacionadosErrorResponseAPI02 {
  success: false;
  message: string;
  errorType: string;
  details?: any;
}
