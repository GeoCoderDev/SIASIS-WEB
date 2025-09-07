import { NextRequest, NextResponse } from "next/server";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import {
  AsistenciaDiariaEscolarResultado,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { Meses } from "@/interfaces/shared/Meses";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { AsistenciasEscolaresHoyRepository } from "./_utils/AsistenciasTomadasHoyRepository";

/**
 * Interfaz para la respuesta del endpoint de consulta de asistencias de estudiantes
 */
interface ConsultarAsistenciasEstudiantesResponseBody {
  TipoAsistencia: TipoAsistencia;
  Dia: number;
  Mes: Meses;
  Nivel?: string;
  Grado?: number;
  Seccion?: string;
  Resultados:
    | AsistenciaDiariaEscolarResultado
    | AsistenciaDiariaEscolarResultado[]
    | null;
  _debug?: string;
}

/**
 * Mapea string a NivelEducativo
 */
const mapearNivelEducativo = (nivel: string): NivelEducativo => {
  switch (nivel.toUpperCase()) {
    case "P":
    case "PRIMARIA":
      return NivelEducativo.PRIMARIA;
    case "S":
    case "SECUNDARIA":
      return NivelEducativo.SECUNDARIA;
    default:
      throw new Error(`Nivel educativo no válido: ${nivel}`);
  }
};

/**
 * Valida los permisos según el rol para consultas de asistencia de estudiantes
 */
const validarPermisosEstudiantes = (
  rol: RolesSistema,
  tipoAsistencia: TipoAsistencia,
  nivel?: string,
  grado?: number,
  seccion?: string
): { esValido: boolean; mensaje?: string } => {
  switch (rol) {
    case RolesSistema.Directivo:
      // Los directivos pueden consultar cualquier asistencia de estudiantes
      return { esValido: true };

    case RolesSistema.Auxiliar:
      // Solo estudiantes de secundaria
      if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesSecundaria) {
        return {
          esValido: false,
          mensaje:
            "Los auxiliares solo pueden consultar estudiantes de secundaria",
        };
      }
      return { esValido: true };

    case RolesSistema.ProfesorPrimaria:
      // Solo estudiantes de primaria
      if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesPrimaria) {
        return {
          esValido: false,
          mensaje:
            "Los profesores de primaria solo pueden consultar estudiantes de primaria",
        };
      }
      // TODO: Aquí se podría validar que el profesor solo consulte su aula asignada
      return { esValido: true };

    case RolesSistema.Tutor:
      // Solo estudiantes de secundaria
      if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesSecundaria) {
        return {
          esValido: false,
          mensaje:
            "Los tutores solo pueden consultar estudiantes de secundaria",
        };
      }
      // TODO: Aquí se podría validar que el tutor solo consulte su aula asignada
      return { esValido: true };

    case RolesSistema.Responsable:
      // Los responsables pueden consultar estudiantes, pero solo los que tienen bajo su responsabilidad
      // TODO: Esta validación requeriría consultar la base de datos para verificar la relación
      return { esValido: true };

    case RolesSistema.ProfesorSecundaria:
      return {
        esValido: false,
        mensaje:
          "Los profesores de secundaria no pueden consultar asistencias de estudiantes",
      };

    case RolesSistema.PersonalAdministrativo:
      return {
        esValido: false,
        mensaje:
          "El personal administrativo no puede consultar asistencias de estudiantes",
      };

    default:
      return { esValido: false, mensaje: "Rol no autorizado" };
  }
};

