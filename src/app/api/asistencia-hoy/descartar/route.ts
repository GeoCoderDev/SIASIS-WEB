import { NextRequest, NextResponse } from "next/server";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import {
  GruposIntanciasDeRedis,
  redisClient,
} from "../../../../../config/Redis/RedisClient";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { obtenerFechaActualPeru } from "../../_helpers/obtenerFechaActualPeru";
import {
  EliminarAsistenciaRequestBody,
  EliminarAsistenciaSuccessResponse,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { validateDNI } from "@/lib/helpers/validators/data/validateDNI";
import {
  RequestErrorTypes,
  SystemErrorTypes,
} from "@/interfaces/shared/errors";
import { GrupoInstaciasDeRedisPorTipoAsistencia } from "../marcar/route";

// Function to validate permissions according to role
const validarPermisosEliminacion = (
  rol: RolesSistema,
  actor: ActoresSistema,
  tipoAsistencia: TipoAsistencia
): { esValido: boolean; mensaje?: string } => {
  switch (rol) {
    case RolesSistema.Directivo:
      // Can only delete staff attendance, NOT student attendance
      if (actor === ActoresSistema.Estudiante) {
        return {
          esValido: false,
          mensaje:
            "Directors cannot delete student attendances",
        };
      }
      // For staff it must be the correct type
      if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
        return {
          esValido: false,
          mensaje:
            "To delete staff attendances, TipoAsistencia.ParaPersonal must be used",
        };
      }
      return { esValido: true };

    case RolesSistema.ProfesorPrimaria:
      // Can only delete primary student attendances
      if (actor !== ActoresSistema.Estudiante) {
        return {
          esValido: false,
          mensaje:
            "Primary school teachers can only delete student attendances",
        };
      }
      if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesPrimaria) {
        return {
          esValido: false,
          mensaje:
            "Primary school teachers can only delete primary student attendances",
        };
      }
      return { esValido: true };

    case RolesSistema.Auxiliar:
      // Can only delete secondary student attendances
      if (actor !== ActoresSistema.Estudiante) {
        return {
          esValido: false,
          mensaje:
            "Assistants can only delete student attendances",
        };
      }
      if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesSecundaria) {
        return {
          esValido: false,
          mensaje:
            "Assistants can only delete secondary student attendances",
        };
      }
      return { esValido: true };

    default:
      return {
        esValido: false,
        mensaje: "Your role does not have permission to delete attendances",
      };
  }
};

// Function to build the Redis key
const construirClaveRedis = (
  fecha: string,
  modoRegistro: ModoRegistro,
  actor: ActoresSistema,
  dni: string,
  nivelEducativo?: string,
  grado?: number,
  seccion?: string
): string => {
  if (
    actor === ActoresSistema.Estudiante &&
    nivelEducativo &&
    grado &&
    seccion
  ) {
    // For students with complete data
    return `${fecha}:${modoRegistro}:${actor}:${dni}:${nivelEducativo}:${grado}:${seccion}`;
  } else {
    // For staff or when complete student data is not specified
    return `${fecha}:${modoRegistro}:${actor}:${dni}`;
  }
};

// Function to search for student keys by pattern
const buscarClaveEstudiante = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  redisClientInstance: ReturnType<typeof redisClient>,
  fecha: string,
  modoRegistro: ModoRegistro,
  actor: ActoresSistema,
  dni: string
): Promise<string | null> => {
  const patron = `${fecha}:${modoRegistro}:${actor}:${dni}:*`;

  try {
    const claves = await redisClientInstance.keys(patron);

    if (claves.length === 0) {
      return null;
    }

    if (claves.length === 1) {
      return claves[0];
    }

    // If there are multiple keys, we return the first one found
    // In a real scenario, this might require additional logic
    console.warn(
      `Multiple keys found for student ${dni}:`,
      claves
    );
    return claves[0];
  } catch (error) {
    console.error("Error searching for student keys:", error);
    return null;
  }
};

