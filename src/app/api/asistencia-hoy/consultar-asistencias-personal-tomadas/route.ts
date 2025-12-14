import { NextRequest, NextResponse } from "next/server";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import {
  GruposIntanciasDeRedis,
  redisClient,
} from "../../../../../config/Redis/RedisClient";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import { getCurrentDateInPeru } from "../../_helpers/obtenerFechaActualPeru";
import {
  AsistenciaDiariaDePersonalResultado,
  ConsultarAsistenciasDePersonalTomadasPorRolEnRedisResponseBody,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { Meses } from "@/interfaces/shared/Meses";

/**
 * Validates permissions according to role for personal attendance queries
 */
const validateStaffPermissions = (
  role: RolesSistema,
  queryId: string | null,
  myId: string,
  isOwnQuery: boolean = false
): { isValid: boolean; message?: string } => {
  switch (role) {
    case RolesSistema.Directivo:
      // Directors can query attendance of any staff
      return { isValid: true };

    case RolesSistema.Auxiliar:
    case RolesSistema.ProfesorPrimaria:
    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
    case RolesSistema.PersonalAdministrativo:
      // Other roles can only query their own personal attendance
      if (isOwnQuery) return { isValid: true };

      if (!queryId || queryId !== myId) {
        return {
          isValid: false,
          message: `Role ${role} can only query their own personal attendance`,
        };
      }
      return { isValid: true };

    case RolesSistema.Responsable:
      return {
        isValid: false,
        message: "Guardians do not have personal attendance records",
      };

    default:
      return { isValid: false, message: "Unauthorized role" };
  }
};

export async function GET(req: NextRequest) {
  try {
    // Verify authentication
    const { error, rol: role, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.ProfesorSecundaria,
      RolesSistema.Tutor,
      RolesSistema.PersonalAdministrativo,
    ]);

    if (error && !role && !decodedToken) return error;

    const myId = decodedToken.ID_Usuario;

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const roleParam = searchParams.get("Rol"); // Optional for own query
    const registrationModeParam = searchParams.get("ModoRegistro");
    const idParam = searchParams.get("idUsuario"); // Optional for own query

    // Detect if it is own query
    const isOwnQuery = !roleParam;
    let queryRole: RolesSistema;

    if (isOwnQuery) {
      // If Role is not sent, it is own query
      queryRole = role!;
      console.log(`🔍 Own query detected: ${queryRole}`);
    } else {
      // Validate that Role is valid for querying others
      if (!Object.values(RolesSistema).includes(roleParam as RolesSistema)) {
        return NextResponse.json(
          { success: false, message: "The provided Role is not valid" },
          { status: 400 }
        );
      }
      queryRole = roleParam as RolesSistema;

      // Check that the queried role has personal attendance
      if (queryRole === RolesSistema.Responsable) {
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
    if (!registrationModeParam) {
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
      !Object.values(ModoRegistro).includes(registrationModeParam as ModoRegistro)
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
    const permissionValidation = validateStaffPermissions(
      role!,
      idParam,
      myId,
      isOwnQuery
    );

    if (!permissionValidation.isValid) {
      return NextResponse.json(
        {
          success: false,
          message: permissionValidation.message,
        },
        { status: 403 }
      );
    }

    // Get current date in Peru
    const currentPeruDate = await getCurrentDateInPeru();

    // Create search pattern
    const roleCode = queryRole;
    const idToSearch = isOwnQuery ? myId : idParam;

    let searchPattern: string;
    if (idToSearch) {
      // Unitary query by specific idUsuario
      searchPattern = `${currentPeruDate}:${registrationModeParam}:${roleCode}:${idToSearch}`;
    } else {
      // General query by role
      searchPattern = `${currentPeruDate}:${registrationModeParam}:${roleCode}:*`;
    }

    console.log(
      `🔍 Searching keys with pattern: ${searchPattern} ${
        isOwnQuery ? "(own query)" : "(query of others)"
      }`
    );

    // Get Redis instance for staff
    const redisClientInstance = redisClient(
      GruposIntanciasDeRedis.ParaAsistenciasDePersonal
    );

    // Search keys
    let keys: string[];
    if (idToSearch) {
      // For unitary query, check if the specific key exists
      const exists = await redisClientInstance.exists(searchPattern);
      keys = exists ? [searchPattern] : [];
    } else {
      // For multiple queries, use keys
      keys = await redisClientInstance.keys(searchPattern);
    }

    console.log(`📊 Keys found: ${keys.length}`, keys);

    // Process results
    const results: AsistenciaDiariaDePersonalResultado[] = [];

    for (const key of keys) {
      const value = await redisClientInstance.get(key);

      if (value) {
        const parts = key.split(":");
        if (parts.length >= 4) {
          const id = parts[3];

          // For staff, value must be an array with timestamp and offset
          if (Array.isArray(value) && value.length >= 2) {
            const timestamp = parseInt(value[0] as string);
            const offsetSeconds = parseInt(value[1] as string);

            results.push({
              idUsuario: id,
              AsistenciaMarcada: true,
              Detalles: {
                Timestamp: timestamp,
                DesfaseSegundos: offsetSeconds,
              },
            });
          }
        }
      }
    }

    console.log(`✅ Total results found: ${results.length}`);

    // Create response
    const response: ConsultarAsistenciasDePersonalTomadasPorRolEnRedisResponseBody =
      {
        Rol: queryRole,
        Dia: Number(currentPeruDate.split("-")[2]),
        Mes: Number(currentPeruDate.split("-")[1]) as Meses,
        ModoRegistro: registrationModeParam as ModoRegistro,
        TipoAsistencia: TipoAsistencia.ParaPersonal,
        Resultados: idToSearch ? results[0] || [] : results,
      };

    return NextResponse.json(response, { status: 200 });
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