import { ReporteAsistenciaEscolarAnonimo } from "../../../ReporteAsistenciaEscolar";
import { SuccessResponseAPIBase } from "../../types";

export interface GetTodosLosReportesAsistenciaEscolarSuccessResponse
  extends SuccessResponseAPIBase {
  data: ReporteAsistenciaEscolarAnonimo[];
  total: number;
}

export interface GetReporteAsistenciaEscolarSuccessResponse
  extends SuccessResponseAPIBase {
  data: ReporteAsistenciaEscolarAnonimo;
}
