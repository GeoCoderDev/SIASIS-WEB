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
    <div className="max-w-6xl mx-auto p-6">
      {/* Panel de filtros */}
      <div className="bg-white rounded-lg border-2 border-green-200 p-6 mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold text-green-800">
            Filtros de Búsqueda - Estudiantes de Secundaria
          </h3>
          <button
            onClick={limpiarFiltros}
            className="text-sm text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar filtros
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Selector de Grado */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Grado
            </label>
            <select
              value={gradoSeleccionado || ""}
              onChange={(e) => handleGradoChange(Number(e.target.value))}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
            >
              <option value="">Seleccione un grado</option>
              {grados.map((grado) => (
                <option key={grado} value={grado}>
                  {grado}° Grado
                </option>
              ))}
            </select>
          </div>

          {/* Selector de Sección */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sección
            </label>
            <select
              value={seccionSeleccionada || ""}
              onChange={(e) => handleSeccionChange(e.target.value)}
              disabled={!gradoSeleccionado}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100"
            >
              <option value="">Seleccione una sección</option>
              {secciones.map((seccion) => (
                <option key={seccion} value={seccion}>
                  Sección {seccion}
                </option>
              ))}
            </select>
          </div>

          {/* Campo de búsqueda por nombre */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Buscar estudiante
            </label>
            <input
              type="text"
              value={busquedaNombre}
              onChange={handleBusquedaChange}
              disabled={!aulaSeleccionada}
              placeholder="Ingrese nombre y/o apellido..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 placeholder-gray-400"
            />
          </div>
        </div>

        {/* Información del aula seleccionada */}
        {aulaSeleccionada && (
          <div className="mt-4 p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">
                  <span className="font-medium">Aula seleccionada:</span>{" "}
                  {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}" -
                  <span
                    className="inline-block w-4 h-4 rounded-full ml-2 mr-1"
                    style={{ backgroundColor: aulaSeleccionada.Color }}
                  ></span>
                  {aulaSeleccionada.Color}
                </p>
                <p className="text-xs text-gray-600">
                  {estudiantesFiltrados.length} de {estudiantesDelAula.length}{" "}
                  estudiantes mostrados
                  {busquedaNombre && ` (filtrado por: "${busquedaNombre}")`}
                </p>
              </div>
              <div className="text-sm">
                <span className="text-green-600 font-medium">
                  {estudiantesRegistrados.size} registrados
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista de estudiantes */}
      {estudiantesFiltrados.length > 0 && (
        <div className="bg-white rounded-lg border-2 border-green-200 p-6">
          <h3 className="text-lg font-bold text-green-800 mb-4">
            Lista de Estudiantes - {aulaSeleccionada?.Grado}° "
            {aulaSeleccionada?.Seccion}"
            {busquedaNombre && ` - Búsqueda: "${busquedaNombre}"`}
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
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
          <div className="bg-white rounded-lg border-2 border-yellow-200 p-8 text-center">
            <div className="text-yellow-600">
              <svg
                className="w-16 h-16 mx-auto mb-4"
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
              <h4 className="text-lg font-medium mb-2">
                No se encontraron resultados
              </h4>
              <p className="text-gray-600">
                No hay estudiantes que coincidan con "
                <strong>{busquedaNombre}</strong>" en el aula{" "}
                {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}".
              </p>
              <button
                onClick={() => setBusquedaNombre("")}
                className="mt-4 px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 transition-colors"
              >
                Mostrar todos los estudiantes
              </button>
            </div>
          </div>
        )}

      {/* Estado cuando no hay estudiantes en el aula */}
      {aulaSeleccionada && estudiantesDelAula.length === 0 && (
        <div className="bg-white rounded-lg border-2 border-gray-200 p-8 text-center">
          <div className="text-gray-500">
            <svg
              className="w-16 h-16 mx-auto mb-4"
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
            <h4 className="text-lg font-medium mb-2">Aula sin estudiantes</h4>
            <p>No se encontraron estudiantes activos en esta aula.</p>
          </div>
        </div>
      )}

      {/* Estado inicial - sin seleccionar aula */}
      {!aulaSeleccionada && (
        <div className="bg-white rounded-lg border-2 border-gray-200 p-8 text-center">
          <div className="text-gray-400">
            <svg
              className="w-16 h-16 mx-auto mb-4"
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
            <h4 className="text-lg font-medium mb-2">Seleccione un aula</h4>
            <p>
              Elija el grado y la sección para mostrar la lista de estudiantes.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RegistroEstudiantesSecundariaManual;
