import { NOMBRE_ARCHIVO_REPORTE_ACTUALIZACION_DE_LISTAS_DE_ESTUDIANTES } from "@/constants/NOMBRE_ARCHIVOS_SISTEMA";

import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { NextRequest, NextResponse } from "next/server";
import { esContenidoJSON } from "../../_helpers/esContenidoJSON";
import { redisClient } from "../../../../../config/Redis/RedisClient";
import { ErrorDetailsForLogout, LogoutTypes } from "@/interfaces/LogoutTypes";
import { redirectToLogin } from "@/lib/utils/backend/auth/functions/redirectToLogin";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import {
  ReporteActualizacionDeListasEstudiantes,
  ReporteActualizacionDeListasEstudiantesPrimaria,
  ReporteActualizacionDeListasEstudiantesSecundaria,
} from "@/interfaces/shared/Asistencia/ReporteModificacionesListasDeEstudiantes";

// Cache for the update report
let reporteActualizacionCache: ReporteActualizacionDeListasEstudiantes | null =
  null;
let ultimaActualizacionReporte = 0;
const CACHE_DURACION_REPORTE = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

export async function GET(req: NextRequest) {
  try {
    const { decodedToken, rol, error } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.Tutor,
      RolesSistema.Auxiliar,
    ]);

    if (error) return error;

    let reporteActualizacionListas: ReporteActualizacionDeListasEstudiantes;
    let usandoRespaldo = false;
    let usandoCache = false;

    const ahora = Date.now();

    // Check if we can use the cache
    if (
      reporteActualizacionCache &&
      ahora - ultimaActualizacionReporte < CACHE_DURACION_REPORTE
    ) {
      reporteActualizacionListas = reporteActualizacionCache;
      usandoCache = true;
    } else {
      try {
        // Main attempt: get data from blob
        const response = await fetch(
          `${process.env
            .RDP04_THIS_INSTANCE_VERCEL_BLOB_BASE_URL!}/${NOMBRE_ARCHIVO_REPORTE_ACTUALIZACION_DE_LISTAS_DE_ESTUDIANTES}`
        );

        if (!response.ok || !(await esContenidoJSON(response))) {
          throw new Error("Respuesta del blob inválida o no es JSON");
        }

        reporteActualizacionListas = await response.json();
      } catch (blobError) {
        // Plan B: If the first fetch fails, try with Google Drive
        console.warn(
          "Error getting data from blob, using backup:",
          blobError
        );
        usandoRespaldo = true;

        try {
          // Get the Google Drive ID from Redis
          const archivoReporteActualizacionDeListasDeEstudiantesGoogleDriveID =
            await redisClient().get(
              NOMBRE_ARCHIVO_REPORTE_ACTUALIZACION_DE_LISTAS_DE_ESTUDIANTES
            );

          if (!archivoReporteActualizacionDeListasDeEstudiantesGoogleDriveID) {
            throw new Error("No se encontró el ID del archivo en Redis");
          }

          // Make backup fetch from Google Drive
          const respaldoResponse = await fetch(
            `https://drive.google.com/uc?export=download&id=${archivoReporteActualizacionDeListasDeEstudiantesGoogleDriveID}`
          );

          if (
            !respaldoResponse.ok ||
            !(await esContenidoJSON(respaldoResponse))
          ) {
            throw new Error(
              `Error en la respuesta de respaldo: ${respaldoResponse.status} ${respaldoResponse.statusText}`
            );
          }

          reporteActualizacionListas = await respaldoResponse.json();
          console.log(
            "Datos obtenidos exitosamente desde respaldo Google Drive"
          );
        } catch (respaldoError) {
          // If the backup also fails, throw a more descriptive error
          console.error(
            "Error getting data from backup:",
            respaldoError
          );
          throw new Error(
            `Falló el acceso principal y el respaldo: ${
              (respaldoError as Error).message
            }`
          );
        }
      }

      // Update cache with new data
      reporteActualizacionCache = reporteActualizacionListas;
      ultimaActualizacionReporte = ahora;
    }

    // Filter data according to role
    const datosFiltrados = filtrarReporteSegunRol(
      reporteActualizacionListas,
      rol
    );

    // Return filtered data with source indicator
    return NextResponse.json({
      ...datosFiltrados,
      _debug: usandoCache
        ? "Datos obtenidos desde cache"
        : usandoRespaldo
        ? "Datos obtenidos desde respaldo"
        : "Datos obtenidos desde fuente principal",
    });
  } catch (error) {
    console.error(
      "Error al obtener reporte de actualización de listas:",
      error
    );
    // Determine error type
    let logoutType = LogoutTypes.ERROR_SISTEMA;
    const errorDetails: ErrorDetailsForLogout = {
      mensaje: "Error al recuperar reporte de actualización de listas",
      origen: "api/reporte-actualizacion-listas",
      timestamp: Date.now(),
      siasisComponent: "RDP04", // Principal componente es RDP04 (blob)
    };

    if (error instanceof Error) {
      // If it's a network error or connection problem
      if (
        error.message.includes("fetch") ||
        error.message.includes("network") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("timeout")
      ) {
        logoutType = LogoutTypes.ERROR_RED;
        errorDetails.mensaje =
          "Error de conexión al obtener reporte de actualización";
      }
      // If it's a JSON parsing error
      else if (
        error.message.includes("JSON") ||
        error.message.includes("parse") ||
        error.message.includes("no es JSON válido")
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_CORRUPTOS;
        errorDetails.mensaje = "Error al procesar el reporte de actualización";
        errorDetails.contexto = "Formato de datos inválido";
      }
      // If Redis lookup failed
      else if (error.message.includes("No se encontró el ID")) {
        logoutType = LogoutTypes.ERROR_DATOS_NO_DISPONIBLES;
        errorDetails.mensaje =
          "No se pudo encontrar el reporte de actualización";
        errorDetails.siasisComponent = "RDP05"; // Error específico de Redis
      }
      // If both main access and backup failed
      else if (
        error.message.includes("Falló el acceso principal y el respaldo")
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_NO_DISPONIBLES;
        errorDetails.mensaje = "No se pudo obtener el reporte de actualización";
        errorDetails.contexto =
          "Falló tanto el acceso a blob como a Google Drive";
      }

      errorDetails.mensaje += `: ${error.message}`;
    }

    return redirectToLogin(logoutType, errorDetails);
  }
}

