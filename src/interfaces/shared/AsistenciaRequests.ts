import { ModoRegistro } from "./ModoRegistroPersonal";
import { RolesSistema } from "./RolesSistema";
import { Meses } from "./Meses";
import { ActoresSistema } from "./ActoresSistema";
import { EstadosAsistenciaPersonal } from "./EstadosAsistenciaPersonal";
import { EstadosAsistencia } from "./EstadosAsistenciaEstudiantes";
import { SuccessResponseAPIBase } from "./apis/types";
import { NivelEducativo } from "./NivelEducativo";

export interface AsistenciaDiariaResultado {
  idUsuario: string; // ✅ ACTUALIZADO: Era "DNI", ahora soporta ID (directivos) o DNI (otros)
  AsistenciaMarcada: boolean;
  Detalles: {
    // Para estudiantes
    Estado?: EstadosAsistencia;
    // Para personal
    Timestamp?: number;
    DesfaseSegundos?: number;
  };
}

export interface DetallesAsistenciaUnitariaEstudiantes {
  Estado: EstadosAsistencia;
}

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

export type RegistroAsistenciaMensualPersonal = Pick<
  RegistroAsistenciaUnitariaPersonal,
  "Id_Usuario" | "Rol" | "ModoRegistro"
> & {
  Mes: Meses;
  RegistrosDelMes: Record<number, DetallesAsistenciaUnitariaPersonal | null>;
};

export interface DetallesAsistenciaUnitariaPersonal {
  Timestamp: number;
  DesfaseSegundos: number;
}

export interface ConsultarAsistenciasDiariasPorActorEnRedisResponseBody {
  Actor: ActoresSistema;
  ModoRegistro: ModoRegistro;
  Resultados: AsistenciaDiariaResultado[];
  Mes: Meses;
  Dia: number;
}

export enum TipoAsistencia {
  ParaPersonal = "personal",
  ParaEstudiantesSecundaria = "secundaria",
  ParaEstudiantesPrimaria = "primaria",
}

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

export interface DetallesAsistenciaUnitariaPersonal {
  Timestamp: number;
  DesfaseSegundos: number;
}

/**
 * ✅ ACTUALIZADO: Respuesta del endpoint de consulta de asistencias diarias
 */
export interface ConsultarAsistenciasTomadasPorActorEnRedisResponseBody {
  Actor: ActoresSistema;
  Dia: number;
  Mes: Meses;
  ModoRegistro: ModoRegistro;
  TipoAsistencia: TipoAsistencia; // ✅ AGREGADO: Para mayor claridad en la respuesta
  Resultados: AsistenciaDiariaResultado[] | AsistenciaDiariaResultado | null; // Array para múltiples, objeto/null para unitario
}

/**
 * ✅ NUEVAS: Interfaces específicas para diferentes tipos de consulta desde el frontend
 */

// Para consulta propia (solo requiere ModoRegistro)
export interface ConsultaAsistenciaPropia {
  ModoRegistro: ModoRegistro;
  // Actor y TipoAsistencia se determinan automáticamente del token
}

// Para consulta de personal específico
export interface ConsultaAsistenciaPersonal extends ConsultaAsistenciaPropia {
  Actor: Exclude<ActoresSistema, ActoresSistema.Estudiante>;
  TipoAsistencia: TipoAsistencia.ParaPersonal;
  idUsuario: string; // ID para directivos, DNI para otros
}

// Para consulta de estudiantes específicos
export interface ConsultaAsistenciaEstudiante extends ConsultaAsistenciaPropia {
  Actor: ActoresSistema.Estudiante;
  TipoAsistencia:
    | TipoAsistencia.ParaEstudiantesPrimaria
    | TipoAsistencia.ParaEstudiantesSecundaria;
  idUsuario?: string; // Opcional para consulta individual
  NivelEducativo?: string; // Requerido para consultas grupales o individuales
  Grado?: string; // Requerido para consultas grupales o individuales
  Seccion?: string; // Requerido para consultas grupales o individuales
}

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

// Interfaces para asistencia mensual
export interface AsistenciaMensualPersonal {
  Id_Registro_Mensual: number;
  mes: Meses;
  idUsuario_Personal: string;
  registros: Record<string, RegistroEntradaSalida>;
}

// Interfaces para los registros de entrada/salida
export interface RegistroEntradaSalida {
  timestamp: number;
  desfaseSegundos: number;
  estado: EstadosAsistenciaPersonal;
}

export interface RegistroEntradaSalidaPersonal {
  timestamp: number;
  desfaseSegundos: number;
  estado: EstadosAsistenciaPersonal;
}


// Interface para el request body
export interface EliminarAsistenciaRequestBody {
  Id_Usuario: string;
  Actor: ActoresSistema;
  ModoRegistro: ModoRegistro;
  TipoAsistencia: TipoAsistencia;
  // Para estudiantes (opcionales si no se especifican, se busca por patrón)
  NivelEducativo?: string;
  Grado?: number;
  Seccion?: string;
  // Fecha específica (opcional, por defecto usa fecha actual)
  Fecha?: string; // Formato YYYY-MM-DD
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

// ✅ Interface principal (flexible para todos los casos)
export interface RegistrarAsistenciaIndividualRequestBody {
  Id_Usuario?: string; // ✅ Opcional para registro propio
  TipoAsistencia?: TipoAsistencia;
  Actor?: ActoresSistema | RolesSistema;
  ModoRegistro: ModoRegistro;
  FechaHoraEsperadaISO: string;
  NivelDelEstudiante?: NivelEducativo;
  Grado?: number;
  Seccion?: string;
}

// ✅ Interfaces específicas para TypeScript
export interface RegistroPropio {
  ModoRegistro: ModoRegistro;
  FechaHoraEsperadaISO: string;
}

export interface RegistroPersonal extends RegistroPropio {
  Id_Usuario: string;
  TipoAsistencia: TipoAsistencia.ParaPersonal;
  Actor: Exclude<ActoresSistema, ActoresSistema.Estudiante>;
}

export interface RegistroEstudiante extends RegistroPropio {
  Id_Usuario: string;
  TipoAsistencia:
    | TipoAsistencia.ParaEstudiantesPrimaria
    | TipoAsistencia.ParaEstudiantesSecundaria;
  Actor: ActoresSistema.Estudiante;
  NivelDelEstudiante: NivelEducativo;
  Grado: number;
  Seccion: string;
}