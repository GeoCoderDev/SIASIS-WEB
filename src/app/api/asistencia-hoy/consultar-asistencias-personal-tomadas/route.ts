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
 * Valida los permisos según el rol para consultas de asistencia personal
 */
const validarPermisosPersonal = (
  rol: RolesSistema,
  idConsulta: string | null,
  miid: string,
  esConsultaPropia: boolean = false
): { esValido: boolean; mensaje?: string } => {
  switch (rol) {
    case RolesSistema.Directivo:
      // Los directivos pueden consultar asistencias de cualquier personal
      return { esValido: true };

    case RolesSistema.Auxiliar:
    case RolesSistema.ProfesorPrimaria:
    case RolesSistema.ProfesorSecundaria:
    case RolesSistema.Tutor:
    case RolesSistema.PersonalAdministrativo:
      // Otros roles solo pueden consultar su propia asistencia
      if (esConsultaPropia) return { esValido: true };

      if (!idConsulta || idConsulta !== miid) {
        return {
          esValido: false,
          mensaje: `El rol ${rol} solo puede consultar su propia asistencia personal`,
        };
      }
      return { esValido: true };

    case RolesSistema.Responsable:
      return {
        esValido: false,
        mensaje: "Los responsables no tienen registro de asistencia personal",
      };

    default:
      return { esValido: false, mensaje: "Rol no autorizado" };
  }
};

export async function GET(req: NextRequest) {
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

    const MI_idUsuario = decodedToken.ID_Usuario;

    // Obtener parámetros de la consulta
    const searchParams = req.nextUrl.searchParams;
    const rolParam = searchParams.get("Rol"); // Opcional para consulta propia
    const modoRegistroParam = searchParams.get("ModoRegistro");
    const idParam = searchParams.get("idUsuario"); // Opcional para consulta propia

    // Detectar si es consulta propia
    const esConsultaPropia = !rolParam;
    let rolConsulta: RolesSistema;

    if (esConsultaPropia) {
      // Si no se envía Rol, es consulta propia
      rolConsulta = rol!;
      console.log(`🔍 Consulta propia detectada: ${rolConsulta}`);
    } else {
      // Validar que Rol sea válido para consulta de otros
      if (!Object.values(RolesSistema).includes(rolParam as RolesSistema)) {
        return NextResponse.json(
          { success: false, message: "El Rol proporcionado no es válido" },
          { status: 400 }
        );
      }
      rolConsulta = rolParam as RolesSistema;

      // Verificar que el rol consultado tenga asistencia personal
      if (rolConsulta === RolesSistema.Responsable) {
        return NextResponse.json(
          {
            success: false,
            message: "Los responsables no tienen asistencia personal",
          },
          { status: 400 }
        );
      }
    }

    // Validar parámetros obligatorios
    if (!modoRegistroParam) {
      return NextResponse.json(
        {
          success: false,
          message: "Se requiere el parámetro ModoRegistro",
        },
        { status: 400 }
      );
    }

    // Validar que ModoRegistro sea válido
    if (
      !Object.values(ModoRegistro).includes(modoRegistroParam as ModoRegistro)
    ) {
      return NextResponse.json(
        {
          success: false,
          message: "El ModoRegistro proporcionado no es válido",
        },
        { status: 400 }
      );
    }

    // Validar permisos
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

    // Obtener la fecha actual en Perú
    const fechaActualPeru = await obtenerFechaActualPeru();

    // Crear patrón de búsqueda
    const codigoRol = rolConsulta;
    const idParaBusqueda = esConsultaPropia ? MI_idUsuario : idParam;

    let patronBusqueda: string;
    if (idParaBusqueda) {
      // Consulta unitaria por idUsuario específico
      patronBusqueda = `${fechaActualPeru}:${modoRegistroParam}:${codigoRol}:${idParaBusqueda}`;
    } else {
      // Consulta general por rol
      patronBusqueda = `${fechaActualPeru}:${modoRegistroParam}:${codigoRol}:*`;
    }

    console.log(
      `🔍 Buscando claves con patrón: ${patronBusqueda} ${
        esConsultaPropia ? "(consulta propia)" : "(consulta de otros)"
      }`
    );

    // Obtener la instancia de Redis para personal
    const redisClientInstance = redisClient(
      GruposIntanciasDeRedis.ParaAsistenciasDePersonal
    );

    // Buscar claves
    let claves: string[];
    if (idParaBusqueda) {
      // Para consulta unitaria, verificar si existe la clave específica
      const existe = await redisClientInstance.exists(patronBusqueda);
      claves = existe ? [patronBusqueda] : [];
    } else {
      // Para consultas múltiples, usar keys
      claves = await redisClientInstance.keys(patronBusqueda);
    }

    console.log(`📊 Claves encontradas: ${claves.length}`, claves);

    // Procesar resultados
    const resultados: AsistenciaDiariaDePersonalResultado[] = [];

    for (const clave of claves) {
      const valor = await redisClientInstance.get(clave);

      if (valor) {
        const partes = clave.split(":");
        if (partes.length >= 4) {
          const id = partes[3];

          // Para personal, valor debe ser un array con timestamp y desfase
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

    console.log(`✅ Total de resultados encontrados: ${resultados.length}`);

    // Crear respuesta
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
    console.error("❌ Error al consultar asistencias de personal:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error interno del servidor",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
