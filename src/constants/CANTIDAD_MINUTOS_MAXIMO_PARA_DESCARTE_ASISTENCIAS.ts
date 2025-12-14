import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";

export const MAX_MINUTES_TO_DISCARD_STAFF_ATTENDANCE = 5;
export const MAX_MINUTES_TO_DISCARD_SECONDARY_STUDENT_ATTENDANCE = 5;
export const MAX_MINUTES_TO_DISCARD_PRIMARY_STUDENT_ATTENDANCE = 5;

export const MAX_MINUTES_TO_DISCARD_ATTENDANCE: Record<
  TipoAsistencia,
  number
> = {
  [TipoAsistencia.ParaPersonal]:
    MAX_MINUTES_TO_DISCARD_STAFF_ATTENDANCE,
  [TipoAsistencia.ParaEstudiantesSecundaria]:
    MAX_MINUTES_TO_DISCARD_SECONDARY_STUDENT_ATTENDANCE,
  [TipoAsistencia.ParaEstudiantesPrimaria]:
    MAX_MINUTES_TO_DISCARD_PRIMARY_STUDENT_ATTENDANCE,
};