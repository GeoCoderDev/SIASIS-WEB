import { NextRequest, NextResponse } from "next/server";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import {
  GruposIntanciasDeRedis,
  redisClient,
} from "../../../../../config/Redis/RedisClient";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { getCurrentDateInPeru } from "../../_helpers/obtenerFechaActualPeru";
import {
  EliminarAsistenciaRequestBody,
  EliminarAsistenciaSuccessResponse,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { validateDNI } from "@/lib/helpers/validators/data/validateDNI";
import {
  RequestErrorTypes,
  SystemErrorTypes,
} from "@/interfaces/shared/errors";
import { GrupoInstaciasDeRedisPorTipoAsistencia } from "../marcar/route";

// Function to validate permissions according to role
const validateDeletionPermissions = (
  role: RolesSistema,
  actor: ActoresSistema,
  attendanceType: TipoAsistencia
): { isValid: boolean; message?: string } => {
  switch (role) {
    case RolesSistema.Directivo:
      // Can only delete staff attendance, NOT student attendance
      if (actor === ActoresSistema.Estudiante) {
        return {
          isValid: false,
          message:
            "Directors cannot delete student attendances",
        };
      }
      // For staff it must be the correct type
      if (attendanceType !== TipoAsistencia.ParaPersonal) {
        return {
          isValid: false,
          message:
            "To delete staff attendances, TipoAsistencia.ParaPersonal must be used",
        };
      }
      return { isValid: true };

    case RolesSistema.ProfesorPrimaria:
      // Can only delete primary student attendances
      if (actor !== ActoresSistema.Estudiante) {
        return {
          isValid: false,
          message:
            "Primary school teachers can only delete student attendances",
        };
      }
      if (attendanceType !== TipoAsistencia.ParaEstudiantesPrimaria) {
        return {
          isValid: false,
          message:
            "Primary school teachers can only delete primary student attendances",
        };
      }
      return { isValid: true };

    case RolesSistema.Auxiliar:
      // Can only delete secondary student attendances
      if (actor !== ActoresSistema.Estudiante) {
        return {
          isValid: false,
          message:
            "Assistants can only delete student attendances",
        };
      }
      if (attendanceType !== TipoAsistencia.ParaEstudiantesSecundaria) {
        return {
          isValid: false,
          message:
            "Assistants can only delete secondary student attendances",
        };
      }
      return { isValid: true };

    default:
      return {
        isValid: false,
        message: "Your role does not have permission to delete attendances",
      };
  }
};

// Function to build the Redis key
const buildRedisKey = (
  date: string,
  registrationMode: ModoRegistro,
  actor: ActoresSistema,
  dni: string,
  educationalLevel?: string,
  grade?: number,
  section?: string
): string => {
  if (
    actor === ActoresSistema.Estudiante &&
    educationalLevel &&
    grade &&
    section
  ) {
    // For students with complete data
    return `${date}:${registrationMode}:${actor}:${dni}:${educationalLevel}:${grade}:${section}`;
  } else {
    // For staff or when complete student data is not specified
    return `${date}:${registrationMode}:${actor}:${dni}`;
  }
};

// Function to search for student keys by pattern
const findStudentKey = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redisClientInstance: ReturnType<typeof redisClient>,
  date: string,
  registrationMode: ModoRegistro,
  actor: ActoresSistema,
  dni: string
): Promise<string | null> => {
  const pattern = `${date}:${registrationMode}:${actor}:${dni}:*`;

  try {
    const keys = await redisClientInstance.keys(pattern);

    if (keys.length === 0) {
      return null;
    }

    if (keys.length === 1) {
      return keys[0];
    }

    // If there are multiple keys, we return the first one found
    // In a real scenario, this might require additional logic
    console.warn(
      `Multiple keys found for student ${dni}:`,
      keys
    );
    return keys[0];
  } catch (error) {
    console.error("Error searching for student keys:", error);
    return null;
  }
};

export async function DELETE(req: NextRequest) {
  try {
    // Verify authentication - Only certain roles can access
    const { error, rol: role, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.Auxiliar,
    ]);

    if (error && !role && !decodedToken) return error;

    // Parse the request body
    const body = (await req.json()) as EliminarAsistenciaRequestBody;

    const {
      Id_Usuario: userId,
      Actor: actor,
      ModoRegistro: registrationMode,
      TipoAsistencia: attendanceType,
      NivelEducativo: educationalLevel,
      Grado: grade,
      Seccion: section,
      Fecha: date,
    } = body;

    // Validate DNI
    const dniValidation = validateDNI(userId, true);
    // The director will have an ID
    if (!dniValidation.isValid && actor !== ActoresSistema.Directivo) {
      return NextResponse.json(
        {
          success: false,
          message: dniValidation.errorMessage,
          errorType: dniValidation.errorType,
        },
        { status: 400 }
      );
    }

    // Validate mandatory fields
    if (!actor || !registrationMode || !attendanceType) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The following fields are required: DNI, Actor, ModoRegistro and TipoAsistencia",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Validate that Actor is valid
    if (!Object.values(ActoresSistema).includes(actor)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid Actor",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Validate that ModoRegistro is valid
    if (!Object.values(ModoRegistro).includes(registrationMode)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid ModoRegistro",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Validate that TipoAsistencia is valid
    if (!Object.values(TipoAsistencia).includes(attendanceType)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid TipoAsistencia",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Validate permissions according to role
    const permissionValidation = validateDeletionPermissions(
      role!,
      actor,
      attendanceType
    );

    if (!permissionValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: permissionValidation.message,
        },
        { status: 403 }
      );
    }

    // Determine the date to use
    const deletionDate = date || (await getCurrentDateInPeru());

    // Validate date format if provided
    if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        {
          success: false,
          message: "The date format must be YYYY-MM-DD",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Get the corresponding Redis instance
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[attendanceType]
    );

    // Build the key or search for it
    let keyToDelete: string | null = null;

    if (actor === ActoresSistema.Estudiante) {
      if (educationalLevel && grade && section) {
        // If all student data is provided, build exact key
        keyToDelete = buildRedisKey(
          deletionDate,
          registrationMode,
          actor,
          userId,
          educationalLevel,
          grade,
          section
        );
      } else {
        // If all data is not provided, search by pattern
        keyToDelete = await findStudentKey(
          redisClientInstance,
          deletionDate,
          registrationMode,
          actor,
          userId
        );
      }
    } else {
      // For staff, build key directly
      keyToDelete = buildRedisKey(
        deletionDate,
        registrationMode,
        actor,
        userId
      );
    }

    if (!keyToDelete) {
      return NextResponse.json(
        {
          success: false,
          message: "No attendance to delete was found",
        },
        { status: 404 }
      );
    }

    // Check if the key exists before trying to delete it
    const exists = await redisClientInstance.exists(keyToDelete);

    if (!exists) {
      return NextResponse.json(
        {
          success: false,
          message: "The specified attendance does not exist",
        },
        { status: 404 }
      );
    }

    // Delete the attendance
    const result = await redisClientInstance.del(keyToDelete);

    console.log(
      `✅ Attendance deleted: ${keyToDelete} by user ${role} (${decodedToken.ID_Usuario})`
    );

    // Successful response
    const response: EliminarAsistenciaSuccessResponse = {
      success: true,
      message: "Attendance deleted successfully",
      data: {
        attendanceDeleted: result > 0,
        deletedKey: keyToDelete,
        fecha: deletionDate,
      },
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("❌ Error deleting attendance:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        errorDetails: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