export async function DELETE(req: NextRequest) {
  try {
    // Verify authentication - Only certain roles can access
    const { error, rol, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.Auxiliar,
    ]);

    if (error && !rol && !decodedToken) return error;

    // Parse the request body
    const body = (await req.json()) as EliminarAsistenciaRequestBody;

    const {
      Id_Usuario,
      Actor,
      ModoRegistro,
      TipoAsistencia: tipoAsistencia,
      NivelEducativo,
      Grado,
      Seccion,
      Fecha,
    } = body;

    // Validate DNI
    const dniValidation = validateDNI(Id_Usuario, true);
    // The director will have an ID
    if (!dniValidation.isValid && Actor !== ActoresSistema.Directivo) {
      return NextResponse.json(
        {
          success: false,
          message: dniValidation.errorMessage,
          errorType: dniValidation.errorType,
        },
        { status: 400 }
      );
    }

    // Validate mandatory fields
    if (!Actor || !ModoRegistro || !tipoAsistencia) {
      return NextResponse.json(
        {
          success: false,
          message:
            "The following fields are required: DNI, Actor, ModoRegistro and TipoAsistencia",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Validate that Actor is valid
    if (!Object.values(ActoresSistema).includes(Actor)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid Actor",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Validate that ModoRegistro is valid
    if (!Object.values(ModoRegistro).includes(ModoRegistro)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid ModoRegistro",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Validate that TipoAsistencia is valid
    if (!Object.values(TipoAsistencia).includes(tipoAsistencia)) {
      return NextResponse.json(
        {
          success: false,
          message: "Invalid TipoAsistencia",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Validate permissions according to role
    const validacionPermisos = validarPermisosEliminacion(
      rol!,
      Actor,
      tipoAsistencia
    );

    if (!validacionPermisos.esValido) {
      return NextResponse.json(
        {
          success: false,
          message: validacionPermisos.mensaje,
        },
        { status: 403 }
      );
    }

    // Determine the date to use
    const fechaEliminacion = Fecha || (await obtenerFechaActualPeru());

    // Validate date format if provided
    if (Fecha && !/^\d{4}-\d{2}-\d{2}$/.test(Fecha)) {
      return NextResponse.json(
        {
          success: false,
          message: "The date format must be YYYY-MM-DD",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // Get the corresponding Redis instance
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
    );

    // Build the key or search for it
    let claveAEliminar: string | null = null;

    if (Actor === ActoresSistema.Estudiante) {
      if (NivelEducativo && Grado && Seccion) {
        // If all student data is provided, build exact key
        claveAEliminar = construirClaveRedis(
          fechaEliminacion,
          ModoRegistro,
          Actor,
          Id_Usuario,
          NivelEducativo,
          Grado,
          Seccion
        );
      } else {
        // If all data is not provided, search by pattern
        claveAEliminar = await buscarClaveEstudiante(
          redisClientInstance,
          fechaEliminacion,
          ModoRegistro,
          Actor,
          Id_Usuario
        );
      }
    } else {
      // For staff, build key directly
      claveAEliminar = construirClaveRedis(
        fechaEliminacion,
        ModoRegistro,
        Actor,
        Id_Usuario
      );
    }

    if (!claveAEliminar) {
      return NextResponse.json(
        {
          success: false,
          message: "No attendance to delete was found",
        },
        { status: 404 }
      );
    }

    // Check if the key exists before trying to delete it
    const existe = await redisClientInstance.exists(claveAEliminar);

    if (!existe) {
      return NextResponse.json(
        {
          success: false,
          message: "The specified attendance does not exist",
        },
        { status: 404 }
      );
    }

    // Delete the attendance
    const resultado = await redisClientInstance.del(claveAEliminar);

    console.log(
      `✅ Attendance deleted: ${claveAEliminar} by user ${rol} (${decodedToken.ID_Usuario})`
    );

    // Successful response
    const respuesta: EliminarAsistenciaSuccessResponse = {
      success: true,
      message: "Attendance deleted successfully",
      data: {
        asistenciaEliminada: resultado > 0,
        claveEliminada: claveAEliminar,
        fecha: fechaEliminacion,
      },
    };

    return NextResponse.json(respuesta, { status: 200 });
  } catch (error) {
    console.error("❌ Error deleting attendance:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        errorDetails: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}