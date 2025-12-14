//These names are used to save the attendance states
// daily in a low latency DB, at the moment we are using Redis
export const STAFF_ATTENDANCE_START_FLAG_NAME =
  "Se_inicio_toma_asistencia_personal";
export const PRIMARY_ATTENDANCE_START_FLAG_NAME =
  "Se_inicio_toma_asistencia_primaria";
export const SECONDARY_ATTENDANCE_START_FLAG_NAME =
  "Se_inicio_toma_asistencia_secundaria";