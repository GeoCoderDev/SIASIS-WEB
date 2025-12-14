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
import { getTodayAttendanceData } from "../_utils/obtenerDatosAsistenciaHoy";

export async function GET(req: NextRequest) {
  try {
    const { decodedToken, rol: role, error } = await verifyAuthToken(req);

    if (error) return error;

    // Get data using the new service
    const {
      data: completeData,
      source,
      message,
    } = await getTodayAttendanceData();

    // Filter data according to role
    const filteredData = filterDataByRole(
      completeData,
      role,
      decodedToken.ID_Usuario
    );

    // Return filtered data with source indicator
    return NextResponse.json({
      ...filteredData,
      _debug: message,
      _source: source,
    });
  } catch (error) {
    console.error("Error getting attendance data:", error);

    // Determine the error type
    let logoutType = LogoutTypes.SYSTEM_ERROR;
    const errorDetails: ErrorDetailsForLogout = {
      message: "Error retrieving attendance data",
      origin: "api/datos-asistencia-hoy",
      timestamp: Date.now(),
      siasisComponent: "RDP04", // Main component is RDP04 (blob)
    };

    if (error instanceof Error) {
      // If it's a network error or connection problem
      if (
        error.message.includes("fetch") ||
        error.message.includes("network") ||
        error.message.includes("ECONNREFUSED") ||
        error.message.includes("timeout") ||
        error.message.includes("HTTP request timeout")
      ) {
        logoutType = LogoutTypes.NETWORK_ERROR;
        errorDetails.message =
          "Connection error when getting attendance data";
      }
      // If it's a JSON parsing error
      else if (
        error.message.includes("JSON") ||
        error.message.includes("parse") ||
        error.message.includes("not valid JSON")
      ) {
        logoutType = LogoutTypes.CORRUPT_DATA_ERROR;
        errorDetails.message = "Error processing attendance data";
        errorDetails.contexto = "Invalid data format";
      }
      // If Redis lookup failed
      else if (
        error.message.includes(
          "Backup file ID not found in Redis"
        )
      ) {
        logoutType = LogoutTypes.DATA_NOT_AVAILABLE_ERROR;
        errorDetails.message =
          "Could not find attendance information";
        errorDetails.siasisComponent = "RDP05"; // Specific Redis error
      }
      // If both main access and backup failed
      else if (
        error.message.includes("Main access and backup failed")
      ) {
        logoutType = LogoutTypes.DATA_NOT_AVAILABLE_ERROR;
        errorDetails.message =
          "Could not get attendance information";
        errorDetails.contexto =
          "Failed to access both blob and Google Drive";
      }
      // If it's a specific HTTP error
      else if (
        error.message.includes("HTTP error in blob") ||
        error.message.includes("HTTP error in backup")
      ) {
        logoutType = LogoutTypes.NETWORK_ERROR;
        errorDetails.message =
          "Server error when getting attendance data";
        errorDetails.contexto = "Invalid HTTP response";
      }

      errorDetails.message += `: ${error.message}`;
    }

    return redirectToLogin(logoutType, errorDetails);
  }
}

// Function to filter data according to role
function filterDataByRole(
  data: DatosAsistenciaHoyIE20935,
  role: RolesSistema,
  userId: string
): BaseAsistenciaResponse {
  // Base data for all roles
  const baseData: BaseAsistenciaResponse = {
    DiaEvento: data.DiaEvento,
    FechaUTC: data.FechaUTC,
    FechaLocalPeru: data.FechaLocalPeru,
    FueraAñoEscolar: data.FueraAñoEscolar,
    Semana_De_Gestion: data.Semana_De_Gestion,
    Vacaciones_Interescolares: data.Vacaciones_Interescolares,
    ComunicadosParaMostrarHoy: data.ComunicadosParaMostrarHoy,
  };

  switch (role) {
    case RolesSistema.Directivo:
      // Directors have access to all data
      return {
        ...baseData,
        ListaDePersonalesAdministrativos:
          data.ListaDePersonalesAdministrativos,
        ListaDeDirectivos: data.ListaDeDirectivos,
        ListaDeProfesoresPrimaria: data.ListaDeProfesoresPrimaria,
        ListaDeProfesoresSecundaria: data.ListaDeProfesoresSecundaria,
        HorariosLaboraresGenerales: data.HorariosLaboraresGenerales,
        HorariosEscolares: data.HorariosEscolares,
        ListaDeAuxiliares: data.ListaDeAuxiliares,
      } as DirectivoAsistenciaResponse;

    case RolesSistema.ProfesorPrimaria:
      // Primary school teachers receive their schedule and that of primary students
      return {
        ...baseData,
        HorarioTomaAsistenciaProfesorPrimaria:
          data.HorariosLaboraresGenerales.TomaAsistenciaProfesorPrimaria,
        HorarioEscolarPrimaria:
          data.HorariosEscolares[NivelEducativo.PRIMARIA],
        Mi_Identificador: userId,
      } as ProfesorPrimariaAsistenciaResponse;

    case RolesSistema.Auxiliar:
      // Auxiliaries receive their schedule and that of secondary students
      return {
        ...baseData,
        HorarioTomaAsistenciaAuxiliares:
          data.HorariosLaboraresGenerales.TomaAsistenciaAuxiliares,
        HorarioEscolarSecundaria:
          data.HorariosEscolares[NivelEducativo.SECUNDARIA],
        Mi_Identificador: userId,
      } as AuxiliarAsistenciaResponse;

    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
      // Secondary school teachers and tutors receive their own schedule and that of secondary students
      const teacherInfo = data.ListaDeProfesoresSecundaria.find(
        (p) => p.Id_Profesor_Secundaria === userId
      );

      return {
        ...baseData,
        HorarioProfesor: teacherInfo
          ? {
              Hora_Entrada_Dia_Actual: teacherInfo.Hora_Entrada_Dia_Actual,
              Hora_Salida_Dia_Actual: teacherInfo.Hora_Salida_Dia_Actual,
            }
          : false,
        HorarioEscolarSecundaria:
          data.HorariosEscolares[NivelEducativo.SECUNDARIA],
        Mi_Identificador: userId,
      } as ProfesorTutorSecundariaAsistenciaResponse;

    case RolesSistema.Responsable:
      // Guardians receive primary and secondary school schedules
      return {
        ...baseData,
        HorariosEscolares: data.HorariosEscolares,
      } as ResponsableAsistenciaResponse;

    case RolesSistema.PersonalAdministrativo:
      // Administrative staff receive only their own schedule
      const staffInfo = data.ListaDePersonalesAdministrativos.find(
        (p) => p.Id_Personal_Administrativo == userId
      );
      return {
        ...baseData,
        HorarioPersonal: staffInfo
          ? {
              Horario_Laboral_Entrada: staffInfo.Hora_Entrada_Dia_Actual,
              Horario_Laboral_Salida: staffInfo.Hora_Salida_Dia_Actual,
            }
          : false,
        Mi_Identificador: userId,
      } as PersonalAdministrativoAsistenciaResponse;

    default:
      // By default, only return base data
      return baseData;
  }
}