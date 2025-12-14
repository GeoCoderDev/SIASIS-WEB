import { NextRequest, NextResponse } from "next/server";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { Meses } from "@/interfaces/shared/Meses";
import { LogoutTypes, ErrorDetailsForLogout } from "@/interfaces/LogoutTypes";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { redirectToLogin } from "@/lib/utils/backend/auth/functions/redirectToLogin";
import { redisClient } from "../../../../../config/Redis/RedisClient";
import {
  getCurrentDateInPeru,
  getCurrentDateTimeInPeru,
} from "../../_helpers/obtenerFechaActualPeru";
import {
  NOMBRE_BANDERA_INICIO_TOMA_ASISTENCIA_PERSONAL,
  NOMBRE_BANDERA_INICIO_TOMA_ASISTENCIA_PRIMARIA,
  NOMBRE_BANDERA_INICIO_TOMA_ASISTENCIA_SECUNDARIA,
} from "@/constants/NOMBRES_BANDERAS_INICIO_TOMA_ASISTENCIAS";
import {
  EstadoTomaAsistenciaResponseBody,
  IniciarTomaAsistenciaRequestBody,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { GrupoInstaciasDeRedisPorTipoAsistencia } from "../marcar/route";

/**
 * Calculates the remaining seconds until 23:59:59 of the current day in Peruvian time
 * Now uses the improved function that handles offsets automatically
 * @returns Seconds until the end of the day in Peru
 */
async function calculateSecondsUntilEndOfDayPeru(): Promise<number> {
  // ✅ Use the new function that handles all offsets automatically
  const currentPeruDate = await getCurrentDateTimeInPeru();

  // Create a date representing 23:59:59 of the same day in Peru
  const endOfDayPeru = new Date(currentPeruDate);
  endOfDayPeru.setHours(23, 59, 59, 999);

  // Calculate difference in seconds
  const remainingSeconds = Math.floor(
    (endOfDayPeru.getTime() - currentPeruDate.getTime()) / 1000
  );

  // Log for debugging (keeping useful information)
  console.log(
    `Current date Peru (with offsets): ${currentPeruDate.toISOString()}`
  );
  console.log(`End of Peruvian day: ${endOfDayPeru.toISOString()}`);
  console.log(`Calculated remaining seconds: ${remainingSeconds}`);

  // Ensure that we return at least 1 second and at most one day
  return Math.max(Math.min(remainingSeconds, 86400), 1);
}

export async function POST(req: NextRequest) {
  try {
    // Verify authentication - only roles with permissions to start attendance
    const { error } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
    ]);

    if (error) return error;

    // Get body data
    const body = (await req.json()) as IniciarTomaAsistenciaRequestBody;

    // Validate that TipoAsistencia was provided
    if (!body.TipoAsistencia) {
      return NextResponse.json(
        {
          success: false,
          message: "The TipoAsistencia parameter is required in the body",
        },
        { status: 400 }
      );
    }

    // Validate that TipoAsistencia is valid
    if (!Object.values(TipoAsistencia).includes(body.TipoAsistencia)) {
      return NextResponse.json(
        {
          success: false,
          message: "The provided TipoAsistencia is not valid",
        },
        { status: 400 }
      );
    }

    // ✅ Get the current date in Peru using both functions
    // The original function continues to work for backward compatibility
    const currentPeruDate = await getCurrentDateInPeru();
    const [year, month, day] = currentPeruDate.split("-").map(Number);

    // ✅ We can also get the full date/time for additional logs if needed
    const fullDateTimePeru = await getCurrentDateTimeInPeru();
    console.log(
      `📅 Full date Peru (with offsets): ${fullDateTimePeru.toISOString()}`
    );
    console.log(`📅 Date string Peru: ${currentPeruDate}`);

    // Determine the correct key in Redis according to TipoAsistencia
    let redisKey;
    const attendanceType = body.TipoAsistencia;

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

    // ✅ Calculate seconds until the end of the day using the improved function
    const secondsUntilEndOfDay = await calculateSecondsUntilEndOfDayPeru();

    console.log(
      `⏰ Setting flag with expiration of ${secondsUntilEndOfDay} seconds (until 23:59:59 Peruvian time)`
    );
    console.log(
      `⏰ In readable time: ${Math.floor(
        secondsUntilEndOfDay / 3600
      )}h ${Math.floor((secondsUntilEndOfDay % 3600) / 60)}m ${
        secondsUntilEndOfDay % 60
      }s`
    );

    // Get the Redis instance corresponding to the attendance type
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[attendanceType]
    );

    // Store in Redis with expiration at the end of the Peruvian day
    const savedValue = await redisClientInstance.set(
      redisKey,
      "true",
      secondsUntilEndOfDay
    );

    if (savedValue !== "OK") {
      return NextResponse.json(
        {
          success: false,
          message: "Error storing attendance status in Redis",
        },
        { status: 500 }
      );
    }

    // Build the response
    const response: EstadoTomaAsistenciaResponseBody = {
      TipoAsistencia: attendanceType,
      Dia: day,
      Mes: month as Meses,
      Anio: year,
      AsistenciaIniciada: true,
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Error starting attendance taking status:", error);

    // Determine the type of error
    let logoutType: LogoutTypes | null = null;
    const errorDetails: ErrorDetailsForLogout = {
      message: "Error starting attendance taking status",
      origin: "api/estado-toma-asistencia",
      timestamp: Date.now(),
      siasisComponent: "RDP05", // Redis component
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
      // If it's a JSON parsing error
      else if (
        error.message.includes("JSON") ||
        error.message.includes("parse") ||
        error.message.includes("Unexpected token")
      ) {
        logoutType = LogoutTypes.CORRUPT_DATA_ERROR;
        errorDetails.message = "Error processing request data";
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