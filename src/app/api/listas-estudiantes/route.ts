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

// Configuración de duración de caché por nivel y grado
const CONFIGURACION_CACHE_LISTAS: Record<
  NivelEducativo,
  Record<number, number> // Duración en milisegundos
> = {
  [NivelEducativo.PRIMARIA]: {
    [GradosPrimaria.PRIMERO]: 1 * 60 * 60 * 1000, // 1 hora
    [GradosPrimaria.SEGUNDO]: 1 * 60 * 60 * 1000, // 1 hora
    [GradosPrimaria.TERCERO]: 1 * 60 * 60 * 1000, // 1 hora
    [GradosPrimaria.CUARTO]: 1 * 60 * 60 * 1000, // 1 hora
    [GradosPrimaria.QUINTO]: 1 * 60 * 60 * 1000, // 1 hora
    [GradosPrimaria.SEXTO]: 1 * 60 * 60 * 1000, // 1 hora
  },
  [NivelEducativo.SECUNDARIA]: {
    [GradosSecundaria.PRIMERO]: 1 * 60 * 60 * 1000, // 1 hora
    [GradosSecundaria.SEGUNDO]: 1 * 60 * 60 * 1000, // 1 hora
    [GradosSecundaria.TERCERO]: 1 * 60 * 60 * 1000, // 1 hora
    [GradosSecundaria.CUARTO]: 1 * 60 * 60 * 1000, // 1 hora
    [GradosSecundaria.QUINTO]: 1 * 60 * 60 * 1000, // 1 hora
  },
};

// Función para obtener la duración de caché de un archivo específico
function obtenerDuracionCache(
  nombreArchivo: NOMBRE_ARCHIVO_LISTA_ESTUDIANTES
): number {
  // Extraer nivel y grado del nombre del archivo
  if (nombreArchivo.includes("_P_")) {
    // Es de primaria
    const grado = parseInt(nombreArchivo.split("_P_")[1]);
    return (
      CONFIGURACION_CACHE_LISTAS[NivelEducativo.PRIMARIA][grado] ||
      1 * 60 * 60 * 1000
    );
  } else if (nombreArchivo.includes("_S_")) {
    // Es de secundaria
    const grado = parseInt(nombreArchivo.split("_S_")[1]);
    return (
      CONFIGURACION_CACHE_LISTAS[NivelEducativo.SECUNDARIA][grado] ||
      1 * 60 * 60 * 1000
    );
  }

  // Valor por defecto si no se puede determinar
  return 1 * 60 * 60 * 1000; // 1 hora
}

// Cache Map para los archivos con duraciones personalizadas
interface CacheItem {
  data: ListaEstudiantesPorGradoParaHoy<any>;
  timestamp: number;
  duracion: number; // Duración específica para este archivo
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

    // Obtener el parámetro de query
    const { searchParams } = new URL(req.url);
    const nombreLista = searchParams.get(
      "nombreLista"
    ) as NOMBRE_ARCHIVO_LISTA_ESTUDIANTES;

    if (!nombreLista) {
      return NextResponse.json(
        { error: "Se requiere el parámetro 'nombreLista'" },
        { status: 400 }
      );
    }

