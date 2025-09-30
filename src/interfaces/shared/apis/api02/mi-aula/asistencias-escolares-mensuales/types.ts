import { SuccessResponseAPIBase } from "../../../types";
import { AsistenciaEscolarDeUnDia } from "../../../../AsistenciasEscolares";

export interface GetAsistenciasEscolaresMensualesDeMiAulaSuccessResponse
  extends SuccessResponseAPIBase {
  data: {
    Mes: number;
    Asistencias_Escolares: Record<
      string, // Id Estudiante,
      Record<number, AsistenciaEscolarDeUnDia | null> // {Numero Dia: AsistenciaEscolarDeUnDia | null}
    >;
  };
}
