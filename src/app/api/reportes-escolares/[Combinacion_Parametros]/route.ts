import { NextRequest, NextResponse } from "next/server";

import {
  EstadoReporteAsistenciaEscolar,
  ReporteAsistenciaEscolarAnonimo,
} from "@/interfaces/shared/ReporteAsistenciaEscolar";
import { T_Reportes_Asistencia_Escolar } from "@prisma/client";
import {
  PermissionErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
} from "@/interfaces/shared/errors";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";
import decodificarCombinacionParametrosParaReporteEscolar from "@/lib/helpers/decoders/reportes-asistencia-escolares/decodificarCombinacionParametrosParaReporteEscolar";
import {
  GruposIntanciasDeRedis,
  redisClient,
} from "../../../../../config/Redis/RedisClient";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { DatosAsistenciaHoyHelper } from "../../_utils/DatosAsistenciaHoyHelper";

// ✅ Main change: params is now a Promise and must be awaited
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ ParameterCombination: string }> }
) {
  try {
    // ✅ Await params before using them
    const { ParameterCombination } = await params;

    // ✅ AUTHENTICATION
    const { error, rol: role, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.ProfesorSecundaria,
      RolesSistema.Tutor,
    ]);

    if (error && !role && !decodedToken) return error;

    console.log(`🔐 Authenticated user: ${role} - ${decodedToken.ID_Usuario}`);

    // Validate that the parameter was received
    if (!ParameterCombination) {
      return NextResponse.json(
        {
          success: false,
          message: "The ParameterCombination parameter is required",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    // Validate parameter length (maximum 40 characters according to schema)
    if (ParameterCombination.length > 40) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The ParameterCombination parameter exceeds the maximum allowed length (40 characters)",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    // ✅ VALIDATE that the parameter combination is valid using the decoding function
    const decodedParameters =
      decodificarCombinacionParametrosParaReporteEscolar(
        ParameterCombination
      );

    if (decodedParameters === false) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The combination of parameters is not valid. Check the format and the provided values.",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    console.log(
      `🔍 Querying report with decoded parameters:`,
      JSON.stringify(decodedParameters, null, 2)
    );

    // ✅ VALIDATE PERMISSIONS using the helper
    const attendanceHelper = await DatosAsistenciaHoyHelper.obtenerInstancia();
    const permissionValidation = attendanceHelper.validarPermisosReporte(
      role!,
      decodedToken.ID_Usuario,
      decodedParameters.aulasSeleccionadas.Nivel,
      decodedParameters.aulasSeleccionadas.Grado,
      decodedParameters.aulasSeleccionadas.Seccion
    );

    if (!permissionValidation.tienePermiso) {
      console.log(
        `❌ Permission denied for ${role}: ${permissionValidation.mensaje}`
      );
      return NextResponse.json(
        {
          success: false,
          message:
            permissionValidation.mensaje ||
            "You do not have permission to query this report",
          errorType: PermissionErrorTypes.INSUFFICIENT_PERMISSIONS,
        } as ErrorResponseAPIBase,
        { status: 403 }
      );
    }

    console.log(`✅ Permissions successfully validated for role ${role}`);

    // Get Redis instance for school attendance reports
    const redisClientInstance = redisClient(
      GruposIntanciasDeRedis.ParaReportesDeAsistenciasEscolares
    );

    // Search for the report in Redis using the parameter combination as key
    const reportData = await redisClientInstance.get(ParameterCombination);

    // If the report doesn't exist, return 404
    if (!reportData) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No report was found with that combination of parameters",
          errorType: RequestErrorTypes.RESOURCE_NOT_FOUND,
        } as ErrorResponseAPIBase,
        { status: 404 }
      );
    }

    // Parse the data from Redis (may come as JSON string)
    const completeReport: T_Reportes_Asistencia_Escolar =
      typeof reportData === "string" ? JSON.parse(reportData) : reportData;

    // Validate that the report status is valid
    if (
      !Object.values(EstadoReporteAsistenciaEscolar).includes(
        completeReport.Estado_Reporte as EstadoReporteAsistenciaEscolar
      )
    ) {
      console.warn(
        `⚠️ Invalid report status found: ${completeReport.Estado_Reporte}`
      );
    }

    // Filter only the data needed by the ReporteAsistenciaEscolarAnonimo interface
    const anonymousReport: ReporteAsistenciaEscolarAnonimo = {
      Combinacion_Parametros_Reporte:
        completeReport.Combinacion_Parametros_Reporte,
      Estado_Reporte: completeReport.Estado_Reporte,
      Datos_Google_Drive_Id: completeReport.Datos_Google_Drive_Id,
      Fecha_Generacion: completeReport.Fecha_Generacion,
    };

    console.log(
      `✅ Report successfully queried: ${ParameterCombination} - Status: ${completeReport.Estado_Reporte} - Type: ${decodedParameters.tipoReporte} - Level: ${decodedParameters.aulasSeleccionadas.Nivel} - Grade: ${decodedParameters.aulasSeleccionadas.Grado}${decodedParameters.aulasSeleccionadas.Seccion}`
    );

    // Return successful response with filtered data
    return NextResponse.json(
      {
        success: true,
        message: "Report found successfully",
        data: anonymousReport,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error querying attendance report:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Error querying attendance report",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        ErrorDetails: error instanceof Error ? error.message : String(error),
      } as ErrorResponseAPIBase,
      { status: 500 }
    );
  }
}