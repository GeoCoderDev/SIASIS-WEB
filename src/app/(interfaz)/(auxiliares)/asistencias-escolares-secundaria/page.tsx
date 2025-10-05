"use client";

import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import ConsultaAsistenciasPorRol from "@/components/asistencias-escolares/por-aula/ConsultaAsistenciasEscolaresPorRol";

/**
 * Página de consulta de asistencias escolares para Auxiliares
 *
 * Características:
 * - Solo acceso a aulas de Secundaria
 * - Restricción de nivel educativo fija
 * - Puede generar QRs solo para aulas de Secundaria
 */
const AsistenciasEscolaresAuxiliares = () => {
  return (
    <ConsultaAsistenciasPorRol
      rol={RolesSistema.Auxiliar}
      nivelEducativoRestringido={NivelEducativo.SECUNDARIA}
    />
  );
};

export default AsistenciasEscolaresAuxiliares;
