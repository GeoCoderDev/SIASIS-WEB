import { NextRequest, NextResponse } from "next/server";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";

import { validateIdActor } from "@/lib/helpers/validators/data/validateIdActor";
import {
  PermissionErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
} from "@/interfaces/shared/errors";
import { redisClient } from "../../../../../config/Redis/RedisClient";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import {
  RegistrarAsistenciaIndividualRequestBody,
  RegistrarAsistenciaIndividualSuccessResponse,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { HORA_MAXIMA_EXPIRACION_PARA_REGISTROS_EN_REDIS } from "@/constants/expirations";
import {
  obtenerFechaActualPeru,
  obtenerFechaHoraActualPeru,
} from "../../_helpers/obtenerFechaActualPeru";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";

/**
 * Mapea un rol del sistema al actor correspondiente para registro de asistencia personal
 */
const mapearRolAActorPersonal = (rol: RolesSistema): ActoresSistema | null => {
  switch (rol) {
    case RolesSistema.Directivo:
      return ActoresSistema.Directivo;
    case RolesSistema.ProfesorPrimaria:
      return ActoresSistema.ProfesorPrimaria;
    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
      return ActoresSistema.ProfesorSecundaria;
    case RolesSistema.Auxiliar:
      return ActoresSistema.Auxiliar;
    case RolesSistema.PersonalAdministrativo:
      return ActoresSistema.PersonalAdministrativo;
    // Responsables no tienen asistencia personal
    case RolesSistema.Responsable:
      return null;
    default:
      return null;
  }
};

// Función para validar permisos de registro según rol
const validarPermisosRegistro = (
  rol: RolesSistema,
  actor: ActoresSistema,
  tipoAsistencia: TipoAsistencia,
  idARegistrar: string,
  miid: string,
  esRegistroPropio: boolean = false,
  grado?: number,
  seccion?: string,
  nivelEducativo?: string
): { esValido: boolean; mensaje?: string } => {
  switch (rol) {
    case RolesSistema.Directivo:
      // Los directivos pueden registrar asistencias de personal (incluyendo otros directivos)
      // PERO NO pueden registrar asistencias de estudiantes
      if (actor === ActoresSistema.Estudiante) {
        return {
          esValido: false,
          mensaje:
            "Los directivos no pueden registrar asistencias de estudiantes",
        };
      }

      // Para personal: pueden registrar cualquier personal
      if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
        return {
          esValido: false,
          mensaje:
            "Los directivos solo pueden registrar asistencias de personal",
        };
      }
      return { esValido: true };

    case RolesSistema.Auxiliar:
      if (actor === ActoresSistema.Estudiante) {
        // Solo estudiantes de secundaria
        if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesSecundaria) {
          return {
            esValido: false,
            mensaje:
              "Los auxiliares solo pueden registrar estudiantes de secundaria",
          };
        }
        // Para estudiantes requiere nivel, grado y sección
        if (!nivelEducativo || !grado || !seccion) {
          return {
            esValido: false,
            mensaje:
              "Se requieren nivel educativo, grado y sección para registrar estudiantes",
          };
        }
      } else {
        // Para asistencia personal: solo su propio registro
        if (!esRegistroPropio && idARegistrar !== miid) {
          return {
            esValido: false,
            mensaje:
              "Los auxiliares solo pueden registrar su propia asistencia de personal",
          };
        }
        // Debe ser tipo Personal
        if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
          return {
            esValido: false,
            mensaje:
              "Los auxiliares solo pueden registrar asistencia de tipo Personal para sí mismos",
          };
        }
      }
      return { esValido: true };

    case RolesSistema.ProfesorPrimaria:
      if (actor === ActoresSistema.Estudiante) {
        // Solo estudiantes de primaria
        if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesPrimaria) {
          return {
            esValido: false,
            mensaje:
              "Los profesores de primaria solo pueden registrar estudiantes de primaria",
          };
        }
        // Para estudiantes requiere nivel, grado y sección
        if (!nivelEducativo || !grado || !seccion) {
          return {
            esValido: false,
            mensaje:
              "Se requieren nivel educativo, grado y sección para registrar estudiantes",
          };
        }
      } else {
        // Para asistencia personal: solo su propio registro
        if (!esRegistroPropio && idARegistrar !== miid) {
          return {
            esValido: false,
            mensaje:
              "Los profesores de primaria solo pueden registrar su propia asistencia de personal",
          };
        }
        // Debe ser tipo Personal
        if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
          return {
            esValido: false,
            mensaje:
              "Los profesores de primaria solo pueden registrar asistencia de tipo Personal para sí mismos",
          };
        }
      }
      return { esValido: true };

    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
      if (actor === ActoresSistema.Estudiante) {
        return {
          esValido: false,
          mensaje:
            "Los profesores/tutores de secundaria no pueden registrar asistencias de estudiantes",
        };
      } else {
        // Para asistencia personal: solo su propio registro
        if (!esRegistroPropio && idARegistrar !== miid) {
          return {
            esValido: false,
            mensaje:
              "Los profesores/tutores de secundaria solo pueden registrar su propia asistencia",
          };
        }
        // Debe ser tipo Personal
        if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
          return {
            esValido: false,
            mensaje:
              "Los profesores/tutores de secundaria solo pueden registrar asistencia de tipo Personal para sí mismos",
          };
        }
      }
      return { esValido: true };

    case RolesSistema.PersonalAdministrativo:
      if (actor === ActoresSistema.Estudiante) {
        return {
          esValido: false,
          mensaje:
            "El personal administrativo no puede registrar asistencias de estudiantes",
        };
      } else {
        // Para asistencia personal: solo su propio registro
        if (!esRegistroPropio && idARegistrar !== miid) {
          return {
            esValido: false,
            mensaje:
              "El personal administrativo solo puede registrar su propia asistencia",
          };
        }
        // Debe ser tipo Personal
        if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
          return {
            esValido: false,
            mensaje:
              "El personal administrativo solo puede registrar asistencia de tipo Personal para sí mismo",
          };
        }
      }
      return { esValido: true };

    case RolesSistema.Responsable:
      // Los responsables no pueden registrar asistencias
      return {
        esValido: false,
        mensaje: "Los responsables no pueden registrar asistencias",
      };

    default:
      return { esValido: false, mensaje: "Rol no autorizado" };
  }
};

