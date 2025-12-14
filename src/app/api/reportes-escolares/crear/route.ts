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
 * Configuración de GitHub Actions para reportes
 */
const GITHUB_CONFIG = {
  TOKEN: process.env.TGSH01_GITHUB_STATIC_PERSONAL_ACCESS_TOKEN,
  REPOSITORY_OWNER: process.env.TGSH01_GITHUB_WEBHOOK_REPOSITORY_OWNER_USERNAME,
  REPOSITORY_NAME: process.env.TGSH01_GITHUB_WEBHOOK_REPOSITORY_NAME,
} as const;

/**
 * Gatilla la generación de un reporte via GitHub Actions
 */
async function gatillarGeneracionReporte(
  payload: T_Reportes_Asistencia_Escolar
): Promise<void> {
  try {
    console.log(`🚀 INICIANDO GATILLADO de generación de reporte`);

    // Verificar configuración de GitHub
    if (!GITHUB_CONFIG.TOKEN) {
      throw new Error("TOKEN de GitHub no configurado");
    }

    if (!GITHUB_CONFIG.REPOSITORY_OWNER || !GITHUB_CONFIG.REPOSITORY_NAME) {
      throw new Error("Configuración de repositorio de GitHub incompleta");
    }

    const url = `https://api.github.com/repos/${GITHUB_CONFIG.REPOSITORY_OWNER}/${GITHUB_CONFIG.REPOSITORY_NAME}/dispatches`;
    console.log(`🌐 URL GitHub Actions: ${url}`);

    const githubPayload = {
      event_type: "generar-reporte-asistencia",
      client_payload: {
        Combinacion_Parametros_Reporte: payload.Combinacion_Parametros_Reporte,
        Estado_Reporte: payload.Estado_Reporte,
        Datos_Google_Drive_Id: payload.Datos_Google_Drive_Id,
        Fecha_Generacion: payload.Fecha_Generacion,
        Rol_Usuario: payload.Rol_Usuario,
        Id_Usuario: payload.Id_Usuario,
      },
    };

    console.log(`📦 Payload a enviar:`, JSON.stringify(githubPayload, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `token ${GITHUB_CONFIG.TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(githubPayload),
    });

    console.log(`📡 Respuesta GitHub Actions - Status: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ Error response body:`, errorText);
      throw new Error(
        `Error al gatillar GitHub Action: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    console.log(`✅ GitHub Action gatillado exitosamente para reporte`);
  } catch (error) {
    console.error(`❌ Error al gatillar GitHub Action:`, error);
    throw error;
  }
}

/**
 * Mapea el rol del sistema al formato de 2 caracteres para almacenamiento
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
    // ✅ AUTENTICACIÓN
    const { error, rol, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.ProfesorSecundaria,
      RolesSistema.Tutor,
    ]);

    if (error && !rol && !decodedToken) return error;

    console.log(`🔐 Usuario autenticado: ${rol} - ${decodedToken.ID_Usuario}`);

    // ✅ PARSEAR BODY
    const body = (await req.json()) as {
      Combinacion_Parametros_Reporte?: string;
    };

    const { Combinacion_Parametros_Reporte } = body;

    if (!Combinacion_Parametros_Reporte) {
      return NextResponse.json(
        {
          success: false,
          message: "Se requiere Combinacion_Parametros_Reporte en el body",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    console.log(
      `📋 Combinación de parámetros recibida: ${Combinacion_Parametros_Reporte}`
    );

    // ✅ VALIDAR FORMATO
    const parametrosDecodificados =
      decodificarCombinacionParametrosParaReporteEscolar(
        Combinacion_Parametros_Reporte
      );

    if (parametrosDecodificados === false) {
      return NextResponse.json(
        {
          success: false,
          message:
            "La combinación de parámetros no es válida. Verifique el formato y los valores proporcionados.",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    console.log(
      `🔍 Parámetros decodificados:`,
      JSON.stringify(parametrosDecodificados, null, 2)
    );

    // ✅ VALIDAR PERMISOS usando el helper
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
        `❌ Permiso denegado para ${rol}: ${validacionPermisos.mensaje}`
      );
      return NextResponse.json(
        {
          success: false,
          message:
            validacionPermisos.mensaje ||
            "No tiene permisos para generar este reporte",
          errorType: PermissionErrorTypes.INSUFFICIENT_PERMISSIONS,
        } as ErrorResponseAPIBase,
        { status: 403 }
      );
    }

    console.log(`✅ Permisos validados correctamente para rol ${rol}`);

    // ✅ VERIFICAR SI YA EXISTE EN REDIS
    const redisClientInstance = redisClient(
      GruposIntanciasDeRedis.ParaReportesDeAsistenciasEscolares
    );

    const reporteExistente = await redisClientInstance.get(
      Combinacion_Parametros_Reporte
    );

    if (reporteExistente) {
      console.log(
        `📋 Reporte ya existe en Redis: ${Combinacion_Parametros_Reporte}`
      );

      // Parsear los datos existentes
      const reporteCompleto: T_Reportes_Asistencia_Escolar =
        typeof reporteExistente === "string"
          ? JSON.parse(reporteExistente)
          : reporteExistente;

      // Filtrar solo los datos anónimos para la respuesta
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
          message: `El reporte ya existe y está en estado ${
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
      `🆕 Reporte no existe, procediendo a crear: ${Combinacion_Parametros_Reporte}`
    );

    // ✅ CREAR NUEVO REPORTE
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
      `📦 Nuevo reporte a crear:`,
      JSON.stringify(nuevoReporte, null, 2)
    );

    // ✅ GUARDAR EN REDIS CON EXPIRACIÓN DE 12 HORAS
    await redisClientInstance.set(
      Combinacion_Parametros_Reporte,
      JSON.stringify(nuevoReporte),
      TIEMPO_EXPIRACION_REPORTES_ASISTENCIAS_ESCOLARES_SEGUNDOS_CACHE_REDIS
    );

    console.log(
      `💾 Reporte guardado en Redis exitosamente con expiración de ${
        TIEMPO_EXPIRACION_REPORTES_ASISTENCIAS_ESCOLARES_SEGUNDOS_CACHE_REDIS /
        3600
      } horas`
    );

    // ✅ GATILLAR GITHUB ACTIONS
    try {
      await gatillarGeneracionReporte(nuevoReporte);
      console.log(`🚀 GitHub Action gatillado exitosamente`);
    } catch (errorGithub) {
      console.error(
        `⚠️ Error al gatillar GitHub Action (reporte guardado en Redis):`,
        errorGithub
      );
      // No fallar la petición si GitHub Actions falla, el reporte ya está en Redis
    }

    // ✅ PREPARAR RESPUESTA ANÓNIMA
    const datosDeEstadoDeReporte: ReporteAsistenciaEscolarAnonimo = {
      Combinacion_Parametros_Reporte:
        nuevoReporte.Combinacion_Parametros_Reporte,
      Estado_Reporte: nuevoReporte.Estado_Reporte,
      Datos_Google_Drive_Id: nuevoReporte.Datos_Google_Drive_Id,
      Fecha_Generacion: nuevoReporte.Fecha_Generacion,
    };

    console.log(
      `✅ Reporte creado exitosamente: ${Combinacion_Parametros_Reporte}`
    );

    return NextResponse.json(
      {
        success: true,
        message:
          "Reporte creado exitosamente y enviado para generación en segundo plano",
        data: datosDeEstadoDeReporte,
        existia: false,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("❌ Error al crear reporte de asistencia:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Error al crear el reporte de asistencia",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        ErrorDetails: error instanceof Error ? error.message : String(error),
      } as ErrorResponseAPIBase,
      { status: 500 }
    );
  }
}
