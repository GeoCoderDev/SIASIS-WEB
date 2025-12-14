// ========== IMPORTS ==========
import { ModoRegistro } from "./ModoRegistro";
import { RolesSistema } from "./RolesSistema";
import { Meses } from "./Meses";
import { ActoresSistema } from "./ActoresSistema";
import { EstadosAsistenciaPersonal } from "./EstadosAsistenciaPersonal";
import { SuccessResponseAPIBase } from "./apis/types";
import { NivelEducativo } from "./NivelEducativo";
import { AsistenciaEscolarDeUnDia } from "./AsistenciasEscolares";

// ========== RESPONSES AND RESULTS ==========

//////////////////////
// DAILY RESULTS
//////////////////////
export interface AsistenciaDiariaDePersonalResultado {
  idUsuario: string;
  AsistenciaMarcada: boolean;
  Detalles: {
    // For staff
    Timestamp?: number;

    DesfaseSegundos: number;
  };
}

export interface AsistenciaDiariaEscolarResultado {
  Id_Estudiante: string;
  AsistenciaMarcada: boolean;
  Asistencia: AsistenciaEscolarDeUnDia | null;
}

// ---------------------------------------------------------------
// |               UNITARY ATTENDANCE DETAILS                    |
// ---------------------------------------------------------------

export interface DetallesAsistenciaUnitariaPersonal {
  Timestamp: number;
  DesfaseSegundos: number;
}

export interface DetallesAsistenciaUnitariaEstudiantes {
  DesfaseSegundos: number;
}

// ---------------------------------------------------------------
// |               UNITARY ATTENDANCE DETAILS                    |
// ---------------------------------------------------------------
export interface RegistroAsistenciaUnitariaPersonal {
  ModoRegistro: ModoRegistro;
  Id_Usuario: string;
  Rol: RolesSistema | ActoresSistema;
  Dia: number;
  Detalles:
    | DetallesAsistenciaUnitariaPersonal
    | DetallesAsistenciaUnitariaEstudiantes
    | null;
  esNuevoRegistro: boolean;
}

//////////////////////
// MONTHLY RECORD FOR STAFF
//////////////////////
export type RegistroAsistenciaMensualPersonal = Pick<
  RegistroAsistenciaUnitariaPersonal,
  "Id_Usuario" | "Rol" | "ModoRegistro"
> & {
  Mes: Meses;
  RegistrosDelMes: Record<number, DetallesAsistenciaUnitariaPersonal | null>;
};

//////////////////////
// ENUMS
//////////////////////
export enum TipoAsistencia {
  ParaPersonal = "personal",
  ParaEstudiantesSecundaria = "secundaria",
  ParaEstudiantesPrimaria = "primaria",
}

// ----------------------------------------------------------------------------
// |         RELATED TO THE STATE OF EACH TYPE OF ATTENDANCE TAKING         |
// ----------------------------------------------------------------------------
export interface EstadoTomaAsistenciaResponseBody {
  TipoAsistencia: TipoAsistencia;
  Dia: number;
  Mes: Meses;
  Anio: number;
  AsistenciaIniciada: boolean;
}

export interface IniciarTomaAsistenciaRequestBody {
  TipoAsistencia: TipoAsistencia;
}

// --------------------------------------------------------------------------------
// |        ATTENDANCES TAKEN GROUPED BY ACTOR OR BY A SINGLE STAFF MEMBER        |
// --------------------------------------------------------------------------------

export interface ConsultarAsistenciasDePersonalTomadasPorRolEnRedisResponseBody {
  Rol: RolesSistema;
  Dia: number;
  Mes: Meses;
  ModoRegistro: ModoRegistro;
  TipoAsistencia: TipoAsistencia;
  Resultados:
    | AsistenciaDiariaDePersonalResultado[]
    | AsistenciaDiariaDePersonalResultado
    | null; // Array for multiple, object/null for unitary
}

// --------------------------------------------------------------------------------
// |        ATTENDANCES TAKEN GROUPED BY ACTOR OR BY A SINGLE STAFF MEMBER        |
// --------------------------------------------------------------------------------
/**
 * ✅ NEW: Specific interfaces for different types of queries from the frontend
 */