export async function GET(req: NextRequest) {
  const logPrefix = "[GET /asistencias/estudiantes]";

  try {
    console.log(`${logPrefix} 🚀 INICIO DE CONSULTA`);
    console.log(`${logPrefix} 🌐 URL completa: ${req.url}`);

    // Verificar autenticación
    console.log(`${logPrefix} 🔐 Verificando autenticación...`);
    const { error, rol, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.Tutor,
      RolesSistema.Responsable,
    ]);

    if (error && !rol && !decodedToken) {
      console.log(`${logPrefix} ❌ Error de autenticación`);
      return error;
    }

    console.log(`${logPrefix} ✅ Usuario autenticado - Rol: ${rol}`);
    console.log(
      `${logPrefix} 👤 Token decodificado:`,
      decodedToken ? Object.keys(decodedToken) : "null"
    );

    // Obtener parámetros de la consulta
    const searchParams = req.nextUrl.searchParams;
    const tipoAsistenciaParam = searchParams.get(
      "TipoAsistencia"
    ) as TipoAsistencia;
    const nivelParam = searchParams.get("Nivel");
    const gradoParam = searchParams.get("Grado");
    const idEstudianteParam = searchParams.get("idEstudiante");
    const seccionParam = searchParams.get("Seccion");

    console.log(`${logPrefix} 📋 Parámetros recibidos:`);
    console.log(`${logPrefix} 📋   TipoAsistencia: ${tipoAsistenciaParam}`);
    console.log(`${logPrefix} 📋   Nivel: ${nivelParam}`);
    console.log(`${logPrefix} 📋   Grado: ${gradoParam}`);
    console.log(`${logPrefix} 📋   idEstudiante: ${idEstudianteParam}`);
    console.log(`${logPrefix} 📋   Seccion: ${seccionParam}`);

    // Validar parámetros obligatorios
    if (!tipoAsistenciaParam) {
      console.log(`${logPrefix} ❌ Falta parámetro TipoAsistencia`);
      return NextResponse.json(
        { success: false, message: "Se requiere el parámetro TipoAsistencia" },
        { status: 400 }
      );
    }

    if (!nivelParam) {
      console.log(`${logPrefix} ❌ Falta parámetro Nivel`);
      return NextResponse.json(
        { success: false, message: "Se requiere el parámetro Nivel" },
        { status: 400 }
      );
    }

    if (!gradoParam) {
      console.log(`${logPrefix} ❌ Falta parámetro Grado`);
      return NextResponse.json(
        { success: false, message: "Se requiere el parámetro Grado" },
        { status: 400 }
      );
    }

    // Validar que TipoAsistencia sea válido y sea para estudiantes
    const tiposValidos = [
      TipoAsistencia.ParaEstudiantesPrimaria,
      TipoAsistencia.ParaEstudiantesSecundaria,
    ];

    if (!tiposValidos.includes(tipoAsistenciaParam)) {
      console.log(
        `${logPrefix} ❌ TipoAsistencia inválido: ${tipoAsistenciaParam}`
      );
      console.log(`${logPrefix} 📋 Tipos válidos: ${tiposValidos.join(", ")}`);
      return NextResponse.json(
        {
          success: false,
          message:
            "El TipoAsistencia debe ser para estudiantes (primaria o secundaria)",
        },
        { status: 400 }
      );
    }

    // Validar que se proporcione idEstudiante O Seccion
    if (!idEstudianteParam && !seccionParam) {
      console.log(`${logPrefix} ❌ Faltan parámetros: idEstudiante o Seccion`);
      return NextResponse.json(
        {
          success: false,
          message:
            "Se requiere idEstudiante (consulta individual) o Seccion (consulta de aula)",
        },
        { status: 400 }
      );
    }

    if (idEstudianteParam && seccionParam) {
      console.log(
        `${logPrefix} ⚠️ Ambos parámetros proporcionados, priorizando idEstudiante`
      );
    }

    // Convertir y validar parámetros
    let nivel: NivelEducativo;
    let grado: number;

    try {
      nivel = mapearNivelEducativo(nivelParam);
      console.log(`${logPrefix} ✅ Nivel mapeado: ${nivel}`);
    } catch (error) {
      console.log(`${logPrefix} ❌ Error al mapear nivel: ${error}`);
      return NextResponse.json(
        { success: false, message: (error as Error).message },
        { status: 400 }
      );
    }

    grado = parseInt(gradoParam);
    if (isNaN(grado) || grado < 1 || grado > 6) {
      console.log(`${logPrefix} ❌ Grado inválido: ${gradoParam}`);
      return NextResponse.json(
        { success: false, message: "El Grado debe ser un número entre 1 y 6" },
        { status: 400 }
      );
    }

    // Validar grado según nivel
    if (nivel === NivelEducativo.SECUNDARIA && grado > 5) {
      console.log(`${logPrefix} ❌ Grado inválido para secundaria: ${grado}`);
      return NextResponse.json(
        {
          success: false,
          message: "Para secundaria, el grado debe estar entre 1 y 5",
        },
        { status: 400 }
      );
    }

    console.log(
      `${logPrefix} ✅ Parámetros validados - Nivel: ${nivel}, Grado: ${grado}`
    );

    // Validar permisos
    console.log(`${logPrefix} 🔒 Validando permisos para rol: ${rol}`);
    const validacionPermisos = validarPermisosEstudiantes(
      rol!,
      tipoAsistenciaParam,
      nivelParam || undefined,
      grado,
      seccionParam || undefined
    );

    if (!validacionPermisos.esValido) {
      console.log(
        `${logPrefix} ❌ Permisos insuficientes: ${validacionPermisos.mensaje}`
      );
      return NextResponse.json(
        { success: false, message: validacionPermisos.mensaje },
        { status: 403 }
      );
    }

    console.log(`${logPrefix} ✅ Permisos validados correctamente`);

    // Crear instancia del repositorio
    const asistenciasRepo = new AsistenciasEscolaresHoyRepository();
    console.log(`${logPrefix} 📦 Repositorio de asistencias creado`);

    let resultados:
      | AsistenciaDiariaEscolarResultado
      | AsistenciaDiariaEscolarResultado[]
      | null;
    let mensajeDebug = "";

    if (idEstudianteParam) {
      // Consulta por ID específico de estudiante
      console.log(
        `${logPrefix} 🔍 INICIANDO consulta por estudiante: ${idEstudianteParam}`
      );
      console.log(
        `${logPrefix} 🎯 Parámetros para consulta: nivel=${nivel}, grado=${grado}, seccion=${seccionParam}, rol=${rol}`
      );

      const resultado = await asistenciasRepo.consultarPorIdEstudiante(
        idEstudianteParam,
        tipoAsistenciaParam,
        nivel,
        grado,
        seccionParam || undefined,
        rol!
      );

      resultados = resultado.datos;
      mensajeDebug = resultado.mensaje;

      console.log(`${logPrefix} 📊 Resultado consulta individual:`);
      console.log(
        `${logPrefix} 📊   Datos: ${
          resultados ? "Encontrado" : "No encontrado"
        }`
      );
      console.log(`${logPrefix} 📊   Mensaje: ${mensajeDebug}`);
    } else {
      // Consulta por aula (nivel, grado, sección)
      console.log(
        `${logPrefix} 🏫 INICIANDO consulta por aula: ${nivelParam} ${grado}° ${seccionParam}`
      );

      const resultado = await asistenciasRepo.consultarPorAula(
        tipoAsistenciaParam,
        nivel!,
        grado!,
        seccionParam!,
        rol!
      );

      resultados = resultado.datos;
      mensajeDebug = resultado.mensaje;

      console.log(`${logPrefix} 📊 Resultado consulta por aula:`);
      console.log(
        `${logPrefix} 📊   Datos: ${
          Array.isArray(resultados)
            ? `${resultados.length} estudiantes`
            : "No encontrado"
        }`
      );
      console.log(`${logPrefix} 📊   Mensaje: ${mensajeDebug}`);
    }

    // Obtener fecha actual para la respuesta
    const fechaActual = await asistenciasRepo.obtenerFechaActual();
    const [año, mes, dia] = fechaActual.split("-").map(Number);

    console.log(
      `${logPrefix} 📅 Fecha actual obtenida: ${fechaActual} (${dia}/${mes}/${año})`
    );

    // Crear respuesta
    const respuesta: ConsultarAsistenciasEstudiantesResponseBody = {
      TipoAsistencia: tipoAsistenciaParam,
      Dia: dia,
      Mes: mes as Meses,
      Nivel: nivelParam || undefined,
      Grado: grado,
      Seccion: seccionParam || undefined,
      Resultados: resultados,
      _debug: mensajeDebug,
    };

    console.log(`${logPrefix} ✅ CONSULTA COMPLETADA EXITOSAMENTE`);
    console.log(
      `${logPrefix} 📈 Respuesta preparada con ${
        Array.isArray(resultados) ? resultados.length : resultados ? 1 : 0
      } resultados`
    );

    return NextResponse.json(respuesta, { status: 200 });
  } catch (error) {
    console.error(`${logPrefix} ❌ ERROR CRÍTICO:`, error);
    console.error(
      `${logPrefix} ❌ Stack trace:`,
      error instanceof Error ? error.stack : "No stack available"
    );

    return NextResponse.json(
      {
        success: false,
        message: "Error interno del servidor",
        error: error instanceof Error ? error.message : String(error),
        _debug: "Ver logs del servidor para más detalles",
      },
      { status: 500 }
    );
  }
}
