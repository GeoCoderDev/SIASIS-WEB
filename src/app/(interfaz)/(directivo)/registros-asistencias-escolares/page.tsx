"use client";
import React, { useEffect, useState } from "react";
import { T_Aulas, T_Estudiantes } from "@prisma/client";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";
import { BaseAulasIDB } from "@/lib/utils/local/db/models/Aulas/AulasBase";
import { BaseEstudiantesIDB } from "@/lib/utils/local/db/models/Estudiantes/EstudiantesBaseIDB";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import Loader from "@/components/shared/loaders/Loader";
import { AsistenciasEscolaresPorAulaParaDirectivosIDB } from "@/lib/utils/local/db/models/AsistenciasEscolares/Para Responsables/AsistenciasEscolaresPorAulaParaDirectivosIDB";
import {
  COLORES_ESTADOS,
  MESES,
  TOLERANCIA_SEGUNDOS_PRIMARIA,
  TOLERANCIA_SEGUNDOS_SECUNDARIA,
} from "../../(responsable)/mis-estudiantes-relacionados/[Id_Estudiante]/asistencias-mensuales/types";
import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";

interface EstudianteConAsistencias {
  estudiante: T_Estudiantes;
  asistencias: Record<number, EstadosAsistenciaEscolar>;
  totales: {
    asistencias: number;
    tardanzas: number;
    faltas: number;
    inactivos: number;
  };
}

interface DatosTablaAsistencias {
  aula: T_Aulas;
  mes: number;
  estudiantes: EstudianteConAsistencias[];
  diasDelMes: Array<{ dia: number; diaSemana: string }>;
  fechaConsulta: string;
}

