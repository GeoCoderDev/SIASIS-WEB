export enum RolesSistema {
    Directivo = 'D',
    ProfesorPrimaria = 'PP',
    Auxiliar = 'A',
    ProfesorSecundaria = 'PS',
    Tutor = 'T',
    Responsable = 'R',
    PersonalAdministrativo = 'PA',
}

export type PersonalDelColegio =
  | RolesSistema.Directivo
  | RolesSistema.Auxiliar
  | RolesSistema.ProfesorPrimaria
  | RolesSistema.ProfesorSecundaria
  | RolesSistema.Tutor
  | RolesSistema.PersonalAdministrativo;