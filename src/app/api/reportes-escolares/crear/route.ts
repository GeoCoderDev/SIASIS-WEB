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
async function gatillarGeneracionReporte(
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
        Combinacion_Parametros_Reporte: payload.Combinacion_Parametros_Reporte,
        Estado_Reporte: payload.Estado_Reporte,
        Datos_Google_Drive_Id: payload.Datos_Google_Drive_Id,
        Fecha_Generacion: payload.Fecha_Generacion,
        Rol_Usuario: payload.Rol_Usuario,
        Id_Usuario: payload.Id_Usuario,
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
function mapearRolACodigoCorto(rol: RolesSistema): string {
  const mapeo: Record<RolesSistema, string> = {
    [RolesSistema.Directivo]: "D",
    [RolesSistema.Auxiliar]: "A",
    [RolesSistema.ProfesorPrimaria]: "PP",
    [RolesSistema.ProfesorSecundaria]: "PS",
    [RolesSistema.Tutor]: "T",
    [RolesSistema.Responsable]: "R",
    [RolesSistema.PersonalAdministrativo]: "PA",
  };

  return mapeo[rol] || "??";
}

export async function POST(req: NextRequest) {
  try {
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

    // ✅ PARSE BODY
    const body = (await req.json()) as {
      Combinacion_Parametros_Reporte?: string;
    };

    const { Combinacion_Parametros_Reporte } = body;

    if (!Combinacion_Parametros_Reporte) {
      return NextResponse.json(
        {
          success: false,
          message: "Combinacion_Parametros_Reporte is required in the body",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    console.log(
      `📋 Received parameter combination: ${Combinacion_Parametros_Reporte}`
    );

    // ✅ VALIDATE FORMAT
    const parametrosDecodificados =
      decodificarCombinacionParametrosParaReporteEscolar(
        Combinacion_Parametros_Reporte
      );

    if (parametrosDecodificados === false) {
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
            "You do not have permission to generate this report",
          errorType: PermissionErrorTypes.INSUFFICIENT_PERMISSIONS,
        } as ErrorResponseAPIBase,
        { status: 403 }
      );
    }

    console.log(`✅ Permissions successfully validated for role ${rol}`);

    // ✅ VERIFY IF ALREADY EXISTS IN REDIS
    const redisClientInstance = redisClient(
      GruposIntanciasDeRedis.ParaReportesDeAsistenciasEscolares
    );

    const reporteExistente = await redisClientInstance.get(
      Combinacion_Parametros_Reporte
    );

    if (reporteExistente) {
      console.log(
        `📋 Report already exists in Redis: ${Combinacion_Parametros_Reporte}`
      );

      // Parse existing data
      const reporteCompleto: T_Reportes_Asistencia_Escolar =
        typeof reporteExistente === "string"
          ? JSON.parse(reporteExistente)
          : reporteExistente;

      // Filter only anonymous data for the response
      const datosDeEstadoDeReporte: ReporteAsistenciaEscolarAnonimo = {
        Combinacion_Parametros_Reporte:
          reporteCompleto.Combinacion_Parametros_Reporte,
        Estado_Reporte: reporteCompleto.Estado_Reporte,
        Datos_Google_Drive_Id: reporteCompleto.Datos_Google_Drive_Id,
        Fecha_Generacion: reporteCompleto.Fecha_Generacion,
      };

      return NextResponse.json(
        {
          success: true,
          message: `The report already exists and is in state ${
            EstadosReporteAsistenciaEscolarTextos[
              datosDeEstadoDeReporte.Estado_Reporte as EstadoReporteAsistenciaEscolar
            ]
          }`,
          data: datosDeEstadoDeReporte,
          existia: true,
        },
        { status: 200 }
      );
    }

    console.log(
      `🆕 Report does not exist, proceeding to create: ${Combinacion_Parametros_Reporte}`
    );

    // ✅ CREATE NEW REPORT
    const fechaGeneracion = new Date();
    const rolCodigo = mapearRolACodigoCorto(rol!);

    const nuevoReporte: T_Reportes_Asistencia_Escolar = {
      Combinacion_Parametros_Reporte,
      Estado_Reporte: EstadoReporteAsistenciaEscolar.PENDIENTE,
      Datos_Google_Drive_Id: null,
      Fecha_Generacion: fechaGeneracion,
      Rol_Usuario: rolCodigo,
      Id_Usuario: decodedToken.ID_Usuario,
    };

    console.log(
      `📦 New report to create:`,
      JSON.stringify(nuevoReporte, null, 2)
    );

    // ✅ SAVE IN REDIS WITH 12 HOUR EXPIRATION
    await redisClientInstance.set(
      Combinacion_Parametros_Reporte,
      JSON.stringify(nuevoReporte),
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
      await gatillarGeneracionReporte(nuevoReporte);
      console.log(`🚀 GitHub Action triggered successfully`);
    } catch (errorGithub) {
      console.error(
        `⚠️ Error triggering GitHub Action (report saved in Redis):`,
        errorGithub
      );
      // Don't fail the request if GitHub Actions fails, the report is already in Redis
    }

    // ✅ PREPARE ANONYMOUS RESPONSE
    const datosDeEstadoDeReporte: ReporteAsistenciaEscolarAnonimo = {
      Combinacion_Parametros_Reporte:
        nuevoReporte.Combinacion_Parametros_Reporte,
      Estado_Reporte: nuevoReporte.Estado_Reporte,
      Datos_Google_Drive_Id: nuevoReporte.Datos_Google_Drive_Id,
      Fecha_Generacion: nuevoReporte.Fecha_Generacion,
    };

    console.log(
      `✅ Report created successfully: ${Combinacion_Parametros_Reporte}`
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Report created successfully and sent for background generation",
        data: datosDeEstadoDeReporte,
        existia: false,
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
