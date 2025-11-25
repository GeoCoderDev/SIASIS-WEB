import { NextRequest, NextResponse } from "next/server";
import { LogoutTypes, ErrorDetailsForLogout } from "@/interfaces/LogoutTypes";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import {
  NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS,
  NOMBRE_ARCHIVO_LISTA_ESTUDIANTES,
} from "@/constants/NOMBRE_ARCHIVOS_SISTEMA";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import {
  GradosPrimaria,
  GradosSecundaria,
} from "@/constants/GRADOS_POR_NIVEL_EDUCATIVO";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { redirectToLogin } from "@/lib/utils/backend/auth/functions/redirectToLogin";
import { ListaEstudiantesPorGradoParaHoy } from "@/interfaces/shared/Asistencia/ListaEstudiantesPorGradosParaHoy";
import { esContenidoJSON } from "../_helpers/esContenidoJSON";
import { redisClient } from "../../../../config/Redis/RedisClient";

// Cache duration configuration by level and grade
const CONFIGURACION_CACHE_LISTAS: Record<
  NivelEducativo,
  Record<number, number> // Duration in milliseconds
> = {
  [NivelEducativo.PRIMARIA]: {
    [GradosPrimaria.PRIMERO]: 1 * 60 * 60 * 1000, // 1 hour
    [GradosPrimaria.SEGUNDO]: 1 * 60 * 60 * 1000, // 1 hour
    [GradosPrimaria.TERCERO]: 1 * 60 * 60 * 1000, // 1 hour
    [GradosPrimaria.CUARTO]: 1 * 60 * 60 * 1000, // 1 hour
    [GradosPrimaria.QUINTO]: 1 * 60 * 60 * 1000, // 1 hour
    [GradosPrimaria.SEXTO]: 1 * 60 * 60 * 1000, // 1 hour
  },
  [NivelEducativo.SECUNDARIA]: {
    [GradosSecundaria.PRIMERO]: 1 * 60 * 60 * 1000, // 1 hour
    [GradosSecundaria.SEGUNDO]: 1 * 60 * 60 * 1000, // 1 hour
    [GradosSecundaria.TERCERO]: 1 * 60 * 60 * 1000, // 1 hour
    [GradosSecundaria.CUARTO]: 1 * 60 * 60 * 1000, // 1 hour
    [GradosSecundaria.QUINTO]: 1 * 60 * 60 * 1000, // 1 hour
  },
};

// Function to get cache duration for a specific file
function obtenerDuracionCache(
  nombreArchivo: NOMBRE_ARCHIVO_LISTA_ESTUDIANTES
): number {
  // Extract level and grade from file name
  if (nombreArchivo.includes("_P_")) {
    // It's from primary
    const grado = parseInt(nombreArchivo.split("_P_")[1]);
    return (
      CONFIGURACION_CACHE_LISTAS[NivelEducativo.PRIMARIA][grado] ||
      1 * 60 * 60 * 1000
    );
  } else if (nombreArchivo.includes("_S_")) {
    // It's from secondary
    const grado = parseInt(nombreArchivo.split("_S_")[1]);
    return (
      CONFIGURACION_CACHE_LISTAS[NivelEducativo.SECUNDARIA][grado] ||
      1 * 60 * 60 * 1000
    );
  }

  // Default value if cannot be determined
  return 1 * 60 * 60 * 1000; // 1 hour
}

// Cache Map for files with custom durations
interface CacheItem {
  data: ListaEstudiantesPorGradoParaHoy<any>;
  timestamp: number;
  duracion: number; // Specific duration for this file
}

const cacheListas = new Map<NOMBRE_ARCHIVO_LISTA_ESTUDIANTES, CacheItem>();