// Function to filter the report according to role
function filtrarReporteSegunRol(
  reporte: ReporteActualizacionDeListasEstudiantes,
  rol: RolesSistema
):
  | ReporteActualizacionDeListasEstudiantes
  | ReporteActualizacionDeListasEstudiantesPrimaria
  | ReporteActualizacionDeListasEstudiantesSecundaria {
  switch (rol) {
    case RolesSistema.Directivo:
      // Directors have access to all information (primary and secondary)
      return reporte;

    case RolesSistema.ProfesorPrimaria:
      // Primary teachers only see primary lists
      const listasPrimaria = {} as any;

      Object.entries(reporte.EstadoDeListasDeEstudiantes).forEach(
        ([archivo, fecha]) => {
          // Check if the file contains "Estudiantes_P_" (primary)
          if (archivo.includes("Estudiantes_P_")) {
            listasPrimaria[archivo] = fecha;
          }
        }
      );

      return {
        EstadoDeListasDeEstudiantes: listasPrimaria,
        Fecha_Actualizacion: reporte.Fecha_Actualizacion,
      } as ReporteActualizacionDeListasEstudiantesPrimaria;

    case RolesSistema.Auxiliar:
    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
      // Auxiliaries, secondary teachers and tutors only see secondary lists
      const listasSecundaria = {} as any;

      Object.entries(reporte.EstadoDeListasDeEstudiantes).forEach(
        ([archivo, fecha]) => {
          // Check if the file contains "Estudiantes_S_" (secondary)
          if (archivo.includes("Estudiantes_S_")) {
            listasSecundaria[archivo] = fecha;
          }
        }
      );

      return {
        EstadoDeListasDeEstudiantes: listasSecundaria,
        Fecha_Actualizacion: reporte.Fecha_Actualizacion,
      } as ReporteActualizacionDeListasEstudiantesSecundaria;

    default:
      // By default, return empty but valid structure
      return {
        EstadoDeListasDeEstudiantes: {} as any,
        Fecha_Actualizacion: reporte.Fecha_Actualizacion,
      } as ReporteActualizacionDeListasEstudiantesSecundaria;
  }
}
