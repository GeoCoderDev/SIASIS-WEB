import { NOMBRE_ARCHIVO_REPORTE_ACTUALIZACION_DE_LISTAS_DE_ESTUDIANTES } from "@/constants/NOMBRE_ARCHIVOS_SISTEMA";

import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { NextRequest, NextResponse } from "next/server";
import { isJSONContent } from "../../_helpers/esContenidoJSON";
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
let updateReportCache: ReporteActualizacionDeListasEstudiantes | null =
  null;
let lastReportUpdate = 0;
const REPORT_CACHE_DURATION = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

export async function GET(req: NextRequest) {
  try {
    const { decodedToken, rol: role, error } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.Tutor,
      RolesSistema.Auxiliar,
    ]);

    if (error) return error;

    let listUpdateReport: ReporteActualizacionDeListasEstudiantes;
    let usingBackup = false;
    let usingCache = false;

    const now = Date.now();

    // Check if we can use the cache
    if (
      updateReportCache &&
      now - lastReportUpdate < REPORT_CACHE_DURATION
    ) {
      listUpdateReport = updateReportCache;
      usingCache = true;
    } else {
      try {
        // Main attempt: get data from blob
        const response = await fetch(
          `${process.env
            .RDP04_THIS_INSTANCE_VERCEL_BLOB_BASE_URL!}/${NOMBRE_ARCHIVO_REPORTE_ACTUALIZACION_DE_LISTAS_DE_ESTUDIANTES}`
        );

        if (!response.ok || !(await isJSONContent(response))) {
          throw new Error("Invalid blob response or not JSON");
        }

        listUpdateReport = await response.json();
      } catch (blobError) {
        // Plan B: If the first fetch fails, try with Google Drive
        console.warn(
          "Error getting data from blob, trying backup:",
          blobError
        );
        usingBackup = true;

        try {
          // Get the Google Drive ID from Redis
          const studentListUpdateReportFileId =
            await redisClient().get(
              NOMBRE_ARCHIVO_REPORTE_ACTUALIZACION_DE_LISTAS_DE_ESTUDIANTES
            );

          if (!studentListUpdateReportFileId) {
            throw new Error("File ID not found in Redis");
          }

          // Make backup fetch from Google Drive
          const backupResponse = await fetch(
            `https://drive.google.com/uc?export=download&id=${studentListUpdateReportFileId}`
          );

          if (
            !backupResponse.ok ||
            !(await isJSONContent(backupResponse))
          ) {
            throw new Error(
              `Error in backup response: ${backupResponse.status} ${backupResponse.statusText}`
            );
          }

          listUpdateReport = await backupResponse.json();
          console.log(
            "Data successfully obtained from Google Drive backup"
          );
        } catch (backupError) {
          // If the backup also fails, throw a more descriptive error
          console.error(
            "Error getting data from backup:",
            backupError
          );
          throw new Error(
            `Main access and backup failed: ${
              (backupError as Error).message
            }`
          );
        }
      }

      // Update cache with new data
      updateReportCache = listUpdateReport;
      lastReportUpdate = now;
    }

    // Filter data according to role
    const filteredData = filterReportByRole(
      listUpdateReport,
      role
    );

    // Return filtered data with source indicator
    return NextResponse.json({
      ...filteredData,
      _debug: usingCache
        ? "Data obtained from cache"
        : usingBackup
        ? "Data obtained from backup"
        : "Data obtained from main source",
    });
  } catch (error) {
    console.error(
      "Error getting list update report:",
      error
    );
    // Determine error type
    let logoutType = LogoutTypes.SYSTEM_ERROR;
    const errorDetails: ErrorDetailsForLogout = {
      message: "Error retrieving list update report",
      origin: "api/reporte-actualizacion-listas",
      timestamp: Date.now(),
      siasisComponent: "RDP04", // Main component is RDP04 (blob)
    };

    if (error instanceof Error) {
      // If it's a network error or connection problem
      if (
        error.message.includes("fetch") ||
        error.message.includes("network") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("timeout")
      ) {
        logoutType = LogoutTypes.NETWORK_ERROR;
        errorDetails.message =
          "Connection error when getting update report";
      }
      // If it's a JSON parsing error
      else if (
        error.message.includes("JSON") ||
        error.message.includes("parse") ||
        error.message.includes("not valid JSON")
      ) {
        logoutType = LogoutTypes.CORRUPT_DATA_ERROR;
        errorDetails.message = "Error processing the update report";
        errorDetails.contexto = "Invalid data format";
      }
      // If Redis lookup failed
      else if (error.message.includes("ID not found")) {
        logoutType = LogoutTypes.DATA_NOT_AVAILABLE_ERROR;
        errorDetails.message =
          "Could not find the update report";
        errorDetails.siasisComponent = "RDP05"; // Specific Redis error
      }
      // If both main access and backup failed
      else if (
        error.message.includes("Main access and backup failed")
      ) {
        logoutType = LogoutTypes.DATA_NOT_AVAILABLE_ERROR;
        errorDetails.message = "Could not get the update report";
        errorDetails.contexto =
          "Failed to access both blob and Google Drive";
      }

      errorDetails.message += `: ${error.message}`;
    }

    return redirectToLogin(logoutType, errorDetails);
  }
}

// Function to filter the report according to role
function filterReportByRole(
  report: ReporteActualizacionDeListasEstudiantes,
  role: RolesSistema
):
  | ReporteActualizacionDeListasEstudiantes
  | ReporteActualizacionDeListasEstudiantesPrimaria
  | ReporteActualizacionDeListasEstudiantesSecundaria {
  switch (role) {
    case RolesSistema.Directivo:
      // Directors have access to all information (primary and secondary)
      return report;

    case RolesSistema.ProfesorPrimaria:
      // Primary teachers only see primary lists
      const primaryLists = {} as any;

      Object.entries(report.EstadoDeListasDeEstudiantes).forEach(
        ([file, date]) => {
          // Check if the file contains "Estudiantes_P_" (primary)
          if (file.includes("Estudiantes_P_")) {
            primaryLists[file] = date;
          }
        }
      );

      return {
        EstadoDeListasDeEstudiantes: primaryLists,
        Fecha_Actualizacion: report.Fecha_Actualizacion,
      } as ReporteActualizacionDeListasEstudiantesPrimaria;

    case RolesSistema.Auxiliar:
    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
      // Auxiliaries, secondary teachers and tutors only see secondary lists
      const secondaryLists = {} as any;

      Object.entries(report.EstadoDeListasDeEstudiantes).forEach(
        ([file, date]) => {
          // Check if the file contains "Estudiantes_S_" (secondary)
          if (file.includes("Estudiantes_S_")) {
            secondaryLists[file] = date;
          }
        }
      );

      return {
        EstadoDeListasDeEstudiantes: secondaryLists,
        Fecha_Actualizacion: report.Fecha_Actualizacion,
      } as ReporteActualizacionDeListasEstudiantesSecundaria;

    default:
      // By default, return empty but valid structure
      return {
        EstadoDeListasDeEstudiantes: {} as any,
        Fecha_Actualizacion: report.Fecha_Actualizacion,
      } as ReporteActualizacionDeListasEstudiantesSecundaria;
  }
}
