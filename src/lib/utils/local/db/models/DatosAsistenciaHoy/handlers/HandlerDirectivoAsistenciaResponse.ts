import {
  AuxiliaresParaTomaDeAsistencia,
  DirectivoAsistenciaResponse,
  DirectivoParaTomaDeAsistencia, // 🆕 NEW IMPORT
  HorarioTomaAsistencia,
  PersonalAdministrativoParaTomaDeAsistencia,
  ProfesoresPrimariaParaTomaDeAsistencia,
  ProfesorTutorSecundariaParaTomaDeAsistencia,
} from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";
import { HandlerAsistenciaBase } from "./HandlerDatosAsistenciaBase";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { Genero } from "@/interfaces/shared/Genero";
import { PersonalParaTomarAsistencia } from "@/components/asistencia-personal/ItemTomaAsistencia";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";

export class HandlerDirectivoAsistenciaResponse extends HandlerAsistenciaBase {
  private directivoData: DirectivoAsistenciaResponse;

  constructor(asistenciaData: DirectivoAsistenciaResponse) {
    super(asistenciaData);
    this.directivoData = asistenciaData;
  }

  // 🆕 NEW METHODS FOR DIRECTORS
  public getDirectivos(): DirectivoParaTomaDeAsistencia[] {
    return this.directivoData.ListaDeDirectivos || [];
  }

  public buscarDirectivoPorDNI(
    dni: string | number
  ): DirectivoParaTomaDeAsistencia | null {
    return (
      this.getDirectivos().find(
        (directivo) => directivo.Id_Directivo === dni
      ) || null
    );
  }

  public buscarDirectivoPorId(
    id: number
  ): DirectivoParaTomaDeAsistencia | null {
    return (
      this.getDirectivos().find(
        (directivo) => directivo.Id_Directivo === Number(id)
      ) || null
    );
  }

  public getTotalDirectivos(): number {
    return this.getDirectivos().length;
  }

  public debeEstarPresenteDirectivoAhora(dniOId: string | number): boolean {
    let directivo: DirectivoParaTomaDeAsistencia | null = null;

    if (typeof dniOId === "string") {
      directivo = this.buscarDirectivoPorDNI(dniOId);
    } else {
      directivo = this.buscarDirectivoPorId(dniOId);
    }

    if (!directivo) return false;

    const ahora = this.getFechaHoraRedux();
    if (!ahora) return false;

    console.log("NOW:", ahora);

    const horaEntrada = new Date(ahora);
    const horaSalida = new Date(ahora);
    console.log("NOW entry:", horaEntrada);
    console.log("NOW exit:", horaSalida);

    const [entradaHours, entradaMinutes] = String(
      directivo.Hora_Entrada_Dia_Actual
    )
      .split(":")
      .map(Number);
    const [salidaHours, salidaMinutes] = String(
      directivo.Hora_Salida_Dia_Actual
    )
      .split(":")
      .map(Number);

    horaEntrada.setHours(entradaHours, entradaMinutes, 0, 0);
    horaSalida.setHours(salidaHours, salidaMinutes, 0, 0);

    return ahora >= horaEntrada && ahora <= horaSalida;
  }

  // EXISTING METHODS FOR ADMINISTRATIVE STAFF
  public getPersonalAdministrativo(): PersonalAdministrativoParaTomaDeAsistencia[] {
    return this.directivoData.ListaDePersonalesAdministrativos || [];
  }

  public buscarPersonalAdministrativoPorDNI(
    dni: string
  ): PersonalAdministrativoParaTomaDeAsistencia | null {
    return (
      this.getPersonalAdministrativo().find(
        (personal) => personal.Id_Personal_Administrativo === dni
      ) || null
    );
  }

  public filtrarPersonalPorCargo(
    cargo: string
  ): PersonalAdministrativoParaTomaDeAsistencia[] {
    return this.getPersonalAdministrativo().filter(
      (personal) => personal.Cargo === cargo
    );
  }

  public getProfesoresPrimaria(): ProfesoresPrimariaParaTomaDeAsistencia[] {
    return this.directivoData.ListaDeProfesoresPrimaria || [];
  }

  public getAuxliares(): AuxiliaresParaTomaDeAsistencia[] {
    return this.directivoData.ListaDeAuxiliares || [];
  }

  public buscarProfesorPrimariaPorDNI(
    dni: string
  ): ProfesoresPrimariaParaTomaDeAsistencia | null {
    return (
      this.getProfesoresPrimaria().find(
        (profesor) => profesor.Id_Profesor_Primaria === dni
      ) || null
    );
  }

  public getProfesoresSecundaria(): ProfesorTutorSecundariaParaTomaDeAsistencia[] {
    return this.directivoData.ListaDeProfesoresSecundaria || [];
  }

