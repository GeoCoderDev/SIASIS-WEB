import React, { useEffect, useState } from "react";
import { T_Estudiantes, T_Aulas } from "@prisma/client";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { BaseEstudiantesIDB } from "@/lib/utils/local/db/models/Estudiantes/EstudiantesBaseIDB";
import { BaseAulasIDB } from "@/lib/utils/local/db/models/Aulas/AulasBase";
import { HandlerAuxiliarAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerAuxiliarAsistenciaResponse";
import { Speaker } from "@/lib/utils/voice/Speaker";
import EstudianteSecundariaParaTomaAsistenciaCard from "./EstudianteSecundariaParaTomaAsistenciaCard";
import { Asistencias_Escolares_QUEUE } from "@/lib/utils/queues/AsistenciasEscolaresQueue";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { TipoAsistencia } from "@/interfaces/shared/AsistenciaRequests";
import { HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_SECUNDARIA } from "@/constants/INTERVALOS_ASISTENCIAS_ESCOLARES";
import { alterarUTCaZonaPeruana } from "@/lib/helpers/alteradores/alterarUTCaZonaPeruana";
import { CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA } from "@/constants/ASISTENCIA_ENTRADA_SALIDA_ESCOLAR";
import FotoPerfilClientSide from "../utils/photos/FotoPerfilClientSide";
import { extraerTipoDeIdentificador } from "@/lib/helpers/extractors/extraerTipoDeIdentificador";
import { TiposIdentificadoresTextos } from "@/interfaces/shared/TiposIdentificadores";
import { extraerIdentificador } from "@/lib/helpers/extractors/extraerIdentificador";

// Optimized compact card component
interface ConfiguracionBoton {
  texto: string;
  colorClass: string;
}

interface EstudianteCardCompactaProps {
  estudiante: T_Estudiantes;
  aulaSeleccionada: T_Aulas | null;
  onMarcarAsistencia: (estudiante: T_Estudiantes) => void;
  yaRegistrado?: boolean;
  configuracionBoton?: ConfiguracionBoton;
}

const EstudianteCardCompacta: React.FC<EstudianteCardCompactaProps> = ({
  estudiante,
  aulaSeleccionada,
  onMarcarAsistencia,
  yaRegistrado = false,
  configuracionBoton = {
    texto: "✓ Mark",
    colorClass: "bg-green-500 hover:bg-green-600",
  },
}) => {
  const esSalida = configuracionBoton.colorClass.includes("red");

  return (
    <div
      className={`border rounded-lg p-2.5 shadow-[0_0_4px_1px_rgba(0,0,0,0.2)] hover:shadow-md transition-all duration-200 ${
        yaRegistrado
          ? "bg-green-50 border-green-200"
          : "bg-white hover:bg-gray-50"
      }`}
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: aulaSeleccionada?.Color || "#gray",
      }}
    >
      {/* Horizontal layout: Photo + Data */}
      <div className="flex items-center gap-2.5">
        {/* Photo fixed to the left */}
        <FotoPerfilClientSide
          className="aspect-square min-w-8 rounded-full object-cover"
          Google_Drive_Foto_ID={estudiante.Google_Drive_Foto_ID}
        />

        {/* Data organized in 3 rows */}
        <div className="flex-1 min-w-0">
          {/* Row 1: Full name + status */}
          <div className="flex items-center justify-between mb-1">
            <p className="font-medium text-gray-900 text-sm truncate pr-1">
              {estudiante.Nombres} {estudiante.Apellidos}
            </p>
            {yaRegistrado && (
              <span className="text-green-600 text-sm flex-shrink-0">✓</span>
            )}
          </div>

          {/* Row 2: DNI + Grade/Section in a single line */}
          <div className="flex items-center justify-start text-xs text-gray-500 mb-2 flex-wrap  gap-2">
            <span className="truncate">
              {
                TiposIdentificadoresTextos[
                  extraerTipoDeIdentificador(estudiante.Id_Estudiante)
                ]
              }
              : {extraerIdentificador(estudiante.Id_Estudiante)}
            </span>
            {aulaSeleccionada && (
              <span className="text-gray-400 ml-2 flex-shrink-0">
                {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}"
              </span>
            )}
          </div>

          {/* Row 3: Compact button */}
          <button
            onClick={() => onMarcarAsistencia(estudiante)}
            disabled={yaRegistrado}
            className={`w-full py-1.5 px-2 rounded text-xs font-medium transition-colors ${
              yaRegistrado
                ? "bg-green-100 text-green-700 cursor-not-allowed"
                : `${configuracionBoton.colorClass} text-white`
            }`}
            title={
              yaRegistrado
                ? "Already registered"
                : esSalida
                ? "Mark exit"
                : "Mark entry"
            }
          >
            {yaRegistrado ? "✓ Registered" : configuracionBoton.texto}
          </button>
        </div>
      </div>
    </div>
  );
};