// For self-query (only requires ModoRegistro)
export interface ConsultaAsistenciaPropia {
  ModoRegistro: ModoRegistro;
  // Actor and TipoAsistencia are automatically determined from the token
}

// For querying a specific staff member
export interface ConsultaAsistenciaPersonal extends ConsultaAsistenciaPropia {
  Actor: Exclude<ActoresSistema, ActoresSistema.Estudiante>;
  TipoAsistencia: TipoAsistencia.ParaPersonal;
  idUsuario: string;
}

// For querying specific students
export interface ConsultaAsistenciaEstudiante {
  Actor: ActoresSistema.Estudiante;
  TipoAsistencia:
    | TipoAsistencia.ParaEstudiantesPrimaria
    | TipoAsistencia.ParaEstudiantesSecundaria;
  idUsuario?: string; // Optional for query
  NivelEducativo?: NivelEducativo; // Required for group or individual queries
  Grado?: string; // Required for group or individual queries
  Seccion?: string; // Required for group or individual queries
}

// ------------------------------------------------------------------------
// |     REGISTRATION OF THE ATTENDANCE OF AN ACTOR (STAFF / STUDENT)     |
// ------------------------------------------------------------------------

// ✅ Main interface (flexible for all cases)
export interface RegistrarAsistenciaIndividualRequestBody {
  Id_Usuario?: string; // ✅ Optional for self-registration
  Id_Estudiante?: string; // Only for students
  TipoAsistencia?: TipoAsistencia;
  Actor?: ActoresSistema | RolesSistema;
  ModoRegistro: ModoRegistro;
  FechaHoraEsperadaISO?: string; // Only for Staff (For a more accurate offset calculation)
  desfaseSegundosAsistenciaEstudiante?: number; //Only for students
  NivelDelEstudiante?: NivelEducativo; // Only for students
  Grado?: number; // Only for students
  Seccion?: string; // Only for students
}

// --------------------------------------------------------------------------------------
// |     QUERY OF ATTENDANCES TAKEN GROUPED BY ACTOR OR FOR A SINGLE STAFF MEMBER    |
// --------------------------------------------------------------------------------------

export interface RegistrarAsistenciaIndividualSuccessResponse
  extends SuccessResponseAPIBase {
  data: {
    timestamp: number;
    desfaseSegundos: number;
    esNuevoRegistro: boolean;
    esRegistroPropio: boolean;
    actorRegistrado: ActoresSistema;
    tipoAsistencia: TipoAsistencia;
  };
}

// ------------------------------------------------------------------------------
// |               LOCAL MONTHLY ATTENDANCE INTERFACES                  |
// ------------------------------------------------------------------------------

export interface AsistenciaMensualPersonal {
  Id_Registro_Mensual: number;
  mes: Meses;
  idUsuario_Personal: string;
  registros: Record<string, RegistroEntradaSalida>;
}

// LOCAL ENTRY/EXIT RECORDS FOR STAFF
export interface RegistroEntradaSalida {
  timestamp: number;
  desfaseSegundos: number;
  estado: EstadosAsistenciaPersonal;
}

// --------------------------------------------------------------------------------
// |                   DELETION OF RECENTLY TAKEN ATTENDANCES                  |
// --------------------------------------------------------------------------------

export interface EliminarAsistenciaRequestBody {
  Id_Usuario: string;
  Actor: ActoresSistema;
  ModoRegistro: ModoRegistro;
  TipoAsistencia: TipoAsistencia;

  // Specific date (optional, defaults to current date)
  Fecha?: string; // YYYY-MM-DD format

  // For students (optional if not specified, searched by pattern)
  NivelEducativo?: NivelEducativo;
  Grado?: number;
  Seccion?: string;
}

// Interface for successful response
export interface EliminarAsistenciaSuccessResponse {
  success: true;
  message: string;
  data: {
    asistenciaEliminada: boolean;
    claveEliminada: string | null;
    fecha: string;
  };
}