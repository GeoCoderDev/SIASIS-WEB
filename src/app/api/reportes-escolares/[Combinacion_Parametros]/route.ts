import { NextRequest, NextResponse } from "next/server";

import {
  EstadoReporteAsistenciaEscolar,
  ReporteAsistenciaEscolarAnonimo,
} from "@/interfaces/shared/ReporteAsistenciaEscolar";
import { T_Reportes_Asistencia_Escolar } from "@prisma/client";
import {
  RequestErrorTypes,
  SystemErrorTypes,
} from "@/interfaces/shared/errors";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";
import decodificarCombinacionParametrosParaReporteEscolar from "@/lib/helpers/decoders/reportes-asistencia-escolares/decodificarCombinacionParametrosParaReporteEscolar";
import {
  GruposIntanciasDeRedis,
  redisClient,
} from "../../../../../config/Redis/RedisClient";

export async function GET(
  req: NextRequest,
  { params }: { params: { Combinacion_Parametros: string } }
) {
  try {
    const { Combinacion_Parametros } = params;

    // Validar que se recibió el parámetro
    if (!Combinacion_Parametros) {
      return NextResponse.json(
        {
          success: false,
          message: "Se requiere el parámetro Combinacion_Parametros",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    // Validar longitud del parámetro (máximo 40 caracteres según el schema)
    if (Combinacion_Parametros.length > 40) {
      return NextResponse.json(
        {
          success: false,
          message:
            "El parámetro Combinacion_Parametros excede la longitud máxima permitida (40 caracteres)",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        } as ErrorResponseAPIBase,
        { status: 400 }
      );
    }

    // ✅ VALIDAR que la combinación de parámetros sea válida usando la función de decodificación
    const parametrosDecodificados =
      decodificarCombinacionParametrosParaReporteEscolar(
        Combinacion_Parametros
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
      `🔍 Consultando reporte con parámetros decodificados:`,
      parametrosDecodificados
    );

    // Obtener instancia de Redis para reportes de asistencia escolar
    const redisClientInstance = redisClient(
      GruposIntanciasDeRedis.ParaReportesDeAsistenciasEscolares
    );

    // Buscar el reporte en Redis usando la combinación de parámetros como clave
    const reporteData = await redisClientInstance.get(Combinacion_Parametros);

    // Si no existe el reporte, devolver 404
    if (!reporteData) {
      return NextResponse.json(
        {
          success: false,
          message:
            "No se encontró ningún reporte con esa combinación de parámetros",
          errorType: RequestErrorTypes.RESOURCE_NOT_FOUND,
        } as ErrorResponseAPIBase,
        { status: 404 }
      );
    }

    // Parsear los datos de Redis (pueden venir como string JSON)
    const reporteCompleto: T_Reportes_Asistencia_Escolar =
      typeof reporteData === "string" ? JSON.parse(reporteData) : reporteData;

    // Validar que el estado del reporte sea válido
    if (
      !Object.values(EstadoReporteAsistenciaEscolar).includes(
        reporteCompleto.Estado_Reporte as EstadoReporteAsistenciaEscolar
      )
    ) {
      console.warn(
        `⚠️ Estado de reporte inválido encontrado: ${reporteCompleto.Estado_Reporte}`
      );
    }

    // Filtrar solo los datos que necesita la interfaz ReporteAsistenciaEscolarAnonimo
    const reporteAnonimo: ReporteAsistenciaEscolarAnonimo = {
      Combinacion_Parametros_Reporte:
        reporteCompleto.Combinacion_Parametros_Reporte,
      Estado_Reporte: reporteCompleto.Estado_Reporte,
      Datos_Google_Drive_Id: reporteCompleto.Datos_Google_Drive_Id,
      Fecha_Generacion: reporteCompleto.Fecha_Generacion,
    };

    console.log(
      `✅ Reporte consultado exitosamente: ${Combinacion_Parametros} - Estado: ${reporteCompleto.Estado_Reporte} - Tipo: ${parametrosDecodificados.tipoReporte} - Nivel: ${parametrosDecodificados.aulasSeleccionadas.Nivel} - Grado: ${parametrosDecodificados.aulasSeleccionadas.Grado}${parametrosDecodificados.aulasSeleccionadas.Seccion}`
    );

    // Devolver respuesta exitosa con los datos filtrados
    return NextResponse.json(
      {
        success: true,
        message: "Reporte encontrado exitosamente",
        data: reporteAnonimo,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("❌ Error al consultar reporte de asistencia:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Error al consultar el reporte de asistencia",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        ErrorDetails: error instanceof Error ? error.message : String(error),
      } as ErrorResponseAPIBase,
      { status: 500 }
    );
  }
}
