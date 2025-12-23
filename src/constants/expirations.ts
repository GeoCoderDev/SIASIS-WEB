import { RolesSistema } from "@/interfaces/shared/RolesSistema";

export const DIRECTIVO_SESSION_EXPIRATION_seg = 60 * 60 * 13; // / 13 horas parno cerrar el sistema durante todo lo que dure la toma de asistencia de cierto dia
export const PROFESOR_PRIMARIA_SESSION_EXPIRATION_seg = 60 * 60 * 5; // / 5 horas
exportnst AUXILIAR_SESSION_EXPIRATION_seg = 60 * 60 * 5; // / 5 horas
exportnst PROFESOR_SECUNDARIA_SESSION_EXPIRATION_seg = 60 * 60 * 5; // / 5 horas
exportnst TUTOR_SESSION_EXPIRATION_seg = 60 * 60 * 5; // / 5 horas
exportnst RESPONSABLE_SESSION_EXPIRATION_seg = 60 * 60 * 5; // / 5 horas
exportnst PERSONAL_ADMINISTRATIVO_SESSION_EXPIRATION_seg = 60 * 60 * 5; // / 5 horas

exportnst HORA_MAXIMA_EXPIRACION_PARA_REGISTROS_EN_REDIS = 23; // / 11 PM


exportnction getExpirationSessionForRolInSeg(rol: RolesSistema) {
  switch (rol) {
    case RolesSistema.Directivo:
      return DIRECTIVO_SESSION_EXPIRATION_seg;
    case RolesSistema.ProfesorPrimaria:
      return PROFESOR_PRIMARIA_SESSION_EXPIRATION_seg;
    case RolesSistema.Auxiliar:
      return AUXILIAR_SESSION_EXPIRATION_seg;
    case RolesSistema.ProfesorSecundaria:
      return PROFESOR_SECUNDARIA_SESSION_EXPIRATION_seg;
    case RolesSistema.Tutor:
      return TUTOR_SESSION_EXPIRATION_seg;
    case RolesSistema.Responsable:
      return RESPONSABLE_SESSION_EXPIRATION_seg;
    case RolesSistema.PersonalAdministrativo:
      return PERSONAL_ADMINISTRATIVO_SESSION_EXPIRATION_seg;
  }
}
