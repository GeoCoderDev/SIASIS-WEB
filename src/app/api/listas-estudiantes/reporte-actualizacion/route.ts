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

// Cache para el reporte de actualización
let reporteActualizacionCache: ReporteActualizacionDeListasEstudiantes | null =
  null;
let ultimaActualizacionReporte = 0;
const CACHE_DURACION_REPORTE = 1 * 60 * 60 * 1000; // 1 hora en milisegundos

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

    // Verificar si podemos usar el cache
    if (
      reporteActualizacionCache &&
      ahora - ultimaActualizacionReporte < CACHE_DURACION_REPORTE
    ) {
      reporteActualizacionListas = reporteActualizacionCache;
      usandoCache = true;
    } else {
      try {
        // Intento principal: obtener datos del blob
        const response = await fetch(
          `${process.env
            .RDP04_THIS_INSTANCE_VERCEL_BLOB_BASE_URL!}/${NOMBRE_ARCHIVO_REPORTE_ACTUALIZACION_DE_LISTAS_DE_ESTUDIANTES}`
        );

        if (!response.ok || !(await esContenidoJSON(response))) {
          throw new Error("Respuesta del blob inválida o no es JSON");
        }

        reporteActualizacionListas = await response.json();
      } catch (blobError) {
        // Plan B: Si el primer fetch falla, intentar con Google Drive
        console.warn(
          "Error al obtener datos del blob, usando respaldo:",
          blobError
        );
        usandoRespaldo = true;

        try {
          // Obtener el ID de Google Drive desde Redis
          const archivoReporteActualizacionDeListasDeEstudiantesGoogleDriveID =
            await redisClient().get(
              NOMBRE_ARCHIVO_REPORTE_ACTUALIZACION_DE_LISTAS_DE_ESTUDIANTES
            );

          if (!archivoReporteActualizacionDeListasDeEstudiantesGoogleDriveID) {
            throw new Error("No se encontró el ID del archivo en Redis");
          }

          // Hacer el fetch de respaldo desde Google Drive
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
          // Si también falla el respaldo, lanzar un error más descriptivo
          console.error(
            "Error al obtener datos desde respaldo:",
            respaldoError
          );
          throw new Error(
            `Falló el acceso principal y el respaldo: ${
              (respaldoError as Error).message
            }`
          );
        }
      }

      // Actualizar cache con los nuevos datos
      reporteActualizacionCache = reporteActualizacionListas;
      ultimaActualizacionReporte = ahora;
    }

    // Filtrar datos según el rol
    const datosFiltrados = filtrarReporteSegunRol(
      reporteActualizacionListas,
      rol
    );

    // Devolver los datos filtrados con indicador de fuente
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
    // Determinar el tipo de error
    let logoutType = LogoutTypes.ERROR_SISTEMA;
    const errorDetails: ErrorDetailsForLogout = {
      mensaje: "Error al recuperar reporte de actualización de listas",
      origen: "api/reporte-actualizacion-listas",
      timestamp: Date.now(),
      siasisComponent: "RDP04", // Principal componente es RDP04 (blob)
    };

    if (error instanceof Error) {
      // Si es un error de red o problemas de conexión
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
      // Si es un error de parseo de JSON
      else if (
        error.message.includes("JSON") ||
        error.message.includes("parse") ||
        error.message.includes("no es JSON válido")
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_CORRUPTOS;
        errorDetails.mensaje = "Error al procesar el reporte de actualización";
        errorDetails.contexto = "Formato de datos inválido";
      }
      // Si falló la búsqueda en Redis
      else if (error.message.includes("No se encontró el ID")) {
        logoutType = LogoutTypes.ERROR_DATOS_NO_DISPONIBLES;
        errorDetails.mensaje =
          "No se pudo encontrar el reporte de actualización";
        errorDetails.siasisComponent = "RDP05"; // Error específico de Redis
      }
      // Si falló tanto el acceso principal como el respaldo
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

// Función para filtrar el reporte según el rol
function filtrarReporteSegunRol(
  reporte: ReporteActualizacionDeListasEstudiantes,
  rol: RolesSistema
):
  | ReporteActualizacionDeListasEstudiantes
  | ReporteActualizacionDeListasEstudiantesPrimaria
  | ReporteActualizacionDeListasEstudiantesSecundaria {
  switch (rol) {
    case RolesSistema.Directivo:
      // Directivos tienen acceso a toda la información (primaria y secundaria)
      return reporte;

    case RolesSistema.ProfesorPrimaria:
      // Profesores de primaria solo ven las listas de primaria
      const listasPrimaria = {} as any;

      Object.entries(reporte.EstadoDeListasDeEstudiantes).forEach(
        ([archivo, fecha]) => {
          // Verificar si el archivo contiene "Estudiantes_P_" (primaria)
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
      // Auxiliares, profesores de secundaria y tutores solo ven las listas de secundaria
      const listasSecundaria = {} as any;

      Object.entries(reporte.EstadoDeListasDeEstudiantes).forEach(
        ([archivo, fecha]) => {
          // Verificar si el archivo contiene "Estudiantes_S_" (secundaria)
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
      // Por defecto, devolver estructura vacía pero válida
      return {
        EstadoDeListasDeEstudiantes: {} as any,
        Fecha_Actualizacion: reporte.Fecha_Actualizacion,
      } as ReporteActualizacionDeListasEstudiantesSecundaria;
  }
}