const calcularSegundosHastaExpiracion = async (): Promise<number> => {
  // ✅ Usar la nueva función que maneja todos los offsets
  const fechaActualPeru = await obtenerFechaHoraActualPeru();

  // Crear fecha objetivo a las 20:00 del mismo día
  const fechaExpiracion = new Date(fechaActualPeru);
  fechaExpiracion.setHours(
    HORA_MAXIMA_EXPIRACION_PARA_REGISTROS_EN_REDIS,
    0,
    0,
    0
  );

  // Si la hora actual ya pasó las 20:00, establecer para las 20:00 del día siguiente
  if (fechaActualPeru >= fechaExpiracion) {
    fechaExpiracion.setDate(fechaExpiracion.getDate() + 1);
  }

  // Calcular diferencia en segundos
  const segundosHastaExpiracion = Math.floor(
    (fechaExpiracion.getTime() - fechaActualPeru.getTime()) / 1000
  );
  return Math.max(1, segundosHastaExpiracion); // Mínimo 1 segundo para evitar valores negativos o cero
};

export async function POST(req: NextRequest) {
  try {
    // Verificar autenticación
    const { error, rol, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.ProfesorSecundaria,
      RolesSistema.Tutor,
      RolesSistema.PersonalAdministrativo,
    ]);

    if (error && !rol && !decodedToken) return error;

    const MI_idUsuario = decodedToken.ID_Usuario; // ✅ Para directivos: ID, para otros: DNI

    // Parsear el cuerpo de la solicitud como JSON
    const body =
      (await req.json()) as Partial<RegistrarAsistenciaIndividualRequestBody>;

    const {
      Actor,
      Id_Usuario,
      Id_Estudiante,
      FechaHoraEsperadaISO,
      ModoRegistro,
      TipoAsistencia: tipoAsistenciaParam,
      desfaseSegundosAsistenciaEstudiante,
      NivelDelEstudiante,
      Grado,
      Seccion,
    } = body;

    // ✅ NUEVA LÓGICA: Determinar tipo de registro
    const esRegistroEstudiante = !!(
      Id_Estudiante && typeof desfaseSegundosAsistenciaEstudiante === "number"
    );
    const esRegistroPersonal = !!(Id_Usuario && FechaHoraEsperadaISO);
    const esRegistroPropio = !esRegistroEstudiante && !esRegistroPersonal;

    let actorFinal: ActoresSistema;
    let idFinal: string;
    let tipoAsistenciaFinal: TipoAsistencia;
    let desfaseSegundos: number;
    let timestampActual: number = 0;

    if (esRegistroPropio) {
      // ✅ REGISTRO PROPIO: Solo requiere ModoRegistro y FechaHoraEsperadaISO
      console.log(`🔍 Registro propio detectado para rol: ${rol}`);

      if (!FechaHoraEsperadaISO) {
        return NextResponse.json(
          {
            success: false,
            message: "Se requiere FechaHoraEsperadaISO para registro propio",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Mapear rol a actor
      const actorMapeado = mapearRolAActorPersonal(rol!);
      if (!actorMapeado) {
        return NextResponse.json(
          {
            success: false,
            message: `El rol ${rol} no puede registrar asistencia personal`,
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      actorFinal = actorMapeado;
      idFinal = MI_idUsuario; // ✅ Usar ID/DNI del token
      tipoAsistenciaFinal = TipoAsistencia.ParaPersonal; // ✅ Siempre Personal para registro propio

      // Calcular desfase para registro propio
      const fechaActualPeru = await obtenerFechaHoraActualPeru();
      timestampActual = fechaActualPeru.getTime();
      desfaseSegundos = Math.floor(
        (timestampActual - new Date(FechaHoraEsperadaISO).getTime()) / 1000
      );
    } else if (esRegistroEstudiante) {
      // ✅ REGISTRO DE ESTUDIANTE: Requiere Id_Estudiante + desfaseSegundosAsistenciaEstudiante
      console.log(`🔍 Registro de estudiante detectado`);

      // Validar ID del estudiante
      const idValidation = validateIdActor(Id_Estudiante!, true);
      if (!idValidation.isValid) {
        return NextResponse.json(
          {
            success: false,
            message: `ID de estudiante inválido: ${idValidation.errorMessage}`,
            errorType: idValidation.errorType,
          },
          { status: 400 }
        );
      }

      // Validar datos de aula para estudiantes
      if (!NivelDelEstudiante || !Grado || !Seccion) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Se requieren nivel educativo, grado y sección para registrar estudiantes",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validar que el grado sea numérico y esté en rango válido
      if (typeof Grado !== "number" || Grado < 1 || Grado > 6) {
        return NextResponse.json(
          {
            success: false,
            message: "El grado debe ser un número entre 1 y 6",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validar que la sección sea una letra válida
      if (typeof Seccion !== "string" || !/^[A-Z]$/.test(Seccion)) {
        return NextResponse.json(
          {
            success: false,
            message: "La sección debe ser una letra mayúscula (A-Z)",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      actorFinal = ActoresSistema.Estudiante;
      idFinal = Id_Estudiante!;
      desfaseSegundos = desfaseSegundosAsistenciaEstudiante!;

      // Determinar tipo de asistencia basado en nivel educativo
      if (NivelDelEstudiante.toLowerCase().includes("primaria")) {
        tipoAsistenciaFinal = TipoAsistencia.ParaEstudiantesPrimaria;
      } else {
        tipoAsistenciaFinal = TipoAsistencia.ParaEstudiantesSecundaria;
      }
    } else if (esRegistroPersonal) {
      // ✅ REGISTRO DE PERSONAL: Requiere Id_Usuario + FechaHoraEsperadaISO
      console.log(`🔍 Registro de personal detectado`);

      // Validar campos necesarios
      if (!Actor || !tipoAsistenciaParam) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Para registrar personal se requieren Actor y TipoAsistencia",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validar Actor
      if (!Object.values(ActoresSistema).includes(Actor as ActoresSistema)) {
        return NextResponse.json(
          {
            success: false,
            message: "Actor no válido",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validar TipoAsistencia
      if (!Object.values(TipoAsistencia).includes(tipoAsistenciaParam)) {
        return NextResponse.json(
          {
            success: false,
            message: "TipoAsistencia no válido",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // ✅ Validación de ID según el actor
      if (Actor !== ActoresSistema.Directivo) {
        const idValidation = validateIdActor(Id_Usuario!, true);
        if (!idValidation.isValid) {
          return NextResponse.json(
            {
              success: false,
              message: `ID de usuario inválido para ${Actor}: ${idValidation.errorMessage}`,
              errorType: idValidation.errorType,
            },
            { status: 400 }
          );
        }
      }

      actorFinal = Actor as ActoresSistema;
      idFinal = Id_Usuario!;
      tipoAsistenciaFinal = tipoAsistenciaParam;

      // Calcular desfase para registro de personal
      const fechaActualPeru = await obtenerFechaHoraActualPeru();
      timestampActual = fechaActualPeru.getTime();
      desfaseSegundos = Math.floor(
        (timestampActual - new Date(FechaHoraEsperadaISO).getTime()) / 1000
      );
    } else {
      return NextResponse.json(
        {
          success: false,
          message:
            "Debe especificar o registro de estudiante (Id_Estudiante + desfase) o personal (Id_Usuario + FechaHoraEsperadaISO)",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Validar ModoRegistro
    if (!ModoRegistro || !Object.values(ModoRegistro).includes(ModoRegistro)) {
      return NextResponse.json(
        {
          success: false,
          message: "Se requiere un ModoRegistro válido",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // ✅ VALIDACIÓN DE PERMISOS
    const validacionPermisos = validarPermisosRegistro(
      rol!,
      actorFinal,
      tipoAsistenciaFinal,
      idFinal,
      MI_idUsuario,
      esRegistroPropio,
      Grado,
      Seccion,
      NivelDelEstudiante
    );

    if (!validacionPermisos.esValido) {
      return NextResponse.json(
        {
          success: false,
          message: validacionPermisos.mensaje,
          errorType: PermissionErrorTypes.INSUFFICIENT_PERMISSIONS,
        },
        { status: 403 }
      );
    }

    // Crear clave para Redis
    const fechaHoy = await obtenerFechaActualPeru();
    let clave: string;

    if (esRegistroEstudiante) {
      // Para estudiantes: incluir nivel, grado y sección en la clave
      clave = `${fechaHoy}:${ModoRegistro}:${actorFinal}:${NivelDelEstudiante}:${Grado}:${Seccion}:${idFinal}`;
    } else {
      // Para personal: clave tradicional
      clave = `${fechaHoy}:${ModoRegistro}:${actorFinal}:${idFinal}`;
    }

    // Usar el TipoAsistencia determinado
    const redisClientInstance = redisClient(tipoAsistenciaFinal);

    // Verificar si ya existe un registro en Redis
    const registroExistente = await redisClientInstance.get(clave);
    const esNuevoRegistro = !registroExistente;

    if (esNuevoRegistro) {
      // Establecer la expiración
      const segundosHastaExpiracion = await calcularSegundosHastaExpiracion();

      if (esRegistroEstudiante) {
        // ✅ Para estudiantes: Solo [desfaseSegundos]
        const valor = [desfaseSegundos.toString()];
        await redisClientInstance.set(clave, valor, segundosHastaExpiracion);
      } else {
        // ✅ Para personal: [timestamp, desfaseSegundos] (sin cambios)
        const valor = [timestampActual.toString(), desfaseSegundos.toString()];
        await redisClientInstance.set(clave, valor, segundosHastaExpiracion);
      }
    }

    console.log(
      `✅ Registro de asistencia: ${
        esRegistroPropio
          ? "PROPIO"
          : esRegistroEstudiante
          ? "ESTUDIANTE"
          : "PERSONAL"
      } - Actor: ${actorFinal} - ${
        esNuevoRegistro ? "NUEVO" : "EXISTENTE"
      } - Desfase: ${desfaseSegundos}s`
    );

    return NextResponse.json(
      {
        success: true,
        message: esNuevoRegistro
          ? "Asistencia registrada correctamente"
          : "La asistencia ya había sido registrada anteriormente",
        data: {
          timestamp: timestampActual || Date.now(), // Para estudiantes será la fecha actual aproximada
          desfaseSegundos,
          esNuevoRegistro,
          esRegistroPropio,
          actorRegistrado: actorFinal,
          tipoAsistencia: tipoAsistenciaFinal,
        },
      } as RegistrarAsistenciaIndividualSuccessResponse,
      { status: 200 }
    );
  } catch (error) {
    console.error("Error al registrar asistencia:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Error al registrar asistencia",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        ErrorDetails: error instanceof Error ? error.message : String(error),
      } as ErrorResponseAPIBase,
      { status: 500 }
    );
  }
}
