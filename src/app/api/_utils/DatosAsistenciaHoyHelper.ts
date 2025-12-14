import { DatosAsistenciaHoyIE20935 } from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { getTodayAttendanceData } from "../_utils/obtenerDatosAsistenciaHoy";

/**
 * Information about the classroom assigned to a teacher
 */
export interface AssignedClassroom {
  level: NivelEducativo;
  grade: number;
  section: string;
  hasClassroom: boolean;
}

/**
 * Permission validation result for reports
 */
export interface PermissionValidationResult {
  hasPermission: boolean;
  message?: string;
  assignedClassroom?: AssignedClassroom;
}

/**
 * Helper for working with daily attendance data
 */
export class TodayAttendanceDataHelper {
  private data: DatosAsistenciaHoyIE20935;

  constructor(data: DatosAsistenciaHoyIE20935) {
    this.data = data;
  }

  /**
   * Gets an instance of the helper with current data
   */
  static async getInstance(): Promise<TodayAttendanceDataHelper> {
    const { data } = await getTodayAttendanceData();
    return new TodayAttendanceDataHelper(data);
  }

  /**
   * Gets the classroom assigned to an elementary school teacher
   */
  getPrimarySchoolTeacherClassroom(teacherId: string): AssignedClassroom | null {
    const teacher = this.data.ListaDeProfesoresPrimaria.find(
      (p) => p.Id_Profesor_Primaria === teacherId
    );

    if (!teacher) {
      return null;
    }

    if (!teacher.Aula) {
      return {
        level: NivelEducativo.PRIMARIA,
        grade: 0,
        section: "",
        hasClassroom: false,
      };
    }

    return {
      level: teacher.Aula.Nivel as NivelEducativo,
      grade: teacher.Aula.Grado,
      section: teacher.Aula.Seccion,
      hasClassroom: true,
    };
  }

  /**
   * Gets the classroom assigned to a secondary school teacher/tutor
   */
  getSecondarySchoolTeacherClassroom(teacherId: string): AssignedClassroom | null {
    const teacher = this.data.ListaDeProfesoresSecundaria.find(
      (p) => p.Id_Profesor_Secundaria === teacherId
    );

    if (!teacher) {
      return null;
    }

    if (!teacher.Aula) {
      return {
        level: NivelEducativo.SECUNDARIA,
        grade: 0,
        section: "",
        hasClassroom: false,
      };
    }

    return {
      level: teacher.Aula.Nivel as NivelEducativo,
      grade: teacher.Aula.Grado,
      section: teacher.Aula.Seccion,
      hasClassroom: true,
    };
  }

