import { T_Reportes_Asistencia_Escolar } from "@prisma/client";
import { NivelEducativo } from "./NivelEducativo";

export enum TipoReporteAsistenciaEscolar {
  POR_DIA = "D",
  POR_MES = "M",
}

export enum EstadoReporteAsistenciaEscolar {
  PENDIENTE = "P",
  DISPONIBLE = "D",
  ERROR = "E",
}

export const EstadosReporteAsistenciaEscolarTextos: Record<
  EstadoReporteAsistenciaEscolar,
  string
> = {
  [EstadoReporteAsistenciaEscolar.PENDIENTE]: "Pendiente",
  [EstadoReporteAsistenciaEscolar.DISPONIBLE]: "Disponible",
  [EstadoReporteAsistenciaEscolar.ERROR]: "Error",
};

export interface RangoTiempoReporteAsistenciasEscolares {
  DesdeMes: number;
  DesdeDia: number | null;

  HastaMes: number;
  HastaDia: number | null;
}

export interface AulasSeleccionadasParaReporteAsistenciaEscolar {
  Nivel: NivelEducativo;
  Grado: number | "T" | "";
  Seccion: `${string}` | "T" | "";
}

export type ReporteAsistenciaEscolarAnonimo = Pick<
  T_Reportes_Asistencia_Escolar,
  | "Combinacion_Parametros_Reporte"
  | "Estado_Reporte"
  | "Datos_Google_Drive_Id"
  | "Fecha_Generacion"
>;
