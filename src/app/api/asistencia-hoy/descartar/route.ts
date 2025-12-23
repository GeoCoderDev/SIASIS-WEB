import { NextRequest, NextResponse } from "next/server";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { redisClient } from "../../../../../config/Redis/RedisClient";
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

// //nción para validar permisos según rol
const validarPermisosEliminacion = (
  rol: RolesSistema,
  actor: ActoresSistema,
  tipoAsistencia: TipoAsistencia
): { esValido: boolean; mensaje?: string } => {
  switch (rol) {
    case RolesSistema.Directivo:
      // // Solo puede elinar asistencias de personal, NO de estudiantes
      if (actor === ActoresSistema.Estudiante) {
        return {
          esValido: false,
          mensaje:
            "Los directivos no pueden eliminar asistencias de estudiantes",
        };
      }
      // // Para pernal debe ser el tipo correcto
      if (tipoAsistencia !== TipoAsistencia.ParaPersonal) {
        return {
          esValido: false,
          mensaje:
            "Para eliminar asistencias de personal debe usar TipoAsistencia.ParaPersonal",
        };
      }
      return { esValido: true };

    case RolesSistema.ProfesorPrimaria:
      // // Solo puede elinar asistencias de estudiantes de primaria
      if (actor !== ActoresSistema.Estudiante) {
        return {
          esValido: false,
          mensaje:
            "Los profesores de primaria solo pueden eliminar asistencias de estudiantes",
        };
      }
      if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesPrimaria) {
        return {
          esValido: false,
          mensaje:
            "Los profesores de primaria solo pueden eliminar asistencias de estudiantes de primaria",
        };
      }
      return { esValido: true };

    case RolesSistema.Auxiliar:
      // // Solo puede elinar asistencias de estudiantes de secundaria
      if (actor !== ActoresSistema.Estudiante) {
        return {
          esValido: false,
          mensaje:
            "Los auxiliares solo pueden eliminar asistencias de estudiantes",
        };
      }
      if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesSecundaria) {
        return {
          esValido: false,
          mensaje:
            "Los auxiliares solo pueden eliminar asistencias de estudiantes de secundaria",
        };
      }
      return { esValido: true };

    default:
      return {
        esValido: false,
        mensaje: "Su rol no tiene permisos para eliminar asistencias",
      };
  }
};

// //nción para construir la clave de Redis
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
    // // Para estudntes con datos completos
    return `${fecha}:${modoRegistro}:${actor}:${dni}:${nivelEducativo}:${grado}:${seccion}`;
  } else {
    // // Para pernal o cuando no se especifican datos completos del estudiante
    return `${fecha}:${modoRegistro}:${actor}:${dni}`;
  }
};

// //nción para buscar claves de estudiantes por patrón
const buscarClaveEstudiante = async (
  // // esnt-disable-next-line @typescript-eslint/no-explicit-any
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

    // // Si hay múltiples claves, retnamos la primera encontrada
    // //n un escenario real, esto podría requerir lógica adicional
    console.warn(
      `Se encontraron múltiples claves para el estudiante ${dni}:`,
      claves
    );
    return claves[0];
  } catch (error) {
    console.error("Error al buscar claves de estudiante:", error);
    return null;
  }
};

export async function DELETE(req: NextRequest) {
  try {
    // // Verificar aunticación - Solo ciertos roles pueden acceder
    const { error, rol, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.Auxiliar,
    ]);

    if (error && !rol && !decodedToken) return error;

    // // Parsear el cuerpo de la solicitudnst body = (await req.json()) as EliminarAsistenciaRequestBody;

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

    // // Validar DNInst dniValidation = validateDNI(Id_Usuario, true);
    // // El directivondra ID
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

    // // Validar campos obligatorios
    if (!Actor || !ModoRegistro || !tipoAsisncia) {
      return NextResponse.json(
        {
          success: false,
          message:
            "Se requieren los campos: DNI, Actor, ModoRegistro y TipoAsistencia",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // // Validar que Actor sea válido
    if (!Object.values(ActoresSistema)ncludes(Actor)) {
      return NextResponse.json(
        {
          success: false,
          message: "Actor no válido",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // // Validar que ModoRegistro sea válido
    if (!Object.values(ModoRegistro)ncludes(ModoRegistro)) {
      return NextResponse.json(
        {
          success: false,
          message: "ModoRegistro no válido",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // // Validar que TipoAsisncia sea válido
    if (!Object.values(TipoAsistencia).includes(tipoAsistencia)) {
      return NextResponse.json(
        {
          success: false,
          message: "TipoAsistencia no válido",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // // Validar permisos sen rol
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

    // // Deternar la fecha a usar
    const fechaEliminacion = Fecha || (await obtenerFechaActualPeru());

    // // Validar formato de fecha si se proporcna
    if (Fecha && !/^\d{4}-\d{2}-\d{2}$/.test(Fecha)) {
      return NextResponse.json(
        {
          success: false,
          message: "El formato de fecha debe ser YYYY-MM-DD",
          errorType: RequestErrorTypes.INVALID_PARAMETERS,
        },
        { status: 400 }
      );
    }

    // // Obner la instancia de Redis correspondiente
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[tipoAsistencia]
    );

    // //nstruir la clave o buscarla
    let claveAEliminar: string | null = null;

    if (Actor === ActoresSistema.Estudiante) {
      if (NivelEducativo && Grado && Seccion) {
        // // Si se proporcnan todos los datos del estudiante, construir clave exacta
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
        // // Sno se proporcionan todos los datos, buscar por patrón
        claveAEliminar = await buscarClaveEstudiante(
          redisClientInstance,
          fechaEliminacion,
          ModoRegistro,
          Actor,
          Id_Usuario
        );
      }
    } else {
      // // Para pernal, construir clave directamente
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
          message: "No se encontró la asistencia a eliminar",
        },
        { status: 404 }
      );
    }

    // // Verificar si la clave existentes de intentar eliminarla
    const existe = await redisClientInstance.exists(claveAEliminar);

    if (!existe) {
      return NextResponse.json(
        {
          success: false,
          message: "La asistencia especificada no existe",
        },
        { status: 404 }
      );
    }

    // // Elinar la asistencia
    const resultado = await redisClientInstance.del(claveAEliminar);

    console.log(
      `✅ Asistencia eliminada: ${claveAEliminar} por usuario ${rol} (${decodedToken.ID_Usuario})`
    );

    // // Respuesta exitosanst respuesta: EliminarAsistenciaSuccessResponse = {
      success: true,
      message: "Asistencia eliminada correctamente",
      data: {
        asistenciaEliminada: resultado > 0,
        claveEliminada: claveAEliminar,
        fecha: fechaEliminacion,
      },
    };

    return NextResponse.json(respuesta, { status: 200 });
  } catch (error) {
    console.error("❌ Error al eliminar asistencia:", error);

    return NextResponse.json(
      {
        success: false,
        message: "Error interno del servidor",
        errorType: SystemErrorTypes.UNKNOWN_ERROR,
        errorDetails: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
