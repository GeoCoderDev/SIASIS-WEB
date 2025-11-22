import { NextRequest, NextResponse } from "next/server";
import { LogoutTypes, ErrorDetailsForLogout } from "@/interfaces/LogoutTypes";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import {
  AuxiliarAsistenciaResponse,
  BaseAsistenciaResponse,
  DatosAsistenciaHoyIE20935,
  DirectivoAsistenciaResponse,
  PersonalAdministrativoAsistenciaResponse,
  ProfesorPrimariaAsistenciaResponse,
  ProfesorTutorSecundariaAsistenciaResponse,
  ResponsableAsistenciaResponse,
} from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { redirectToLogin } from "@/lib/utils/backend/auth/functions/redirectToLogin";
import { obtenerDatosAsistenciaHoy } from "../_utils/obtenerDatosAsistenciaHoy";

export async function GET(req: NextRequest) {
  try {
    const { decodedToken, rol, error } = await verifyAuthToken(req);

    if (error) return error;

    // Get data using the new service
    const {
      datos: datosCompletos,
      fuente,
      mensaje,
    } = await obtenerDatosAsistenciaHoy();

    // Filter data according to role
    const datosFiltrados = filtrarDatosSegunRol(
      datosCompletos,
      rol,
      decodedToken.ID_Usuario
    );

    // Return filtered data with source indicator
    return NextResponse.json({
      ...datosFiltrados,
      _debug: mensaje,
      _fuente: fuente,
    });
  } catch (error) {
    console.error("Error getting attendance data:", error);

    // Determine the type of error
    let logoutType = LogoutTypes.ERROR_SISTEMA;
    const errorDetails: ErrorDetailsForLogout = {
      mensaje: "Error al recuperar datos de asistencia",
      origen: "api/datos-asistencia-hoy",
      timestamp: Date.now(),
      siasisComponent: "RDP04", // Principal componente es RDP04 (blob)
    };

    if (error instanceof Error) {
      // If it's a network error or connection problem
      if (
        error.message.includes("fetch") ||
        error.message.includes("network") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("timeout") ||
        error.message.includes("Timeout de petición HTTP")
      ) {
        logoutType = LogoutTypes.ERROR_RED;
        errorDetails.mensaje =
          "Error de conexión al obtener datos de asistencia";
      }
      // If it's a JSON parsing error
      else if (
        error.message.includes("JSON") ||
        error.message.includes("parse") ||
        error.message.includes("no contiene JSON válido")
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_CORRUPTOS;
        errorDetails.mensaje = "Error al procesar los datos de asistencia";
        errorDetails.contexto = "Formato de datos inválido";
      }
      // If Redis lookup failed
      else if (
        error.message.includes(
          "No se encontró el ID del archivo de respaldo en Redis"
        )
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_NO_DISPONIBLES;
        errorDetails.mensaje =
          "No se pudo encontrar la información de asistencia";
        errorDetails.siasisComponent = "RDP05"; // Error específico de Redis
      }
      // If both primary access and backup failed
      else if (
        error.message.includes("Falló el acceso principal y el respaldo")
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_NO_DISPONIBLES;
        errorDetails.mensaje =
          "No se pudo obtener la información de asistencia";
        errorDetails.contexto =
          "Falló tanto el acceso a blob como a Google Drive";
      }
      // If it's a specific HTTP error
      else if (
        error.message.includes("Error HTTP en blob") ||
        error.message.includes("Error HTTP en respaldo")
      ) {
        logoutType = LogoutTypes.ERROR_RED;
        errorDetails.mensaje =
          "Error del servidor al obtener datos de asistencia";
        errorDetails.contexto = "Respuesta HTTP inválida";
      }

      errorDetails.mensaje += `: ${error.message}`;
    }

    return redirectToLogin(logoutType, errorDetails);
  }
}

