import {
  AuxiliarAsistenciaResponse,
  HorarioTomaAsistencia,
} from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";
import { HandlerAsistenciaBase } from "./HandlerDatosAsistenciaBase";
import { alterarUTCaZonaPeruana } from "@/lib/helpers/alteradores/alterarUTCaZonaPeruana";
import {
  aplicarExtension,
  EXTENSION_ENTRADA_ESTUDIANTES_SECUNDARIA,
  EXTENSION_SALIDA_ESTUDIANTES_SECUNDARIA,
} from "@/constants/EXTENSION_HORARIOS_ESCOLARES";

export class HandlerAuxiliarAsistenciaResponse extends HandlerAsistenciaBase {
  private auxiliarData: AuxiliarAsistenciaResponse;

  constructor(asistenciaData: AuxiliarAsistenciaResponse) {
    super(asistenciaData);
    this.auxiliarData = asistenciaData;
  }

  // ===== METHODS FOR AUXILIARY DATA =====

  public getMiIdentificador(): string {
    return this.auxiliarData.Mi_Identificador;
  }

  public getMiHorarioTomaAsistencia(): HorarioTomaAsistencia {
    return this.auxiliarData.HorarioTomaAsistenciaAuxiliares;
  }

  public getHorarioEscolarSecundaria(): HorarioTomaAsistencia {
    return this.auxiliarData.HorarioEscolarSecundaria;
  }

  // ===== SCHEDULE VALIDATION METHODS =====

  public estaHorarioActivo(horario: HorarioTomaAsistencia): boolean {
    const ahora = this.getFechaHoraRedux();
    if (!ahora) return false;

    const inicio = new Date(alterarUTCaZonaPeruana(String(horario.Inicio)));
    const fin = new Date(alterarUTCaZonaPeruana(String(horario.Fin)));

    return ahora >= inicio && ahora <= fin;
  }

  public estaActivaTomaAsistencia(): boolean {
    return this.estaHorarioActivo(this.getMiHorarioTomaAsistencia());
  }

  public estaActivoHorarioEscolarSecundaria(): boolean {
    return this.estaHorarioActivo(this.getHorarioEscolarSecundaria());
  }

  /**
   * Gets the effective schedule for taking secondary school students' attendance
   * (school schedule + extensions)
   * @returns Object with effective schedule including extensions
   */
  public getHorarioEfectivoSecundaria(): {
    inicioEfectivo: Date;
    finEfectivo: Date;
    inicioOficial: Date;
    finOficial: Date;
    extensionEntrada: number;
    extensionSalida: number;
  } {
    const horarioOficial = this.getHorarioEscolarSecundaria();

    const inicioOficial = new Date(
      alterarUTCaZonaPeruana(String(horarioOficial.Inicio))
    );
    const finOficial = new Date(
      alterarUTCaZonaPeruana(String(horarioOficial.Fin))
    );

    const inicioEfectivo = aplicarExtension(
      inicioOficial,
      -EXTENSION_ENTRADA_ESTUDIANTES_SECUNDARIA
    );
    const finEfectivo = aplicarExtension(
      finOficial,
      EXTENSION_SALIDA_ESTUDIANTES_SECUNDARIA
    );

    return {
      inicioEfectivo,
      finEfectivo,
      inicioOficial,
      finOficial,
      extensionEntrada: EXTENSION_ENTRADA_ESTUDIANTES_SECUNDARIA,
      extensionSalida: EXTENSION_SALIDA_ESTUDIANTES_SECUNDARIA,
    };
  }

  /**
   * Checks if student attendance taking is within effective hours
   * (considering extensions)
   * @returns true if it is within effective hours to take attendance
   */
  public estaEnHorarioEfectivoTomaAsistencia(): boolean {
    const ahora = this.getFechaHoraRedux();
    if (!ahora) return false;

    const horarioEfectivo = this.getHorarioEfectivoSecundaria();

    return (
      ahora >= horarioEfectivo.inicioEfectivo &&
      ahora <= horarioEfectivo.finEfectivo
    );
  }

  /**
   * Checks if it is a valid day for taking student attendance
   * (it is not an event day, inter-school holidays, nor management week)
   * @returns true if it is a valid day for student classes
   */
  public esDiaValidoParaClases(): boolean {
    // Students do NOT have classes on:
    // - Event days (holidays, celebrations)
    // - Inter-school holidays
    // - Management week

    if (this.esHoyDiaDeEvento()) {
      return false;
    }

    if (this.esSemanaDeGestion()) {
      return false;
    }

    // Check inter-school holidays
    const vacacionesInterescolares =
      this.auxiliarData.Vacaciones_Interescolares || [];
    const fechaActual = this.getFechaLocalPeru();

    const enVacaciones = vacacionesInterescolares.some((vacacion) => {
      const inicioVacacion = new Date(
        alterarUTCaZonaPeruana(String(vacacion.Fecha_Inicio))
      );
      const finVacacion = new Date(
        alterarUTCaZonaPeruana(String(vacacion.Fecha_Conclusion))
      );

      return fechaActual >= inicioVacacion && fechaActual <= finVacacion;
    });

    return !enVacaciones;
  }

  /**
   * Gets detailed information about why it is not a valid day for classes
   * @returns Object with information about the current restriction
   */
  public getInfoRestriccionClases(): {
    esValido: boolean;
    motivo?: string;
    detalles?: any;
  } {
    const esValido = this.esDiaValidoParaClases();

    if (esValido) {
      return { esValido: true };
    }

    // Check specific reason
    const diaEvento = this.esHoyDiaDeEvento();
    if (diaEvento) {
      return {
        esValido: false,
        motivo: "evento",
        detalles: diaEvento,
      };
    }

    const semanaGestion = this.esSemanaDeGestion();
    if (semanaGestion) {
      return {
        esValido: false,
        motivo: "semana_gestion",
        detalles: semanaGestion,
      };
    }

    // Check inter-school holidays
    const vacacionesInterescolares =
      this.auxiliarData.Vacaciones_Interescolares || [];
    const fechaActual = this.getFechaLocalPeru();

    const vacacionActiva = vacacionesInterescolares.find((vacacion) => {
      const inicioVacacion = new Date(
        alterarUTCaZonaPeruana(String(vacacion.Fecha_Inicio))
      );
      const finVacacion = new Date(
        alterarUTCaZonaPeruana(String(vacacion.Fecha_Conclusion))
      );

      return fechaActual >= inicioVacacion && fechaActual <= finVacacion;
    });

    if (vacacionActiva) {
      return {
        esValido: false,
        motivo: "vacaciones_interescolares",
        detalles: vacacionActiva,
      };
    }

    return {
      esValido: false,
      motivo: "desconocido",
    };
  }

  public getDatosCompletosAuxiliar(): AuxiliarAsistenciaResponse {
    return this.auxiliarData;
  }
}
