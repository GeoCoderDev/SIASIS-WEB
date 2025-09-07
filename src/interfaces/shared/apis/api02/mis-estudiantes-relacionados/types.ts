import { EstudianteDelResponsable } from "../../../Estudiantes";

export interface MisEstudiantesRelacionadosSuccessResponseAPI02 {
  success: true;
  data: EstudianteDelResponsable[];
  total: number;
}

export interface MisEstudiantesRelacionadosErrorResponseAPI02 {
  success: false;
  message: string;
  errorType: string;
  details?: any;
}
