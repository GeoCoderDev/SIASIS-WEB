import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";

export interface MisEstudianteRelacionadoAsistenciasMensuales {
  success: true;
  data: Record<number, AsistenciaEscolarDeUnDia>;
  total: number;
}

export interface MisEstudianteRelacionadoAsistenciasMensualesErrorAPI02 {
  success: false;
  message: string;
  errorType: string;
  details?: any;
}
