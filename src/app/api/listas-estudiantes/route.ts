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
import { isJSONContent } from "../_helpers/esContenidoJSON";
import { redisClient } from "../../../../config/Redis/RedisClient";

// Cache duration configuration by level and grade
const LIST_CACHE_CONFIG: Record<
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
function getCacheDuration(
  fileName: NOMBRE_ARCHIVO_LISTA_ESTUDIANTES
): number {
  // Extract level and grade from file name
  if (fileName.includes("_P_")) {
    // It's from primary
    const grade = parseInt(fileName.split("_P_")[1]);
    return (
      LIST_CACHE_CONFIG[NivelEducativo.PRIMARIA][grade] ||
      1 * 60 * 60 * 1000
    );
  } else if (fileName.includes("_S_")) {
    // It's from secondary
    const grade = parseInt(fileName.split("_S_")[1]);
    return (
      LIST_CACHE_CONFIG[NivelEducativo.SECUNDARIA][grade] ||
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
  duration: number; // Specific duration for this file
}

const listCache = new Map<NOMBRE_ARCHIVO_LISTA_ESTUDIANTES, CacheItem>();

export async function GET(req: NextRequest) {
  try {
    const { decodedToken, rol: role, error } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.Tutor,
      RolesSistema.Auxiliar,
    ]);

    if (error) return error;

    // Get query parameter
    const { searchParams } = new URL(req.url);
    const listName = searchParams.get(
      "nombreLista"
    ) as NOMBRE_ARCHIVO_LISTA_ESTUDIANTES;

    if (!listName) {
      return NextResponse.json(
        { error: "The 'nombreLista' parameter is required" },
        { status: 400 }
      );
    }

    // Validate that the file name is valid
    const allFiles = [
      ...Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.PRIMARIA]
      ),
      ...Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.SECUNDARIA]
      ),
    ];

    if (!allFiles.includes(listName)) {
      return NextResponse.json(
        { error: "Invalid list name" },
        { status: 400 }
      );
    }

    // Validate permissions by role
    const hasPermission = validateFilePermission(listName, role);
    if (!hasPermission) {
      return NextResponse.json(
        { error: "You do not have permission to access this list" },
        { status: 403 }
      );
    }

    let completeData: ListaEstudiantesPorGradoParaHoy<any>;
    let usingBackup = false;
    let usingCache = false;

    const now = Date.now();
    const cacheItem = listCache.get(listName);
    const cacheDuration = getCacheDuration(listName);

    // Check if we can use cache (each file has its own duration)
    if (cacheItem && now - cacheItem.timestamp < cacheItem.duration) {
      completeData = cacheItem.data;
      usingCache = true;
    } else {
      try {
        // Main attempt: get data from blob
        const response = await fetch(
          `${process.env
            .RDP04_THIS_INSTANCE_VERCEL_BLOB_BASE_URL!}/${listName}.json`
        );

        if (!response.ok || !(await isJSONContent(response))) {
          throw new Error("Invalid blob response or not JSON");
        }

        completeData = await response.json();
      } catch (blobError) {
        // Plan B: If the first fetch fails, try with Google Drive
        console.warn(
          "Error getting data from blob, trying backup:",
          blobError
        );
        usingBackup = true;

        try {
          // Get Google Drive ID from Redis
          const fileGoogleDriveID = await redisClient().get(
            `${listName}.json`
          );

          if (!fileGoogleDriveID) {
            throw new Error("File ID not found in Redis");
          }

          // Make backup fetch from Google Drive
          const backupResponse = await fetch(
            `https://drive.google.com/uc?export=download&id=${fileGoogleDriveID}`
          );

          if (
            !backupResponse.ok ||
            !(await isJSONContent(backupResponse))
          ) {
            throw new Error(
              `Error in backup response: ${backupResponse.status} ${backupResponse.statusText}`
            );
          }

          completeData = await backupResponse.json();
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

      // Update cache with new data and its specific duration
      listCache.set(listName, {
        data: completeData,
        timestamp: now,
        duration: cacheDuration,
      });
    }

    // Filter data according to role and user
    const filteredData = filterDataByRoleAndUser(
      completeData,
      role,
      decodedToken.ID_Usuario
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
    console.error("Error getting student list:", error);
    // Determine error type
    let logoutType = LogoutTypes.SYSTEM_ERROR;
    const errorDetails: ErrorDetailsForLogout = {
      message: "Error retrieving student list",
      origin: "api/lista-estudiantes-grado",
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
          "Connection error when getting student list";
      }
      // If it's a JSON parsing error
      else if (
        error.message.includes("JSON") ||
        error.message.includes("parse") ||
        error.message.includes("not valid JSON")
      ) {
        logoutType = LogoutTypes.CORRUPT_DATA_ERROR;
        errorDetails.message = "Error processing student list";
        errorDetails.contexto = "Invalid data format";
      }
      // If Redis lookup failed
      else if (error.message.includes("ID not found")) {
        logoutType = LogoutTypes.DATA_NOT_AVAILABLE_ERROR;
        errorDetails.message = "Could not find student list";
        errorDetails.siasisComponent = "RDP05"; // Specific Redis error
      }
      // If both main access and backup failed
      else if (
        error.message.includes("Main access and backup failed")
      ) {
        logoutType = LogoutTypes.DATA_NOT_AVAILABLE_ERROR;
        errorDetails.message = "Could not get student list";
        errorDetails.contexto =
          "Failed to access both blob and Google Drive";
      }

      errorDetails.message += `: ${error.message}`;
    }

    return redirectToLogin(logoutType, errorDetails);
  }
}

