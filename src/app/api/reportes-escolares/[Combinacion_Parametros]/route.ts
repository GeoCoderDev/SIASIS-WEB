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
  { params }: { params: Promise<{ Combinacion_Parametros: string }> }
) {
  try {
    // ✅ Await params before using them
    const { Combinacion_Parametros } = await params;

    // ✅ AUTHENTICATION
    const { error, rol, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.ProfesorSecundaria,
      RolesSistema.Tutor,
    ]);

    if (error && !rol && !decodedToken) return error;

    console.log(`🔐 Authenticated user: ${rol} - ${decodedToken.ID_Usuario}`);

    // Validate that the parameter was received
    if (!Combinacion_Parametros) {
      return NextResponse.json(
        {
          success: false,
          message: "The Combinacion_Parametros parameter is required",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    // Validate parameter length (maximum 40 characters according to schema)
    if (Combinacion_Parametros.length > 40) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The Combinacion_Parametros parameter exceeds the maximum allowed length (40 characters)",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    // ✅ VALIDATE that the parameter combination is valid using the decoding function
    const parametrosDecodificados =
      decodificarCombinacionParametrosParaReporteEscolar(
        Combinacion_Parametros
      );

    if (parametrosDecodificados === false) {
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
      JSON.stringify(parametrosDecodificados, null, 2)
    );

    // ✅ VALIDATE PERMISSIONS using the helper
    const helperAsistencia = await DatosAsistenciaHoyHelper.obtenerInstancia();
    const validacionPermisos = helperAsistencia.validarPermisosReporte(
      rol!,
      decodedToken.ID_Usuario,
      parametrosDecodificados.aulasSeleccionadas.Nivel,
      parametrosDecodificados.aulasSeleccionadas.Grado,
      parametrosDecodificados.aulasSeleccionadas.Seccion
    );

    if (!validacionPermisos.tienePermiso) {
      console.log(
        `❌ Permission denied for ${rol}: ${validacionPermisos.mensaje}`
      );
      return NextResponse.json(
        {
          success: false,
          message:
            validacionPermisos.mensaje ||
            "You do not have permission to query this report",
          errorType: PermissionErrorTypes.INSUFFICIENT_PERMISSIONS,
        } as ErrorResponseAPIBase,
        { status: 403 }
      );
    }

    console.log(`✅ Permissions successfully validated for role ${rol}`);

    // Get Redis instance for school attendance reports
    const redisClientInstance = redisClient(
      GruposIntanciasDeRedis.ParaReportesDeAsistenciasEscolares
    );

    // Search for the report in Redis using the parameter combination as key
    const reporteData = await redisClientInstance.get(Combinacion_Parametros);

    // If the report doesn't exist, return 404
    if (!reporteData) {
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
    const reporteCompleto: T_Reportes_Asistencia_Escolar =
      typeof reporteData === "string" ? JSON.parse(reporteData) : reporteData;

    // Validate that the report status is valid
    if (
      !Object.values(EstadoReporteAsistenciaEscolar).includes(
        reporteCompleto.Estado_Reporte as EstadoReporteAsistenciaEscolar
      )
    ) {
      console.warn(
        `⚠️ Invalid report status found: ${reporteCompleto.Estado_Reporte}`
      );
    }

    // Filter only the data needed by the ReporteAsistenciaEscolarAnonimo interface
    const reporteAnonimo: ReporteAsistenciaEscolarAnonimo = {
      Combinacion_Parametros_Reporte:
        reporteCompleto.Combinacion_Parametros_Reporte,
      Estado_Reporte: reporteCompleto.Estado_Reporte,
      Datos_Google_Drive_Id: reporteCompleto.Datos_Google_Drive_Id,
      Fecha_Generacion: reporteCompleto.Fecha_Generacion,
    };

    console.log(
      `✅ Report successfully queried: ${Combinacion_Parametros} - Status: ${reporteCompleto.Estado_Reporte} - Type: ${parametrosDecodificados.tipoReporte} - Level: ${parametrosDecodificados.aulasSeleccionadas.Nivel} - Grade: ${parametrosDecodificados.aulasSeleccionadas.Grado}${parametrosDecodificados.aulasSeleccionadas.Seccion}`
    );

    // Return successful response with filtered data
    return NextResponse.json(
      {
        success: true,
        message: "Report found successfully",
        data: reporteAnonimo,
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
