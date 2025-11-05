import {
  AulasSeleccionadasParaReporteAsistenciaEscolar,
  RangoTiempoReporteAsistenciasEscolares,
  TipoReporteAsistenciaEscolar,
} from "@/interfaces/shared/ReporteAsistenciaEscolar";
import { codificarNumerosACaracteres } from "../codificarNumerosACaracteres";

export interface ParametrosCodificacionCombinacionParametrosParaReporteEscolar {
  tipoReporte: TipoReporteAsistenciaEscolar;
  rangoTiempo: RangoTiempoReporteAsistenciasEscolares;
  aulasSeleccionadas: AulasSeleccionadasParaReporteAsistenciaEscolar;
}

const codificarCombinacionParametrosParaReporteEscolar = ({
  aulasSeleccionadas,
  rangoTiempo,
  tipoReporte,
}: ParametrosCodificacionCombinacionParametrosParaReporteEscolar) => {
  if (tipoReporte === TipoReporteAsistenciaEscolar.POR_DIA) {
    return `${tipoReporte}${codificarNumerosACaracteres(
      Number(rangoTiempo.DesdeMes)
    )}${codificarNumerosACaracteres(
      Number(rangoTiempo.DesdeDia)
    )}${codificarNumerosACaracteres(
      Number(rangoTiempo.HastaMes)
    )}${codificarNumerosACaracteres(Number(rangoTiempo.HastaDia))}${
      aulasSeleccionadas.Nivel
    }${aulasSeleccionadas.Grado}${aulasSeleccionadas.Seccion}`;
  }

  return `${tipoReporte}${codificarNumerosACaracteres(
    Number(rangoTiempo.DesdeMes)
  )}${codificarNumerosACaracteres(Number(rangoTiempo.HastaMes))}${
    aulasSeleccionadas.Nivel
  }${aulasSeleccionadas.Grado}${aulasSeleccionadas.Seccion}`;
};

export default codificarCombinacionParametrosParaReporteEscolar;