interface RegistroEstudiantesSecundariaManualProps {
  handlerAuxiliar: HandlerAuxiliarAsistenciaResponse;
}

const RegistroEstudiantesSecundariaManual: React.FC<
  RegistroEstudiantesSecundariaManualProps
> = ({ handlerAuxiliar }) => {
  // States for filters and data
  const [grados, setGrados] = useState<number[]>([]);
  const [gradoSeleccionado, setGradoSeleccionado] = useState<number | null>(
    null
  );
  const [secciones, setSecciones] = useState<string[]>([]);
  const [seccionSeleccionada, setSeccionSeleccionada] = useState<string | null>(
    // Added null type
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

  // State for name search filter
  const [busquedaNombre, setBusquedaNombre] = useState<string>("");

  // State for already registered students
  const [estudiantesRegistrados, setEstudiantesRegistrados] = useState<
    Set<string>
  >(new Set());

  // Database models
  const [estudiantesIDB] = useState(() => new BaseEstudiantesIDB());
  const [aulasIDB] = useState(() => new BaseAulasIDB());

  // Function to determine the current registration mode
  const determinarModoRegistro = (): ModoRegistro => {
    if (!CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA) {
      return ModoRegistro.Entrada;
    }

    const fechaActual = handlerAuxiliar.getFechaHoraRedux();
    if (!fechaActual) return ModoRegistro.Entrada;

    const horarioSecundaria = handlerAuxiliar.getHorarioEscolarSecundaria();
    const horaActual = fechaActual;

    // Calculate the cutoff time (1 hour before official exit)
    const horaLimite = new Date(
      alterarUTCaZonaPeruana(String(horarioSecundaria.Fin))
    );
    horaLimite.setHours(
      horaLimite.getHours() -
        HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_SECUNDARIA
    );

    return horaActual < horaLimite ? ModoRegistro.Entrada : ModoRegistro.Salida;
  };

  // Function to get button configuration
  const obtenerConfiguracionBoton = () => {
    if (!CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA) {
      return {
        texto: "Mark Attendance",
        colorClass: "bg-green-500 hover:bg-green-600",
      };
    }

    const modoActual = determinarModoRegistro();
    if (modoActual === ModoRegistro.Entrada) {
      return {
        texto: "Mark Entry",
        colorClass: "bg-green-500 hover:bg-green-600",
      };
    } else {
      return {
        texto: "Mark Exit",
        colorClass: "bg-red-500 hover:bg-red-600",
      };
    }
  };

  // Load available grades on mount
  useEffect(() => {
    cargarGradosDisponibles();
  }, []);

  // Load sections when a grade is selected
  useEffect(() => {
    if (gradoSeleccionado !== null) {
      cargarSeccionesDelGrado(gradoSeleccionado);
    } else {
      setSecciones([]);
      setSeccionSeleccionada(null);
    }
  }, [gradoSeleccionado]);

  // Load students when a section is selected
  useEffect(() => {
    if (aulaSeleccionada) {
      cargarEstudiantesDelAula(aulaSeleccionada.Id_Aula);
    } else {
      setEstudiantesDelAula([]);
    }
  }, [aulaSeleccionada]);

  // Filter students by name when search or classroom students change
  useEffect(() => {
    filtrarEstudiantesPorNombre();
  }, [busquedaNombre, estudiantesDelAula]);

  // Function to load available grades
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
      console.error("Error loading grades:", error);
    }
  };

  // Function to load sections for a specific grade
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
      console.error("Error loading sections:", error);
    }
  };

  // Function to select the classroom
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
      console.error("Error selecting classroom:", error);
    }
  };

  // Function to load students from a classroom
  const cargarEstudiantesDelAula = async (idAula: string) => {
    try {
      const todosLosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
        false
      );
      const estudiantesDelAula = todosLosEstudiantes.filter(
        (estudiante) => estudiante.Id_Aula === idAula && estudiante.Estado
      );

      // Sort by surnames
      estudiantesDelAula.sort((a, b) =>
        `${a.Apellidos} ${a.Nombres}`.localeCompare(
          `${b.Apellidos} ${b.Nombres}`
        )
      );

      setEstudiantesDelAula(estudiantesDelAula);
    } catch (error) {
      console.error("Error loading students:", error);
    }
  };

  // Function to filter students by name and surname
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

  // Handle grade change
  const handleGradoChange = (grado: number) => {
    setGradoSeleccionado(grado);
    setSeccionSeleccionada(null);
    setAulaSeleccionada(null);
    setBusquedaNombre(""); // Clear search
  };

  // Handle section change
  const handleSeccionChange = (seccion: string) => {
    setSeccionSeleccionada(seccion);
    setBusquedaNombre(""); // Clear search
    if (gradoSeleccionado !== null) {
      seleccionarAula(gradoSeleccionado, seccion);
    }
  };

  // Handle search field change
  const handleBusquedaChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setBusquedaNombre(e.target.value);
  };

  // Function to mark attendance - WITH SCHEDULE CONTROL
  const marcarAsistencia = (estudiante: T_Estudiantes) => {
    const fechaActual = handlerAuxiliar.getFechaHoraRedux();
    if (!fechaActual) {
      console.error("Cannot mark attendance: current date missing");
      return;
    }

    const horarioSecundaria = handlerAuxiliar.getHorarioEscolarSecundaria();
    const horaActual = fechaActual;
    const horaEntradaOficial = new Date(
      alterarUTCaZonaPeruana(String(horarioSecundaria.Inicio))
    );
    const horaSalidaOficial = new Date(
      alterarUTCaZonaPeruana(String(horarioSecundaria.Fin))
    );

    let modoRegistro: ModoRegistro;
    let desfaseSegundos: number;

    if (CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA) {
      // Original logic with entry/exit
      const horaLimite = new Date(horaSalidaOficial);
      horaLimite.setHours(
        horaLimite.getHours() -
          HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_SECUNDARIA
      );

      modoRegistro =
        horaActual < horaLimite ? ModoRegistro.Entrada : ModoRegistro.Salida;

      if (modoRegistro === ModoRegistro.Entrada) {
        desfaseSegundos = Math.floor(
          (horaActual.getTime() - horaEntradaOficial.getTime()) / 1000
        );
      } else {
        desfaseSegundos = Math.floor(
          (horaActual.getTime() - horaSalidaOficial.getTime()) / 1000
        );
      }
    } else {
      // Only entry, always calculate offset with entry time
      modoRegistro = ModoRegistro.Entrada;
      desfaseSegundos = Math.floor(
        (horaActual.getTime() - horaEntradaOficial.getTime()) / 1000
      );
    }

    const speaker = Speaker.getInstance();
    const tipoRegistro =
      CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA &&
      modoRegistro === ModoRegistro.Salida
        ? "exit"
        : "entry";

    speaker.start(
      `${tipoRegistro} registered for ${estudiante.Nombres} ${estudiante.Apellidos}`
    );

    Asistencias_Escolares_QUEUE.enqueue({
      Id_Estudiante: estudiante.Id_Estudiante,
      Actor: ActoresSistema.Estudiante,
      desfaseSegundosAsistenciaEstudiante: desfaseSegundos,
      NivelDelEstudiante: aulaSeleccionada!.Nivel as NivelEducativo,
      Grado: aulaSeleccionada!.Grado,
      Seccion: aulaSeleccionada!.Seccion,
      ModoRegistro: modoRegistro,
      TipoAsistencia: TipoAsistencia.ParaEstudiantesSecundaria,
    });

    // Add to registered list
    const nuevosRegistrados = new Set(estudiantesRegistrados);
    nuevosRegistrados.add(estudiante.Id_Estudiante);
    setEstudiantesRegistrados(nuevosRegistrados);
  };

  // Clear all filters
  const limpiarFiltros = () => {
    setGradoSeleccionado(null);
    setSeccionSeleccionada(null);
    setAulaSeleccionada(null);
    setBusquedaNombre("");
    setEstudiantesDelAula([]);
    setEstudiantesFiltrados([]);
  };

  const configuracionBoton = obtenerConfiguracionBoton();

  return (
    <div className="w-full h-full flex items-center justify-center p-2 md:p-4">
      <div className="w-full max-w-7xl h-full max-h-[85vh] flex flex-col">
        {/* MOBILE: Vertical layout (<md) */}
        <div className="md:hidden flex flex-col h-full overflow-hidden">
          {/* ULTRA COMPACT filter panel for mobile */}
          <div className="flex-shrink-0 bg-white border-b border-green-200 p-2">
            <div className="flex justify-between items-center mb-1">
              <h3 className="text-sm font-bold text-green-800">Filters</h3>
              <button
                onClick={limpiarFiltros}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear
              </button>
            </div>

            {/* Compact grid for mobile filters */}
            <div className="grid grid-cols-2 gap-1.5 mb-2">
              {/* Grade Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Grade
                </label>
                <select
                  value={gradoSeleccionado || ""}
                  onChange={(e) => handleGradoChange(Number(e.target.value))}
                  className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500"
                >
                  <option value="">Select</option>
                  {grados.map((grado) => (
                    <option key={grado} value={grado}>
                      {grado}°
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Selector */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-0.5">
                  Section
                </label>
                <select
                  value={seccionSeleccionada || ""}
                  onChange={(e) => handleSeccionChange(e.target.value)}
                  disabled={!gradoSeleccionado}
                  className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 disabled:bg-gray-100"
                >
                  <option value="">Select</option>
                  {secciones.map((seccion) => (
                    <option key={seccion} value={seccion}>
                      {seccion}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Search field */}
            <div>
              <input
                type="text"
                value={busquedaNombre}
                onChange={handleBusquedaChange}
                disabled={!aulaSeleccionada}
                placeholder="Search student..."
                className="w-full p-1.5 border border-gray-300 rounded text-xs focus:ring-1 focus:ring-green-500 disabled:bg-gray-100"
              />
            </div>

            {/* SIMPLIFIED classroom info */}
            {aulaSeleccionada && (
              <div className="mt-1.5 p-1.5 bg-gray-50 rounded text-xs">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <span
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: aulaSeleccionada.Color }}
                    ></span>
                    <span className="font-medium">
                      {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}"
                    </span>
                  </div>
                  <div className="flex gap-2 text-xs">
                    <span className="text-blue-600">
                      {estudiantesFiltrados.length} displayed
                    </span>
                    <span className="text-green-600">
                      {estudiantesRegistrados.size} registered
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Result area with internal mobile scroll */}
          <div className="flex-1 overflow-y-auto bg-gray-50 p-2">
            {estudiantesFiltrados.length > 0 && (
              <div className="grid grid-cols-1 gap-1.5">
                {estudiantesFiltrados.map((estudiante) => (
                  <EstudianteCardCompacta
                    key={estudiante.Id_Estudiante}
                    estudiante={estudiante}
                    aulaSeleccionada={aulaSeleccionada}
                    onMarcarAsistencia={marcarAsistencia}
                    yaRegistrado={estudiantesRegistrados.has(
                      estudiante.Id_Estudiante
                    )}
                    configuracionBoton={configuracionBoton}
                  />
                ))}
              </div>
            )}

            {/* Empty states for mobile */}
            {!aulaSeleccionada && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-400">
                  <div className="aspect-square w-20 mx-auto mb-2 flex items-center justify-center bg-gray-100 rounded-full">
                    <svg
                      className="aspect-square w-14 mx-auto mb-4"
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
                  </div>
                  <h4 className="text-sm font-medium mb-1">
                    Select a classroom
                  </h4>
                  <p className="text-xs">Choose grade and section</p>
                </div>
              </div>
            )}

            {aulaSeleccionada && estudiantesDelAula.length === 0 && (
              <div className="flex items-center justify-center h-full">
                <div className="text-center text-gray-500">
                  <div className="text-2xl mb-2">👥</div>
                  <h4 className="text-sm font-medium">No students</h4>
                </div>
              </div>
            )}

            {aulaSeleccionada &&
              estudiantesDelAula.length > 0 &&
              estudiantesFiltrados.length === 0 &&
              busquedaNombre && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-yellow-600">
                    <div className="text-2xl mb-2">🔍</div>
                    <h4 className="text-sm font-medium mb-2">No results</h4>
                    <button
                      onClick={() => setBusquedaNombre("")}
                      className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-xs"
                    >
                      Show all
                    </button>
                  </div>
                </div>
              )}
          </div>
        </div>

        {/* DESKTOP: Column layout (md+) - MORE COMPACT */}
        <div className="hidden md:flex h-full">
          {/* LEFT COLUMN: NARROWER filter panel */}
          <div className="w-64 flex-shrink-0 bg-white border-r border-green-200 flex flex-col">
            {/* COMPACT panel header */}
            <div className="p-3 border-b border-gray-200">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-base font-bold text-green-800">Filters</h3>
                <button
                  onClick={limpiarFiltros}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Clear
                </button>
              </div>
            </div>

            {/* COMPACT filter form */}
            <div className="p-3 space-y-3 flex-1">
              {/* Grade Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Grade
                </label>
                <select
                  value={gradoSeleccionado || ""}
                  onChange={(e) => handleGradoChange(Number(e.target.value))}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 text-sm"
                >
                  <option value="">Select grade</option>
                  {grados.map((grado) => (
                    <option key={grado} value={grado}>
                      {grado}° Grade
                    </option>
                  ))}
                </select>
              </div>

              {/* Section Selector */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Section
                </label>
                <select
                  value={seccionSeleccionada || ""}
                  onChange={(e) => handleSeccionChange(e.target.value)}
                  disabled={!gradoSeleccionado}
                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 disabled:bg-gray-100 text-sm"
                >
                  <option value="">Select section</option>
                  {secciones.map((seccion) => (
                    <option key={seccion} value={seccion}>
                      Section {seccion}
                    </option>
                  ))}
                </select>
              </div>

              {/* Search field */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Search
                </label>
                <input
                  type="text"
                  value={busquedaNombre}
                  onChange={handleBusquedaChange}
                  disabled={!aulaSeleccionada}
                  placeholder="Name or surname..."
                  className="w-full p-2 border border-gray-300 rounded focus:ring-1 focus:ring-green-500 disabled:bg-gray-100 text-sm"
                />
              </div>

              {/* ULTRA SIMPLIFIED classroom info */}
              {aulaSeleccionada && (
                <div className="p-2 bg-gray-50 rounded border">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: aulaSeleccionada.Color }}
                      ></span>
                      <span className="text-sm font-medium">
                        {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}"
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div> {estudiantesDelAula.length} students</div>
                      <div className="flex gap-3">
                        <span className="text-blue-600">
                          Displayed: {estudiantesFiltrados.length}
                        </span>
                        <span className="text-green-600">
                          Registered: {estudiantesRegistrados.size}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Results area */}
          <div className="flex-1 flex flex-col bg-gray-50 overflow-hidden">
            {/* COMPACT results header */}
            <div className="bg-white border-b border-gray-200 p-3 flex-shrink-0">
              <div className="flex justify-between items-center">
                {aulaSeleccionada ? (
                  <div>
                    <h3 className="text-base font-bold text-green-800">
                      {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}" |{" "}
                      {estudiantesFiltrados.length} Students
                    </h3>
                  </div>
                ) : (
                  <h3 className="text-base font-bold text-gray-600">
                    Secondary Students
                  </h3>
                )}

                {estudiantesRegistrados.size > 0 && (
                  <div className="text-right">
                    <div className="text-lg font-bold text-green-700">
                      {estudiantesRegistrados.size}
                    </div>
                    <div className="text-xs text-green-600">Registered</div>
                  </div>
                )}
              </div>
            </div>

            {/* Scroll area with results */}
            <div className="flex-1 overflow-y-auto p-3">
              {estudiantesFiltrados.length > 0 && (
                <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-3">
                  {estudiantesFiltrados.map((estudiante) => (
                    <EstudianteCardCompacta
                      key={estudiante.Id_Estudiante}
                      estudiante={estudiante}
                      aulaSeleccionada={aulaSeleccionada}
                      onMarcarAsistencia={marcarAsistencia}
                      yaRegistrado={estudiantesRegistrados.has(
                        estudiante.Id_Estudiante
                      )}
                      configuracionBoton={configuracionBoton}
                    />
                  ))}
                </div>
              )}

              {/* COMPACT empty states */}
              {!aulaSeleccionada && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-400">
                    <div className="text-4xl mb-3">
                      <svg
                        className="aspect-square w-16 mx-auto mb-4"
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
                    </div>
                    <h4 className="text-lg font-medium mb-2">
                      Select a classroom
                    </h4>
                    <p className="text-gray-500">
                      Use the filter panel to choose grade and section
                    </p>
                  </div>
                </div>
              )}

              {aulaSeleccionada && estudiantesDelAula.length === 0 && (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center text-gray-500">
                    <div className="text-4xl mb-3">👥</div>
                    <h4 className="text-lg font-medium">
                      Classroom without students
                    </h4>
                  </div>
                </div>
              )}

              {aulaSeleccionada &&
                estudiantesDelAula.length > 0 &&
                estudiantesFiltrados.length === 0 &&
                busquedaNombre && (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center text-yellow-600">
                      <div className="text-4xl mb-3">🔍</div>
                      <h4 className="text-sm font-medium mb-2">
                        No results found
                      </h4>
                      <p className="text-gray-600 mb-3">
                        No matches for "
                        <strong>{busquedaNombre}</strong>"
                      </p>
                      <button
                        onClick={() => setBusquedaNombre("")}
                        className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 text-sm"
                      >
                        Show all
                      </button>
                    </div>
                  </div>
                )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegistroEstudiantesSecundariaManual;