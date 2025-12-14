import { NextRequest, NextResponse } from "next/server";

import {
  EstadoReporteAsistenciaEscolar,
  ReporteAsistenciaEscolarAnonimo,
  EstadosReporteAsistenciaEscolarTextos,
} from "@/interfaces/shared/ReporteAsistenciaEscolar";
import { T_Reportes_Asistencia_Escolar } from "@prisma/client";
import {
  PermissionErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
} from "@/interfaces/shared/errors";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import decodificarCombinacionParametrosParaReporteEscolar from "@/lib/helpers/decoders/reportes-asistencia-escolares/decodificarCombinacionParametrosParaReporteEscolar";
import { DatosAsistenciaHoyHelper } from "../../_utils/DatosAsistenciaHoyHelper";
import {
  GruposIntanciasDeRedis,
  redisClient,
} from "../../../../../config/Redis/RedisClient";

import { TIEMPO_EXPIRACION_REPORTES_ASISTENCIAS_ESCOLARES_SEGUNDOS_CACHE_REDIS } from "@/constants/REPORTES_ASISTENCIA";

/**
 * GitHub Actions configuration for reports
 */
const GITHUB_CONFIG = {
  TOKEN: process.env.TGSH01_GITHUB_STATIC_PERSONAL_ACCESS_TOKEN,
  REPOSITORY_OWNER: process.env.TGSH01_GITHUB_WEBHOOK_REPOSITORY_OWNER_USERNAME,
  REPOSITORY_NAME: process.env.TGSH01_GITHUB_WEBHOOK_REPOSITORY_NAME,
} as const;

/**
 * Triggers report generation via GitHub Actions
 */
async function triggerReportGeneration(
  payload: T_Reportes_Asistencia_Escolar
): Promise<void> {
  try {
    console.log(`🚀 STARTING TRIGGER of report generation`);

    // Verify GitHub configuration
    if (!GITHUB_CONFIG.TOKEN) {
      throw new Error("GitHub TOKEN not configured");
    }

    if (!GITHUB_CONFIG.REPOSITORY_OWNER || !GITHUB_CONFIG.REPOSITORY_NAME) {
      throw new Error("Incomplete GitHub repository configuration");
    }

    const url = `https://api.github.com/repos/${GITHUB_CONFIG.REPOSITORY_OWNER}/${GITHUB_CONFIG.REPOSITORY_NAME}/dispatches`;
    console.log(`🌐 GitHub Actions URL: ${url}`);

    const githubPayload = {
      event_type: "generate-attendance-report",
      client_payload: {
        ReportParameterCombination: payload.Combinacion_Parametros_Reporte,
        ReportStatus: payload.Estado_Reporte,
        GoogleDriveDataId: payload.Datos_Google_Drive_Id,
        GenerationDate: payload.Fecha_Generacion,
        UserRole: payload.Rol_Usuario,
        UserId: payload.Id_Usuario,
      },
    };

    console.log(`📦 Payload to send:`, JSON.stringify(githubPayload, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `token ${GITHUB_CONFIG.TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(githubPayload),
    });

    console.log(`📡 GitHub Actions Response - Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error response body:`, errorText);
      throw new Error(
        `Error triggering GitHub Action: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    console.log(`✅ GitHub Action triggered successfully for report`);
  } catch (error) {
    console.error(`❌ Error triggering GitHub Action:`, error);
    throw error;
  }
}

/**
 * Maps system role to 2-character format for storage
 */
function mapRoleToShortCode(role: RolesSistema): string {
  const mapping: Record<RolesSistema, string> = {
    [RolesSistema.Directivo]: "D",
    [RolesSistema.Auxiliar]: "A",
    [RolesSistema.ProfesorPrimaria]: "PP",
    [RolesSistema.ProfesorSecundaria]: "PS",
    [RolesSistema.Tutor]: "T",
    [RolesSistema.Responsable]: "R",
    [RolesSistema.PersonalAdministrativo]: "PA",
  };

  return mapping[role] || "??";
}

export async function POST(req: NextRequest) {
  try {
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

    // ✅ PARSE BODY
    const body = (await req.json()) as {
      ReportParameterCombination?: string;
    };

    const { ReportParameterCombination } = body;

    if (!ReportParameterCombination) {
      return NextResponse.json(
        {
          success: false,
          message: "ReportParameterCombination is required in the body",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    console.log(
      `📋 Received parameter combination: ${ReportParameterCombination}`
    );

    // ✅ VALIDATE FORMAT
    const decodedParameters =
      decodificarCombinacionParametrosParaReporteEscolar(
        ReportParameterCombination
      );

    if (decodedParameters === false) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The parameter combination is not valid. Please check the format and provided values.",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    console.log(
      `🔍 Decoded parameters:`,
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
            "You do not have permission to generate this report",
          errorType: PermissionErrorTypes.INSUFFICIENT_PERMISSIONS,
        } as ErrorResponseAPIBase,
        { status: 403 }
      );
    }

    console.log(`✅ Permissions successfully validated for role ${role}`);

    // ✅ VERIFY IF ALREADY EXISTS IN REDIS
    const redisClientInstance = redisClient(
      GruposIntanciasDeRedis.ParaReportesDeAsistenciasEscolares
    );

    const existingReport = await redisClientInstance.get(
      ReportParameterCombination
    );

    if (existingReport) {
      console.log(
        `📋 Report already exists in Redis: ${ReportParameterCombination}`
      );

      // Parse existing data
      const completeReport: T_Reportes_Asistencia_Escolar =
        typeof existingReport === "string"
          ? JSON.parse(existingReport)
          : existingReport;

      // Filter only anonymous data for the response
      const reportStatusData: ReporteAsistenciaEscolarAnonimo = {
        Combinacion_Parametros_Reporte:
          completeReport.Combinacion_Parametros_Reporte,
        Estado_Reporte: completeReport.Estado_Reporte,
        Datos_Google_Drive_Id: completeReport.Datos_Google_Drive_Id,
        Fecha_Generacion: completeReport.Fecha_Generacion,
      };

      return NextResponse.json(
        {
          success: true,
          message: `The report already exists and is in state ${
            EstadosReporteAsistenciaEscolarTextos[
              reportStatusData.Estado_Reporte as EstadoReporteAsistenciaEscolar
            ]
          }`,
          data: reportStatusData,
          existed: true,
        },
        { status: 200 }
      );
    }

    console.log(
      `🆕 Report does not exist, proceeding to create: ${ReportParameterCombination}`
    );

    // ✅ CREATE NEW REPORT
    const generationDate = new Date();
    const roleCode = mapRoleToShortCode(role!);

    const newReport: T_Reportes_Asistencia_Escolar = {
      Combinacion_Parametros_Reporte: ReportParameterCombination,
      Estado_Reporte: EstadoReporteAsistenciaEscolar.PENDIENTE,
      Datos_Google_Drive_Id: null,
      Fecha_Generacion: generationDate,
      Rol_Usuario: roleCode,
      Id_Usuario: decodedToken.ID_Usuario,
    };

    console.log(
      `📦 New report to create:`,
      JSON.stringify(newReport, null, 2)
    );

    // ✅ SAVE IN REDIS WITH 12 HOUR EXPIRATION
    await redisClientInstance.set(
      ReportParameterCombination,
      JSON.stringify(newReport),
      TIEMPO_EXPIRACION_REPORTES_ASISTENCIAS_ESCOLARES_SEGUNDOS_CACHE_REDIS
    );

    console.log(
      `💾 Report saved to Redis successfully with an expiration of ${
        TIEMPO_EXPIRACION_REPORTES_ASISTENCIAS_ESCOLARES_SEGUNDOS_CACHE_REDIS /
        3600
      } hours`
    );

    // ✅ TRIGGER GITHUB ACTIONS
    try {
      await triggerReportGeneration(newReport);
      console.log(`🚀 GitHub Action triggered successfully`);
    } catch (errorGithub) {
      console.error(
        `⚠️ Error triggering GitHub Action (report saved in Redis):`,
        errorGithub
      );
      // Don't fail the request if GitHub Actions fails, the report is already in Redis
    }

    // ✅ PREPARE ANONYMOUS RESPONSE
    const reportStatusData: ReporteAsistenciaEscolarAnonimo = {
      Combinacion_Parametros_Reporte:
        newReport.Combinacion_Parametros_Reporte,
      Estado_Reporte: newReport.Estado_Reporte,
      Datos_Google_Drive_Id: newReport.Datos_Google_Drive_Id,
      Fecha_Generacion: newReport.Fecha_Generacion,
    };

    console.log(
      `✅ Report created successfully: ${ReportParameterCombination}`
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Report created successfully and sent for background generation",
        data: reportStatusData,
        existed: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error creating attendance report:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Error creating attendance report",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        ErrorDetails: error instanceof Error ? error.message : String(error),
      } as ErrorResponseAPIBase,
      { status: 500 }
    );
  }
}