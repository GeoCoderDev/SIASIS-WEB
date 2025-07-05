import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935 } from "./SalasTomaAsistenciaDePersonal";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistroPersonal";
import { RegistroEntradaSalida } from "../../../../../lib/utils/local/db/models/AsistenciaDePersonal/services/AsistenciaDePersonalMapper";

export interface SALUDAME_PAYLOAD {
  saludo: string;
}

export interface UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_PAYLOAD {
  Sala_Toma_Asistencia_de_Personal: SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935;
}

export interface MessagePayload {
  message: string;
}

export interface MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD
  extends SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD {
  Sala_Toma_Asistencia_de_Personal: SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935;
}

export interface SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD {
  id_o_dni: string | number;
  nombres: string;
  apellidos: string;
  rol: RolesSistema;
  modoRegistro: ModoRegistro;
  RegistroEntradaSalida: RegistroEntradaSalida;
}
