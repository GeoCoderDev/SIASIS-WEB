import { NextRequest, NextResponse } from "next/server";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";

import { validateIdActor } from "@/lib/helpers/validators/data/validateIdActor";
import {
  PermissionErrorTypes,
  RequestErrorTypes,
  SystemErrorTypes,
} from "@/interfaces/shared/errors";
import {
  GruposIntanciasDeRedis,
  redisClient,
} from "../../../../../config/Redis/RedisClient";
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

export const GrupoInstaciasDeRedisPorTipoAsistencia: Record<
  TipoAsistencia,
  GruposIntanciasDeRedis
> = {
  [TipoAsistencia.ParaPersonal]:
    GruposIntanciasDeRedis.ParaAsistenciasDePersonal,
  [TipoAsistencia.ParaEstudiantesSecundaria]:
    GruposIntanciasDeRedis.ParaAsistenciasDeEstudiantesSecundaria,
  [TipoAsistencia.ParaEstudiantesPrimaria]:
    GruposIntanciasDeRedis.ParaAsistenciasDeEstudiantesPrimaria,
};

/**
 * Maps a system role to the corresponding actor for personal attendance registration
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
    // Guardians don't have personal attendance
    case RolesSistema.Responsable:
      return null;
    default:
      return null;
  }
};

// Function to validate registration permissions by role
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
      // Directors can register staff attendance (including other directors)
      // BUT CANNOT register student attendance
      if (actor === ActoresSistema.Estudiante) {
        return {
          esValido: false,
          mensaje:
            "Directors cannot register student attendances",
        };
      }

      // For staff: they can register any staff member
      if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
        return {
          esValido: false,
          mensaje:
            "Directors can only register staff attendances",
        };
      }
      return { esValido: true };

    case RolesSistema.Auxiliar:
      if (actor === ActoresSistema.Estudiante) {
        // Only secondary students
        if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesSecundaria) {
          return {
            esValido: false,
            mensaje:
              "Assistants can only register secondary students",
          };
        }
        // For students requires level, grade and section
        if (!nivelEducativo || !grado || !seccion) {
          return {
            esValido: false,
            mensaje:
              "Educational level, grade and section are required to register students",
          };
        }
      } else {
        // For personal attendance: only their own record
        if (!esRegistroPropio && idARegistrar !== miid) {
          return {
            esValido: false,
            mensaje:
              "Assistants can only register their own personal attendance",
          };
        }
        // Must be Personal type
        if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
          return {
            esValido: false,
            mensaje:
              "Assistants can only register Personal type attendance for themselves",
          };
        }
      }
      return { esValido: true };

    case RolesSistema.ProfesorPrimaria:
      if (actor === ActoresSistema.Estudiante) {
        // Only primary students
        if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesPrimaria) {
          return {
            esValido: false,
            mensaje:
              "Primary school teachers can only register primary students",
          };
        }
        // For students requires level, grade and section
        if (!nivelEducativo || !grado || !seccion) {
          return {
            esValido: false,
            mensaje:
              "Educational level, grade and section are required to register students",
          };
        }
      } else {
        // For personal attendance: only their own record
        if (!esRegistroPropio && idARegistrar !== miid) {
          return {
            esValido: false,
            mensaje:
              "Primary school teachers can only register their own personal attendance",
          };
        }
        // Must be Personal type
        if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
          return {
            esValido: false,
            mensaje:
              "Primary school teachers can only register Personal type attendance for themselves",
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
            "Secondary school teachers/tutors cannot register student attendances",
        };
      } else {
        // For personal attendance: only their own record
        if (!esRegistroPropio && idARegistrar !== miid) {
          return {
            esValido: false,
            mensaje:
              "Secondary school teachers/tutors can only register their own attendance",
          };
        }
        // Must be Personal type
        if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
          return {
            esValido: false,
            mensaje:
              "Secondary school teachers/tutors can only register Personal type attendance for themselves",
          };
        }
      }
      return { esValido: true };

    case RolesSistema.PersonalAdministrativo:
      if (actor === ActoresSistema.Estudiante) {
        return {
          esValido: false,
          mensaje:
            "Administrative staff cannot register student attendances",
        };
      } else {
        // For personal attendance: only their own record
        if (!esRegistroPropio && idARegistrar !== miid) {
          return {
            esValido: false,
            mensaje:
              "Administrative staff can only register their own attendance",
          };
        }
        // Must be Personal type
        if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
          return {
            esValido: false,
            mensaje:
              "Administrative staff can only register Personal type attendance for themselves",
          };
        }
      }
      return { esValido: true };

    case RolesSistema.Responsable:
      // Guardians cannot register attendances
      return {
        esValido: false,
        mensaje: "Guardians cannot register attendances",
      };

    default:
      return { esValido: false, mensaje: "Unauthorized role" };
  }
};

const calcularSegundosHastaExpiracion = async (): Promise<number> => {
  // ✅ Use the new function that handles all offsets
  const fechaActualPeru = await obtenerFechaHoraActualPeru();

  // Create target date at 20:00 of the same day
  const fechaExpiracion = new Date(fechaActualPeru);
  fechaExpiracion.setHours(
    HORA_MAXIMA_EXPIRACION_PARA_REGISTROS_EN_REDIS,
    0,
    0,
    0
  );

  // If current time already passed 20:00, set for 20:00 of next day
  if (fechaActualPeru >= fechaExpiracion) {
    fechaExpiracion.setDate(fechaExpiracion.getDate() + 1);
  }

  // Calculate difference in seconds
  const segundosHastaExpiracion = Math.floor(
    (fechaExpiracion.getTime() - fechaActualPeru.getTime()) / 1000
  );
  return Math.max(1, segundosHastaExpiracion); // Minimum 1 second to avoid negative or zero values
};

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const { error, rol, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.ProfesorSecundaria,
      RolesSistema.Tutor,
      RolesSistema.PersonalAdministrativo,
    ]);

    if (error && !rol && !decodedToken) return error;

    const MI_idUsuario = decodedToken.ID_Usuario; // ✅ For directors: ID, for others: DNI

    // Parse request body as JSON
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

    // ✅ NEW LOGIC: Determine registration type
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
      // ✅ OWN REGISTRATION: Only requires ModoRegistro and FechaHoraEsperadaISO
      console.log(`🔍 Own registration detected for role: ${rol}`);

      if (!FechaHoraEsperadaISO) {
        return NextResponse.json(
          {
            success: false,
            message: "FechaHoraEsperadaISO is required for own registration",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Map role to actor
      const actorMapeado = mapearRolAActorPersonal(rol!);
      if (!actorMapeado) {
        return NextResponse.json(
          {
            success: false,
            message: `Role ${rol} cannot register personal attendance`,
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      actorFinal = actorMapeado;
      idFinal = MI_idUsuario; // ✅ Use ID/DNI from token
      tipoAsistenciaFinal = TipoAsistencia.ParaPersonal; // ✅ Always Personal for own registration

      // Calculate offset for own registration
      const fechaActualPeru = await obtenerFechaHoraActualPeru();
      timestampActual = fechaActualPeru.getTime();
      desfaseSegundos = Math.floor(
        (timestampActual - new Date(FechaHoraEsperadaISO).getTime()) / 1000
      );
    } else if (esRegistroEstudiante) {
      // ✅ STUDENT REGISTRATION: Requires Id_Estudiante + desfaseSegundosAsistenciaEstudiante
      console.log(`🔍 Student registration detected`);

      // Validate student ID
      const idValidation = validateIdActor(Id_Estudiante!, true);
      if (!idValidation.isValid) {
        return NextResponse.json(
          {
            success: false,
            message: `Invalid student ID: ${idValidation.errorMessage}`,
            errorType: idValidation.errorType,
          },
          { status: 400 }
        );
      }

      // Validate classroom data for students
      if (!NivelDelEstudiante || !Grado || !Seccion) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Educational level, grade and section are required to register students",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validate that grade is numeric and in valid range
      if (typeof Grado !== "number" || Grado < 1 || Grado > 6) {
        return NextResponse.json(
          {
            success: false,
            message: "The grade must be a number between 1 and 6",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validate that section is a valid letter
      if (typeof Seccion !== "string" || !/^[A-Z]$/.test(Seccion)) {
        return NextResponse.json(
          {
            success: false,
            message: "The section must be an uppercase letter (A-Z)",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      actorFinal = ActoresSistema.Estudiante;
      idFinal = Id_Estudiante!;
      desfaseSegundos = desfaseSegundosAsistenciaEstudiante!;

      // Determine attendance type based on educational level
      if (NivelDelEstudiante.toLowerCase().includes("primaria")) {
        tipoAsistenciaFinal = TipoAsistencia.ParaEstudiantesPrimaria;
      } else {
        tipoAsistenciaFinal = TipoAsistencia.ParaEstudiantesSecundaria;
      }
    } else if (esRegistroPersonal) {
      // ✅ STAFF REGISTRATION: Requires Id_Usuario + FechaHoraEsperadaISO
      console.log(`🔍 Staff registration detected`);

      // Validate required fields
      if (!Actor || !tipoAsistenciaParam) {
        return NextResponse.json(
          {
            success: false,
            message:
              "Actor and TipoAsistencia are required to register staff",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validate Actor
      if (!Object.values(ActoresSistema).includes(Actor as ActoresSistema)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid Actor",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // Validate TipoAsistencia
      if (!Object.values(TipoAsistencia).includes(tipoAsistenciaParam)) {
        return NextResponse.json(
          {
            success: false,
            message: "Invalid TipoAsistencia",
            errorType: RequestErrorTypes.INVALID_PARAMETERS,
          },
          { status: 400 }
        );
      }

      // ✅ ID validation according to actor
      if (Actor !== ActoresSistema.Directivo) {
        const idValidation = validateIdActor(Id_Usuario!, true);
        if (!idValidation.isValid) {
          return NextResponse.json(
            {
              success: false,
              message: `Invalid user ID for ${Actor}: ${idValidation.errorMessage}`,
              errorType: idValidation.errorType,
            },
            { status: 400 }
          );
        }
      }

      actorFinal = Actor as ActoresSistema;
      idFinal = Id_Usuario!;
      tipoAsistenciaFinal = tipoAsistenciaParam;

      // Calculate offset for staff registration
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
            "You must specify either student registration (Id_Estudiante + offset) or staff (Id_Usuario + FechaHoraEsperadaISO)",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Validate ModoRegistro
    if (!ModoRegistro || !Object.values(ModoRegistro).includes(ModoRegistro)) {
      return NextResponse.json(
        {
          success: false,
          message: "A valid ModoRegistro is required",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // ✅ PERMISSIONS VALIDATION
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

    // Create key for Redis
    const fechaHoy = await obtenerFechaActualPeru();
    let clave: string;

    if (esRegistroEstudiante) {
      // For students: include level, grade and section in key
      clave = `${fechaHoy}:${ModoRegistro}:${actorFinal}:${NivelDelEstudiante}:${Grado}:${Seccion}:${idFinal}`;
    } else {
      // For staff: traditional key
      clave = `${fechaHoy}:${ModoRegistro}:${actorFinal}:${idFinal}`;
    }

    // Use the determined TipoAsistencia
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistenciaFinal]
    );

    // Check if a record already exists in Redis
    const registroExistente = await redisClientInstance.get(clave);
    const esNuevoRegistro = !registroExistente;

    if (esNuevoRegistro) {
      // Set the expiration
      const segundosHastaExpiracion = await calcularSegundosHastaExpiracion();

      if (esRegistroEstudiante) {
        // ✅ For students: Only [desfaseSegundos]
        const valor = [desfaseSegundos.toString()];
        await redisClientInstance.set(clave, valor, segundosHastaExpiracion);
      } else {
        // ✅ For staff: [timestamp, desfaseSegundos] (no changes)
        const valor = [timestampActual.toString(), desfaseSegundos.toString()];
        await redisClientInstance.set(clave, valor, segundosHastaExpiracion);
      }
    }

    console.log(
      `✅ Attendance record: ${
        esRegistroPropio
          ? "OWN"
          : esRegistroEstudiante
          ? "STUDENT"
          : "STAFF"
      } - Actor: ${actorFinal} - ${
        esNuevoRegistro ? "NEW" : "EXISTING"
      } - Offset: ${desfaseSegundos}s`
    );

    return NextResponse.json(
      {
        success: true,
        message: esNuevoRegistro
          ? "Attendance recorded successfully"
          : "Attendance has already been recorded previously",
        data: {
          timestamp: timestampActual || Date.now(), // For students it will be the approximate current date
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
    console.error("Error registering attendance:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Error registering attendance",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        ErrorDetails: error instanceof Error ? error.message : String(error),
      } as ErrorResponseAPIBase,
      { status: 500 }
    );
  }
}