const RegistrosAsistenciasEscolares = () => {
  const [nivelTemporal, setNivelTemporal] = useState<NivelEducativo | "">("");
  const [gradoTemporal, setGradoTemporal] = useState<number | "">("");
  const [seccionTemporal, setSeccionTemporal] = useState<string>("");
  const [mesTemporal, setMesTemporal] = useState<number>(
    new Date().getMonth() + 1
  );

  const [nivelSeleccionado, setNivelSeleccionado] = useState<
    NivelEducativo | ""
  >("");
  const [gradoSeleccionado, setGradoSeleccionado] = useState<number | "">("");
  const [seccionSeleccionada, setSeccionSeleccionada] = useState<string>("");
  const [mesSeleccionado, setMesSeleccionado] = useState<number>(
    new Date().getMonth() + 1
  );

  const [gradosDisponibles, setGradosDisponibles] = useState<number[]>([]);
  const [seccionesDisponibles, setSeccionesDisponibles] = useState<string[]>(
    []
  );
  const [aulaSeleccionada, setAulaSeleccionada] = useState<T_Aulas | null>(
    null
  );
  const [datosTabla, setDatosTabla] = useState<DatosTablaAsistencias | null>(
    null
  );

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);
  const [successMessage, setSuccessMessage] = useState<MessageProperty | null>(
    null
  );

  const [aulasIDB] = useState(() => new BaseAulasIDB());
  const [estudiantesIDB] = useState(() => new BaseEstudiantesIDB());
  const [asistenciasIDB] = useState(
    () =>
      new AsistenciasEscolaresPorAulaParaDirectivosIDB(
        setIsLoading,
        setError,
        setSuccessMessage
      )
  );

  useEffect(() => {
    if (nivelTemporal) {
      cargarGradosDisponibles(nivelTemporal);
    } else {
      setGradosDisponibles([]);
      setGradoTemporal("");
    }
  }, [nivelTemporal]);

  useEffect(() => {
    if (nivelTemporal && gradoTemporal) {
      cargarSeccionesDisponibles(nivelTemporal, gradoTemporal);
    } else {
      setSeccionesDisponibles([]);
      setSeccionTemporal("");
    }
  }, [nivelTemporal, gradoTemporal]);

  useEffect(() => {
    if (nivelSeleccionado && gradoSeleccionado && seccionSeleccionada) {
      cargarAulaSeleccionada();
    } else {
      setAulaSeleccionada(null);
      setDatosTabla(null);
    }
  }, [nivelSeleccionado, gradoSeleccionado, seccionSeleccionada]);

  useEffect(() => {
    if (aulaSeleccionada && mesSeleccionado) {
      cargarAsistenciasAula();
    } else {
      setDatosTabla(null);
    }
  }, [aulaSeleccionada, mesSeleccionado]);

  const cargarGradosDisponibles = async (nivel: NivelEducativo) => {
    try {
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aulasDelNivel = todasLasAulas.filter(
        (aula) => aula.Nivel === nivel
      );
      const gradosUnicos = [
        ...new Set(aulasDelNivel.map((aula) => aula.Grado)),
      ].sort();
      setGradosDisponibles(gradosUnicos);
    } catch (error) {
      console.error("Error cargando grados:", error);
    }
  };

  const cargarSeccionesDisponibles = async (
    nivel: NivelEducativo,
    grado: number
  ) => {
    try {
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aulasDelGrado = todasLasAulas.filter(
        (aula) => aula.Nivel === nivel && aula.Grado === grado
      );
      const seccionesUnicas = [
        ...new Set(aulasDelGrado.map((aula) => aula.Seccion)),
      ].sort();
      setSeccionesDisponibles(seccionesUnicas);
    } catch (error) {
      console.error("Error cargando secciones:", error);
    }
  };

  const cargarAulaSeleccionada = async () => {
    try {
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aula = todasLasAulas.find(
        (aula) =>
          aula.Nivel === nivelSeleccionado &&
          aula.Grado === gradoSeleccionado &&
          aula.Seccion === seccionSeleccionada
      );
      setAulaSeleccionada(aula || null);
    } catch (error) {
      console.error("Error cargando aula:", error);
    }
  };

  const cargarAsistenciasAula = async () => {
    if (!aulaSeleccionada) return;

    try {
      const todosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
        false
      );
      const estudiantesAula = todosEstudiantes.filter(
        (estudiante) =>
          estudiante.Id_Aula === aulaSeleccionada.Id_Aula && estudiante.Estado
      );

      if (estudiantesAula.length === 0) {
        setDatosTabla(null);
        setError({
          success: false,
          message: "No se encontraron estudiantes activos en esta aula",
        });
        return;
      }

      const resultado = await asistenciasIDB.consultarAsistenciasMensualesAula(
        aulaSeleccionada.Id_Aula,
        mesSeleccionado
      );

      if (resultado.success && resultado.data) {
        const estudiantesConAsistencias = procesarAsistenciasEstudiantes(
          estudiantesAula,
          resultado.data.Asistencias_Escolares,
          aulaSeleccionada.Nivel as NivelEducativo
        );

        const diasDelMes = obtenerDiasDelMes(mesSeleccionado);

        setDatosTabla({
          aula: aulaSeleccionada,
          mes: mesSeleccionado,
          estudiantes: estudiantesConAsistencias,
          diasDelMes,
          fechaConsulta: new Date().toLocaleString(),
        });

        setError(null);
      } else if (resultado.requiereEspera && resultado.data) {
        const estudiantesConAsistencias = procesarAsistenciasEstudiantes(
          estudiantesAula,
          resultado.data.Asistencias_Escolares,
          aulaSeleccionada.Nivel as NivelEducativo
        );

        const diasDelMes = obtenerDiasDelMes(mesSeleccionado);

        setDatosTabla({
          aula: aulaSeleccionada,
          mes: mesSeleccionado,
          estudiantes: estudiantesConAsistencias,
          diasDelMes,
          fechaConsulta: new Date().toLocaleString(),
        });

        setError(null);
      } else {
        setDatosTabla(null);
        if (!resultado.requiereEspera) {
          setError({
            success: false,
            message:
              resultado.message || "No se pudieron cargar las asistencias",
          });
        }
      }
    } catch (error) {
      console.error("Error cargando asistencias:", error);
      setError({
        success: false,
        message: "Error inesperado al cargar las asistencias",
      });
    }
  };

  const procesarAsistenciasEstudiantes = (
    estudiantes: T_Estudiantes[],
    asistenciasRaw: Record<
      string,
      Record<number, AsistenciaEscolarDeUnDia | null>
    >,
    nivel: NivelEducativo
  ): EstudianteConAsistencias[] => {
    const toleranciaSegundos =
      nivel === NivelEducativo.PRIMARIA
        ? TOLERANCIA_SEGUNDOS_PRIMARIA
        : TOLERANCIA_SEGUNDOS_SECUNDARIA;

    return estudiantes
      .map((estudiante) => {
        const asistenciasEstudiante =
          asistenciasRaw[estudiante.Id_Estudiante] || {};
        const asistenciasProcesadas: Record<number, EstadosAsistenciaEscolar> =
          {};

        const totales = {
          asistencias: 0,
          tardanzas: 0,
          faltas: 0,
          inactivos: 0,
        };

        const diasEscolares = obtenerDiasDelMes(mesSeleccionado);
        const diasEscolaresSet = new Set(diasEscolares.map((d) => d.dia));

        for (let dia = 1; dia <= 31; dia++) {
          if (!diasEscolaresSet.has(dia)) {
            continue;
          }

          const asistenciaDia = asistenciasEstudiante[dia];

          if (asistenciaDia === undefined) {
            continue;
          }

          if (asistenciaDia === null) {
            asistenciasProcesadas[dia] = EstadosAsistenciaEscolar.Inactivo;
            totales.inactivos++;
            continue;
          }

          const registroEntrada = asistenciaDia.E;
          if (!registroEntrada || registroEntrada.DesfaseSegundos === null) {
            asistenciasProcesadas[dia] = EstadosAsistenciaEscolar.Falta;
            totales.faltas++;
            continue;
          }

          if (registroEntrada.DesfaseSegundos <= toleranciaSegundos) {
            asistenciasProcesadas[dia] = EstadosAsistenciaEscolar.Temprano;
            totales.asistencias++;
          } else {
            asistenciasProcesadas[dia] = EstadosAsistenciaEscolar.Tarde;
            totales.tardanzas++;
          }
        }

        return {
          estudiante,
          asistencias: asistenciasProcesadas,
          totales,
        };
      })
      .sort((a, b) =>
        `${a.estudiante.Apellidos} ${a.estudiante.Nombres}`.localeCompare(
          `${b.estudiante.Apellidos} ${b.estudiante.Nombres}`
        )
      );
  };

  const obtenerDiasDelMes = (
    mes: number
  ): Array<{ dia: number; diaSemana: string }> => {
    const año = new Date().getFullYear();
    const diasEnMes = new Date(año, mes, 0).getDate();
    const diasEscolares: Array<{ dia: number; diaSemana: string }> = [];

    const diasSemanaTextos = ["D", "L", "M", "M", "J", "V", "S"];

    for (let dia = 1; dia <= diasEnMes; dia++) {
      const fecha = new Date(año, mes - 1, dia);
      const diaSemana = fecha.getDay();

      if (diaSemana >= 1 && diaSemana <= 5) {
        diasEscolares.push({
          dia: dia,
          diaSemana: diasSemanaTextos[diaSemana],
        });
      }
    }

    return diasEscolares;
  };

  const obtenerMesesDisponibles = () => {
    const mesActual = new Date().getMonth() + 1;
    return MESES.filter((mes) => mes.value >= 3 && mes.value <= mesActual);
  };

  const handleConsultar = () => {
    setNivelSeleccionado(nivelTemporal);
    setGradoSeleccionado(gradoTemporal);
    setSeccionSeleccionada(seccionTemporal);
    setMesSeleccionado(mesTemporal);
  };

  const limpiarFiltros = () => {
    setNivelTemporal("");
    setGradoTemporal("");
    setSeccionTemporal("");
    setMesTemporal(new Date().getMonth() + 1);
    setNivelSeleccionado("");
    setGradoSeleccionado("");
    setSeccionSeleccionada("");
    setMesSeleccionado(new Date().getMonth() + 1);
    setDatosTabla(null);
    setError(null);
    setSuccessMessage(null);
  };

  return (
    <div className="w-full h-full bg-gray-50 flex flex-col overflow-hidden">
      {/* Header - Siempre visible */}
      <div className="bg-white border-b border-gray-200 p-4 flex-shrink-0 w-full">
        <div className="w-full">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">
            REGISTROS DE ASISTENCIA ESCOLAR
          </h1>

          {/* Filtros */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Nivel Educativo
              </label>
              <select
                value={nivelTemporal}
                onChange={(e) =>
                  setNivelTemporal(e.target.value as NivelEducativo | "")
                }
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Seleccionar</option>
                <option value={NivelEducativo.PRIMARIA}>Primaria</option>
                <option value={NivelEducativo.SECUNDARIA}>Secundaria</option>
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Grado
              </label>
              <select
                value={gradoTemporal}
                onChange={(e) =>
                  setGradoTemporal(e.target.value ? Number(e.target.value) : "")
                }
                disabled={!nivelTemporal}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">Seleccionar</option>
                {gradosDisponibles.map((grado) => (
                  <option key={grado} value={grado}>
                    {grado}°
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Sección
              </label>
              <select
                value={seccionTemporal}
                onChange={(e) => setSeccionTemporal(e.target.value)}
                disabled={!gradoTemporal}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100"
              >
                <option value="">Seleccionar</option>
                {seccionesDisponibles.map((seccion) => (
                  <option key={seccion} value={seccion}>
                    {seccion}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[150px]">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mes
              </label>
              <select
                value={mesTemporal}
                onChange={(e) => setMesTemporal(Number(e.target.value))}
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {obtenerMesesDisponibles().map((mes) => (
                  <option key={mes.value} value={mes.value}>
                    {mes.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-end min-w-[120px]">
              <button
                onClick={handleConsultar}
                disabled={!nivelTemporal || !gradoTemporal || !seccionTemporal}
                className="w-full p-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
              >
                Consultar
              </button>
            </div>

            <div className="flex items-end min-w-[120px]">
              <button
                onClick={limpiarFiltros}
                className="w-full p-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors font-medium"
              >
                Limpiar
              </button>
            </div>
          </div>

          {/* Info del aula seleccionada */}
          {aulaSeleccionada && (
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg w-full">
              <div
                className="w-4 h-4 rounded-full flex-shrink-0"
                style={{ backgroundColor: aulaSeleccionada.Color }}
              ></div>
              <span className="font-medium">
                {aulaSeleccionada.Nivel === NivelEducativo.PRIMARIA
                  ? "Primaria"
                  : "Secundaria"}{" "}
                - {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}"
              </span>
              {datosTabla && (
                <span className="text-gray-600">
                  • {datosTabla.estudiantes.length} estudiantes
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mensajes */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 mx-4 mt-4 rounded-lg flex-shrink-0 w-auto">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p>{error.message}</p>
              <button
                onClick={() => setError(null)}
                className="text-xs text-red-700 hover:text-red-800 underline mt-1"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {successMessage && (
        <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 mx-4 mt-4 rounded-lg flex-shrink-0 w-auto">
          <div className="flex items-start gap-2">
            <svg
              className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <div className="flex-1">
              <p>{successMessage.message}</p>
              <button
                onClick={() => setSuccessMessage(null)}
                className="text-xs text-green-700 hover:text-green-800 underline mt-1"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenido principal - Área fija para tabla/loader/placeholder */}
      <div className="flex-1 p-4 overflow-hidden w-full">
        <div className="h-full w-full overflow-auto">
          {isLoading ? (
            <div className="h-full flex items-center justify-center bg-white rounded-lg shadow-sm">
              <div className="text-center">
                <Loader className="w-8 h-8 mx-auto mb-4" />
                <p className="text-gray-600">Cargando datos de asistencia...</p>
              </div>
            </div>
          ) : !datosTabla ? (
            <div className="h-full bg-white rounded-lg shadow-sm p-8 flex items-center justify-center">
              <div className="text-center">
                <div className="text-gray-400 mb-4">
                  <svg
                    className="w-16 h-16 mx-auto"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Seleccione un aula y presione "Consultar"
                </h3>
                <p className="text-gray-600">
                  Use los filtros para seleccionar nivel, grado, sección y mes,
                  luego haga clic en "Consultar"
                </p>
              </div>
            </div>
          ) : (
            <TablaAsistencias datos={datosTabla} />
          )}
        </div>
      </div>
    </div>
  );
};

const TablaAsistencias = ({ datos }: { datos: DatosTablaAsistencias }) => {
  const mesInfo = MESES.find((m) => m.value === datos.mes);

  const hoy = new Date();
  const mesActual = hoy.getMonth() + 1;
  const diaActual = hoy.getDate();
  const esMesActual = datos.mes === mesActual;
  const diaSemanaActual = hoy.getDay();

  const mostrarIndicadorDiaActual =
    esMesActual && diaSemanaActual >= 1 && diaSemanaActual <= 5;

  return (
    <div className="bg-white rounded-lg shadow-sm h-full flex flex-col overflow-hidden w-full max-w-full max-h-[500px]">
      {/* Header de la tabla */}
      <div className="p-4 border-b border-gray-200 flex-shrink-0">
        <div className="flex justify-between items-center">
          <h2 className="text-lg font-semibold text-gray-900">
            {mesInfo?.label} - {datos.aula.Grado}° "{datos.aula.Seccion}"
          </h2>
          <div className="text-sm text-gray-600">
            {datos.estudiantes.length} estudiantes • Actualizado:{" "}
            {datos.fechaConsulta}
          </div>
        </div>
      </div>

      {/* Contenedor de tabla con scroll propio */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full relative border-collapse">
          <thead className="bg-gray-50">
            <tr>
              <th className="md:sticky md:left-0 sticky top-0 bg-gray-50 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-b-0 border-gray-200 md:z-30 z-20 min-w-[200px] h-10">
                {/* Espacio para el nombre */}
              </th>
              {datos.diasDelMes.map(({ dia, diaSemana }) => (
                <th
                  key={`dia-${dia}`}
                  className="sticky top-0 bg-gray-50 px-2 py-1 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-0 border-gray-200 z-20 min-w-[40px] h-10"
                >
                  {diaSemana}
                </th>
              ))}
              <th className="md:sticky md:right-[120px] sticky top-0 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-b-0 border-gray-200 md:z-30 z-20 min-w-[60px] h-10">
                {/* Espacio para F */}
              </th>
              <th className="md:sticky md:right-[60px] sticky top-0 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b-0 border-gray-200 md:z-30 z-20 min-w-[60px] h-10">
                {/* Espacio para T */}
              </th>
              <th className="md:sticky md:right-0 sticky top-0 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-b-0 border-gray-200 md:z-30 z-20 min-w-[60px] h-10">
                {/* Espacio para A */}
              </th>
            </tr>
            <tr>
              <th className="md:sticky md:left-0 sticky top-10 bg-gray-50 px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-b border-gray-200 md:z-30 z-20 h-12">
                Apellidos y Nombres
              </th>
              {datos.diasDelMes.map(({ dia }) => (
                <th
                  key={dia}
                  className="sticky top-10 bg-gray-50 px-2 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 z-20 min-w-[40px] relative h-12"
                >
                  <div className="flex flex-col items-center justify-center gap-0.5 h-full">
                    {mostrarIndicadorDiaActual && dia === diaActual && (
                      <div className="text-blue-600 text-base leading-none -mb-1">
                        ▼
                      </div>
                    )}
                    <span>{dia}</span>
                  </div>
                </th>
              ))}
              <th className="md:sticky md:right-[120px] sticky top-10 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-b border-gray-200 md:z-30 z-20 h-12">
                F
              </th>
              <th className="md:sticky md:right-[60px] sticky top-10 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-b border-gray-200 md:z-30 z-20 h-12">
                T
              </th>
              <th className="md:sticky md:right-0 sticky top-10 bg-gray-50 px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l border-b border-gray-200 md:z-30 z-20 h-12">
                A
              </th>
            </tr>
          </thead>

          <tbody className="bg-white divide-y divide-gray-200">
            {datos.estudiantes.map((item, index) => (
              <tr
                key={item.estudiante.Id_Estudiante}
                className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}
              >
                <td className="md:sticky md:left-0 bg-inherit px-4 py-3 text-sm font-medium text-gray-900 border-r border-gray-200 md:z-10 min-w-[200px]">
                  <div className="truncate">
                    {item.estudiante.Apellidos}, {item.estudiante.Nombres}
                  </div>
                </td>

                {datos.diasDelMes.map(({ dia }) => (
                  <td key={dia} className="px-2 py-3 text-center min-w-[40px]">
                    {item.asistencias[dia] ? (
                      <div className="flex justify-center">
                        {renderCeldaAsistencia(item.asistencias[dia], dia)}
                      </div>
                    ) : (
                      <div className="w-6 h-6"></div>
                    )}
                  </td>
                ))}

                <td className="md:sticky md:right-[120px] bg-inherit px-4 py-3 text-center text-sm font-medium text-red-600 border-l border-gray-200 md:z-10">
                  {item.totales.faltas}
                </td>
                <td className="md:sticky md:right-[60px] bg-inherit px-4 py-3 text-center text-sm font-medium text-orange-600 md:z-10">
                  {item.totales.tardanzas}
                </td>
                <td className="md:sticky md:right-0 bg-inherit px-4 py-3 text-center text-sm font-medium text-green-600 border-l border-gray-200 md:z-10">
                  {item.totales.asistencias}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Leyenda */}
      <div className="p-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
        <div className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-blue-500 rounded flex items-center justify-center text-white text-xs font-medium">
              A
            </div>
            <span>Asistió</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-orange-500 rounded flex items-center justify-center text-white text-xs font-medium">
              T
            </div>
            <span>Tardanza</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-700 rounded flex items-center justify-center text-white text-xs font-medium">
              F
            </div>
            <span>Falta</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-400 rounded flex items-center justify-center text-white text-xs font-medium">
              -
            </div>
            <span>Sin datos</span>
          </div>
          {mostrarIndicadorDiaActual && (
            <div className="flex items-center gap-2 ml-4">
              <div className="text-blue-600 text-lg leading-none">▼</div>
              <span>Día actual</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const renderCeldaAsistencia = (
  estado: EstadosAsistenciaEscolar,
  dia: number
) => {
  const colores = COLORES_ESTADOS[estado];
  const simbolo =
    estado === EstadosAsistenciaEscolar.Temprano
      ? "A"
      : estado === EstadosAsistenciaEscolar.Tarde
      ? "T"
      : estado === EstadosAsistenciaEscolar.Falta
      ? "F"
      : "-";

  return (
    <div
      className={`w-6 h-6 flex items-center justify-center text-xs font-medium ${colores.background} ${colores.text} rounded`}
      title={`Día ${dia}: ${
        simbolo === "A"
          ? "Asistió"
          : simbolo === "T"
          ? "Tardanza"
          : simbolo === "F"
          ? "Falta"
          : "Sin datos"
      }`}
    >
      {simbolo}
    </div>
  );
};

export default RegistrosAsistenciasEscolares;
