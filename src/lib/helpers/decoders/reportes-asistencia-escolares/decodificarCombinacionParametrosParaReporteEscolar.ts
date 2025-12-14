
import { AulasSeleccionadasParaReporteAsistenciaEscolar, RangoTiempoReporteAsistenciasEscolares, TipoReporteAsistenciaEscolar } from "@/interfaces/shared/ReporteAsistenciaEscolar";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { decodificarCaracterANumero } from "../decodificarCaracterANumero";

export interface ParametrosDecodificadosCombinacionReporteEscolar {
  tipoReporte: TipoReporteAsistenciaEscolar;
  rangoTiempo: RangoTiempoReporteAsistenciasEscolares;
  aulasSeleccionadas: AulasSeleccionadasParaReporteAsistenciaEscolar;
}

/**
 * Decodes a parameter combination string for a school attendance report
 * @param combinacionCodificada - Encoded string representing the report parameters
 * @returns Object with the decoded parameters or false if the string is not valid
 */
const decodificarCombinacionParametrosParaReporteEscolar = (
  combinacionCodificada: string
): ParametrosDecodificadosCombinacionReporteEscolar | false => {
  try {
    // Validate that the string is not empty
    if (!combinacionCodificada || combinacionCodificada.length === 0) {
      return false;
    }

    // Extract the report type (first character)
    const tipoReporte =
      combinacionCodificada[0] as TipoReporteAsistenciaEscolar;

    // Validate that the report type is valid
    if (!Object.values(TipoReporteAsistenciaEscolar).includes(tipoReporte)) {
      return false;
    }

    let posicion = 1; // We start after the report type

    if (tipoReporte === TipoReporteAsistenciaEscolar.POR_DIA) {
      // Format: D + FromMonth(1) + FromDay(1) + ToMonth(1) + ToDay(1) + Level(1) + Grade(1) + Section(1)
      // Minimum expected length: 8 characters
      if (combinacionCodificada.length < 8) {
        return false;
      }

      // Decode FromMonth (position 1)
      const mesDesdeCodificado = combinacionCodificada[posicion];
      const mesDesde = decodificarCaracterANumero(mesDesdeCodificado);
      if (
        mesDesde === null ||
        (mesDesde as number) < 1 ||
        (mesDesde as number) > 12
      ) {
        return false;
      }
      posicion++;

      // Decode FromDay (position 2)
      const diaDesdeCodificado = combinacionCodificada[posicion];
      const diaDesde = decodificarCaracterANumero(diaDesdeCodificado);
      if (diaDesde === null || diaDesde < 1 || diaDesde > 31) {
        return false;
      }
      posicion++;

      // Decode ToMonth (position 3)
      const mesHastaCodificado = combinacionCodificada[posicion];
      const mesHasta = decodificarCaracterANumero(mesHastaCodificado);
      if (mesHasta === null || mesHasta < 1 || mesHasta > 12) {
        return false;
      }
      posicion++;

      // Decode ToDay (position 4)
      const diaHastaCodificado = combinacionCodificada[posicion];
      const diaHasta = decodificarCaracterANumero(diaHastaCodificado);
      if (diaHasta === null || diaHasta < 1 || diaHasta > 31) {
        return false;
      }
      posicion++;

      // Extract Level (position 5) - 1 character
      const nivel = combinacionCodificada[posicion];
      if (
        !nivel ||
        !Object.values(NivelEducativo).includes(nivel as NivelEducativo)
      ) {
        return false;
      }
      posicion++;

      // Extract Grade (position 6) - 1 character (can be a number 1-6 or "T" for all)
      const gradoStr = combinacionCodificada[posicion];
      let grado: number | string;

      if (gradoStr === "T") {
        grado = "T";
      } else {
        const gradoNum = parseInt(gradoStr, 10);
        if (isNaN(gradoNum) || gradoNum < 1 || gradoNum > 6) {
          return false;
        }
        grado = gradoNum;
      }
      posicion++;

      // Extract Section (position 7) - 1 character (letter A-Z or "T" for all)
      const seccion = combinacionCodificada[posicion];
      if (!seccion || (!/^[A-Z]$/.test(seccion) && seccion !== "T")) {
        return false;
      }

      return {
        tipoReporte,
        rangoTiempo: {
          DesdeMes: mesDesde as number,
          DesdeDia: diaDesde,
          HastaMes: mesHasta as number,
          HastaDia: diaHasta,
        },
        aulasSeleccionadas: {
          Nivel: nivel as NivelEducativo,
          Grado: grado as number | "T",
          Seccion: seccion,
        },
      };
    } else {
      // TipoReporteAsistenciaEscolar.POR_MES
      // Format: M + FromMonth(1) + ToMonth(1) + Level(1) + Grade(1) + Section(1)
      // Minimum expected length: 6 characters
      if (combinacionCodificada.length < 6) {
        return false;
      }

      // Decode FromMonth (position 1)
      const mesDesdeCodificado = combinacionCodificada[posicion];
      const mesDesde = decodificarCaracterANumero(mesDesdeCodificado);
      if (mesDesde === null || mesDesde < 1 || mesDesde > 12) {
        return false;
      }
      posicion++;

      // Decode ToMonth (position 2)
      const mesHastaCodificado = combinacionCodificada[posicion];
      const mesHasta = decodificarCaracterANumero(mesHastaCodificado);
      if (mesHasta === null || mesHasta < 1 || mesHasta > 12) {
        return false;
      }
      posicion++;

      // Extract Level (position 3) - 1 character
      const nivel = combinacionCodificada[posicion];
      if (
        !nivel ||
        !Object.values(NivelEducativo).includes(nivel as NivelEducativo)
      ) {
        return false;
      }
      posicion++;

      // Extract Grade (position 4) - 1 character (can be a number 1-6 or "T" for all)
      const gradoStr = combinacionCodificada[posicion];
      let grado: number | string;

      if (gradoStr === "T") {
        grado = "T";
      } else {
        const gradoNum = parseInt(gradoStr, 10);
        if (isNaN(gradoNum) || gradoNum < 1 || gradoNum > 6) {
          return false;
        }
        grado = gradoNum;
      }
      posicion++;

      // Extract Section (position 5) - 1 character (letter A-Z or "T" for all)
      const seccion = combinacionCodificada[posicion];
      if (!seccion || (!/^[A-Z]$/.test(seccion) && seccion !== "T")) {
        return false;
      }

      return {
        tipoReporte,
        rangoTiempo: {
          DesdeMes: mesDesde,
          DesdeDia: null,
          HastaMes: mesHasta,
          HastaDia: null,
        },
        aulasSeleccionadas: {
          Nivel: nivel as NivelEducativo,
          Grado: grado as number | "T",
          Seccion: seccion,
        },
      };
    }
  } catch (error) {
    console.error("Error decoding parameter combination:", error);
    return false;
  }
};

export default decodificarCombinacionParametrosParaReporteEscolar;
