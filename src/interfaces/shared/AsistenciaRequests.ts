// ========== IMPORTS ==========
import { ModoRegistro } from "./ModoRegistroPersonal";
import { RolesSistema } from "./RolesSistema";
import { Meses } from "./Meses";
import { ActoresSistema } from "./ActoresSistema";
import { EstadosAsistenciaPersonal } from "./EstadosAsistenciaPersonal";
import { EstadosAsistencia } from "./EstadosAsistenciaEstudiantes";
import { SuccessResponseAPIBase } from "./apis/types";
import { NivelEducativo } from "./NivelEducativo";

// ========== RESPUESTAS Y RESULTADOS ==========

//////////////////////
// RESULTADOS DIARIOS
//////////////////////
export interface AsistenciaDiariaResultado {
  idUsuario: string;
  AsistenciaMarcada: boolean;
  Detalles: {

    // Para personal
    Timestamp?: number;

    
    DesfaseSegundos: number;
  };
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

// // ✅ Interfaces específicas para TypeScript
// export interface RegistroPropio {
//   ModoRegistro: ModoRegistro;
//   FechaHoraEsperadaISO: string;
// }

// export interface RegistroPersonal extends RegistroPropio {
//   Id_Usuario: string;
//   TipoAsistencia: TipoAsistencia.ParaPersonal;
//   Actor: Exclude<ActoresSistema, ActoresSistema.Estudiante>;
// }

// export interface RegistroEstudiante extends RegistroPropio {
//   Id_Usuario: string;
//   TipoAsistencia:
//     | TipoAsistencia.ParaEstudiantesPrimaria
//     | TipoAsistencia.ParaEstudiantesSecundaria;
//   Actor: ActoresSistema.Estudiante;
//   NivelDelEstudiante: NivelEducativo;
//   Grado: number;
//   Seccion: string;
// }

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

export interface ConsultarAsistenciasTomadasPorActorEnRedisResponseBody {
  Actor: ActoresSistema;
  Dia: number;
  Mes: Meses;
  ModoRegistro: ModoRegistro;
  TipoAsistencia: TipoAsistencia;
  Resultados: AsistenciaDiariaResultado[] | AsistenciaDiariaResultado | null; // Array para múltiples, objeto/null para unitario
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
  NivelDelEstudiante?: NivelEducativo;
  Grado?: number;
  Seccion?: string;
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
