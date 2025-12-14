import { NextRequest, NextResponse } from "next/server";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { Meses } from "@/interfaces/shared/Meses";
import { LogoutTypes, ErrorDetailsForLogout } from "@/interfaces/LogoutTypes";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { redirectToLogin } from "@/lib/utils/backend/auth/functions/redirectToLogin";
import { redisClient } from "../../../../../config/Redis/RedisClient";
import { getCurrentDateInPeru } from "../../_helpers/obtenerFechaActualPeru";
import {
  EstadoTomaAsistenciaResponseBody,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import {
  NOMBRE_BANDERA_INICIO_TOMA_ASISTENCIA_PERSONAL,
  NOMBRE_BANDERA_INICIO_TOMA_ASISTENCIA_PRIMARIA,
  NOMBRE_BANDERA_INICIO_TOMA_ASISTENCIA_SECUNDARIA,
} from "@/constants/NOMBRES_BANDERAS_INICIO_TOMA_ASISTENCIAS";
import { GrupoInstaciasDeRedisPorTipoAsistencia } from "../marcar/route";

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const { error } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.ProfesorSecundaria,
      RolesSistema.Tutor,
    ]);

    if (error) return error;

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const attendanceTypeParam = searchParams.get(
      "TipoAsistencia"
    ) as TipoAsistencia;

    // Validate parameters
    if (!attendanceTypeParam) {
      return NextResponse.json(
        {
          success: false,
          message: "The TipoAsistencia parameter is required",
        },
        { status: 400 }
      );
    }

    // Validate that TipoAsistencia is valid
    if (
      !Object.values(TipoAsistencia).includes(
        attendanceTypeParam as TipoAsistencia
      )
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "The provided TipoAsistencia is not valid",
        },
        { status: 400 }
      );
    }

    // Get the current date in Peru
    const currentPeruDate = await getCurrentDateInPeru();
    const [year, month, day] = currentPeruDate.split("-").map(Number);

    // Determine the correct Redis key based on TipoAsistencia
    let redisKey;
    const attendanceType = attendanceTypeParam;

    switch (attendanceType) {
      case TipoAsistencia.ParaPersonal:
        redisKey = NOMBRE_BANDERA_INICIO_TOMA_ASISTENCIA_PERSONAL;
        break;
      case TipoAsistencia.ParaEstudiantesPrimaria:
        redisKey = NOMBRE_BANDERA_INICIO_TOMA_ASISTENCIA_PRIMARIA;
        break;
      case TipoAsistencia.ParaEstudiantesSecundaria:
        redisKey = NOMBRE_BANDERA_INICIO_TOMA_ASISTENCIA_SECUNDARIA;
        break;
      default:
        return NextResponse.json(
          { success: false, message: "Unrecognized attendance type" },
          { status: 400 }
        );
    }

    // Get the Redis instance corresponding to the attendance type
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[attendanceType]
    );

    // Query the value in Redis
    const value = await redisClientInstance.get(redisKey);

    // Determine if attendance has started - If there is no value, we simply consider that it has not started
    const attendanceStarted = value === "true";
    console.log("test", value);

    // Build the response - always return a valid response with the current status
    const response: EstadoTomaAsistenciaResponseBody = {
      TipoAsistencia: attendanceType,
      Dia: day,
      Mes: month as Meses,
      Anio: year,
      AsistenciaIniciada: attendanceStarted,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error querying attendance taking status:", error);

    // Determine the type of error
    let logoutType: LogoutTypes | null = null;
    const errorDetails: ErrorDetailsForLogout = {
      message: "Error querying attendance taking status",
      origin: "api/estado-toma-asistencia",
      timestamp: Date.now(),
      siasisComponent: "RDP04",
    };

    if (error instanceof Error) {
      // If it's a critical Redis error or severe connection problems
      if (
        error.message.includes("Redis connection lost") ||
        error.message.includes("Redis connection failed") ||
        error.message.includes("Redis connection timed out")
      ) {
        logoutType = LogoutTypes.SYSTEM_ERROR;
        errorDetails.message = "Error connecting to the data system";
      }

      errorDetails.message += `: ${error.message}`;
    }

    // If we identify a critical error, redirect to login
    if (logoutType) {
      return redirectToLogin(logoutType, errorDetails);
    }

    // For other errors, simply return a JSON error response
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}