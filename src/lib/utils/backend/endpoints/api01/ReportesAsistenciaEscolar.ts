import { EndpointSiasis } from "../EndpointSiasis";
import {
  GetReporteAsistenciaEscolarSuccessResponse,
  GetTodosLosReportesAsistenciaEscolarSuccessResponse,
} from "@/interfaces/shared/apis/api01/reportes-asistencia-escolar/types";

export const Endpoint_Get_Reporte_Asistencia_Escolar = new EndpointSiasis<
  "/api/reportes-asistencia-escolar/:Combinacion_Parametros_Reporte",
  GetReporteAsistenciaEscolarSuccessResponse
>({
  siasisApi: "API01",
  metodoHttp: "GET",
  ruta: "/api/reportes-asistencia-escolar/:Combinacion_Parametros_Reporte",
});

export const Endpoint_Get_Reportes_Disponibles_Asistencia_Escolar =
  new EndpointSiasis<
    "/api/reportes-asistencia-escolar",
    GetTodosLosReportesAsistenciaEscolarSuccessResponse
  >({
    siasisApi: "API01",
    metodoHttp: "GET",
    ruta: "/api/reportes-asistencia-escolar",
  });