export async function GET(req: NextRequest) {
  try {
    const { decodedToken, rol, error } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.Tutor,
      RolesSistema.Auxiliar,
    ]);

    if (error) return error;

    // Get query parameter
    const { searchParams } = new URL(req.url);
    const nombreLista = searchParams.get(
      "nombreLista"
    ) as NOMBRE_ARCHIVO_LISTA_ESTUDIANTES;

    if (!nombreLista) {
      return NextResponse.json(
        { error: "The 'nombreLista' parameter is required" },
        { status: 400 }
      );
    }

    // Validate that the file name is valid
    const todosLosArchivos = [
      ...Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.PRIMARIA]
      ),
      ...Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.SECUNDARIA]
      ),
    ];

    if (!todosLosArchivos.includes(nombreLista)) {
      return NextResponse.json(
        { error: "Invalid list name" },
        { status: 400 }
      );
    }

    // Validate permissions by role
    const tienePermiso = validarPermisoArchivo(nombreLista, rol);
    if (!tienePermiso) {
      return NextResponse.json(
        { error: "You do not have permission to access this list" },
        { status: 403 }
      );
    }

    let datosCompletos: ListaEstudiantesPorGradoParaHoy<any>;
    let usandoRespaldo = false;
    let usandoCache = false;

    const ahora = Date.now();
    const cacheItem = cacheListas.get(nombreLista);
    const duracionCache = obtenerDuracionCache(nombreLista);

    // Check if we can use cache (each file has its own duration)
    if (cacheItem && ahora - cacheItem.timestamp < cacheItem.duracion) {
      datosCompletos = cacheItem.data;
      usandoCache = true;
    } else {
      try {
        // Main attempt: get data from blob
        const response = await fetch(
          `${process.env
            .RDP04_THIS_INSTANCE_VERCEL_BLOB_BASE_URL!}/${nombreLista}.json`
        );

        if (!response.ok || !(await esContenidoJSON(response))) {
          throw new Error("Invalid blob response or not JSON");
        }

        datosCompletos = await response.json();
      } catch (blobError) {
        // Plan B: If the first fetch fails, try with Google Drive
        console.warn(
          "Error getting data from blob, trying backup:",
          blobError
        );
        usandoRespaldo = true;

        try {
          // Get Google Drive ID from Redis
          const archivoGoogleDriveID = await redisClient().get(
            `${nombreLista}.json`
          );

          if (!archivoGoogleDriveID) {
            throw new Error("File ID not found in Redis");
          }

          // Make backup fetch from Google Drive
          const respaldoResponse = await fetch(
            `https://drive.google.com/uc?export=download&id=${archivoGoogleDriveID}`
          );

          if (
            !respaldoResponse.ok ||
            !(await esContenidoJSON(respaldoResponse))
          ) {
            throw new Error(
              `Error in backup response: ${respaldoResponse.status} ${respaldoResponse.statusText}`
            );
          }

          datosCompletos = await respaldoResponse.json();
          console.log(
            "Data successfully obtained from Google Drive backup"
          );
        } catch (respaldoError) {
          // If the backup also fails, throw a more descriptive error
          console.error(
            "Error getting data from backup:",
            respaldoError
          );
          throw new Error(
            `Main access and backup failed: ${
              (respaldoError as Error).message
            }`
          );
        }
      }

      // Update cache with new data and its specific duration
      cacheListas.set(nombreLista, {
        data: datosCompletos,
        timestamp: ahora,
        duracion: duracionCache,
      });
    }

    // Filter data according to role and user
    const datosFiltrados = filtrarDatosSegunRolYUsuario(
      datosCompletos,
      rol,
      decodedToken.ID_Usuario
    );

    // Return filtered data with source indicator
    return NextResponse.json({
      ...datosFiltrados,
      _debug: usandoCache
        ? "Data obtained from cache"
        : usandoRespaldo
        ? "Data obtained from backup"
        : "Data obtained from main source",
    });
  } catch (error) {
    console.error("Error getting student list:", error);
    // Determine error type
    let logoutType = LogoutTypes.ERROR_SISTEMA;
    const errorDetails: ErrorDetailsForLogout = {
      mensaje: "Error retrieving student list",
      origen: "api/lista-estudiantes-grado",
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
        logoutType = LogoutTypes.ERROR_RED;
        errorDetails.mensaje =
          "Connection error when getting student list";
      }
      // If it's a JSON parsing error
      else if (
        error.message.includes("JSON") ||
        error.message.includes("parse") ||
        error.message.includes("not valid JSON")
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_CORRUPTOS;
        errorDetails.mensaje = "Error processing student list";
        errorDetails.contexto = "Invalid data format";
      }
      // If Redis lookup failed
      else if (error.message.includes("ID not found")) {
        logoutType = LogoutTypes.ERROR_DATOS_NO_DISPONIBLES;
        errorDetails.mensaje = "Could not find student list";
        errorDetails.siasisComponent = "RDP05"; // Specific Redis error
      }
      // If both main access and backup failed
      else if (
        error.message.includes("Main access and backup failed")
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_NO_DISPONIBLES;
        errorDetails.mensaje = "Could not get student list";
        errorDetails.contexto =
          "Failed to access both blob and Google Drive";
      }

      errorDetails.mensaje += `: ${error.message}`;
    }

    return redirectToLogin(logoutType, errorDetails);
  }
}

