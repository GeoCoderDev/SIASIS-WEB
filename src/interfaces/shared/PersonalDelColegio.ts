import { RolesSistema } from "./RolesSistema";

export type PersonalDelColegio =
  | RolesSistema.Directivo
  | RolesSistema.ProfesorPrimaria
  | RolesSistema.Auxiliar
  | RolesSistema.ProfesorSecundaria
  | RolesSistema.Tutor
  | RolesSistema.PersonalAdministrativo;
