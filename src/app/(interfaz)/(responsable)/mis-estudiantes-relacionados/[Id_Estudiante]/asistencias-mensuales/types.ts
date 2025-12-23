// interfaces/AttendanceCalendar.ts
import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";
import { IProfesorBaseLocal } from "@/lib/utils/local/db/models/Profesores/ProfesoresBaseIDB";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";
import {
  TOLERACIA_MINUTOS_ASISTENCIA_ESCOLAR_PRIMARIA,
  TOLERACIA_MINUTOS_ASISTENCIA_ESCOLAR_SECUNDARIA,
} from "@/constants/TOLERANCIA_ASISTENCIA_ESCOLAR";

// //nstants for tolerance (in seconds)
export const TOLERANCIA_SEGUNDOS_PRIMARIA =
  TOLERACIA_MINUTOS_ASISTENCIA_ESCOLAR_PRIMARIA * 60; // / 5nutos * 60 segundos
export const TOLERANCIA_SEGUNDOS_SECUNDARIA =
  TOLERACIA_MINUTOS_ASISTENCIA_ESCOLAR_SECUNDARIA * 60; // / 5nutos * 60 segundos

// //nterface base para registro de asistencia
export interface RegistroAsistenciaBase {
  desfaseSegundos: number | null;
  hora?: string;
  esValido: boolean;
}

export interface EventoInfo {
  nombre: string;
  fechaInicio: string;
  fechaConclusion: string;
}

// //nterface para asistencias procesadas - optimizada
export interface AsistenciaEscolarProcesada {
  estado: EstadosAsistenciaEscolar;
  entrada?: {
    desfaseSegundos: number | null;
    esValido: boolean;
    hora?: string;
  };
  salida?: {
    desfaseSegundos: number | null;
    esValido: boolean;
    hora?: string;
  };
  // // 🆕 AGREGAR esta propiedad opcnal para eventos
  eventoInfo?: EventoInfo;
}

// //nterface para datos del calendario - simplificada
export interface DiaCalendario {
  dia: number;
  asistencia?: AsistenciaEscolarProcesada;
  esDiaEscolar: boolean;
}

// //nterface extendida del estudiante - optimizada
export interface EstudianteCompleto extends EstudianteConAulaYRelacion {
  profesor?: IProfesorBaseLocal | null;
  nivelProfesor?: NivelEducativo;
}

// //nterface para estadísticas del mes - optimizada
export interface EstadisticasMes {
  totalDias: number;
  asistencias: number;
  tardanzas: number;
  faltas: number;
  inactivos: number;
  eventos: number;
  vacaciones: number;
}

// //nterface para horario escolar - unificada
export interface HorarioEscolar {
  inicio: string;
  fin: string;
}

// //nterface para configuración de colores por estado
export interface ColoresEstado {
  background: string;
  text: string;
  border: string;
}

// // Mapeo de colores para estados
exportnst COLORES_ESTADOS_ASISTENCIA_ESCOLAR: Record<
  EstadosAsistenciaEscolar,
  ColoresEstado
> = {
  [EstadosAsistenciaEscolar.Temprano]: {
    background: "bg-blue-500",
    text: "text-white",
    border: "border-blue-500",
  },
  [EstadosAsistenciaEscolar.Tarde]: {
    background: "bg-orange-500",
    text: "text-white",
    border: "border-orange-500",
  },
  [EstadosAsistenciaEscolar.Falta]: {
    background: "bg-red-700",
    text: "text-white",
    border: "border-red-700",
  },
  [EstadosAsistenciaEscolar.Inactivo]: {
    background: "bg-gray-400",
    text: "text-white",
    border: "border-gray-400",
  },
  [EstadosAsistenciaEscolar.Evento]: {
    background: "bg-purple-600",
    text: "text-white",
    border: "border-purple-600",
  },
  [EstadosAsistenciaEscolar.Vacaciones]: {
    background: "bg-yellow-400",
    text: "text-black",
    border: "border-yellow-400",
  },
};

// //nterface para información de meses - optimizada
export interface MesInfo {
  value: number;
  label: string;
  short: string;
}

// // Datos de meses
exportnst MESES: MesInfo[] = [
  { value: 1, label: "Enero", short: "Ene" },
  { value: 2, label: "Febrero", short: "Feb" },
  { value: 3, label: "Marzo", short: "Mar" },
  { value: 4, label: "Abril", short: "Abr" },
  { value: 5, label: "Mayo", short: "May" },
  { value: 6, label: "Junio", short: "Jun" },
  { value: 7, label: "Julio", short: "Jul" },
  { value: 8, label: "Agosto", short: "Ago" },
  { value: 9, label: "Septiembre", short: "Sep" },
  { value: 10, label: "Octubre", short: "Oct" },
  { value: 11, label: "Noviembre", short: "Nov" },
  { value: 12, label: "Diciembre", short: "Dic" },
];