  public buscarProfesorSecundariaPorDNI(
    dni: string
  ): ProfesorTutorSecundariaParaTomaDeAsistencia | null {
    return (
      this.getProfesoresSecundaria().find(
        (profesor) => profesor.Id_Profesor_Secundaria === dni
      ) || null
    );
  }

  public getHorarioTomaAsistenciaGeneral(): HorarioTomaAsistencia {
    return this.directivoData.HorariosLaboraresGenerales
      .TomaAsistenciaRangoTotalPersonales;
  }

  public getHorarioTomaAsistenciaPrimaria(): HorarioTomaAsistencia {
    return this.directivoData.HorariosLaboraresGenerales
      .TomaAsistenciaProfesorPrimaria;
  }

  public getHorarioTomaAsistenciaAuxiliares(): HorarioTomaAsistencia {
    return this.directivoData.HorariosLaboraresGenerales
      .TomaAsistenciaAuxiliares;
  }

  public getHorarioEscolar(
    nivel: NivelEducativo
  ): HorarioTomaAsistencia | null {
    return this.directivoData.HorariosEscolares[nivel] || null;
  }

  public estaHorarioActivo(horario: HorarioTomaAsistencia): boolean {
    const ahora = this.getFechaHoraRedux();
    if (!ahora) return false;

    const inicio = new Date(horario.Inicio);
    const fin = new Date(horario.Fin);

    return ahora >= inicio && ahora <= fin;
  }

  public estaActivaTomaAsistenciaGeneral(): boolean {
    return this.estaHorarioActivo(this.getHorarioTomaAsistenciaGeneral());
  }

  public estaActivaTomaAsistenciaPrimaria(): boolean {
    return this.estaHorarioActivo(this.getHorarioTomaAsistenciaPrimaria());
  }

  public estaActivaTomaAsistenciaAuxiliares(): boolean {
    return this.estaHorarioActivo(this.getHorarioTomaAsistenciaAuxiliares());
  }

  public getTotalPersonalAdministrativo(): number {
    return this.getPersonalAdministrativo().length;
  }

  public getTotalProfesoresPrimaria(): number {
    return this.getProfesoresPrimaria().length;
  }

  public getTotalProfesoresSecundaria(): number {
    return this.getProfesoresSecundaria().length;
  }

  public debeEstarPresentePersonalAhora(dni: string): boolean {
    const personal = this.buscarPersonalAdministrativoPorDNI(dni);
    if (!personal) return false;

    const ahora = this.getFechaHoraRedux();

    if (!ahora) return false;
    console.log("NOW:", ahora);

    const horaEntrada = new Date(ahora);
    const horaSalida = new Date(ahora);
    console.log("NOW entry:", horaEntrada);
    console.log("NOW exit:", horaSalida);

    const [entradaHours, entradaMinutes] = String(
      personal.Hora_Entrada_Dia_Actual
    )
      .split(":")
      .map(Number);
    const [salidaHours, salidaMinutes] = String(personal.Hora_Salida_Dia_Actual)
      .split(":")
      .map(Number);

    horaEntrada.setHours(entradaHours, entradaMinutes, 0, 0);
    horaSalida.setHours(salidaHours, salidaMinutes, 0, 0);

    return ahora >= horaEntrada && ahora <= horaSalida;
  }

  public getDatosCompletosDirectivo(): DirectivoAsistenciaResponse {
    return this.directivoData;
  }

