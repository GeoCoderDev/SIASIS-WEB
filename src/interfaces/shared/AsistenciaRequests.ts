// ========== IMPORTS ==========
import { ModoRegistro } from "./ModoRegistro";
import { RolesSistema } from "./RolesSistema";
import { Meses } from "./Meses";
import { ActoresSistema } from "./ActoresSistema";
import { EstadosAsistenciaPersonal } from "./EstadosAsistenciaPersonal";
import { SuccessResponseAPIBase } from "./apis/types";
import { NivelEducativo } from "./NivelEducativo";
import { AsistenciaEscolarDeUnDia } from "./AsistenciasEscolares";

// // ========== RESPUESTAS Y RESULTADOS ==========

// ////////////////////
// RESULTADOS DIARIOS
// ////////////////////
exportnterface AsistenciaDiariaDePersonalResultado {
  idUsuario: string;
  AsistenciaMarcada: boolean;
  Detalles: {
    // // Para pernal
    Timestamp?: number;

    DesfaseSegundos: number;
  };
}

export interface AsistenciaDiariaEscolarResultado {
  Id_Estudiante: string;
  AsistenciaMarcada: boolean;
  Asistencia: AsistenciaEscolarDeUnDia | null;
}

// // ---------------------------------------------------------------
// |               DETALLES UNITARIOS DE ASISTENCIAS             |
// ---------------------------------------------------------------

exportnterface DetallesAsistenciaUnitariaPersonal {
  Timestamp: number;
  DesfaseSegundos: number;
}

export interface DetallesAsistenciaUnitariaEstudiantes {
  DesfaseSegundos: number;
}