// Function to validate file access permissions by role
function validarPermisoArchivo(
  nombreArchivo: NOMBRE_ARCHIVO_LISTA_ESTUDIANTES,
  rol: RolesSistema
): boolean {
  switch (rol) {
    case RolesSistema.Directivo:
      // Directors can access any file
      return true;

    case RolesSistema.ProfesorPrimaria:
      // Primary teachers can only access primary files
      const archivosPrimaria = Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.PRIMARIA]
      );
      return archivosPrimaria.includes(nombreArchivo);

    case RolesSistema.Auxiliar:
      // Auxiliaries can only access secondary files
      const archivosSecundaria = Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.SECUNDARIA]
      );
      return archivosSecundaria.includes(nombreArchivo);

    case RolesSistema.Tutor:
      // Tutors can only access secondary files
      const archivosSecundariaTutor = Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.SECUNDARIA]
      );
      return archivosSecundariaTutor.includes(nombreArchivo);

    default:
      return false;
  }
}

// Function to filter data according to role and specific user
function filtrarDatosSegunRolYUsuario(
  datos: ListaEstudiantesPorGradoParaHoy<any>,
  rol: RolesSistema,
  idUsuario: string
): ListaEstudiantesPorGradoParaHoy<any> {
  switch (rol) {
    case RolesSistema.Directivo:
      // Directors receive ALL data without filtering (all students, all classrooms)
      return datos;

    case RolesSistema.Auxiliar:
      // Auxiliaries receive ALL secondary data without filtering (all students, all classrooms of that grade)
      return datos;

    case RolesSistema.ProfesorPrimaria:
      // Primary teachers only see their students and their classroom
      const aulaProfesorPrimaria = datos.Aulas.find(
        (aula) => aula.Id_Profesor_Primaria === idUsuario
      );

      if (!aulaProfesorPrimaria) {
        // If they don't have a classroom in this grade, return empty lists
        return {
          ...datos,
          ListaEstudiantes: [],
          Aulas: [],
        };
      }

      const estudiantesProfesorPrimaria = datos.ListaEstudiantes.filter(
        (estudiante) => estudiante.Id_Aula === aulaProfesorPrimaria.Id_Aula
      );

      return {
        ...datos,
        ListaEstudiantes: estudiantesProfesorPrimaria,
        Aulas: [aulaProfesorPrimaria], // Only THEIR classroom
      };

    case RolesSistema.Tutor:
      // Tutors only see their students and their classroom
      const aulaTutor = datos.Aulas.find(
        (aula) => aula.Id_Profesor_Secundaria === idUsuario
      );

      if (!aulaTutor) {
        // If they don't have a classroom in this grade, return empty lists
        return {
          ...datos,
          ListaEstudiantes: [],
          Aulas: [],
        };
      }

      const estudiantesTutor = datos.ListaEstudiantes.filter(
        (estudiante) => estudiante.Id_Aula === aulaTutor.Id_Aula
      );

      return {
        ...datos,
        ListaEstudiantes: estudiantesTutor,
        Aulas: [aulaTutor], // Only THEIR classroom
      };

    default:
      // By default, return empty lists
      return {
        ...datos,
        ListaEstudiantes: [],
        Aulas: [],
      };
  }
}