import { RolesSistema } from "@/interfaces/shared/RolesSistema";

export const PRIMARY_TEACHER_ATTENDANCE_ENTRY_EXTENSION_MINUTES = 60;
export const PRIMARY_TEACHER_ATTENDANCE_EXIT_EXTENSION_MINUTES = 60;
export const ASSISTANT_ATTENDANCE_ENTRY_EXTENSION_MINUTES = 60;
export const ASSISTANT_ATTENDANCE_EXIT_EXTENSION_MINUTES = 60;
export const SECONDARY_TEACHER_ATTENDANCE_ENTRY_EXTENSION_MINUTES = 60;
export const SECONDARY_TEACHER_ATTENDANCE_EXIT_EXTENSION_MINUTES = 60;
export const TUTOR_ATTENDANCE_ENTRY_EXTENSION_MINUTES = 60;
export const TUTOR_ATTENDANCE_EXIT_EXTENSION_MINUTES = 60;
export const ADMINISTRATIVE_STAFF_ATTENDANCE_ENTRY_EXTENSION_MINUTES = 60;
export const ADMINISTRATIVE_STAFF_ATTENDANCE_EXIT_EXTENSION_MINUTES = 60;

export const STAFF_ENTRY_EXTENSIONS_MINUTES: Record<
  | RolesSistema.ProfesorPrimaria
  | RolesSistema.ProfesorSecundaria
  | RolesSistema.Auxiliar
  | RolesSistema.Tutor
  | RolesSistema.PersonalAdministrativo,
  number
> = {
  [RolesSistema.ProfesorPrimaria]:
    PRIMARY_TEACHER_ATTENDANCE_ENTRY_EXTENSION_MINUTES,
  [RolesSistema.ProfesorSecundaria]:
    SECONDARY_TEACHER_ATTENDANCE_ENTRY_EXTENSION_MINUTES,
  [RolesSistema.Auxiliar]: ASSISTANT_ATTENDANCE_ENTRY_EXTENSION_MINUTES,
  [RolesSistema.Tutor]: TUTOR_ATTENDANCE_ENTRY_EXTENSION_MINUTES,
  [RolesSistema.PersonalAdministrativo]:
    ADMINISTRATIVE_STAFF_ATTENDANCE_ENTRY_EXTENSION_MINUTES,
};

export const STAFF_EXIT_EXTENSIONS_MINUTES: Record<
  | RolesSistema.ProfesorPrimaria
  | RolesSistema.ProfesorSecundaria
  | RolesSistema.Auxiliar
  | RolesSistema.Tutor
  | RolesSistema.PersonalAdministrativo,
  number
> = {
  [RolesSistema.ProfesorPrimaria]:
    PRIMARY_TEACHER_ATTENDANCE_EXIT_EXTENSION_MINUTES,
  [RolesSistema.ProfesorSecundaria]:
    SECONDARY_TEACHER_ATTENDANCE_EXIT_EXTENSION_MINUTES,
  [RolesSistema.Auxiliar]: ASSISTANT_ATTENDANCE_EXIT_EXTENSION_MINUTES,
  [RolesSistema.Tutor]: TUTOR_ATTENDANCE_EXIT_EXTENSION_MINUTES,
  [RolesSistema.PersonalAdministrativo]:
    ADMINISTRATIVE_STAFF_ATTENDANCE_EXIT_EXTENSION_MINUTES,
};