// Function to validate file access permissions by role
function validateFilePermission(
  fileName: NOMBRE_ARCHIVO_LISTA_ESTUDIANTES,
  role: RolesSistema
): boolean {
  switch (role) {
    case RolesSistema.Directivo:
      // Directors can access any file
      return true;

    case RolesSistema.ProfesorPrimaria:
      // Primary teachers can only access primary files
      const primaryFiles = Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.PRIMARIA]
      );
      return primaryFiles.includes(fileName);

    case RolesSistema.Auxiliar:
      // Auxiliaries can only access secondary files
      const secondaryFiles = Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.SECUNDARIA]
      );
      return secondaryFiles.includes(fileName);

    case RolesSistema.Tutor:
      // Tutors can only access secondary files
      const tutorSecondaryFiles = Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.SECUNDARIA]
      );
      return tutorSecondaryFiles.includes(fileName);

    default:
      return false;
  }
}

// Function to filter data according to role and specific user
function filterDataByRoleAndUser(
  data: ListaEstudiantesPorGradoParaHoy<any>,
  role: RolesSistema,
  userId: string
): ListaEstudiantesPorGradoParaHoy<any> {
  switch (role) {
    case RolesSistema.Directivo:
      // Directors receive ALL data without filtering (all students, all classrooms)
      return data;

    case RolesSistema.Auxiliar:
      // Auxiliaries receive ALL secondary data without filtering (all students, all classrooms of that grade)
      return data;

    case RolesSistema.ProfesorPrimaria:
      // Primary teachers only see their students and their classroom
      const primaryTeacherClassroom = data.Aulas.find(
        (aula) => aula.Id_Profesor_Primaria === userId
      );

      if (!primaryTeacherClassroom) {
        // If they don't have a classroom in this grade, return empty lists
        return {
          ...data,
          ListaEstudiantes: [],
          Aulas: [],
        };
      }

      const primaryTeacherStudents = data.ListaEstudiantes.filter(
        (estudiante) => estudiante.Id_Aula === primaryTeacherClassroom.Id_Aula
      );

      return {
        ...data,
        ListaEstudiantes: primaryTeacherStudents,
        Aulas: [primaryTeacherClassroom], // Only THEIR classroom
      };

    case RolesSistema.Tutor:
      // Tutors only see their students and their classroom
      const tutorClassroom = data.Aulas.find(
        (aula) => aula.Id_Profesor_Secundaria === userId
      );

      if (!tutorClassroom) {
        // If they don't have a classroom in this grade, return empty lists
        return {
          ...data,
          ListaEstudiantes: [],
          Aulas: [],
        };
      }

      const tutorStudents = data.ListaEstudiantes.filter(
        (estudiante) => estudiante.Id_Aula === tutorClassroom.Id_Aula
      );

      return {
        ...data,
        ListaEstudiantes: tutorStudents,
        Aulas: [tutorClassroom], // Only THEIR classroom
      };

    default:
      // By default, return empty lists
      return {
        ...data,
        ListaEstudiantes: [],
        Aulas: [],
      };
  }
}