// Function to filter data according to role
function filtrarDatosSegunRol(
  datos: DatosAsistenciaHoyIE20935,
  rol: RolesSistema,
  idUsuario: string
): BaseAsistenciaResponse {
  // Base data for all roles
  const datosBase: BaseAsistenciaResponse = {
    DiaEvento: datos.DiaEvento,
    FechaUTC: datos.FechaUTC,
    FechaLocalPeru: datos.FechaLocalPeru,
    FueraAñoEscolar: datos.FueraAñoEscolar,
    Semana_De_Gestion: datos.Semana_De_Gestion,
    Vacaciones_Interescolares: datos.Vacaciones_Interescolares,
    ComunicadosParaMostrarHoy: datos.ComunicadosParaMostrarHoy,
  };

  switch (rol) {
    case RolesSistema.Directivo:
      // Directors have access to all data
      return {
        ...datosBase,
        ListaDePersonalesAdministrativos:
          datos.ListaDePersonalesAdministrativos,
        ListaDeDirectivos: datos.ListaDeDirectivos,
        ListaDeProfesoresPrimaria: datos.ListaDeProfesoresPrimaria,
        ListaDeProfesoresSecundaria: datos.ListaDeProfesoresSecundaria,
        HorariosLaboraresGenerales: datos.HorariosLaboraresGenerales,
        HorariosEscolares: datos.HorariosEscolares,
        ListaDeAuxiliares: datos.ListaDeAuxiliares,
      } as DirectivoAsistenciaResponse;

    case RolesSistema.ProfesorPrimaria:
      // Primary school teachers receive their schedule and that of primary students
      return {
        ...datosBase,
        HorarioTomaAsistenciaProfesorPrimaria:
          datos.HorariosLaboraresGenerales.TomaAsistenciaProfesorPrimaria,
        HorarioEscolarPrimaria:
          datos.HorariosEscolares[NivelEducativo.PRIMARIA],
        Mi_Identificador: idUsuario,
      } as ProfesorPrimariaAsistenciaResponse;

    case RolesSistema.Auxiliar:
      // Auxiliaries receive their schedule and that of secondary students
      return {
        ...datosBase,
        HorarioTomaAsistenciaAuxiliares:
          datos.HorariosLaboraresGenerales.TomaAsistenciaAuxiliares,
        HorarioEscolarSecundaria:
          datos.HorariosEscolares[NivelEducativo.SECUNDARIA],
        Mi_Identificador: idUsuario,
      } as AuxiliarAsistenciaResponse;

    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
      // Secondary school teachers and tutors receive their own schedule and that of secondary students
      const profesorInfo = datos.ListaDeProfesoresSecundaria.find(
        (p) => p.Id_Profesor_Secundaria === idUsuario
      );

      return {
        ...datosBase,
        HorarioProfesor: profesorInfo
          ? {
              Hora_Entrada_Dia_Actual: profesorInfo.Hora_Entrada_Dia_Actual,
              Hora_Salida_Dia_Actual: profesorInfo.Hora_Salida_Dia_Actual,
            }
          : false,
        HorarioEscolarSecundaria:
          datos.HorariosEscolares[NivelEducativo.SECUNDARIA],
        Mi_Identificador: idUsuario,
      } as ProfesorTutorSecundariaAsistenciaResponse;

    case RolesSistema.Responsable:
      // Guardians receive primary and secondary school schedules
      return {
        ...datosBase,
        HorariosEscolares: datos.HorariosEscolares,
      } as ResponsableAsistenciaResponse;

    case RolesSistema.PersonalAdministrativo:
      // Administrative staff receive only their own schedule
      const personalInfo = datos.ListaDePersonalesAdministrativos.find(
        (p) => p.Id_Personal_Administrativo == idUsuario
      );
      return {
        ...datosBase,
        HorarioPersonal: personalInfo
          ? {
              Horario_Laboral_Entrada: personalInfo.Hora_Entrada_Dia_Actual,
              Horario_Laboral_Salida: personalInfo.Hora_Salida_Dia_Actual,
            }
          : false,
        Mi_Identificador: idUsuario,
      } as PersonalAdministrativoAsistenciaResponse;

    default:
      // By default, only return base data
      return datosBase;
  }
}
