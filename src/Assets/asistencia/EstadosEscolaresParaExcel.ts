import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";

export const EstadosAsistenciaEscolarParaExcel: Record<
  EstadosAsistenciaEscolar,
  string
> = {
  [EstadosAsistenciaEscolar.Temprano]: "●",
  [EstadosAsistenciaEscolar.Tarde]: "●",
  [EstadosAsistenciaEscolar.Falta]: "F",
  [EstadosAsistenciaEscolar.Inactivo]: "-",
  [EstadosAsistenciaEscolar.Evento]: "",
  [EstadosAsistenciaEscolar.Vacaciones]: "",
};
