import { NextRequest, NextResponse } from "next/server";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";

import { validateIdActor } from "@/lib/helpers/validators/data/validateIdActor";
import {
  PermissionErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
} from "@/interfaces/shared/errors";
import {
  GruposIntanciasDeRedis,
  redisClient,
} from "../../../../../config/Redis/RedisClient";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import {
  RegistrarAsistenciaIndividualRequestBody,
  RegistrarAsistenciaIndividualSuccessResponse,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { HORA_MAXIMA_EXPIRACION_PARA_REGISTROS_EN_REDIS } from "@/constants/expirations";
import {
  getCurrentDateInPeru,
  getCurrentDateTimeInPeru,
} from "../../_helpers/obtenerFechaActualPeru";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";

export const RedisInstanceGroupByAttendanceType: Record<
  TipoAsistencia,
  GruposIntanciasDeRedis
> = {
  [TipoAsistencia.ParaPersonal]:
    GruposIntanciasDeRedis.ParaAsistenciasDePersonal,
  [TipoAsistencia.ParaEstudiantesSecundaria]:
    GruposIntanciasDeRedis.ParaAsistenciasDeEstudiantesSecundaria,
  [TipoAsistencia.ParaEstudiantesPrimaria]:
    GruposIntanciasDeRedis.ParaAsistenciasDeEstudiantesPrimaria,
};

/**
 * Maps a system role to the corresponding actor for personal attendance registration
 */
const mapRoleToStaffActor = (role: RolesSistema): ActoresSistema | null => {
  switch (role) {
    case RolesSistema.Directivo:
      return ActoresSistema.Directivo;
    case RolesSistema.ProfesorPrimaria:
      return ActoresSistema.ProfesorPrimaria;
    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
      return ActoresSistema.ProfesorSecundaria;
    case RolesSistema.Auxiliar:
      return ActoresSistema.Auxiliar;
    case RolesSistema.PersonalAdministrativo:
      return ActoresSistema.PersonalAdministrativo;
    // Guardians don't have personal attendance
    case RolesSistema.Responsable:
      return null;
    default:
      return null;
  }
};

// Function to validate registration permissions by role
const validateRegistrationPermissions = (
  role: RolesSistema,
  actor: ActoresSistema,
  attendanceType: TipoAsistencia,
  idToRegister: string,
  myId: string,
  isOwnRegistration: boolean = false,
  grade?: number,
  section?: string,
  educationalLevel?: string
): { isValid: boolean; message?: string } => {
  switch (role) {
    case RolesSistema.Directivo:
      // Directors can register staff attendance (including other directors)
      // BUT CANNOT register student attendance
      if (actor === ActoresSistema.Estudiante) {
        return {
          isValid: false,
          message:
            "Directors cannot register student attendances",
        };
      }

      // For staff: they can register any staff member
      if (attendanceType !== TipoAsistencia.ParaPersonal) {
        return {
          isValid: false,
          message:
            "Directors can only register staff attendances",
        };
      }
      return { isValid: true };

    case RolesSistema.Auxiliar:
      if (actor === ActoresSistema.Estudiante) {
        // Only secondary students
        if (attendanceType !== TipoAsistencia.ParaEstudiantesSecundaria) {
          return {
            isValid: false,
            message:
              "Assistants can only register secondary students",
          };
        }
        // For students requires level, grade and section
        if (!educationalLevel || !grade || !section) {
          return {
            isValid: false,
            message:
              "Educational level, grade and section are required to register students",
          };
        }
      } else {
        // For personal attendance: only their own record
        if (!isOwnRegistration && idToRegister !== myId) {
          return {
            isValid: false,
            message:
              "Assistants can only register their own personal attendance",
          };
        }
        // Must be Personal type
        if (attendanceType !== TipoAsistencia.ParaPersonal) {
          return {
            isValid: false,
            message:
              "Assistants can only register Personal type attendance for themselves",
          };
        }
      }
      return { isValid: true };

    case RolesSistema.ProfesorPrimaria:
      if (actor === ActoresSistema.Estudiante) {
        // Only primary students
        if (attendanceType !== TipoAsistencia.ParaEstudiantesPrimaria) {
          return {
            isValid: false,
            message:
              "Primary school teachers can only register primary students",
          };
        }
        // For students requires level, grade and section
        if (!educationalLevel || !grade || !section) {
          return {
            isValid: false,
            message:
              "Educational level, grade and section are required to register students",
          };
        }
      } else {
        // For personal attendance: only their own record
        if (!isOwnRegistration && idToRegister !== myId) {
          return {
            isValid: false,
            message:
              "Primary school teachers can only register their own personal attendance",
          };
        }
        // Must be Personal type
        if (attendanceType !== TipoAsistencia.ParaPersonal) {
          return {
            isValid: false,
            message:
              "Primary school teachers can only register Personal type attendance for themselves",
          };
        }
      }
      return { isValid: true };

    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
      if (actor === ActoresSistema.Estudiante) {
        return {
          isValid: false,
          message:
            "Secondary school teachers/tutors cannot register student attendances",
        };
      } else {
        // For personal attendance: only their own record
        if (!isOwnRegistration && idToRegister !== myId) {
          return {
            isValid: false,
            message:
              "Secondary school teachers/tutors can only register their own attendance",
          };
        }
        // Must be Personal type
        if (attendanceType !== TipoAsistencia.ParaPersonal) {
          return {
            isValid: false,
            message:
              "Secondary school teachers/tutors can only register Personal type attendance for themselves",
          };
        }
      }
      return { isValid: true };

    case RolesSistema.PersonalAdministrativo:
      if (actor === ActoresSistema.Estudiante) {
        return {
          isValid: false,
          message:
            "Administrative staff cannot register student attendances",
        };
      } else {
        // For personal attendance: only their own record
        if (!isOwnRegistration && idToRegister !== myId) {
          return {
            isValid: false,
            message:
              "Administrative staff can only register their own attendance",
          };
        }
        // Must be Personal type
        if (attendanceType !== TipoAsistencia.ParaPersonal) {
          return {
            isValid: false,
            message:
              "Administrative staff can only register Personal type attendance for themselves",
          };
        }
      }
      return { isValid: true };

    case RolesSistema.Responsable:
      // Guardians cannot register attendances
      return {
        isValid: false,
        message: "Guardians cannot register attendances",
      };

    default:
      return { isValid: false, message: "Unauthorized role" };
  }
};

const calculateSecondsUntilExpiration = async (): Promise<number> => {
  // ✅ Use the new function that handles all offsets
  const currentPeruDate = await getCurrentDateTimeInPeru();

  // Create target date at 20:00 of the same day
  const expirationDate = new Date(currentPeruDate);
  expirationDate.setHours(
    HORA_MAXIMA_EXPIRACION_PARA_REGISTROS_EN_REDIS,
    0,
    0,
    0
  );

  // If current time already passed 20:00, set for 20:00 of next day
  if (currentPeruDate >= expirationDate) {
    expirationDate.setDate(expirationDate.getDate() + 1);
  }

  // Calculate difference in seconds
  const secondsUntilExpiration = Math.floor(
    (expirationDate.getTime() - currentPeruDate.getTime()) / 1000
  );
  return Math.max(1, secondsUntilExpiration); // Minimum 1 second to avoid negative or zero values
};

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const { error, rol: role, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.ProfesorSecundaria,
      RolesSistema.Tutor,
      RolesSistema.PersonalAdministrativo,
    ]);

    if (error && !role && !decodedToken) return error;

    const myId = decodedToken.ID_Usuario; // ✅ For directors: ID, for others: DNI

    // Parse request body as JSON
    const body =
      (await req.json()) as Partial<RegistrarAsistenciaIndividualRequestBody>;

    const {
      Actor: actor,
      Id_Usuario: userId,
      Id_Estudiante: studentId,
      FechaHoraEsperadaISO: expectedDateTimeISO,
      ModoRegistro: registrationMode,
      TipoAsistencia: attendanceTypeParam,
      desfaseSegundosAsistenciaEstudiante: studentAttendanceOffsetSeconds,
      NivelDelEstudiante: studentLevel,
      Grado: grade,
      Seccion: section,
    } = body;

    // ✅ NEW LOGIC: Determine registration type
    const isStudentRegistration = !!(
      studentId && typeof studentAttendanceOffsetSeconds === "number"
    );
    const isStaffRegistration = !!(userId && expectedDateTimeISO);
    const isOwnRegistration = !isStudentRegistration && !isStaffRegistration;

    let finalActor: ActoresSistema;
    let finalId: string;
    let finalAttendanceType: TipoAsistencia;
    let offsetSeconds: number;
    let currentTimestamp: number = 0;

    if (isOwnRegistration) {
      // ✅ OWN REGISTRATION: Only requires ModoRegistro and FechaHoraEsperadaISO
      console.log(`🔍 Own registration detected for role: ${role}`);

      if (!expectedDateTimeISO) {
        return NextResponse.json(
          {
            success: false,
            message: "FechaHoraEsperadaISO is required for own registration",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Map role to actor
      const mappedActor = mapRoleToStaffActor(role!);
      if (!mappedActor) {
        return NextResponse.json(
          {
            success: false,
            message: `Role ${role} cannot register personal attendance`,
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      finalActor = mappedActor;
      finalId = myId; // ✅ Use ID/DNI from token
      finalAttendanceType = TipoAsistencia.ParaPersonal; // ✅ Always Personal for own registration

      // Calculate offset for own registration
      const currentPeruDate = await getCurrentDateTimeInPeru();
      currentTimestamp = currentPeruDate.getTime();
      offsetSeconds = Math.floor(
        (currentTimestamp - new Date(expectedDateTimeISO).getTime()) / 1000
      );
    } else if (isStudentRegistration) {
      // ✅ STUDENT REGISTRATION: Requires Id_Estudiante + desfaseSegundosAsistenciaEstudiante
      console.log(`🔍 Student registration detected`);

      // Validate student ID
      const idValidation = validateIdActor(studentId!, true);
      if (!idValidation.isValid) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid student ID: ${idValidation.errorMessage}`,
            errorType: idValidation.errorType,
          },
          { status: 400 }
        );
      }

      // Validate classroom data for students
      if (!studentLevel || !grade || !section) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Educational level, grade and section are required to register students",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validate that grade is numeric and in valid range
      if (typeof grade !== "number" || grade < 1 || grade > 6) {
        return NextResponse.json(
          {
            success: false,
            message: "The grade must be a number between 1 and 6",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validate that section is a valid letter
      if (typeof section !== "string" || !/^[A-Z]$/.test(section)) {
        return NextResponse.json(
          {
            success: false,
            message: "The section must be an uppercase letter (A-Z)",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      finalActor = ActoresSistema.Estudiante;
      finalId = studentId!;
      offsetSeconds = studentAttendanceOffsetSeconds!;

      // Determine attendance type based on educational level
      if (studentLevel.toLowerCase().includes("primaria")) {
        finalAttendanceType = TipoAsistencia.ParaEstudiantesPrimaria;
      } else {
        finalAttendanceType = TipoAsistencia.ParaEstudiantesSecundaria;
      }
    } else if (isStaffRegistration) {
      // ✅ STAFF REGISTRATION: Requires Id_Usuario + FechaHoraEsperadaISO
      console.log(`🔍 Staff registration detected`);

      // Validate required fields
      if (!actor || !attendanceTypeParam) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Actor and TipoAsistencia are required to register staff",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validate Actor
      if (!Object.values(ActoresSistema).includes(actor as ActoresSistema)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid Actor",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validate TipoAsistencia
      if (!Object.values(TipoAsistencia).includes(attendanceTypeParam)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid TipoAsistencia",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // ✅ ID validation according to actor
      if (actor !== ActoresSistema.Directivo) {
        const idValidation = validateIdActor(userId!, true);
        if (!idValidation.isValid) {
          return NextResponse.json(
            {
              success: false,
              message: `Invalid user ID for ${actor}: ${idValidation.errorMessage}`,
              errorType: idValidation.errorType,
            },
            { status: 400 }
          );
        }
      }

      finalActor = actor as ActoresSistema;
      finalId = userId!;
      finalAttendanceType = attendanceTypeParam;

      // Calculate offset for staff registration
      const currentPeruDate = await getCurrentDateTimeInPeru();
      currentTimestamp = currentPeruDate.getTime();
      offsetSeconds = Math.floor(
        (currentTimestamp - new Date(expectedDateTimeISO).getTime()) / 1000
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message:
            "You must specify either student registration (Id_Estudiante + offset) or staff (Id_Usuario + FechaHoraEsperadaISO)",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Validate ModoRegistro
    if (!registrationMode || !Object.values(ModoRegistro).includes(registrationMode)) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid ModoRegistro is required",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // ✅ PERMISSIONS VALIDATION
    const permissionValidation = validateRegistrationPermissions(
      role!,
      finalActor,
      finalAttendanceType,
      finalId,
      myId,
      isOwnRegistration,
      grade,
      section,
      studentLevel
    );

    if (!permissionValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: permissionValidation.message,
          errorType: PermissionErrorTypes.INSUFFICIENT_PERMISSIONS,
        },
        { status: 403 }
      );
    }

    // Create key for Redis
    const todayDate = await getCurrentDateInPeru();
    let key: string;

    if (isStudentRegistration) {
      // For students: include level, grade and section in key
      key = `${todayDate}:${registrationMode}:${finalActor}:${studentLevel}:${grade}:${section}:${finalId}`;
    } else {
      // For staff: traditional key
      key = `${todayDate}:${registrationMode}:${finalActor}:${finalId}`;
    }

    // Use the determined TipoAsistencia
    const redisClientInstance = redisClient(
      RedisInstanceGroupByAttendanceType[finalAttendanceType]
    );

    // Check if a record already exists in Redis
    const existingRecord = await redisClientInstance.get(key);
    const isNewRecord = !existingRecord;

    if (isNewRecord) {
      // Set the expiration
      const secondsUntilExpiration = await calculateSecondsUntilExpiration();

      if (isStudentRegistration) {
        // ✅ For students: Only [desfaseSegundos]
        const value = [offsetSeconds.toString()];
        await redisClientInstance.set(key, value, secondsUntilExpiration);
      } else {
        // ✅ For staff: [timestamp, desfaseSegundos] (no changes)
        const value = [currentTimestamp.toString(), offsetSeconds.toString()];
        await redisClientInstance.set(key, value, secondsUntilExpiration);
      }
    }

    console.log(
      `✅ Attendance record: ${
        isOwnRegistration
          ? "OWN"
          : isStudentRegistration
          ? "STUDENT"
          : "STAFF"
      } - Actor: ${finalActor} - ${
        isNewRecord ? "NEW" : "EXISTING"
      } - Offset: ${offsetSeconds}s`
    );

    return NextResponse.json(
      {
        success: true,
        message: isNewRecord
          ? "Attendance recorded successfully"
          : "Attendance has already been recorded previously",
        data: {
          timestamp: currentTimestamp || Date.now(), // For students it will be the approximate current date
          offsetSeconds,
          isNewRecord,
          isOwnRegistration,
          registeredActor: finalActor,
          attendanceType: finalAttendanceType,
        },
      } as RegistrarAsistenciaIndividualSuccessResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error("Error registering attendance:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Error registering attendance",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        ErrorDetails: error instanceof Error ? error.message : String(error),
      } as ErrorResponseAPIBase,
      { status: 500 }
    );
  }
}
