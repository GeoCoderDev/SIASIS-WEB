// interfaces/CalendarAttendance.ts
import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";
import { IProfesorBaseLocal } from "@/lib/utils/local/db/models/Profesores/ProfesoresBaseIDB";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";
import {
  TOLERACIA_MINUTOS_ASISTENCIA_ESCOLAR_PRIMARIA,
  TOLERACIA_MINUTOS_ASISTENCIA_ESCOLAR_SECUNDARIA,
} from "@/constants/TOLERANCIA_ASISTENCIA_ESCOLAR";

// Constants for tolerance (in seconds)
export const PRIMARY_TOLERANCE_SECONDS =
  TOLERACIA_MINUTOS_ASISTENCIA_ESCOLAR_PRIMARIA * 60; // 5 minutes * 60 seconds
export const SECONDARY_TOLERANCE_SECONDS =
  TOLERACIA_MINUTOS_ASISTENCIA_ESCOLAR_SECUNDARIA * 60; // 5 minutes * 60 seconds

// Base interface for attendance records
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

// Interface for processed attendances - optimized
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
  // 🆕 ADD this optional property for events
  eventoInfo?: EventoInfo;
}

// Interface for calendar data - simplified
export interface DiaCalendario {
  dia: number;
  asistencia?: AsistenciaEscolarProcesada;
  esDiaEscolar: boolean;
}

// Extended student interface - optimized
export interface EstudianteCompleto extends EstudianteConAulaYRelacion {
  profesor?: IProfesorBaseLocal | null;
  nivelProfesor?: NivelEducativo;
}

// Interface for month statistics - optimized
export interface EstadisticasMes {
  totalDias: number;
  asistencias: number;
  tardanzas: number;
  faltas: number;
  inactivos: number;
  eventos: number;
  vacaciones: number;
}

// Interface for school schedule - unified
export interface HorarioEscolar {
  inicio: string;
  fin: string;
}

// Interface for state color configuration
export interface ColoresEstado {
  background: string;
  text: string;
  border: string;
}

// Color mapping for states
export const COLORES_ESTADOS_ASISTENCIA_ESCOLAR: Record<
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

// Interface for month information - optimized
export interface MesInfo {
  value: number;
  label: string;
  short: string;
}

// Month data
export const MESES: MesInfo[] = [
  { value: 1, label: "January", short: "Jan" },
  { value: 2, label: "February", short: "Feb" },
  { value: 3, label: "March", short: "Mar" },
  { value: 4, label: "April", short: "Apr" },
  { value: 5, label: "May", short: "May" },
  { value: 6, label: "June", short: "Jun" },
  { value: 7, label: "July", short: "Jul" },
  { value: 8, label: "August", short: "Aug" },
  { value: 9, label: "September", short: "Sep" },
  { value: 10, label: "October", short: "Oct" },
  { value: 11, label: "November", short: "Nov" },
  { value: 12, label: "December", short: "Dec" },
];