  /**
   * Gets the list of staff according to the specified role
   * @param rol Role of the staff to get
   * @returns Array of staff with unified format
   */
  public obtenerPersonalPorRol(
    rol: ActoresSistema | RolesSistema
  ): PersonalParaTomarAsistencia[] {
    switch (rol) {
      // 🆕 NEW CASE FOR DIRECTORS
      case ActoresSistema.Directivo:
        return this.getDirectivos().map((directivo) => ({
          idUsuario: String(directivo.Id_Directivo), // For directors we use DNI as the main identifier
          GoogleDriveFotoId: directivo.Google_Drive_Foto_ID,
          Nombres: directivo.Nombres,
          Apellidos: directivo.Apellidos,
          Genero: directivo.Genero as Genero,
          // Additional fields specific to directors
          Id_Directivo: directivo.Id_Directivo, // We also save the internal ID
        }));

      case ActoresSistema.ProfesorPrimaria:
        return this.getProfesoresPrimaria().map((profesor) => ({
          idUsuario: profesor.Id_Profesor_Primaria,
          GoogleDriveFotoId: profesor.Google_Drive_Foto_ID,
          Nombres: profesor.Nombres,
          Apellidos: profesor.Apellidos,
          Genero: profesor.Genero as Genero,
          Aula: profesor.Aula,
        }));

      case ActoresSistema.ProfesorSecundaria:
      case ActoresSistema.Tutor:
        return this.getProfesoresSecundaria().map((profesor) => ({
          idUsuario: profesor.Id_Profesor_Secundaria,
          GoogleDriveFotoId: profesor.Google_Drive_Foto_ID,
          Nombres: profesor.Nombres,
          Apellidos: profesor.Apellidos,
          Genero: profesor.Genero as Genero,
          Aula: profesor.Aula,
        }));

      case ActoresSistema.Auxiliar:
        return this.getAuxliares().map((auxiliar) => ({
          idUsuario: auxiliar.Id_Auxiliar,
          GoogleDriveFotoId: auxiliar.Google_Drive_Foto_ID,
          Nombres: auxiliar.Nombres,
          Apellidos: auxiliar.Apellidos,
          Genero: auxiliar.Genero as Genero,
        }));

      case ActoresSistema.PersonalAdministrativo:
        return this.getPersonalAdministrativo().map((personal) => ({
          idUsuario: personal.Id_Personal_Administrativo,
          GoogleDriveFotoId: personal.Google_Drive_Foto_ID,
          Nombres: personal.Nombres,
          Apellidos: personal.Apellidos,
          Genero: personal.Genero as Genero,
          Cargo: personal.Cargo, // Only for administrative staff
        }));

      default:
        return [];
    }
  }

  /**
   * Gets the time at which the staff should arrive or leave according to their role, DNI and registration mode
   * @param rol Staff role
   * @param dni Staff DNI
   * @param modoRegistro Registration mode (Entry or Exit)
   * @returns Scheduled time for entry or exit in ISO string format (as it comes from JSON)
   */
  public obtenerHorarioPersonalISO(
    rol: ActoresSistema | RolesSistema,
    idUsuario: string | number,
    modoRegistro: ModoRegistro
  ): string {
    try {
      // Special case for students
      if (rol === ActoresSistema.Estudiante) {
        if (this.directivoData.HorariosEscolares[NivelEducativo.PRIMARIA]) {
          return String(
            this.directivoData.HorariosEscolares[NivelEducativo.PRIMARIA].Inicio
          );
        } else {
          // If no schedule is defined, create a default one
          const fechaHoy = new Date();
          fechaHoy.setHours(7, 45, 0, 0);
          return fechaHoy.toISOString();
        }
      }

      switch (rol) {
        // 🆕 NEW CASE FOR DIRECTORS
        case ActoresSistema.Directivo:
          const directivo = this.buscarDirectivoPorId(idUsuario as number);

          if (directivo) {
            if (
              modoRegistro === ModoRegistro.Entrada &&
              directivo.Hora_Entrada_Dia_Actual
            ) {
              return String(directivo.Hora_Entrada_Dia_Actual);
            } else if (
              modoRegistro === ModoRegistro.Salida &&
              directivo.Hora_Salida_Dia_Actual
            ) {
              return String(directivo.Hora_Salida_Dia_Actual);
            } else {
              // Fallback to general schedule
              const horarioGeneral = this.getHorarioTomaAsistenciaGeneral();

              if (modoRegistro === ModoRegistro.Entrada) {
                return String(horarioGeneral.Inicio);
              } else {
                return String(horarioGeneral.Fin);
              }
            }
          }
          break;

        case ActoresSistema.ProfesorPrimaria:
          const horarioProfesoresPrimaria =
            this.getHorarioTomaAsistenciaPrimaria();

          if (modoRegistro === ModoRegistro.Entrada) {
            return String(horarioProfesoresPrimaria.Inicio);
          } else {
            return String(horarioProfesoresPrimaria.Fin);
          }

        case ActoresSistema.ProfesorSecundaria:
        case ActoresSistema.Tutor:
          const profesorSecundaria = this.buscarProfesorSecundariaPorDNI(
            idUsuario as string
          );

          if (profesorSecundaria) {
            if (
              modoRegistro === ModoRegistro.Entrada &&
              profesorSecundaria.Hora_Entrada_Dia_Actual
            ) {
              return String(profesorSecundaria.Hora_Entrada_Dia_Actual);
            } else if (
              modoRegistro === ModoRegistro.Salida &&
              profesorSecundaria.Hora_Salida_Dia_Actual
            ) {
              return String(profesorSecundaria.Hora_Salida_Dia_Actual);
            } else {
              // Fallback to general secondary schedule
              if (
                this.directivoData.HorariosEscolares[NivelEducativo.SECUNDARIA]
              ) {
                const horario =
                  this.directivoData.HorariosEscolares[
                    NivelEducativo.SECUNDARIA
                  ];

                if (modoRegistro === ModoRegistro.Entrada) {
                  return String(horario.Inicio);
                } else {
                  return String(horario.Fin);
                }
              }
            }
          }
          break;

        case ActoresSistema.Auxiliar:
          const horarioAuxiliares = this.getHorarioTomaAsistenciaAuxiliares();

          if (modoRegistro === ModoRegistro.Entrada) {
            return String(horarioAuxiliares.Inicio);
          } else {
            return String(horarioAuxiliares.Fin);
          }

        case ActoresSistema.PersonalAdministrativo:
          const personal = this.buscarPersonalAdministrativoPorDNI(
            idUsuario as string
          );

          if (personal) {
            if (
              modoRegistro === ModoRegistro.Entrada &&
              personal.Hora_Entrada_Dia_Actual
            ) {
              return String(personal.Hora_Entrada_Dia_Actual);
            } else if (
              modoRegistro === ModoRegistro.Salida &&
              personal.Hora_Salida_Dia_Actual
            ) {
              return String(personal.Hora_Salida_Dia_Actual);
            } else {
              // Fallback to general schedule
              const horarioGeneral = this.getHorarioTomaAsistenciaGeneral();

              if (modoRegistro === ModoRegistro.Entrada) {
                return String(horarioGeneral.Inicio);
              } else {
                return String(horarioGeneral.Fin);
              }
            }
          }
          break;

        default:
          // Fallback using general schedule
          const horarioGeneral = this.getHorarioTomaAsistenciaGeneral();

          if (modoRegistro === ModoRegistro.Entrada) {
            return String(horarioGeneral.Inicio);
          } else {
            return String(horarioGeneral.Fin);
          }
      }
    } catch (error) {
      console.error("Error getting staff schedule:", error);
    }

    // In case of any error, return a default schedule
    const fechaPredeterminada = new Date();
    if (modoRegistro === ModoRegistro.Entrada) {
      fechaPredeterminada.setHours(8, 0, 0, 0);
    } else {
      fechaPredeterminada.setHours(16, 0, 0, 0);
    }
    return fechaPredeterminada.toISOString();
  }

