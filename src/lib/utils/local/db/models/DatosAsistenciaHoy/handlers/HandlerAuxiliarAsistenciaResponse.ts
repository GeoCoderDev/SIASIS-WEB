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

  // ===== MÉTODOS PARA DATOS DEL AUXILIAR =====

  public getMiIdentificador(): string {
    return this.auxiliarData.Mi_Identificador;
  }

  public getMiHorarioTomaAsistencia(): HorarioTomaAsistencia {
    return this.auxiliarData.HorarioTomaAsistenciaAuxiliares;
  }

  public getHorarioEscolarSecundaria(): HorarioTomaAsistencia {
    return this.auxiliarData.HorarioEscolarSecundaria;
  }

  // ===== MÉTODOS DE VALIDACIÓN DE HORARIOS =====

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
   * Obtiene el horario efectivo para toma de asistencia de estudiantes de secundaria
   * (horario escolar + extensiones)
   * @returns Objeto con horario efectivo incluyendo extensiones
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
   * Verifica si la toma de asistencia de estudiantes está en horario efectivo
   * (considerando extensiones)
   * @returns true si está en horario efectivo para tomar asistencia
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
   * Verifica si es un día válido para toma de asistencia de estudiantes
   * (no es día de evento, vacaciones interescolares, ni semana de gestión)
   * @returns true si es un día válido para clases de estudiantes
   */
  public esDiaValidoParaClases(): boolean {
    // Los estudiantes NO tienen clases en:
    // - Días de evento (feriados, celebraciones)
    // - Vacaciones interescolares
    // - Semana de gestión

    if (this.esHoyDiaDeEvento()) {
      return false;
    }

    if (this.esSemanaDeGestion()) {
      return false;
    }

    // Verificar vacaciones interescolares
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
   * Obtiene información detallada sobre por qué no es un día válido para clases
   * @returns Objeto con información sobre la restricción actual
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

    // Verificar motivo específico
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

    // Verificar vacaciones interescolares
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