    // Validar que el nombre del archivo sea válido
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
        { error: "Nombre de lista no válido" },
        { status: 400 }
      );
    }

    // Validar permisos por rol
    const tienePermiso = validarPermisoArchivo(nombreLista, rol);
    if (!tienePermiso) {
      return NextResponse.json(
        { error: "No tienes permisos para acceder a esta lista" },
        { status: 403 }
      );
    }

    let datosCompletos: ListaEstudiantesPorGradoParaHoy<any>;
    let usandoRespaldo = false;
    let usandoCache = false;

    const ahora = Date.now();
    const cacheItem = cacheListas.get(nombreLista);
    const duracionCache = obtenerDuracionCache(nombreLista);

    // Verificar si podemos usar el cache (cada archivo tiene su propia duración)
    if (cacheItem && ahora - cacheItem.timestamp < cacheItem.duracion) {
      datosCompletos = cacheItem.data;
      usandoCache = true;
    } else {
      try {
        // Intento principal: obtener datos del blob
        const response = await fetch(
          `${process.env
            .RDP04_THIS_INSTANCE_VERCEL_BLOB_BASE_URL!}/${nombreLista}.json`
        );

        if (!response.ok || !(await esContenidoJSON(response))) {
          throw new Error("Respuesta del blob inválida o no es JSON");
        }

        datosCompletos = await response.json();
      } catch (blobError) {
        // Plan B: Si el primer fetch falla, intentar con Google Drive
        console.warn(
          "Error al obtener datos del blob, usando respaldo:",
          blobError
        );
        usandoRespaldo = true;

        try {
          // Obtener el ID de Google Drive desde Redis
          const archivoGoogleDriveID = await redisClient().get(
            `${nombreLista}.json`
          );

          if (!archivoGoogleDriveID) {
            throw new Error("No se encontró el ID del archivo en Redis");
          }

          // Hacer el fetch de respaldo desde Google Drive
          const respaldoResponse = await fetch(
            `https://drive.google.com/uc?export=download&id=${archivoGoogleDriveID}`
          );

          if (
            !respaldoResponse.ok ||
            !(await esContenidoJSON(respaldoResponse))
          ) {
            throw new Error(
              `Error en la respuesta de respaldo: ${respaldoResponse.status} ${respaldoResponse.statusText}`
            );
          }

          datosCompletos = await respaldoResponse.json();
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

      // Actualizar cache con los nuevos datos y su duración específica
      cacheListas.set(nombreLista, {
        data: datosCompletos,
        timestamp: ahora,
        duracion: duracionCache,
      });
    }

    // Filtrar datos según el rol y el usuario
    const datosFiltrados = filtrarDatosSegunRolYUsuario(
      datosCompletos,
      rol,
      decodedToken.ID_Usuario
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
    console.error("Error al obtener lista de estudiantes:", error);
    // Determinar el tipo de error
    let logoutType = LogoutTypes.ERROR_SISTEMA;
    const errorDetails: ErrorDetailsForLogout = {
      mensaje: "Error al recuperar lista de estudiantes",
      origen: "api/lista-estudiantes-grado",
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
          "Error de conexión al obtener lista de estudiantes";
      }
      // Si es un error de parseo de JSON
      else if (
        error.message.includes("JSON") ||
        error.message.includes("parse") ||
        error.message.includes("no es JSON válido")
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_CORRUPTOS;
        errorDetails.mensaje = "Error al procesar la lista de estudiantes";
        errorDetails.contexto = "Formato de datos inválido";
      }
      // Si falló la búsqueda en Redis
      else if (error.message.includes("No se encontró el ID")) {
        logoutType = LogoutTypes.ERROR_DATOS_NO_DISPONIBLES;
        errorDetails.mensaje = "No se pudo encontrar la lista de estudiantes";
        errorDetails.siasisComponent = "RDP05"; // Error específico de Redis
      }
      // Si falló tanto el acceso principal como el respaldo
      else if (
        error.message.includes("Falló el acceso principal y el respaldo")
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_NO_DISPONIBLES;
        errorDetails.mensaje = "No se pudo obtener la lista de estudiantes";
        errorDetails.contexto =
          "Falló tanto el acceso a blob como a Google Drive";
      }

      errorDetails.mensaje += `: ${error.message}`;
    }

    return redirectToLogin(logoutType, errorDetails);
  }
}

// Función para validar permisos de acceso al archivo por rol
function validarPermisoArchivo(
  nombreArchivo: NOMBRE_ARCHIVO_LISTA_ESTUDIANTES,
  rol: RolesSistema
): boolean {
  switch (rol) {
    case RolesSistema.Directivo:
      // Directivos pueden acceder a cualquier archivo
      return true;

    case RolesSistema.ProfesorPrimaria:
      // Profesores de primaria solo pueden acceder a archivos de primaria
      const archivosPrimaria = Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.PRIMARIA]
      );
      return archivosPrimaria.includes(nombreArchivo);

    case RolesSistema.Auxiliar:
      // Auxiliares solo pueden acceder a archivos de secundaria
      const archivosSecundaria = Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.SECUNDARIA]
      );
      return archivosSecundaria.includes(nombreArchivo);

    case RolesSistema.Tutor:
      // Tutores solo pueden acceder a archivos de secundaria
      const archivosSecundariaTutor = Object.values(
        NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[NivelEducativo.SECUNDARIA]
      );
      return archivosSecundariaTutor.includes(nombreArchivo);

    default:
      return false;
  }
}

// Función para filtrar datos según el rol y usuario específico
function filtrarDatosSegunRolYUsuario(
  datos: ListaEstudiantesPorGradoParaHoy<any>,
  rol: RolesSistema,
  idUsuario: string
): ListaEstudiantesPorGradoParaHoy<any> {
  switch (rol) {
    case RolesSistema.Directivo:
      // Directivos reciben TODOS los datos sin filtrar (todos los estudiantes, todas las aulas)
      return datos;

    case RolesSistema.Auxiliar:
      // Auxiliares reciben TODOS los datos de secundaria sin filtrar (todos los estudiantes, todas las aulas de ese grado)
      return datos;

    case RolesSistema.ProfesorPrimaria:
      // Profesores de primaria solo ven sus estudiantes y su aula
      const aulaProfesorPrimaria = datos.Aulas.find(
        (aula) => aula.Id_Profesor_Primaria === idUsuario
      );

      if (!aulaProfesorPrimaria) {
        // Si no tiene aula en este grado, devolver listas vacías
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
        Aulas: [aulaProfesorPrimaria], // Solo SU aula
      };

    case RolesSistema.Tutor:
      // Tutores solo ven sus estudiantes y su aula
      const aulaTutor = datos.Aulas.find(
        (aula) => aula.Id_Profesor_Secundaria === idUsuario
      );

      if (!aulaTutor) {
        // Si no tiene aula en este grado, devolver listas vacías
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
        Aulas: [aulaTutor], // Solo SU aula
      };

    default:
      // Por defecto, devolver listas vacías
      return {
        ...datos,
        ListaEstudiantes: [],
        Aulas: [],
      };
  }
}
