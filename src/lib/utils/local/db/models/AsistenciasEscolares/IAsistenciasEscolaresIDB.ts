import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { AsistenciaOperationResult } from "./AsistenciasEscolaresBaseIDB";

/**
 * Interfaz común que deben implementar todos los modelos IDB de asistencias escolares
 *
 * Garantiza que cualquier rol pueda ser usado de forma intercambiable
 * en los componentes de UI sin conocer la implementación específica
 */
export interface IAsistenciasEscolaresIDB {
  /**
   * Consulta asistencias mensuales de un aula completa
   *
   * @param idAula - ID del aula a consultar
   * @param mes - Mes a consultar (1-12)
   * @returns Resultado con asistencias de todos los estudiantes del aula
   */
  consultarAsistenciasMensualesAula(
    idAula: string,
    mes: number
  ): Promise<AsistenciaOperationResult>;

  /**
   * Consulta asistencias mensuales de un estudiante individual
   *
   * @param idEstudiante - ID del estudiante
   * @param mes - Mes a consultar (1-12)
   * @param nivel - Nivel educativo del estudiante
   * @param grado - Grado del estudiante
   * @returns Resultado con asistencias del estudiante
   */
  consultarAsistenciasMensualesEstudiante(
    idEstudiante: string,
    mes: number,
    nivel: NivelEducativo,
    grado: number
  ): Promise<AsistenciaOperationResult>;
}
