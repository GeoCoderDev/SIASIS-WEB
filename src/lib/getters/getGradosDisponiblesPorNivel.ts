import { GradosPrimaria } from "@/constants/GRADOS_POR_NIVEL_EDUCATIVO";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";

const getGradosDisponiblesPorNivel = (nivelSeleccionado: NivelEducativo) => {
  if (nivelSeleccionado === NivelEducativo.PRIMARIA) {
    return [1, 2, 3, 4, 5, 6];
  }
  if (nivelSeleccionado === NivelEducativo.SECUNDARIA) {
    return [1, 2, 3, 4, 5];
  }

  return [];
};

export default getGradosDisponiblesPorNivel;