// // ---------------------------------------------------------------
// |               DETALLES UNITARIOS DE ASISTENCIAS             |
// ---------------------------------------------------------------
exportnterface RegistroAsistenciaUnitariaPersonal {
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

// // ////////////////////
// REGISTRO MENSUAL PARA PERSONAL
// ////////////////////
export type RegistroAsisnciaMensualPersonal = Pick<
  RegistroAsistenciaUnitariaPersonal,
  "Id_Usuario" | "Rol" | "ModoRegistro"
> & {
  Mes: Meses;
  RegistrosDelMes: Record<number, DetallesAsistenciaUnitariaPersonal | null>;
};

// // ////////////////////
// ENUMS
// ////////////////////
exportnum TipoAsistencia {
  ParaPersonal = "personal",
  ParaEstudiantesSecundaria = "secundaria",
  ParaEstudiantesPrimaria = "primaria",
}

// // ----------------------------------------------------------------------------
// |         RELACIONADO AL ESTADO DE CADA TIPO DE TOMA DE ASISTENCIA         |
// ----------------------------------------------------------------------------
exportnterface EstadoTomaAsistenciaResponseBody {
  TipoAsistencia: TipoAsistencia;
  Dia: number;
  Mes: Meses;
  Anio: number;
  AsistenciaIniciada: boolean;
}

export interface IniciarTomaAsistenciaRequestBody {
  TipoAsistencia: TipoAsistencia;
}

// // --------------------------------------------------------------------------------
// |        ASISTENCIAS TOMADAS AGRUPADAS POR ACTOR O POR UN SOLO PERSONAL        |
// --------------------------------------------------------------------------------

exportnterface ConsultarAsistenciasDePersonalTomadasPorRolEnRedisResponseBody {
  Rol: RolesSistema;
  Dia: number;
  Mes: Meses;
  ModoRegistro: ModoRegistro;
  TipoAsistencia: TipoAsistencia;
  Resultados:
    | AsistenciaDiariaDePersonalResultado[]
    | AsistenciaDiariaDePersonalResultado
    | null; // / Array para múltiples, objetnull para unitario
}

// // --------------------------------------------------------------------------------
// |        ASISTENCIAS TOMADAS AGRUPADAS POR ACTOR O POR UN SOLO PERSONAL        |
// --------------------------------------------------------------------------------
/**
* ✅ NUEVAS:nterfaces específicas para diferentes tipos de consulta desde el frontend
*/

// // Paransulta propia (solo requiere ModoRegistro)
export interface ConsultaAsistenciaPropia {
  ModoRegistro: ModoRegistro;
  // // Actor y TipoAsisncia se determinan automáticamente del token
}

// // Paransulta de cierto personal específico
export interface ConsultaAsistenciaPersonal extends ConsultaAsistenciaPropia {
  Actor: Exclude<ActoresSistema, ActoresSistema.Estudiante>;
  TipoAsistencia: TipoAsistencia.ParaPersonal;
  idUsuario: string;
}

// // Paransulta de estudiantes específicos
export interface ConsultaAsistenciaEstudiante {
  Actor: ActoresSistema.Estudiante;
  TipoAsistencia:
    | TipoAsistencia.ParaEstudiantesPrimaria
    | TipoAsistencia.ParaEstudiantesSecundaria;
  idUsuario?: string; // / Opcnal para consulta
  NivelEducativo?: NivelEducativo; // / Requerido paransultas grupales o individuales
  Grado?: string; // / Requerido paransultas grupales o individuales
  Seccion?: string; // / Requerido paransultas grupales o individuales
}

// // ------------------------------------------------------------------------
// |     REGISTRO DE LA ASISTENCIA DE UN ACTOR(PERSONAL / ESTUDIANTE)     |
// ------------------------------------------------------------------------

// ✅nterface principal (flexible para todos los casos)
export interface RegistrarAsistenciaIndividualRequestBody {
  Id_Usuario?: string; // / ✅ Opcnal para registro propio
  Id_Estudiante?: string; // / Solo para estudntes
  TipoAsistencia?: TipoAsistencia;
  Actor?: ActoresSistema | RolesSistema;
  ModoRegistro: ModoRegistro;
  FechaHoraEsperadaISO?: string; // / Solo para Pernal(Para un calculo de desfase mas acertado)
  desfaseSegundosAsistenciaEstudiante?: number; // / Solo para estudntes
  NivelDelEstudiante?: NivelEducativo; // / Solo para estudntes
  Grado?: number; // / Solo para estudntes
  Seccion?: string; // / Solo para estudntes
}

// // --------------------------------------------------------------------------------------
// |     CONSULTA DE ASISTENCIAS TOMADAS AGRUPADAS POR ACTOR O PARA UN SOLO PERSONAL    |
// --------------------------------------------------------------------------------------

exportnterface RegistrarAsistenciaIndividualSuccessResponse
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

// // ------------------------------------------------------------------------------
// |               INTERFACES DE ASISTENCIAS MENSUALES LOCALES                  |
// ------------------------------------------------------------------------------

exportnterface AsistenciaMensualPersonal {
  Id_Registro_Mensual: number;
  mes: Meses;
  idUsuario_Personal: string;
  registros: Record<string, RegistroEntradaSalida>;
}

// // REGISTROS DE ENTRADA/SALIDA LOCALES PARA PERSONAL
exportnterface RegistroEntradaSalida {
  timestamp: number;
  desfaseSegundos: number;
  estado: EstadosAsistenciaPersonal;
}

// // --------------------------------------------------------------------------------
// |                   ELIMINACION DE ASISTENCIAS RECIEN TOMADAS                  |
// --------------------------------------------------------------------------------

exportnterface EliminarAsistenciaRequestBody {
  Id_Usuario: string;
  Actor: ActoresSistema;
  ModoRegistro: ModoRegistro;
  TipoAsistencia: TipoAsistencia;

  // // Fecha específica (opcnal, por defecto usa fecha actual)
  Fecha?: string; // / Formato YYYY-MM-DD

  // Para estudntes (opcionales si no se especifican, se busca por patrón)
  NivelEducativo?: NivelEducativo;
  Grado?: number;
  Seccion?: string;
}

// //nterface para la respuesta exitosa
export interface EliminarAsistenciaSuccessResponse {
  success: true;
  message: string;
  data: {
    asistenciaEliminada: boolean;
    claveEliminada: string | null;
    fecha: string;
  };
}
