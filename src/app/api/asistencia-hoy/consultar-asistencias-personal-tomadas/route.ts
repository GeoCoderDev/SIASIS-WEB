import { NextRequest, NextResponse } from "next/server";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import {
  GruposIntanciasDeRedis,
  redisClient,
} from "../../../../../config/Redis/RedisClient";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { obtenerFechaActualPeru } from "../../_helpers/obtenerFechaActualPeru";
import {
  AsistenciaDiariaDePersonalResultado,
  ConsultarAsistenciasDePersonalTomadasPorRolEnRedisResponseBody,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { Meses } from "@/interfaces/shared/Meses";

/**
 * Validates permissions according to role for personal attendance queries
 */
const validarPermisosPersonal = (
  rol: RolesSistema,
  idConsulta: string | null,
  miid: string,
  esConsultaPropia: boolean = false
): { esValido: boolean; mensaje?: string } => {
  switch (rol) {
    case RolesSistema.Directivo:
      // Directors can query attendance of any staff
      return { esValido: true };

    case RolesSistema.Auxiliar:
    case RolesSistema.ProfesorPrimaria:
    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
    case RolesSistema.PersonalAdministrativo:
      // Other roles can only query their own personal attendance
      if (esConsultaPropia) return { esValido: true };

      if (!idConsulta || idConsulta !== miid) {
        return {
          esValido: false,
          mensaje: `Role ${rol} can only query their own personal attendance`,
        };
      }
      return { esValido: true };

    case RolesSistema.Responsable:
      return {
        esValido: false,
        mensaje: "Guardians do not have personal attendance records",
      };

    default:
      return { esValido: false, mensaje: "Unauthorized role" };
  }
};

export async function GET(req: NextRequest) {
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

    const MI_idUsuario = decodedToken.ID_Usuario;

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const rolParam = searchParams.get("Rol"); // Optional for own query
    const modoRegistroParam = searchParams.get("ModoRegistro");
    const idParam = searchParams.get("idUsuario"); // Optional for own query

    // Detect if it is own query
    const esConsultaPropia = !rolParam;
    let rolConsulta: RolesSistema;

    if (esConsultaPropia) {
      // If Role is not sent, it is own query
      rolConsulta = rol!;
      console.log(`🔍 Own query detected: ${rolConsulta}`);
    } else {
      // Validate that Role is valid for querying others
      if (!Object.values(RolesSistema).includes(rolParam as RolesSistema)) {
        return NextResponse.json(
          { success: false, message: "The provided Role is not valid" },
          { status: 400 }
        );
      }
      rolConsulta = rolParam as RolesSistema;

      // Check that the queried role has personal attendance
      if (rolConsulta === RolesSistema.Responsable) {
        return NextResponse.json(
          {
            success: false,
            message: "Guardians do not have personal attendance",
          },
          { status: 400 }
        );
      }
    }

    // Validate mandatory parameters
    if (!modoRegistroParam) {
      return NextResponse.json(
        {
          success: false,
          message: "The ModoRegistro parameter is required",
        },
        { status: 400 }
      );
    }

    // Validate that ModoRegistro is valid
    if (
      !Object.values(ModoRegistro).includes(modoRegistroParam as ModoRegistro)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "The provided ModoRegistro is not valid",
        },
        { status: 400 }
      );
    }

    // Validate permissions
    const validacionPermisos = validarPermisosPersonal(
      rol!,
      idParam,
      MI_idUsuario,
      esConsultaPropia
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

    // Get current date in Peru
    const fechaActualPeru = await obtenerFechaActualPeru();

    // Create search pattern
    const codigoRol = rolConsulta;
    const idParaBusqueda = esConsultaPropia ? MI_idUsuario : idParam;

    let patronBusqueda: string;
    if (idParaBusqueda) {
      // Unitary query by specific idUsuario
      patronBusqueda = `${fechaActualPeru}:${modoRegistroParam}:${codigoRol}:${idParaBusqueda}`;
    } else {
      // General query by role
      patronBusqueda = `${fechaActualPeru}:${modoRegistroParam}:${codigoRol}:*`;
    }

    console.log(
      `🔍 Searching keys with pattern: ${patronBusqueda} ${
        esConsultaPropia ? "(own query)" : "(query of others)"
      }`
    );

    // Get Redis instance for staff
    const redisClientInstance = redisClient(
      GruposIntanciasDeRedis.ParaAsistenciasDePersonal
    );

    // Search keys
    let claves: string[];
    if (idParaBusqueda) {
      // For unitary query, check if the specific key exists
      const existe = await redisClientInstance.exists(patronBusqueda);
      claves = existe ? [patronBusqueda] : [];
    } else {
      // For multiple queries, use keys
      claves = await redisClientInstance.keys(patronBusqueda);
    }

    console.log(`📊 Keys found: ${claves.length}`, claves);

    // Process results
    const resultados: AsistenciaDiariaDePersonalResultado[] = [];

    for (const clave of claves) {
      const valor = await redisClientInstance.get(clave);

      if (valor) {
        const partes = clave.split(":");
        if (partes.length >= 4) {
          const id = partes[3];

          // For staff, value must be an array with timestamp and offset
          if (Array.isArray(valor) && valor.length >= 2) {
            const timestamp = parseInt(valor[0] as string);
            const desfaseSegundos = parseInt(valor[1] as string);

            resultados.push({
              idUsuario: id,
              AsistenciaMarcada: true,
              Detalles: {
                Timestamp: timestamp,
                DesfaseSegundos: desfaseSegundos,
              },
            });
          }
        }
      }
    }

    console.log(`✅ Total results found: ${resultados.length}`);

    // Create response
    const respuesta: ConsultarAsistenciasDePersonalTomadasPorRolEnRedisResponseBody =
      {
        Rol: rolConsulta,
        Dia: Number(fechaActualPeru.split("-")[2]),
        Mes: Number(fechaActualPeru.split("-")[1]) as Meses,
        ModoRegistro: modoRegistroParam as ModoRegistro,
        TipoAsistencia: TipoAsistencia.ParaPersonal,
        Resultados: idParaBusqueda ? resultados[0] || [] : resultados,
      };

    return NextResponse.json(respuesta, { status: 200 });
  } catch (error) {
    console.error("❌ Error querying personal attendance:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