  // Simplified debugging method - 🆕 UPDATED TO INCLUDE DIRECTORS
  public debugHorariosISO(
    rol: ActoresSistema | RolesSistema,
    dni?: string
  ): void {
    console.log("🔍 DEBUG ISO SCHEDULES (WITHOUT CONVERSIONS)");
    console.log("==========================================");
    console.log("Role:", rol);
    console.log("DNI:", dni || "N/A");

    // 🆕 If it is a director, show additional information
    if (rol === ActoresSistema.Directivo && dni) {
      const directivo = this.buscarDirectivoPorDNI(dni);
      if (directivo) {
        console.log("📋 DIRECTOR FOUND:");
        console.log("  - ID:", directivo.Id_Directivo);
        console.log(
          "  - Full name:",
          `${directivo.Nombres} ${directivo.Apellidos}`
        );
        console.log(
          "  - Original entry time:",
          directivo.Hora_Entrada_Dia_Actual
        );
        console.log(
          "  - Original exit time:",
          directivo.Hora_Salida_Dia_Actual
        );
      } else {
        console.log("❌ DIRECTOR NOT FOUND WITH DNI:", dni);
      }
    }

    try {
      const entradaISO = this.obtenerHorarioPersonalISO(
        rol,
        dni || "",
        ModoRegistro.Entrada
      );
      const salidaISO = this.obtenerHorarioPersonalISO(
        rol,
        dni || "",
        ModoRegistro.Salida
      );

      console.log("📅 ENTRY ISO:", entradaISO);
      console.log("📅 EXIT ISO:", salidaISO);
      console.log(
        "✅ These values are sent directly to the API without conversions"
      );
    } catch (error) {
      console.error("❌ ERROR in debug:", error);
    }

    console.log("==========================================");
  }

  // 🆕 AUXILIARY METHOD FOR SPECIFIC DEBUGGING OF DIRECTORS
  public debugDirectivos(): void {
    console.log("🏢 DEBUG DIRECTORS");
    console.log("==========================================");

    const directivos = this.getDirectivos();
    console.log("📊 Total directors:", directivos.length);

    directivos.forEach((directivo, index) => {
      console.log(`📋 Director ${index + 1}:`);
      console.log("  - ID:", directivo.Id_Directivo);
      console.log("  - DNI:", directivo.Identificador_Nacional);
      console.log("  - Name:", `${directivo.Nombres} ${directivo.Apellidos}`);
      console.log("  - Entry:", directivo.Hora_Entrada_Dia_Actual);
      console.log("  - Exit:", directivo.Hora_Salida_Dia_Actual);
      console.log("  ---");
    });

    console.log("==========================================");
  }
}
