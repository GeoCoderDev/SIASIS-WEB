import { AsistenciaEscolarDeUnDia } from "../../../../AsistenciasEscolares";
import { SuccessResponseAPIBase } from "../../../types";

export interface GetAsistenciasMensualesDeUnAulaSuccessResponse
  extends SuccessResponseAPIBase {
  data: {
    Mes: number;
    Asistencias_Escolares: Record<
      string, // / Id Estudnte,
      Record<number, AsistenciaEscolarDeUnDia | null> // / {Numero Dia: AsisnciaEscolarDeUnDia | null}
    >;
  };
}
