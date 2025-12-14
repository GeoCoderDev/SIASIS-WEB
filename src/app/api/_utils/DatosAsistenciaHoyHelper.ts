import { DatosAsistenciaHoyIE20935 } from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { obtenerDatosAsistenciaHoy } from "../_utils/obtenerDatosAsistenciaHoy";

/**
 * Información del aula asignada a un profesor
 */
export interface AulaAsignada {
  nivel: NivelEducativo;
  grado: number;
  seccion: string;
  tieneAula: boolean;
}

/**
 * Resultado de validación de permisos para reportes
 */
export interface ResultadoValidacionPermisos {
  tienePermiso: boolean;
  mensaje?: string;
  aulaAsignada?: AulaAsignada;
}

/**
 * Helper para trabajar con datos de asistencia del día
 */
export class DatosAsistenciaHoyHelper {
  private datos: DatosAsistenciaHoyIE20935;

  constructor(datos: DatosAsistenciaHoyIE20935) {
    this.datos = datos;
  }

  /**
   * Obtiene una instancia del helper con los datos actuales
   */
  static async obtenerInstancia(): Promise<DatosAsistenciaHoyHelper> {
    const { datos } = await obtenerDatosAsistenciaHoy();
    return new DatosAsistenciaHoyHelper(datos);
  }

  /**
   * Obtiene el aula asignada a un profesor de primaria
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
   * Obtiene el aula asignada a un profesor/tutor de secundaria
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
   * Valida si un usuario tiene permiso para generar/consultar un reporte específico
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
        // Solo puede generar reportes de secundaria
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

        // Verificar que coincida con su aula asignada
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

        // Verificar que coincida con su aula asignada
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
   * Obtiene los datos completos de asistencia
   */
  obtenerDatosCompletos(): DatosAsistenciaHoyIE20935 {
    return this.datos;
  }
}
