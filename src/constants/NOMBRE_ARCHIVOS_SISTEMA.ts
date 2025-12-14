import { NivelEducativo } from "../interfaces/shared/NivelEducativo";
import { GradosPrimaria, GradosSecundaria } from "./GRADOS_POR_NIVEL_EDUCATIVO";

export const DAILY_ATTENDANCE_DATA_FILENAME =
  "datos-asistencia-hoy-ie20935.json";

// RELATED TO THE FILES OF LISTS OF SECONDARY AND
// PRIMARY SCHOOL STUDENTS TO BE SAVED IN BLOBS AND GOOGLE DRIVE
export type GradeByLevel<N extends NivelEducativo> =
  N extends NivelEducativo.PRIMARIA
    ? GradosPrimaria
    : N extends NivelEducativo.SECUNDARIA
    ? GradosSecundaria
    : never;

export type PRIMARY_STUDENT_LIST_FILENAME =
  (typeof DAILY_STUDENT_LIST_FILENAMES)[NivelEducativo.PRIMARIA][keyof (typeof DAILY_STUDENT_LIST_FILENAMES)[NivelEducativo.PRIMARIA]];
export type SECONDARY_STUDENT_LIST_FILENAME =
  (typeof DAILY_STUDENT_LIST_FILENAMES)[NivelEducativo.SECUNDARIA][keyof (typeof DAILY_STUDENT_LIST_FILENAMES)[NivelEducativo.SECUNDARIA]];

export type STUDENT_LIST_FILENAME<
  N extends NivelEducativo = NivelEducativo
> = N extends NivelEducativo ? `Students_${N}_${GradeByLevel<N>}` : never;

export const DAILY_STUDENT_LIST_FILENAMES: Record<
  NivelEducativo,
  Record<number, STUDENT_LIST_FILENAME>
> = {
  [NivelEducativo.PRIMARIA]: {
    1: "Students_P_1",
    2: "Students_P_2",
    3: "Students_P_3",
    4: "Students_P_4",
    5: "Students_P_5",
    6: "Students_P_6",
  },
  [NivelEducativo.SECUNDARIA]: {
    1: "Students_S_1",
    2: "Students_S_2",
    3: "Students_S_3",
    4: "Students_S_4",
    5: "Students_S_5",
  },
};

export const STUDENT_LIST_UPDATE_REPORT_FILENAME =
  "reporte-actualizacion-listas-estudiantes.json";