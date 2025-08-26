import React, { useEffect, useState } from "react";
import { T_Estudiantes, T_Aulas } from "@prisma/client";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { BaseEstudiantesIDB } from "@/lib/utils/local/db/models/Estudiantes/EstudiantesBaseIDB";
import { BaseAulasIDB } from "@/lib/utils/local/db/models/Aulas/AulasBase";
import { HandlerAuxiliarAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerAuxiliarAsistenciaResponse";
import { Speaker } from "@/lib/utils/voice/Speaker";
import EstudianteSecundariaParaTomaAsistenciaCard from "./EstudianteSecundariaParaTomaAsistenciaCard";

interface RegistroEstudiantesSecundariaManualProps {
  handlerAuxiliar: HandlerAuxiliarAsistenciaResponse;
}

const RegistroEstudiantesSecundariaManual: React.FC<
  RegistroEstudiantesSecundariaManualProps
> = ({ handlerAuxiliar }) => {
  // Estados para filtros y datos
  const [grados, setGrados] = useState<number[]>([]);
  const [gradoSeleccionado, setGradoSeleccionado] = useState<number | null>(
    null
  );
  const [secciones, setSecciones] = useState<string[]>([]);
  const [seccionSeleccionada, setSeccionSeleccionada] = useState<string | null>(
    null
  );
  const [aulaSeleccionada, setAulaSeleccionada] = useState<T_Aulas | null>(
    null
  );
  const [estudiantesDelAula, setEstudiantesDelAula] = useState<T_Estudiantes[]>(
    []
  );
  const [estudiantesFiltrados, setEstudiantesFiltrados] = useState<
    T_Estudiantes[]
  >([]);

  // Estado para el filtro de búsqueda por nombre
  const [busquedaNombre, setBusquedaNombre] = useState<string>("");

  // Estado para estudiantes ya registrados (simulado)
  const [estudiantesRegistrados, setEstudiantesRegistrados] = useState<
    Set<string>
  >(new Set());

  // Modelos de base de datos
  const [estudiantesIDB] = useState(() => new BaseEstudiantesIDB());
  const [aulasIDB] = useState(() => new BaseAulasIDB());

  // Cargar grados disponibles al montar
  useEffect(() => {
    cargarGradosDisponibles();
  }, []);

  // Cargar secciones cuando se selecciona un grado
  useEffect(() => {
    if (gradoSeleccionado !== null) {
      cargarSeccionesDelGrado(gradoSeleccionado);
    } else {
      setSecciones([]);
      setSeccionSeleccionada(null);
    }
  }, [gradoSeleccionado]);

  // Cargar estudiantes cuando se selecciona una sección
  useEffect(() => {
    if (aulaSeleccionada) {
      cargarEstudiantesDelAula(aulaSeleccionada.Id_Aula);
    } else {
      setEstudiantesDelAula([]);
    }
  }, [aulaSeleccionada]);

  // Filtrar estudiantes por nombre cuando cambia la búsqueda o los estudiantes del aula
  useEffect(() => {
    filtrarEstudiantesPorNombre();
  }, [busquedaNombre, estudiantesDelAula]);

  // Función para cargar grados disponibles
  const cargarGradosDisponibles = async () => {
    try {
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aulasSecundaria = todasLasAulas.filter(
        (aula) => aula.Nivel === NivelEducativo.SECUNDARIA
      );

      const gradosUnicos = [
        ...new Set(aulasSecundaria.map((aula) => aula.Grado)),
      ].sort();
      setGrados(gradosUnicos);
    } catch (error) {
      console.error("Error al cargar grados:", error);
    }
  };

  // Función para cargar secciones de un grado específico
  const cargarSeccionesDelGrado = async (grado: number) => {
    try {
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aulasDelGrado = todasLasAulas.filter(
        (aula) =>
          aula.Nivel === NivelEducativo.SECUNDARIA && aula.Grado === grado
      );

      const seccionesUnicas = [
        ...new Set(aulasDelGrado.map((aula) => aula.Seccion)),
      ].sort();
      setSecciones(seccionesUnicas);
    } catch (error) {
      console.error("Error al cargar secciones:", error);
    }
  };

  // Función para obtener el aula seleccionada
  const seleccionarAula = async (grado: number, seccion: string) => {
    try {
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aula = todasLasAulas.find(
        (aula) =>
          aula.Nivel === NivelEducativo.SECUNDARIA &&
          aula.Grado === grado &&
          aula.Seccion === seccion
      );

      setAulaSeleccionada(aula || null);
    } catch (error) {
      console.error("Error al seleccionar aula:", error);
    }
  };

  // Función para cargar estudiantes de un aula
  const cargarEstudiantesDelAula = async (idAula: string) => {
    try {
      const todosLosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
        false
      );
      const estudiantesDelAula = todosLosEstudiantes.filter(
        (estudiante) => estudiante.Id_Aula === idAula && estudiante.Estado
      );

      // Ordenar por apellidos
      estudiantesDelAula.sort((a, b) =>
        `${a.Apellidos} ${a.Nombres}`.localeCompare(
          `${b.Apellidos} ${b.Nombres}`
        )
      );

      setEstudiantesDelAula(estudiantesDelAula);
    } catch (error) {
      console.error("Error al cargar estudiantes:", error);
    }
  };

  // Función para filtrar estudiantes por nombre y apellido
  const filtrarEstudiantesPorNombre = () => {
    if (!busquedaNombre.trim()) {
      setEstudiantesFiltrados(estudiantesDelAula);
      return;
    }

    const terminosBusqueda = busquedaNombre.toLowerCase().split(" ");
    const estudiantesFiltrados = estudiantesDelAula.filter((estudiante) => {
      const nombreCompleto =
        `${estudiante.Nombres} ${estudiante.Apellidos}`.toLowerCase();

      return terminosBusqueda.every((termino) =>
        nombreCompleto.includes(termino)
      );
    });

    setEstudiantesFiltrados(estudiantesFiltrados);
  };

  // Manejar cambio de grado
  const handleGradoChange = (grado: number) => {
    setGradoSeleccionado(grado);
    setSeccionSeleccionada(null);
    setAulaSeleccionada(null);
    setBusquedaNombre(""); // Limpiar búsqueda
  };

  // Manejar cambio de sección
  const handleSeccionChange = (seccion: string) => {
    setSeccionSeleccionada(seccion);
    setBusquedaNombre(""); // Limpiar búsqueda
    if (gradoSeleccionado !== null) {
      seleccionarAula(gradoSeleccionado, seccion);
    }
  };

  // Manejar cambio en el campo de búsqueda
  const handleBusquedaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBusquedaNombre(e.target.value);
  };

  // Función para marcar asistencia
  const marcarAsistencia = (estudiante: T_Estudiantes) => {
    // TODO: Implementar lógica real de marcado de asistencia
    console.log(
      `Marcando asistencia para: ${estudiante.Nombres} ${estudiante.Apellidos}`
    );

    const speaker = Speaker.getInstance();
    speaker.start(
      `Asistencia registrada para ${estudiante.Nombres} ${estudiante.Apellidos}`
    );

    // Agregar a la lista de registrados (simulado)
    const nuevosRegistrados = new Set(estudiantesRegistrados);
    nuevosRegistrados.add(estudiante.Id_Estudiante);
    setEstudiantesRegistrados(nuevosRegistrados);
  };

  // Limpiar todos los filtros
  const limpiarFiltros = () => {
    setGradoSeleccionado(null);
    setSeccionSeleccionada(null);
    setAulaSeleccionada(null);
    setBusquedaNombre("");
    setEstudiantesDelAula([]);
    setEstudiantesFiltrados([]);
  };

  return (
    <div className="max-w-6xl mx-auto p-3 sxs-only:p-2 xs-only:p-3 sm-only:p-4 md-only:p-5 lg-only:p-6 xl-only:p-6">
      {/* Panel de filtros */}
      <div className="bg-white rounded-lg border-2 border-green-200 p-3 xs:p-4 sm:p-5 md:p-6 mb-3 xs:mb-4 sm:mb-6">
        <div className="flex flex-col xs:flex-row justify-between items-start xs:items-center mb-2 xs:mb-3 md:mb-4 gap-2 xs:gap-0">
          <h3 className="text-base xs:text-lg md:text-lg font-bold text-green-800">
            <span className="hidden sm:inline">
              Filtros de Búsqueda - Estudiantes de Secundaria
            </span>
            <span className="hidden xs:inline sm:hidden">
              Filtros - Secundaria
            </span>
            <span className="xs:hidden">Filtros</span>
          </h3>
          <button
            onClick={limpiarFiltros}
            className="text-xs xs:text-sm text-gray-500 hover:text-gray-700 underline"
          >
            <span className="hidden xs:inline">Limpiar filtros</span>
            <span className="xs:hidden">Limpiar</span>
          </button>
        </div>

        {/* Grid responsive para filtros */}
        <div className="grid grid-cols-1 xs:grid-cols-2 md:grid-cols-3 gap-2 xs:gap-3 md:gap-4">
          {/* Selector de Grado */}
          <div>
            <label className="block text-xs xs:text-sm font-medium text-gray-700 mb-1 xs:mb-2">
              Grado
            </label>
            <select
              value={gradoSeleccionado || ""}
              onChange={(e) => handleGradoChange(Number(e.target.value))}
              className="w-full p-2 xs:p-2.5 md:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 text-xs xs:text-sm"
            >
              <option value="">
                <span className="hidden xs:inline">Seleccione un grado</span>
                <span className="xs:hidden">Seleccione grado</span>
              </option>
              {grados.map((grado) => (
                <option key={grado} value={grado}>
                  {grado}° Grado
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Sección */}
          <div>
            <label className="block text-xs xs:text-sm font-medium text-gray-700 mb-1 xs:mb-2">
              Sección
            </label>
            <select
              value={seccionSeleccionada || ""}
              onChange={(e) => handleSeccionChange(e.target.value)}
              disabled={!gradoSeleccionado}
              className="w-full p-2 xs:p-2.5 md:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 text-xs xs:text-sm"
            >
              <option value="">
                <span className="hidden xs:inline">Seleccione una sección</span>
                <span className="xs:hidden">Seleccione sección</span>
              </option>
              {secciones.map((seccion) => (
                <option key={seccion} value={seccion}>
                  Sección {seccion}
                </option>
              ))}
            </select>
          </div>

          {/* Campo de búsqueda por nombre */}
          <div className="xs:col-span-2 md:col-span-1">
            <label className="block text-xs xs:text-sm font-medium text-gray-700 mb-1 xs:mb-2">
              <span className="hidden xs:inline">Buscar estudiante</span>
              <span className="xs:hidden">Buscar</span>
            </label>
            <input
              type="text"
              value={busquedaNombre}
              onChange={handleBusquedaChange}
              disabled={!aulaSeleccionada}
              placeholder="Ingrese nombre y/o apellido..."
              className="w-full p-2 xs:p-2.5 md:p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 placeholder-gray-400 text-xs xs:text-sm"
            />
          </div>
        </div>

        {/* Información del aula seleccionada */}
        {aulaSeleccionada && (
          <div className="mt-3 xs:mt-4 p-2 xs:p-3 bg-gray-50 rounded-lg">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 xs:gap-0">
              <div>
                <p className="text-xs xs:text-sm">
                  <span className="font-medium">
                    <span className="hidden xs:inline">Aula seleccionada:</span>
                    <span className="xs:hidden">Aula:</span>
                  </span>{" "}
                  {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}" -
                  <span
                    className="inline-block w-3 h-3 xs:w-4 xs:h-4 rounded-full ml-1 xs:ml-2 mr-1"
                    style={{ backgroundColor: aulaSeleccionada.Color }}
                  ></span>
                  <span className="hidden xs:inline">
                    {aulaSeleccionada.Color}
                  </span>
                </p>
                <p className="text-[0.6rem] xs:text-xs text-gray-600">
                  <span className="hidden sm:inline">
                    {estudiantesFiltrados.length} de {estudiantesDelAula.length}{" "}
                    estudiantes mostrados
                    {busquedaNombre && ` (filtrado por: "${busquedaNombre}")`}
                  </span>
                  <span className="hidden xs:inline sm:hidden">
                    {estudiantesFiltrados.length}/{estudiantesDelAula.length}{" "}
                    estudiantes
                    {busquedaNombre && ` (filtro: "${busquedaNombre}")`}
                  </span>
                  <span className="xs:hidden">
                    {estudiantesFiltrados.length}/{estudiantesDelAula.length}
                  </span>
                </p>
              </div>
              <div className="text-xs xs:text-sm">
                <span className="text-green-600 font-medium">
                  <span className="hidden xs:inline">
                    {estudiantesRegistrados.size} registrados
                  </span>
                  <span className="xs:hidden">
                    {estudiantesRegistrados.size}
                  </span>
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de estudiantes */}
      {estudiantesFiltrados.length > 0 && (
        <div className="bg-white rounded-lg border-2 border-green-200 p-3 xs:p-4 sm:p-5 md:p-6">
          <h3 className="text-base xs:text-lg md:text-lg font-bold text-green-800 mb-2 xs:mb-3 md:mb-4">
            <span className="hidden sm:inline">
              Lista de Estudiantes - {aulaSeleccionada?.Grado}° "
              {aulaSeleccionada?.Seccion}"
              {busquedaNombre && ` - Búsqueda: "${busquedaNombre}"`}
            </span>
            <span className="hidden xs:inline sm:hidden">
              {aulaSeleccionada?.Grado}° "{aulaSeleccionada?.Seccion}"
              {busquedaNombre && ` - "${busquedaNombre}"`}
            </span>
            <span className="xs:hidden">
              {aulaSeleccionada?.Grado}° "{aulaSeleccionada?.Seccion}"
            </span>
          </h3>

          {/* Grid responsive para estudiantes */}
          <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-2 xs:gap-3 sm:gap-4">
            {estudiantesFiltrados.map((estudiante) => (
              <EstudianteSecundariaParaTomaAsistenciaCard
                key={estudiante.Id_Estudiante}
                estudiante={estudiante}
                aulaSeleccionada={aulaSeleccionada}
                onMarcarAsistencia={marcarAsistencia}
                yaRegistrado={estudiantesRegistrados.has(
                  estudiante.Id_Estudiante
                )}
              />
            ))}
          </div>
        </div>
      )}

      {/* Estado cuando no hay resultados de búsqueda */}
      {aulaSeleccionada &&
        estudiantesDelAula.length > 0 &&
        estudiantesFiltrados.length === 0 &&
        busquedaNombre && (
          <div className="bg-white rounded-lg border-2 border-yellow-200 p-4 xs:p-6 md:p-8 text-center">
            <div className="text-yellow-600">
              <svg
                className="w-12 h-12 xs:w-14 xs:h-14 md:w-16 md:h-16 mx-auto mb-3 xs:mb-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9.172 16.172a4 4 0 015.656 0M9 12h6m-6-4h6m2 5.291A7.962 7.962 0 0112 15c-2.34 0-4.291-1.002-5.824-2.651M15 17H9v-2.5A5.5 5.5 0 0114.5 9H15v8z"
                />
              </svg>
              <h4 className="text-sm xs:text-base md:text-lg font-medium mb-1 xs:mb-2">
                <span className="hidden xs:inline">
                  No se encontraron resultados
                </span>
                <span className="xs:hidden">Sin resultados</span>
              </h4>
              <p className="text-gray-600 text-xs xs:text-sm">
                <span className="hidden sm:inline">
                  No hay estudiantes que coincidan con "
                  <strong>{busquedaNombre}</strong>" en el aula{" "}
                  {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}".
                </span>
                <span className="hidden xs:inline sm:hidden">
                  No hay estudiantes con "<strong>{busquedaNombre}</strong>"
                </span>
                <span className="xs:hidden">Sin coincidencias</span>
              </p>
              <button
                onClick={() => setBusquedaNombre("")}
                className="mt-2 xs:mt-3 md:mt-4 px-3 xs:px-4 py-1.5 xs:py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors text-xs xs:text-sm"
              >
                <span className="hidden xs:inline">
                  Mostrar todos los estudiantes
                </span>
                <span className="xs:hidden">Mostrar todos</span>
              </button>
            </div>
          </div>
        )}

      {/* Estado cuando no hay estudiantes en el aula */}
      {aulaSeleccionada && estudiantesDelAula.length === 0 && (
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4 xs:p-6 md:p-8 text-center">
          <div className="text-gray-500">
            <svg
              className="w-12 h-12 xs:w-14 xs:h-14 md:w-16 md:h-16 mx-auto mb-3 xs:mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
              />
            </svg>
            <h4 className="text-sm xs:text-base md:text-lg font-medium mb-1 xs:mb-2">
              <span className="hidden xs:inline">Aula sin estudiantes</span>
              <span className="xs:hidden">Sin estudiantes</span>
            </h4>
            <p className="text-xs xs:text-sm">
              <span className="hidden xs:inline">
                No se encontraron estudiantes activos en esta aula.
              </span>
              <span className="xs:hidden">No hay estudiantes activos</span>
            </p>
          </div>
        </div>
      )}

      {/* Estado inicial - sin seleccionar aula */}
      {!aulaSeleccionada && (
        <div className="bg-white rounded-lg border-2 border-gray-200 p-4 xs:p-6 md:p-8 text-center">
          <div className="text-gray-400">
            <svg
              className="w-12 h-12 xs:w-14 xs:h-14 md:w-16 md:h-16 mx-auto mb-3 xs:mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
              />
            </svg>
            <h4 className="text-sm xs:text-base md:text-lg font-medium mb-1 xs:mb-2">
              <span className="hidden xs:inline">Seleccione un aula</span>
              <span className="xs:hidden">Seleccione aula</span>
            </h4>
            <p className="text-xs xs:text-sm">
              <span className="hidden xs:inline">
                Elija el grado y la sección para mostrar la lista de
                estudiantes.
              </span>
              <span className="xs:hidden">Elija grado y sección</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistroEstudiantesSecundariaManual;
