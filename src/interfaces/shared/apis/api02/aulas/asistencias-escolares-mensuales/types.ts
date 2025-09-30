import { AsistenciaEscolarDeUnDia } from "../../../../AsistenciasEscolares";
import { SuccessResponseAPIBase } from "../../../types";

export interface GetAsistenciasMensualesDeUnAulaSuccessResponse
  extends SuccessResponseAPIBase {
  data: {
    Mes: number;
    Asistencias_Escolares: Record<
      string, //Id Estudiante,
      Record<number, AsistenciaEscolarDeUnDia | null> // {Numero Dia: AsistenciaEscolarDeUnDia | null}
    >;
  };
}
