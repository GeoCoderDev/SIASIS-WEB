import { NextRequest, NextResponse } from "next/server";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import {
  AsistenciaDiariaEscolarResultado,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { Meses } from "@/interfaces/shared/Meses";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { TodaySchoolAttendancesRepository } from "./_utils/AsistenciasEscolaresTomadasHoyRepository";

/**
 * Interface for the student attendance query endpoint response
 */
interface QueryStudentAttendancesResponseBody {
  AttendanceType: TipoAsistencia;
  Day: number;
  Month: Meses;
  Level?: string;
  Grade?: number;
  Section?: string;
  ExpectedTotalStudents?: number;
  Results:
    | AsistenciaDiariaEscolarResultado
    | AsistenciaDiariaEscolarResultado[]
    | null;
  _debug?: string;
}

/**
 * Maps string to EducationalLevel
 */
const mapEducationalLevel = (level: string): NivelEducativo => {
  switch (level.toUpperCase()) {
    case "P":
    case "PRIMARIA":
      return NivelEducativo.PRIMARIA;
    case "S":
    case "SECUNDARIA":
      return NivelEducativo.SECUNDARIA;
    default:
      throw new Error(`Invalid educational level: ${level}`);
  }
};

/**
 * Validates permissions according to role for student attendance queries
 */
const validateStudentPermissions = (
  role: RolesSistema,
  attendanceType: TipoAsistencia,
  level?: string,
  grade?: number,
  section?: string
): { isValid: boolean; message?: string } => {
  switch (role) {
    case RolesSistema.Directivo:
      // Directors can query any student attendance
      return { isValid: true };

    case RolesSistema.Auxiliar:
      // Only secondary students
      if (attendanceType !== TipoAsistencia.ParaEstudiantesSecundaria) {
        return {
          isValid: false,
          message:
            "Assistants can only query secondary students",
        };
      }
      return { isValid: true };

    case RolesSistema.ProfesorPrimaria:
      // Only primary students
      if (attendanceType !== TipoAsistencia.ParaEstudiantesPrimaria) {
        return {
          isValid: false,
          message:
            "Primary school teachers can only query primary students",
        };
      }
      // TODO: Here it could be validated that the teacher only queries their assigned classroom
      return { isValid: true };

    case RolesSistema.Tutor:
      // Only secondary students
      if (attendanceType !== TipoAsistencia.ParaEstudiantesSecundaria) {
        return {
          isValid: false,
          message:
            "Tutors can only query secondary students",
        };
      }
      // TODO: Here it could be validated that the tutor only queries their assigned classroom
      return { isValid: true };

    case RolesSistema.Responsable:
      // Guardians can query students, but only those under their responsibility
      // TODO: This validation would require querying the database to verify the relationship
      return { isValid: true };

    case RolesSistema.ProfesorSecundaria:
      return {
        isValid: false,
        message:
          "Secondary school teachers cannot query student attendances",
      };

    case RolesSistema.PersonalAdministrativo:
      return {
        isValid: false,
        message:
          "Administrative staff cannot query student attendances",
      };

    default:
      return { isValid: false, message: "Unauthorized role" };
  }
};

export async function GET(req: NextRequest) {
  const logPrefix = "[GET /attendances/students]";

  try {
    console.log(`${logPrefix} 🚀 STARTING QUERY`);
    console.log(`${logPrefix} 🌐 Full URL: ${req.url}`);

    // Verify authentication
    console.log(`${logPrefix} 🔐 Verifying authentication...`);
    const { error, rol: role, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.Tutor,
      RolesSistema.Responsable,
    ]);

    if (error && !role && !decodedToken) {
      console.log(`${logPrefix} ❌ Authentication error`);
      return error;
    }

    console.log(`${logPrefix} ✅ Authenticated user - Role: ${role}`);
    console.log(
      `${logPrefix} 👤 Decoded token:`,
      decodedToken ? Object.keys(decodedToken) : "null"
    );

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const attendanceTypeParam = searchParams.get(
      "TipoAsistencia"
    ) as TipoAsistencia;
    const levelParam = searchParams.get("Nivel");
    const gradeParam = searchParams.get("Grado");
    const studentIdParam = searchParams.get("idEstudiante");
    const sectionParam = searchParams.get("Seccion");
    const totalStudentsParam = searchParams.get("totalEstudiantes");

    console.log(`${logPrefix} 📋 Received parameters:`);
    console.log(`${logPrefix} 📋   TipoAsistencia: ${attendanceTypeParam}`);
    console.log(`${logPrefix} 📋   Nivel: ${levelParam}`);
    console.log(`${logPrefix} 📋   Grado: ${gradeParam}`);
    console.log(`${logPrefix} 📋   idEstudiante: ${studentIdParam}`);
    console.log(`${logPrefix} 📋   Seccion: ${sectionParam}`);
    console.log(`${logPrefix} 📋   totalEstudiantes: ${totalStudentsParam}`);

    // Validate mandatory parameters
    if (!attendanceTypeParam) {
      console.log(`${logPrefix} ❌ Missing TipoAsistencia parameter`);
      return NextResponse.json(
        { success: false, message: "The TipoAsistencia parameter is required" },
        { status: 400 }
      );
    }

    if (!levelParam) {
      console.log(`${logPrefix} ❌ Missing Nivel parameter`);
      return NextResponse.json(
        { success: false, message: "The Nivel parameter is required" },
        { status: 400 }
      );
    }

    if (!gradeParam) {
      console.log(`${logPrefix} ❌ Missing Grado parameter`);
      return NextResponse.json(
        { success: false, message: "The Grado parameter is required" },
        { status: 400 }
      );
    }

    // NEW VALIDATION: Section is mandatory for the new structure
    if (!sectionParam) {
      console.log(`${logPrefix} ❌ Missing Seccion parameter`);
      return NextResponse.json(
        {
          success: false,
          message:
            "The Seccion parameter is required to work with the new data structure",
        },
        { status: 400 }
      );
    }

    // Validate that TipoAsistencia is valid and is for students
    const validTypes = [
      TipoAsistencia.ParaEstudiantesPrimaria,
      TipoAsistencia.ParaEstudiantesSecundaria,
    ];

    if (!validTypes.includes(attendanceTypeParam)) {
      console.log(
        `${logPrefix} ❌ Invalid TipoAsistencia: ${attendanceTypeParam}`
      );
      console.log(`${logPrefix} 📋 Valid types: ${validTypes.join(", ")}`);
      return NextResponse.json(
        {
          success: false,
          message:
            "TipoAsistencia must be for students (primary or secondary)",
        },
        { status: 400 }
      );
    }

    // Determine query type: individual vs classroom
    const isIndividualQuery = !!studentIdParam;
    const isClassroomQuery = !studentIdParam;

    console.log(
      `${logPrefix} 🎯 Query type: ${
        isIndividualQuery ? "Individual" : "Full classroom"
      }`
    );

    // NEW VALIDATION: totalEstudiantes mandatory only for classroom queries
    if (isClassroomQuery && !totalStudentsParam) {
      console.log(
        `${logPrefix} ❌ Missing totalEstudiantes parameter for classroom query`
      );
      return NextResponse.json(
        {
          success: false,
          message:
            "The totalEstudiantes parameter is mandatory for full classroom queries (when idEstudiante is not specified)",
        },
        { status: 400 }
      );
    }

    // Validate totalEstudiantes if provided
    let totalStudents: number | undefined;
    if (totalStudentsParam) {
      totalStudents = parseInt(totalStudentsParam);
      if (
        isNaN(totalStudents) ||
        totalStudents < 1 ||
        totalStudents > 50
      ) {
        console.log(
          `${logPrefix} ❌ Invalid totalEstudiantes: ${totalStudentsParam}`
        );
        return NextResponse.json(
          {
            success: false,
            message:
              "The totalEstudiantes parameter must be a number between 1 and 50",
          },
          { status: 400 }
        );
      }
      console.log(
        `${logPrefix} ✅ totalEstudiantes validated: ${totalStudents}`
      );
    }

    // Convert and validate parameters
    let level: NivelEducativo;
    let grade: number;

    try {
      level = mapEducationalLevel(levelParam);
      console.log(`${logPrefix} ✅ Level mapped: ${level}`);
    } catch (error) {
      console.log(`${logPrefix} ❌ Error mapping level: ${error}`);
      return NextResponse.json(
        { success: false, message: (error as Error).message },
        { status: 400 }
      );
    }

    grade = parseInt(gradeParam);
    if (isNaN(grade) || grade < 1 || grade > 6) {
      console.log(`${logPrefix} ❌ Invalid Grado: ${gradeParam}`);
      return NextResponse.json(
        { success: false, message: "The Grade must be a number between 1 and 6" },
        { status: 400 }
      );
    }

    // Validate grade according to level
    if (level === NivelEducativo.SECUNDARIA && grade > 5) {
      console.log(`${logPrefix} ❌ Invalid Grade for secondary: ${grade}`);
      return NextResponse.json(
        {
          success: false,
          message: "For secondary, the grade must be between 1 and 5",
        },
        { status: 400 }
      );
    }

    // Validate section (basic format)
    if (sectionParam && !/^[A-Z]{1,2}$/i.test(sectionParam)) {
      console.log(
        `${logPrefix} ❌ Invalid section format: ${sectionParam}`
      );
      return NextResponse.json(
        {
          success: false,
          message: "The section must be one or two letters (A, B, AB, etc.)",
        },
        { status: 400 }
      );
    }

    const section = sectionParam.toUpperCase();
    console.log(
      `${logPrefix} ✅ Parameters validated - Level: ${level}, Grade: ${grade}, Section: ${section}`
    );

    // Validate permissions
    console.log(`${logPrefix} 🔒 Validating permissions for role: ${role}`);
    const permissionValidation = validateStudentPermissions(
      role!,
      attendanceTypeParam,
      levelParam || undefined,
      grade,
      section
    );

    if (!permissionValidation.isValid) {
      console.log(
        `${logPrefix} ❌ Insufficient permissions: ${permissionValidation.message}`
      );
      return NextResponse.json(
        { success: false, message: permissionValidation.message },
        { status: 403 }
      );
    }

    console.log(`${logPrefix} ✅ Permissions validated correctly`);

    // Create repository instance
    const attendancesRepo = new TodaySchoolAttendancesRepository();
    console.log(`${logPrefix} 📦 Attendance repository created`);

    let results:
      | AsistenciaDiariaEscolarResultado
      | AsistenciaDiariaEscolarResultado[]
      | null;
    let debugMessage = "";

    if (isIndividualQuery) {
      // Query by specific student ID
      console.log(
        `${logPrefix} 🔍 STARTING individual query: ${studentIdParam}`
      );
      console.log(
        `${logPrefix} 🎯 Parameters for query: level=${level}, grade=${grade}, section=${section}, role=${role}`
      );

      const result = await attendancesRepo.queryByStudentId(
        studentIdParam!,
        attendanceTypeParam,
        level,
        grade,
        section,
        role!
      );

      results = result.data;
      debugMessage = result.message;

      console.log(`${logPrefix} 📊 Individual query result:`);
      console.log(
        `${logPrefix} 📊   Data: ${
          results ? "Found" : "Not found"
        }`
      );
      console.log(`${logPrefix} 📊   Message: ${debugMessage}`);
    } else {
      // Query by classroom (level, grade, section) - UPDATED WITH totalEstudiantes
      console.log(
        `${logPrefix} 🏫 STARTING classroom query: ${level} ${grade}° ${section} (${totalStudents} expected students)`
      );

      const result = await attendancesRepo.queryByClassroom(
        attendanceTypeParam,
        level!,
        grade!,
        section!,
        totalStudents!, // New mandatory parameter
        role!
      );

      results = result.data;
      debugMessage = result.message;

      console.log(`${logPrefix} 📊 Classroom query result:`);
      console.log(
        `${logPrefix} 📊   Data: ${
          Array.isArray(results)
            ? `${results.length}/${totalStudents} students`
            : "Not found"
        }`
      );
      console.log(`${logPrefix} 📊   Message: ${debugMessage}`);
    }

    // Get current date for the response
    const currentDate = await attendancesRepo.getCurrentDate();
    const [year, month, day] = currentDate.split("-").map(Number);

    console.log(
      `${logPrefix} 📅 Current date obtained: ${currentDate} (${day}/${month}/${year})`
    );

    // Create response
    const response: QueryStudentAttendancesResponseBody = {
      AttendanceType: attendanceTypeParam,
      Day: day,
      Month: month as Meses,
      Level: levelParam || undefined,
      Grade: grade,
      Section: section,
      ...(isClassroomQuery &&
        totalStudents && { ExpectedTotalStudents: totalStudents }),
      Results: results,
      _debug: debugMessage,
    };

    console.log(`${logPrefix} ✅ QUERY COMPLETED SUCCESSFULLY`);
    console.log(
      `${logPrefix} 📈 Response prepared with ${
        Array.isArray(results) ? results.length : results ? 1 : 0
      } results`
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error(`${logPrefix} ❌ CRITICAL ERROR:`, error);
    console.error(
      `${logPrefix} ❌ Stack trace:`,
      error instanceof Error ? error.stack : "No stack available"
    );

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
        _debug: "See server logs for more details",
      },
      { status: 500 }
    );
  }
}
