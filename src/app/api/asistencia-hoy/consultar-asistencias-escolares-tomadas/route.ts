import { NextRequest, NextResponse } from "next/server";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { verifyAuthToken } from "@/lib/utils/backend/auth/functions/jwtComprobations";
import {
  AsistenciaDiariaEscolarResultado,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { Meses } from "@/interfaces/shared/Meses";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { AsistenciasEscolaresHoyRepository } from "./_utils/AsistenciasEscolaresTomadasHoyRepository";

/**
 * Interface for the student attendance query endpoint response
 */
interface ConsultarAsistenciasEstudiantesResponseBody {
  TipoAsistencia: TipoAsistencia;
  Dia: number;
  Mes: Meses;
  Nivel?: string;
  Grado?: number;
  Seccion?: string;
  TotalEstudiantesEsperados?: number;
  Resultados:
    | AsistenciaDiariaEscolarResultado
    | AsistenciaDiariaEscolarResultado[]
    | null;
  _debug?: string;
}

/**
 * Maps string to EducationalLevel
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
      throw new Error(`Invalid educational level: ${nivel}`);
  }
};

/**
 * Validates permissions according to role for student attendance queries
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
      // Directors can query any student attendance
      return { esValido: true };

    case RolesSistema.Auxiliar:
      // Only secondary students
      if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesSecundaria) {
        return {
          esValido: false,
          mensaje:
            "Assistants can only query secondary students",
        };
      }
      return { esValido: true };

    case RolesSistema.ProfesorPrimaria:
      // Only primary students
      if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesPrimaria) {
        return {
          esValido: false,
          mensaje:
            "Primary school teachers can only query primary students",
        };
      }
      // TODO: Here it could be validated that the teacher only queries their assigned classroom
      return { esValido: true };

    case RolesSistema.Tutor:
      // Only secondary students
      if (tipoAsistencia !== TipoAsistencia.ParaEstudiantesSecundaria) {
        return {
          esValido: false,
          mensaje:
            "Tutors can only query secondary students",
        };
      }
      // TODO: Here it could be validated that the tutor only queries their assigned classroom
      return { esValido: true };

    case RolesSistema.Responsable:
      // Guardians can query students, but only those under their responsibility
      // TODO: This validation would require querying the database to verify the relationship
      return { esValido: true };

    case RolesSistema.ProfesorSecundaria:
      return {
        esValido: false,
        mensaje:
          "Secondary school teachers cannot query student attendances",
      };

    case RolesSistema.PersonalAdministrativo:
      return {
        esValido: false,
        mensaje:
          "Administrative staff cannot query student attendances",
      };

    default:
      return { esValido: false, mensaje: "Unauthorized role" };
  }
};

export async function GET(req: NextRequest) {
  const logPrefix = "[GET /attendances/students]";

  try {
    console.log(`${logPrefix} 🚀 STARTING QUERY`);
    console.log(`${logPrefix} 🌐 Full URL: ${req.url}`);

    // Verify authentication
    console.log(`${logPrefix} 🔐 Verifying authentication...`);
    const { error, rol, decodedToken } = await verifyAuthToken(req, [
      RolesSistema.Directivo,
      RolesSistema.Auxiliar,
      RolesSistema.ProfesorPrimaria,
      RolesSistema.Tutor,
      RolesSistema.Responsable,
    ]);

    if (error && !rol && !decodedToken) {
      console.log(`${logPrefix} ❌ Authentication error`);
      return error;
    }

    console.log(`${logPrefix} ✅ Authenticated user - Role: ${rol}`);
    console.log(
      `${logPrefix} 👤 Decoded token:`,
      decodedToken ? Object.keys(decodedToken) : "null"
    );

    // Get query parameters
    const searchParams = req.nextUrl.searchParams;
    const tipoAsistenciaParam = searchParams.get(
      "TipoAsistencia"
    ) as TipoAsistencia;
    const nivelParam = searchParams.get("Nivel");
    const gradoParam = searchParams.get("Grado");
    const idEstudianteParam = searchParams.get("idEstudiante");
    const seccionParam = searchParams.get("Seccion");
    const totalEstudiantesParam = searchParams.get("totalEstudiantes");

    console.log(`${logPrefix} 📋 Received parameters:`);
    console.log(`${logPrefix} 📋   TipoAsistencia: ${tipoAsistenciaParam}`);
    console.log(`${logPrefix} 📋   Nivel: ${nivelParam}`);
    console.log(`${logPrefix} 📋   Grado: ${gradoParam}`);
    console.log(`${logPrefix} 📋   idEstudiante: ${idEstudianteParam}`);
    console.log(`${logPrefix} 📋   Seccion: ${seccionParam}`);
    console.log(`${logPrefix} 📋   totalEstudiantes: ${totalEstudiantesParam}`);

    // Validate mandatory parameters
    if (!tipoAsistenciaParam) {
      console.log(`${logPrefix} ❌ Missing TipoAsistencia parameter`);
      return NextResponse.json(
        { success: false, message: "The TipoAsistencia parameter is required" },
        { status: 400 }
      );
    }

    if (!nivelParam) {
      console.log(`${logPrefix} ❌ Missing Nivel parameter`);
      return NextResponse.json(
        { success: false, message: "The Nivel parameter is required" },
        { status: 400 }
      );
    }

    if (!gradoParam) {
      console.log(`${logPrefix} ❌ Missing Grado parameter`);
      return NextResponse.json(
        { success: false, message: "The Grado parameter is required" },
        { status: 400 }
      );
    }

    // NEW VALIDATION: Section is mandatory for the new structure
    if (!seccionParam) {
      console.log(`${logPrefix} ❌ Missing Seccion parameter`);
      return NextResponse.json(
        {
          success: false,
          message:
            "The Seccion parameter is required to work with the new data structure",
        },
        { status: 400 }
      );
    }

    // Validate that TipoAsistencia is valid and is for students
    const tiposValidos = [
      TipoAsistencia.ParaEstudiantesPrimaria,
      TipoAsistencia.ParaEstudiantesSecundaria,
    ];

    if (!tiposValidos.includes(tipoAsistenciaParam)) {
      console.log(
        `${logPrefix} ❌ Invalid TipoAsistencia: ${tipoAsistenciaParam}`
      );
      console.log(`${logPrefix} 📋 Valid types: ${tiposValidos.join(", ")}`);
      return NextResponse.json(
        {
          success: false,
          message:
            "TipoAsistencia must be for students (primary or secondary)",
        },
        { status: 400 }
      );
    }

    // Determine query type: individual vs classroom
    const esConsultaIndividual = !!idEstudianteParam;
    const esConsultaAula = !idEstudianteParam;

    console.log(
      `${logPrefix} 🎯 Query type: ${
        esConsultaIndividual ? "Individual" : "Full classroom"
      }`
    );

    // NEW VALIDATION: totalEstudiantes mandatory only for classroom queries
    if (esConsultaAula && !totalEstudiantesParam) {
      console.log(
        `${logPrefix} ❌ Missing totalEstudiantes parameter for classroom query`
      );
      return NextResponse.json(
        {
          success: false,
          message:
            "The totalEstudiantes parameter is mandatory for full classroom queries (when idEstudiante is not specified)",
        },
        { status: 400 }
      );
    }

    // Validate totalEstudiantes if provided
    let totalEstudiantes: number | undefined;
    if (totalEstudiantesParam) {
      totalEstudiantes = parseInt(totalEstudiantesParam);
      if (
        isNaN(totalEstudiantes) ||
        totalEstudiantes < 1 ||
        totalEstudiantes > 50
      ) {
        console.log(
          `${logPrefix} ❌ Invalid totalEstudiantes: ${totalEstudiantesParam}`
        );
        return NextResponse.json(
          {
            success: false,
            message:
              "The totalEstudiantes parameter must be a number between 1 and 50",
          },
          { status: 400 }
        );
      }
      console.log(
        `${logPrefix} ✅ totalEstudiantes validated: ${totalEstudiantes}`
      );
    }

    // Convert and validate parameters
    let nivel: NivelEducativo;
    let grado: number;

    try {
      nivel = mapearNivelEducativo(nivelParam);
      console.log(`${logPrefix} ✅ Level mapped: ${nivel}`);
    } catch (error) {
      console.log(`${logPrefix} ❌ Error mapping level: ${error}`);
      return NextResponse.json(
        { success: false, message: (error as Error).message },
        { status: 400 }
      );
    }

    grado = parseInt(gradoParam);
    if (isNaN(grado) || grado < 1 || grado > 6) {
      console.log(`${logPrefix} ❌ Invalid Grado: ${gradoParam}`);
      return NextResponse.json(
        { success: false, message: "The Grade must be a number between 1 and 6" },
        { status: 400 }
      );
    }

    // Validate grade according to level
    if (nivel === NivelEducativo.SECUNDARIA && grado > 5) {
      console.log(`${logPrefix} ❌ Invalid Grade for secondary: ${grado}`);
      return NextResponse.json(
        {
          success: false,
          message: "For secondary, the grade must be between 1 and 5",
        },
        { status: 400 }
      );
    }

    // Validate section (basic format)
    if (seccionParam && !/^[A-Z]{1,2}$/i.test(seccionParam)) {
      console.log(
        `${logPrefix} ❌ Invalid section format: ${seccionParam}`
      );
      return NextResponse.json(
        {
          success: false,
          message: "The section must be one or two letters (A, B, AB, etc.)",
        },
        { status: 400 }
      );
    }

    const seccion = seccionParam.toUpperCase();
    console.log(
      `${logPrefix} ✅ Parameters validated - Level: ${nivel}, Grade: ${grado}, Section: ${seccion}`
    );

    // Validate permissions
    console.log(`${logPrefix} 🔒 Validating permissions for role: ${rol}`);
    const validacionPermisos = validarPermisosEstudiantes(
      rol!,
      tipoAsistenciaParam,
      nivelParam || undefined,
      grado,
      seccion
    );

    if (!validacionPermisos.esValido) {
      console.log(
        `${logPrefix} ❌ Insufficient permissions: ${validacionPermisos.mensaje}`
      );
      return NextResponse.json(
        { success: false, message: validacionPermisos.mensaje },
        { status: 403 }
      );
    }

    console.log(`${logPrefix} ✅ Permissions validated correctly`);

    // Create repository instance
    const asistenciasRepo = new AsistenciasEscolaresHoyRepository();
    console.log(`${logPrefix} 📦 Attendance repository created`);

    let resultados:
      | AsistenciaDiariaEscolarResultado
      | AsistenciaDiariaEscolarResultado[]
      | null;
    let mensajeDebug = "";

    if (esConsultaIndividual) {
      // Query by specific student ID
      console.log(
        `${logPrefix} 🔍 STARTING individual query: ${idEstudianteParam}`
      );
      console.log(
        `${logPrefix} 🎯 Parameters for query: level=${nivel}, grade=${grado}, section=${seccion}, role=${rol}`
      );

      const resultado = await asistenciasRepo.consultarPorIdEstudiante(
        idEstudianteParam!,
        tipoAsistenciaParam,
        nivel,
        grado,
        seccion,
        rol!
      );

      resultados = resultado.datos;
      mensajeDebug = resultado.mensaje;

      console.log(`${logPrefix} 📊 Individual query result:`);
      console.log(
        `${logPrefix} 📊   Data: ${
          resultados ? "Found" : "Not found"
        }`
      );
      console.log(`${logPrefix} 📊   Message: ${mensajeDebug}`);
    } else {
      // Query by classroom (level, grade, section) - UPDATED WITH totalEstudiantes
      console.log(
        `${logPrefix} 🏫 STARTING classroom query: ${nivel} ${grado}° ${seccion} (${totalEstudiantes} expected students)`
      );

      const resultado = await asistenciasRepo.consultarPorAula(
        tipoAsistenciaParam,
        nivel!,
        grado!,
        seccion!,
        totalEstudiantes!, // New mandatory parameter
        rol!
      );

      resultados = resultado.datos;
      mensajeDebug = resultado.mensaje;

      console.log(`${logPrefix} 📊 Classroom query result:`);
      console.log(
        `${logPrefix} 📊   Data: ${
          Array.isArray(resultados)
            ? `${resultados.length}/${totalEstudiantes} students`
            : "Not found"
        }`
      );
      console.log(`${logPrefix} 📊   Message: ${mensajeDebug}`);
    }

    // Get current date for the response
    const fechaActual = await asistenciasRepo.obtenerFechaActual();
    const [año, mes, dia] = fechaActual.split("-").map(Number);

    console.log(
      `${logPrefix} 📅 Current date obtained: ${fechaActual} (${dia}/${mes}/${año})`
    );

    // Create response
    const respuesta: ConsultarAsistenciasEstudiantesResponseBody = {
      TipoAsistencia: tipoAsistenciaParam,
      Dia: dia,
      Mes: mes as Meses,
      Nivel: nivelParam || undefined,
      Grado: grado,
      Seccion: seccion,
      ...(esConsultaAula &&
        totalEstudiantes && { TotalEstudiantesEsperados: totalEstudiantes }),
      Resultados: resultados,
      _debug: mensajeDebug,
    };

    console.log(`${logPrefix} ✅ QUERY COMPLETED SUCCESSFULLY`);
    console.log(
      `${logPrefix} 📈 Response prepared with ${
        Array.isArray(resultados) ? resultados.length : resultados ? 1 : 0
      } results`
    );

    return NextResponse.json(respuesta, { status: 200 });
  } catch (error) {
    console.error(`${logPrefix} ❌ CRITICAL ERROR:`, error);
    console.error(
      `${logPrefix} ❌ Stack trace:`,
      error instanceof Error ? error.stack : "No stack available"
    );

    return NextResponse.json(
      {
        success: false,
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
        _debug: "See server logs for more details",
      },
      { status: 500 }
    );
  }
}