  /**
   * Validates if a user has permission to generate/query a specific report
   */
  validateReportPermissions(
    role: RolesSistema,
    userId: string,
    requestedLevel: NivelEducativo,
    requestedGrade: number | string,
    requestedSection: string
  ): PermissionValidationResult {
    console.log(
      `[TodayAttendanceDataHelper] 🔐 Validating permissions for role: ${role}`
    );
    console.log(
      `[TodayAttendanceDataHelper] 📊 Requested report: ${requestedLevel} ${requestedGrade}° ${requestedSection}`
    );

    switch (role) {
      case RolesSistema.Directivo:
        console.log(
          `[TodayAttendanceDataHelper] ✅ Executive - Full access without restrictions`
        );
        return {
          hasPermission: true,
        };

      case RolesSistema.Auxiliar:
        // Can only generate secondary school reports
        if (requestedLevel !== NivelEducativo.SECUNDARIA) {
          console.log(
            `[TodayAttendanceDataHelper] ❌ Assistant can only generate secondary school reports`
          );
          return {
            hasPermission: false,
            message:
              "Assistants can only generate secondary school reports",
          };
        }

        console.log(
          `[TodayAttendanceDataHelper] ✅ Assistant - Access to secondary school allowed`
        );
        return {
          hasPermission: true,
        };

      case RolesSistema.ProfesorPrimaria:
        const primarySchoolTeacherClassroom =
          this.getPrimarySchoolTeacherClassroom(userId);

        if (!primarySchoolTeacherClassroom) {
          return {
            hasPermission: false,
            message: "Teacher not found in the system",
          };
        }

        if (!primarySchoolTeacherClassroom.hasClassroom) {
          console.log(
            `[TodayAttendanceDataHelper] ❌ Primary school teacher without an assigned classroom`
          );
          return {
            hasPermission: false,
            message: "You do not have an assigned classroom",
            assignedClassroom: primarySchoolTeacherClassroom,
          };
        }

        // Verify that it matches their assigned classroom
        const primarySchoolMatch =
          requestedLevel === primarySchoolTeacherClassroom.level &&
          (requestedGrade === primarySchoolTeacherClassroom.grade ||
            requestedGrade === "T") &&
          (requestedSection === primarySchoolTeacherClassroom.section ||
            requestedSection === "T");

        if (!primarySchoolMatch) {
          console.log(
            `[TodayAttendanceDataHelper] ❌ Primary school teacher tried to access an unassigned classroom`
          );
          console.log(
            `[TodayAttendanceDataHelper] 🏫 Assigned classroom: ${primarySchoolTeacherClassroom.level} ${primarySchoolTeacherClassroom.grade}° ${primarySchoolTeacherClassroom.section}`
          );
          return {
            hasPermission: false,
            message: `You can only generate reports for your assigned classroom: ${primarySchoolTeacherClassroom.level} ${primarySchoolTeacherClassroom.grade}° ${primarySchoolTeacherClassroom.section}`,
            assignedClassroom: primarySchoolTeacherClassroom,
          };
        }

        console.log(
          `[TodayAttendanceDataHelper] ✅ Primary school teacher - Access to their classroom allowed`
        );
        return {
          hasPermission: true,
          assignedClassroom: primarySchoolTeacherClassroom,
        };

      case RolesSistema.ProfesorSecundaria:
      case RolesSistema.Tutor:
        const secondarySchoolTeacherClassroom =
          this.getSecondarySchoolTeacherClassroom(userId);

        if (!secondarySchoolTeacherClassroom) {
          console.log(
            `[TodayAttendanceDataHelper] ❌ Secondary school teacher not found in the system`
          );
          return {
            hasPermission: false,
            message: "Teacher not found in the system",
          };
        }

        if (!secondarySchoolTeacherClassroom.hasClassroom) {
          console.log(
            `[TodayAttendanceDataHelper] ❌ Secondary school teacher without an assigned classroom`
          );
          return {
            hasPermission: false,
            message: "You do not have an assigned classroom",
            assignedClassroom: secondarySchoolTeacherClassroom,
          };
        }

        // Verify that it matches their assigned classroom
        const secondarySchoolMatch =
          requestedLevel === secondarySchoolTeacherClassroom.level &&
          (requestedGrade === secondarySchoolTeacherClassroom.grade ||
            requestedGrade === "T") &&
          (requestedSection === secondarySchoolTeacherClassroom.section ||
            requestedSection === "T");

        if (!secondarySchoolMatch) {
          console.log(
            `[TodayAttendanceDataHelper] ❌ Secondary school teacher tried to access an unassigned classroom`
          );
          console.log(
            `[TodayAttendanceDataHelper] 🏫 Assigned classroom: ${secondarySchoolTeacherClassroom.level} ${secondarySchoolTeacherClassroom.grade}° ${secondarySchoolTeacherClassroom.section}`
          );
          return {
            hasPermission: false,
            message: `You can only generate reports for your assigned classroom: ${secondarySchoolTeacherClassroom.level} ${secondarySchoolTeacherClassroom.grade}° ${secondarySchoolTeacherClassroom.section}`,
            assignedClassroom: secondarySchoolTeacherClassroom,
          };
        }

        console.log(
          `[TodayAttendanceDataHelper] ✅ Secondary school teacher - Access to their classroom allowed`
        );
        return {
          hasPermission: true,
          assignedClassroom: secondarySchoolTeacherClassroom,
        };

      case RolesSistema.PersonalAdministrativo:
      case RolesSistema.Responsable:
        console.log(
          `[TodayAttendanceDataHelper] ❌ Role ${role} does not have access to reports`
        );
        return {
          hasPermission: false,
          message:
            "Your role does not have permission to access attendance reports",
        };

      default:
        console.log(`[TodayAttendanceDataHelper] ❌ Unknown role: ${role}`);
        return {
          hasPermission: false,
          message: "Unauthorized role",
        };
    }
  }

  /**
   * Gets the complete attendance data
   */
  getCompleteData(): DatosAsistenciaHoyIE20935 {
    return this.data;
  }
}