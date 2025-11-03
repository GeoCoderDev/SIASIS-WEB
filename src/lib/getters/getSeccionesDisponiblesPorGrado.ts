import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { BaseAulasIDB } from "../utils/local/db/models/Aulas/AulasBase";

const getSeccionesDisponiblesPorNivelYPorGrado = async (
  nivel: NivelEducativo,
  grado: number
) => {
  const baseAulasIDB = new BaseAulasIDB();

  return await baseAulasIDB.getSeccionesPorNivelYGrado(nivel, grado);
};

export default getSeccionesDisponiblesPorNivelYPorGrado;
