import { DatosAsistenciaHoyIE20935 } from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { obtenerDatosAsistenciaHoy } from "../_utils/obtenerDatosAsistenciaHoy";

/**
 * Information about the classroom assigned to a teacher
 */
export interface AulaAsignada {
  nivel: NivelEducativo;
  grado: number;
  seccion: string;
  tieneAula: boolean;
}

/**
 * Permission validation result for reports
 */
export interface ResultadoValidacionPermisos {
  tienePermiso: boolean;
  mensaje?: string;
  aulaAsignada?: AulaAsignada;
}

/**
 * Helper for working with daily attendance data
 */
export class DatosAsistenciaHoyHelper {
  private datos: DatosAsistenciaHoyIE20935;

  constructor(datos: DatosAsistenciaHoyIE20935) {
    this.datos = datos;
  }

  /**
   * Gets an instance of the helper with current data
   */
  static async obtenerInstancia(): Promise<DatosAsistenciaHoyHelper> {
    const { datos } = await obtenerDatosAsistenciaHoy();
    return new DatosAsistenciaHoyHelper(datos);
  }

  /**
   * Gets the classroom assigned to an elementary school teacher
   */
  obtenerAulaProfesorPrimaria(idProfesor: string): AulaAsignada | null {
    const profesor = this.datos.ListaDeProfesoresPrimaria.find(
      (p) => p.Id_Profesor_Primaria === idProfesor
    );

    if (!profesor) {
      return null;
    }

    if (!profesor.Aula) {
      return {
        nivel: NivelEducativo.PRIMARIA,
        grado: 0,
        seccion: "",
        tieneAula: false,
      };
    }

    return {
      nivel: profesor.Aula.Nivel as NivelEducativo,
      grado: profesor.Aula.Grado,
      seccion: profesor.Aula.Seccion,
      tieneAula: true,
    };
  }

  /**
   * Gets the classroom assigned to a secondary school teacher/tutor
   */
  obtenerAulaProfesorSecundaria(idProfesor: string): AulaAsignada | null {
    const profesor = this.datos.ListaDeProfesoresSecundaria.find(
      (p) => p.Id_Profesor_Secundaria === idProfesor
    );

    if (!profesor) {
      return null;
    }

    if (!profesor.Aula) {
      return {
        nivel: NivelEducativo.SECUNDARIA,
        grado: 0,
        seccion: "",
        tieneAula: false,
      };
    }

    return {
      nivel: profesor.Aula.Nivel as NivelEducativo,
      grado: profesor.Aula.Grado,
      seccion: profesor.Aula.Seccion,
      tieneAula: true,
    };
  }

