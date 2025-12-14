// ========== IMPORTS ==========
import { ModoRegistro } from "./ModoRegistro";
import { RolesSistema } from "./RolesSistema";
import { Meses } from "./Meses";
import { ActoresSistema } from "./ActoresSistema";
import { EstadosAsistenciaPersonal } from "./EstadosAsistenciaPersonal";
import { SuccessResponseAPIBase } from "./apis/types";
import { NivelEducativo } from "./NivelEducativo";
import { AsistenciaEscolarDeUnDia } from "./AsistenciasEscolares";

// ========== RESPUESTAS Y RESULTADOS ==========

//////////////////////
// RESULTADOS DIARIOS
//////////////////////
export interface AsistenciaDiariaDePersonalResultado {
  idUsuario: string;
  AsistenciaMarcada: boolean;
  Detalles: {
    // Para personal
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
// |               DETALLES UNITARIOS DE ASISTENCIAS             |
// ---------------------------------------------------------------

export interface DetallesAsistenciaUnitariaPersonal {
  Timestamp: number;
  DesfaseSegundos: number;
}

export interface DetallesAsistenciaUnitariaEstudiantes {
  DesfaseSegundos: number;
}

// ---------------------------------------------------------------
// |               DETALLES UNITARIOS DE ASISTENCIAS             |
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
// REGISTRO MENSUAL PARA PERSONAL
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
// |         RELACIONADO AL ESTADO DE CADA TIPO DE TOMA DE ASISTENCIA         |
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
// |        ASISTENCIAS TOMADAS AGRUPADAS POR ACTOR O POR UN SOLO PERSONAL        |
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
    | null; // Array para múltiples, objeto/null para unitario
}

// --------------------------------------------------------------------------------
// |        ASISTENCIAS TOMADAS AGRUPADAS POR ACTOR O POR UN SOLO PERSONAL        |
// --------------------------------------------------------------------------------
/**
 * ✅ NUEVAS: Interfaces específicas para diferentes tipos de consulta desde el frontend
 */

// Para consulta propia (solo requiere ModoRegistro)
export interface ConsultaAsistenciaPropia {
  ModoRegistro: ModoRegistro;
  // Actor y TipoAsistencia se determinan automáticamente del token
}

// Para consulta de cierto personal específico
export interface ConsultaAsistenciaPersonal extends ConsultaAsistenciaPropia {
  Actor: Exclude<ActoresSistema, ActoresSistema.Estudiante>;
  TipoAsistencia: TipoAsistencia.ParaPersonal;
  idUsuario: string;
}

// Para consulta de estudiantes específicos
export interface ConsultaAsistenciaEstudiante {
  Actor: ActoresSistema.Estudiante;
  TipoAsistencia:
    | TipoAsistencia.ParaEstudiantesPrimaria
    | TipoAsistencia.ParaEstudiantesSecundaria;
  idUsuario?: string; // Opcional para consulta
  NivelEducativo?: NivelEducativo; // Requerido para consultas grupales o individuales
  Grado?: string; // Requerido para consultas grupales o individuales
  Seccion?: string; // Requerido para consultas grupales o individuales
}

// ------------------------------------------------------------------------
// |     REGISTRO DE LA ASISTENCIA DE UN ACTOR(PERSONAL / ESTUDIANTE)     |
// ------------------------------------------------------------------------

// ✅ Interface principal (flexible para todos los casos)
export interface RegistrarAsistenciaIndividualRequestBody {
  Id_Usuario?: string; // ✅ Opcional para registro propio
  Id_Estudiante?: string; // Solo para estudiantes
  TipoAsistencia?: TipoAsistencia;
  Actor?: ActoresSistema | RolesSistema;
  ModoRegistro: ModoRegistro;
  FechaHoraEsperadaISO?: string; // Solo para Personal(Para un calculo de desfase mas acertado)
  desfaseSegundosAsistenciaEstudiante?: number; //Solo para estudiantes
  NivelDelEstudiante?: NivelEducativo; // Solo para estudiantes
  Grado?: number; // Solo para estudiantes
  Seccion?: string; // Solo para estudiantes
}

// --------------------------------------------------------------------------------------
// |     CONSULTA DE ASISTENCIAS TOMADAS AGRUPADAS POR ACTOR O PARA UN SOLO PERSONAL    |
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
// |               INTERFACES DE ASISTENCIAS MENSUALES LOCALES                  |
// ------------------------------------------------------------------------------

export interface AsistenciaMensualPersonal {
  Id_Registro_Mensual: number;
  mes: Meses;
  idUsuario_Personal: string;
  registros: Record<string, RegistroEntradaSalida>;
}

// REGISTROS DE ENTRADA/SALIDA LOCALES PARA PERSONAL
export interface RegistroEntradaSalida {
  timestamp: number;
  desfaseSegundos: number;
  estado: EstadosAsistenciaPersonal;
}

// --------------------------------------------------------------------------------
// |                   ELIMINACION DE ASISTENCIAS RECIEN TOMADAS                  |
// --------------------------------------------------------------------------------

export interface EliminarAsistenciaRequestBody {
  Id_Usuario: string;
  Actor: ActoresSistema;
  ModoRegistro: ModoRegistro;
  TipoAsistencia: TipoAsistencia;

  // Fecha específica (opcional, por defecto usa fecha actual)
  Fecha?: string; // Formato YYYY-MM-DD

  // Para estudiantes (opcionales si no se especifican, se busca por patrón)
  NivelEducativo?: NivelEducativo;
  Grado?: number;
  Seccion?: string;
}

// Interface para la respuesta exitosa
export interface EliminarAsistenciaSuccessResponse {
  success: true;
  message: string;
  data: {
    asistenciaEliminada: boolean;
    claveEliminada: string | null;
    fecha: string;
  };
}
