import { EstadosAsistenciaPersonal } from "../../interfaces/shared/EstadosAsistenciaPersonal";

export const StaffAttendanceStateStyles: Record<
  EstadosAsistenciaPersonal,
  string
> = {
  [EstadosAsistenciaPersonal.Temprano]: "bg-main-green text-white",
  [EstadosAsistenciaPersonal.En_Tiempo]: "bg-main-blue text-white",
  [EstadosAsistenciaPersonal.Cumplido]: "bg-main-green text-white",
  [EstadosAsistenciaPersonal.Salida_Anticipada]:
    "bg-editions-yellow text-black",
  [EstadosAsistenciaPersonal.Tarde]: "bg-main-orange text-white",
  [EstadosAsistenciaPersonal.Falta]: "bg-dark-red text-white",
  [EstadosAsistenciaPersonal.Sin_Registro]: "text-center text-black",
  [EstadosAsistenciaPersonal.No_Registrado]: "text-center text-black",
  [EstadosAsistenciaPersonal.Inactivo]: "bg-dark-gray text-white",
  [EstadosAsistenciaPersonal.Evento]: "bg-main-violet text-white",
  [EstadosAsistenciaPersonal.Otro]: "bg-light-gray text-black",
};