  /**
   * Validates if a user has permission to generate/query a specific report
   */
  validarPermisosReporte(
    rol: RolesSistema,
    idUsuario: string,
    nivelSolicitado: NivelEducativo,
    gradoSolicitado: number | string,
    seccionSolicitada: string
  ): ResultadoValidacionPermisos {
    console.log(
      `[DatosAsistenciaHoyHelper] 🔐 Validando permisos para rol: ${rol}`
    );
    console.log(
      `[DatosAsistenciaHoyHelper] 📊 Reporte solicitado: ${nivelSolicitado} ${gradoSolicitado}° ${seccionSolicitada}`
    );

    switch (rol) {
      case RolesSistema.Directivo:
        console.log(
          `[DatosAsistenciaHoyHelper] ✅ Directivo - Acceso total sin restricciones`
        );
        return {
          tienePermiso: true,
        };

      case RolesSistema.Auxiliar:
        // Can only generate secondary school reports
        if (nivelSolicitado !== NivelEducativo.SECUNDARIA) {
          console.log(
            `[DatosAsistenciaHoyHelper] ❌ Auxiliar solo puede generar reportes de secundaria`
          );
          return {
            tienePermiso: false,
            mensaje:
              "Los auxiliares solo pueden generar reportes de secundaria",
          };
        }

        console.log(
          `[DatosAsistenciaHoyHelper] ✅ Auxiliar - Acceso a secundaria permitido`
        );
        return {
          tienePermiso: true,
        };

      case RolesSistema.ProfesorPrimaria:
        const aulaProfesorPrimaria =
          this.obtenerAulaProfesorPrimaria(idUsuario);

        if (!aulaProfesorPrimaria) {
          console.log(
            `[DatosAsistenciaHoyHelper] ❌ Profesor primaria no encontrado en el sistema`
          );
          return {
            tienePermiso: false,
            mensaje: "Profesor no encontrado en el sistema",
          };
        }

        if (!aulaProfesorPrimaria.tieneAula) {
          console.log(
            `[DatosAsistenciaHoyHelper] ❌ Profesor primaria sin aula asignada`
          );
          return {
            tienePermiso: false,
            mensaje: "No tiene un aula asignada",
            aulaAsignada: aulaProfesorPrimaria,
          };
        }

        // Verify that it matches their assigned classroom
        const coincidePrimaria =
          nivelSolicitado === aulaProfesorPrimaria.nivel &&
          (gradoSolicitado === aulaProfesorPrimaria.grado ||
            gradoSolicitado === "T") &&
          (seccionSolicitada === aulaProfesorPrimaria.seccion ||
            seccionSolicitada === "T");

        if (!coincidePrimaria) {
          console.log(
            `[DatosAsistenciaHoyHelper] ❌ Profesor primaria intentó acceder a aula no asignada`
          );
          console.log(
            `[DatosAsistenciaHoyHelper] 🏫 Aula asignada: ${aulaProfesorPrimaria.nivel} ${aulaProfesorPrimaria.grado}° ${aulaProfesorPrimaria.seccion}`
          );
          return {
            tienePermiso: false,
            mensaje: `Solo puede generar reportes de su aula asignada: ${aulaProfesorPrimaria.nivel} ${aulaProfesorPrimaria.grado}° ${aulaProfesorPrimaria.seccion}`,
            aulaAsignada: aulaProfesorPrimaria,
          };
        }

        console.log(
          `[DatosAsistenciaHoyHelper] ✅ Profesor primaria - Acceso a su aula permitido`
        );
        return {
          tienePermiso: true,
          aulaAsignada: aulaProfesorPrimaria,
        };

      case RolesSistema.ProfesorSecundaria:
      case RolesSistema.Tutor:
        const aulaProfesorSecundaria =
          this.obtenerAulaProfesorSecundaria(idUsuario);

        if (!aulaProfesorSecundaria) {
          console.log(
            `[DatosAsistenciaHoyHelper] ❌ Profesor secundaria no encontrado en el sistema`
          );
          return {
            tienePermiso: false,
            mensaje: "Profesor no encontrado en el sistema",
          };
        }

        if (!aulaProfesorSecundaria.tieneAula) {
          console.log(
            `[DatosAsistenciaHoyHelper] ❌ Profesor secundaria sin aula asignada`
          );
          return {
            tienePermiso: false,
            mensaje: "No tiene un aula asignada",
            aulaAsignada: aulaProfesorSecundaria,
          };
        }

        // Verify that it matches their assigned classroom
        const coincideSecundaria =
          nivelSolicitado === aulaProfesorSecundaria.nivel &&
          (gradoSolicitado === aulaProfesorSecundaria.grado ||
            gradoSolicitado === "T") &&
          (seccionSolicitada === aulaProfesorSecundaria.seccion ||
            seccionSolicitada === "T");

        if (!coincideSecundaria) {
          console.log(
            `[DatosAsistenciaHoyHelper] ❌ Profesor secundaria intentó acceder a aula no asignada`
          );
          console.log(
            `[DatosAsistenciaHoyHelper] 🏫 Aula asignada: ${aulaProfesorSecundaria.nivel} ${aulaProfesorSecundaria.grado}° ${aulaProfesorSecundaria.seccion}`
          );
          return {
            tienePermiso: false,
            mensaje: `Solo puede generar reportes de su aula asignada: ${aulaProfesorSecundaria.nivel} ${aulaProfesorSecundaria.grado}° ${aulaProfesorSecundaria.seccion}`,
            aulaAsignada: aulaProfesorSecundaria,
          };
        }

        console.log(
          `[DatosAsistenciaHoyHelper] ✅ Profesor secundaria - Acceso a su aula permitido`
        );
        return {
          tienePermiso: true,
          aulaAsignada: aulaProfesorSecundaria,
        };

      case RolesSistema.PersonalAdministrativo:
      case RolesSistema.Responsable:
        console.log(
          `[DatosAsistenciaHoyHelper] ❌ Rol ${rol} no tiene acceso a reportes`
        );
        return {
          tienePermiso: false,
          mensaje:
            "Su rol no tiene permisos para acceder a reportes de asistencia",
        };

      default:
        console.log(`[DatosAsistenciaHoyHelper] ❌ Rol desconocido: ${rol}`);
        return {
          tienePermiso: false,
          mensaje: "Rol no autorizado",
        };
    }
  }

  /**
   * Gets the complete attendance data
   */
  obtenerDatosCompletos(): DatosAsistenciaHoyIE20935 {
    return this.datos;
  }
}
