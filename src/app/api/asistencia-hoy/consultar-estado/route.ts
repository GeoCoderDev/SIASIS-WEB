import { NextRequest, NextResponse } from "next/server";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { Meses } from "@/interfaces/shared/Meses";
import { LogoutTypes, ErrorDetailsForLogout } from "@/interfaces/LogoutTypes";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { redirectToLogin } from "@/lib/utils/backend/auth/functions/redirectToLogin";
import { redisClient } from "../../../../../config/Redis/RedisClient";
import { obtenerFechaActualPeru } from "../../_helpers/obtenerFechaActualPeru";
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
    const tipoAsistenciaParam = searchParams.get(
      "TipoAsistencia"
    ) as TipoAsistencia;

    // Validate parameters
    if (!tipoAsistenciaParam) {
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
        tipoAsistenciaParam as TipoAsistencia
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
    const fechaActualPeru = await obtenerFechaActualPeru();
    const [anio, mes, dia] = fechaActualPeru.split("-").map(Number);

    // Determine the correct Redis key based on TipoAsistencia
    let redisKey;
    const tipoAsistencia = tipoAsistenciaParam;

    switch (tipoAsistencia) {
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
      GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
    );

    // Query the value in Redis
    const valor = await redisClientInstance.get(redisKey);

    // Determine if attendance has started - If there is no value, we simply consider that it has not started
    const asistenciaIniciada = valor === "true";
    console.log("test", valor);

    // Build the response - always return a valid response with the current status
    const respuesta: EstadoTomaAsistenciaResponseBody = {
      TipoAsistencia: tipoAsistencia,
      Dia: dia,
      Mes: mes as Meses,
      Anio: anio,
      AsistenciaIniciada: asistenciaIniciada,
    };

    return NextResponse.json(respuesta, { status: 200 });
  } catch (error) {
    console.error("Error querying attendance taking status:", error);

    // Determine the type of error
    let logoutType: LogoutTypes | null = null;
    const errorDetails: ErrorDetailsForLogout = {
      mensaje: "Error querying attendance taking status",
      origen: "api/estado-toma-asistencia",
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
        logoutType = LogoutTypes.ERROR_SISTEMA;
        errorDetails.mensaje = "Error connecting to the data system";
      }

      errorDetails.mensaje += `: ${error.message}`;
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
