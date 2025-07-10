
import { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { GenericUser } from "@/interfaces/shared/GenericUser";

export interface RegistroDiaExcel {
  fecha: string;
  entradaProgramada: string;
  entradaReal: string;
  diferenciaEntrada: string;
  estadoEntrada: EstadosAsistenciaPersonal;
  salidaProgramada: string;
  salidaReal: string;
  diferenciaSalida: string;
  estadoSalida: EstadosAsistenciaPersonal;
  esEvento: boolean;
  nombreEvento?: string;
  esDiaNoEscolar?: boolean;
}

export interface DatosExportacionExcel {
  usuario: GenericUser;
  rolSeleccionado: RolesSistema;
  mes: number;
  registros: RegistroDiaExcel[];
  rolesDisponibles: Array<{ value: RolesSistema; label: string }>;
}

export const COLORES_ESTADOS_EXCEL = {
  [EstadosAsistenciaPersonal.En_Tiempo]: {
    background: "D4F7D4",
    font: "047857",
    nombre: "En tiempo",
  },
  [EstadosAsistenciaPersonal.Temprano]: {
    background: "BFDBFE",
    font: "1E40AF",
    nombre: "Temprano",
  },
  [EstadosAsistenciaPersonal.Tarde]: {
    background: "FED7BA",
    font: "C2410C",
    nombre: "Tarde",
  },
  [EstadosAsistenciaPersonal.Cumplido]: {
    background: "D4F7D4",
    font: "047857",
    nombre: "Cumplido",
  },
  [EstadosAsistenciaPersonal.Salida_Anticipada]: {
    background: "FEF3C7",
    font: "A16207",
    nombre: "Salida anticipada",
  },
  [EstadosAsistenciaPersonal.Falta]: {
    background: "FECACA",
    font: "DC2626",
    nombre: "Falta",
  },
  [EstadosAsistenciaPersonal.No_Registrado]: {
    background: "F3F4F6",
    font: "6B7280",
    nombre: "No registrado",
  },
  [EstadosAsistenciaPersonal.Sin_Registro]: {
    background: "F3F4F6",
    font: "6B7280",
    nombre: "Sin registro",
  },
  [EstadosAsistenciaPersonal.Inactivo]: {
    background: "E5E7EB",
    font: "4B5563",
    nombre: "Inactivo",
  },
  [EstadosAsistenciaPersonal.Evento]: {
    background: "DDD6FE",
    font: "7C3AED",
    nombre: "Evento",
  },
  [EstadosAsistenciaPersonal.Otro]: {
    background: "F3F4F6",
    font: "6B7280",
    nombre: "Otro",
  },
};
