"use client";

import ConsultaAsistenciasPorRol from "@/components/asistencias-escolares/por-aula/ConsultaAsistenciasEscolaresPorRol";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";

/**
 * Página de consulta de asistencias escolares para Directivos
 *
 * Características:
 * - Acceso completo a todas las aulas (Primaria y Secundaria)
 * - Sin restricciones de nivel educativo ni aula
 * - Puede generar QRs para cualquier aula
 */
const AsistenciasEscolaresDirectivos = () => {
  return (
    <ConsultaAsistenciasPorRol
      rol={RolesSistema.Directivo}
      
    />
  );
};

export default AsistenciasEscolaresDirectivos;
