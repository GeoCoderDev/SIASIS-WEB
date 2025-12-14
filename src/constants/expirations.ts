import { RolesSistema } from "@/interfaces/shared/RolesSistema";

export const DIRECTOR_SESSION_EXPIRATION_sec = 60 * 60 * 13; // 13 hours to avoid closing the system during the entire attendance taking of a certain day
export const PRIMARY_TEACHER_SESSION_EXPIRATION_sec = 60 * 60 * 5; // 5 hours
export const ASSISTANT_SESSION_EXPIRATION_sec = 60 * 60 * 5; // 5 hours
export const SECONDARY_TEACHER_SESSION_EXPIRATION_sec = 60 * 60 * 5; // 5 hours
export const TUTOR_SESSION_EXPIRATION_sec = 60 * 60 * 5; // 5 hours
export const GUARDIAN_SESSION_EXPIRATION_sec = 60 * 60 * 5; // 5 hours
export const ADMINISTRATIVE_STAFF_SESSION_EXPIRATION_sec = 60 * 60 * 5; // 5 hours

export const MAX_EXPIRATION_HOUR_FOR_RECORDS_IN_REDIS = 23; // 11 PM


export function getExpirationSessionForRoleInSec(role: RolesSistema) {
  switch (role) {
    case RolesSistema.Directivo:
      return DIRECTOR_SESSION_EXPIRATION_sec;
    case RolesSistema.ProfesorPrimaria:
      return PRIMARY_TEACHER_SESSION_EXPIRATION_sec;
    case RolesSistema.Auxiliar:
      return ASSISTANT_SESSION_EXPIRATION_sec;
    case RolesSistema.ProfesorSecundaria:
      return SECONDARY_TEACHER_SESSION_EXPIRATION_sec;
    case RolesSistema.Tutor:
      return TUTOR_SESSION_EXPIRATION_sec;
    case RolesSistema.Responsable:
      return GUARDIAN_SESSION_EXPIRATION_sec;
    case RolesSistema.PersonalAdministrativo:
      return ADMINISTRATIVE_STAFF_SESSION_EXPIRATION_sec;
  }
}