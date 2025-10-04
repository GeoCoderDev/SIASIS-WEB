"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { EstudiantesParaResponsablesIDB } from "@/lib/utils/local/db/models/Estudiantes/EstudiantesParaResponsablesIDB";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import { EstudianteConAulaYRelacion } from "@/interfaces/shared/Estudiantes";
import { AulasParaResponsablesIDB } from "@/lib/utils/local/db/models/Aulas/AulasParaResponsable";
import { ProfesoresParaResponsablesIDB } from "@/lib/utils/local/db/models/Profesores/Para Responsables/ProfesoresParaResponsablesIDB";
import Loader from "@/components/shared/loaders/Loader";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { HandlerResponsableAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerResponsableAsistenciaResponse";
import { AsistenciasEscolaresParaResponsablesIDB } from "@/lib/utils/local/db/models/AsistenciasEscolares/Para Responsables/AsistenciasEscolaresParaResponsablesIDB";
import { DatosAsistenciaHoyIDB } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/DatosAsistenciaHoyIDB";
import {
  AsistenciaProcesada,
  DiaCalendario,
  EstadisticasMes,
  MESES,
} from "./types";

// Constante para controlar si se muestran mensajes de éxito
const MOSTRAR_MENSAJES_EXITO = false;
import { AsistenciaProcessor } from "../../../../../../lib/utils/asistencia/AsistenciasEscolaresProcessor";
import AsistenciaLeyendaDrawer from "../../../../../../components/asistencias-escolares/por-estudiante/AsistenciaEscolarLegendDrawer";
import MiEstudianteRelacionadoCard from "../../_components/MiEstudianteRelacionadoCard";
import DatosProfesorCard from "../../../../../../components/asistencias-escolares/por-estudiante/DatosProfesorDeAulaCard";
import CalendarioAsistencias from "../../../../../../components/asistencias-escolares/por-estudiante/CalendarioAsistenciaEscolarMensual";
import EstadisticasMensuales from "../../../../../../components/asistencias-escolares/por-estudiante/EstadisticasMensualesDeEstudiante";
import VolverIcon from "@/components/icons/VolverIcon";

// Interfaces para el profesor
interface ProfesorPrimariaGenericoConCelular {
  Id_Profesor_Primaria: string;
  Nombres: string;
  Apellidos: string;
  Genero: string;
  Google_Drive_Foto_ID: string | null;
  Celular: string | null;
}

interface ProfesorSecundariaGenericoConCelular {
  Id_Profesor_Secundaria: string;
  Nombres: string;
  Apellidos: string;
  Genero: string;
  Google_Drive_Foto_ID: string | null;
  Celular: string | null;
}

// Datos del aula para el profesor
interface DatosAulaProfesor {
  Nivel: NivelEducativo;
  Grado: number;
  Seccion: string;
}

const AsistenciasMensualesEstudiantesRelacionados = () => {
  const params = useParams();
  const id_estudiante = params?.Id_Estudiante as string;

  // Estados de mensajes
  const [error, setError] = useState<ErrorResponseAPIBase | null>(null);
  const [successMessage, setSuccessMessage] = useState<MessageProperty | null>(
    null
  );

  // Estados de carga individuales
  const [isLoadingEstudiante, setIsLoadingEstudiante] = useState(true);
  const [isLoadingProfesor, setIsLoadingProfesor] = useState(false);
  const [isLoadingHandler, setIsLoadingHandler] = useState(true);
  const [isLoadingAsistencias, setIsLoadingAsistencias] = useState(false);

  // Estados separados para estudiante y profesor
  const [estudiante, setEstudiante] =
    useState<EstudianteConAulaYRelacion | null>(null);
  const [profesor, setProfesor] = useState<
    | ProfesorPrimariaGenericoConCelular
    | ProfesorSecundariaGenericoConCelular
    | null
  >(null);
  const [datosAulaProfesor, setDatosAulaProfesor] =
    useState<DatosAulaProfesor | null>(null);

  // Estados para asistencias
  const [mesSeleccionado, setMesSeleccionado] = useState<number | null>(null);
  const [asistenciasDelMes, setAsistenciasDelMes] = useState<{
    [dia: number]: AsistenciaProcesada;
  }>({});

  // Estados para UI
  const [mostrarLeyenda, setMostrarLeyenda] = useState(false);
  const [vistaMovil, setVistaMovil] = useState<"calendario" | "agenda">(
    "calendario"
  ); // Nueva vista para móvil

  // Estado para el handler
  const [handlerAsistencia, setHandlerAsistencia] =
    useState<HandlerResponsableAsistenciaResponse | null>(null);

  // Instancia del modelo de asistencias
  const [asistenciasIDB, setAsistenciasIDB] =
    useState<AsistenciasEscolaresParaResponsablesIDB | null>(null);

  // Obtener el handler
  useEffect(() => {
    const obtenerHandler = async () => {
      try {
        setIsLoadingHandler(true);

        const handler =
          (await new DatosAsistenciaHoyIDB().getHandler()) as HandlerResponsableAsistenciaResponse;
        setHandlerAsistencia(handler);

        const asistenciasModel = new AsistenciasEscolaresParaResponsablesIDB(
          setIsLoadingAsistencias,
          setError,
          setSuccessMessage,
          handler
        );
        setAsistenciasIDB(asistenciasModel);
      } catch (handlerError) {
        console.error("Error al obtener handler:", handlerError);
        setError({
          success: false,
          message: "Error al inicializar el sistema de asistencias",
          errorType: "SYSTEM_ERROR" as any,
        });
      } finally {
        setIsLoadingHandler(false);
      }
    };

    obtenerHandler();
  }, []);

  // Cargar datos del estudiante
  useEffect(() => {
    const cargarEstudiante = async () => {
      if (!id_estudiante) {
        setError({
          success: false,
          message: "No se proporcionó un ID de estudiante válido",
          errorType: "USER_ERROR" as any,
        });
        setIsLoadingEstudiante(false);
        return;
      }

      try {
        setIsLoadingEstudiante(true);

        const estudiantesIDB = new EstudiantesParaResponsablesIDB(
          "API02",
          () => {}, // No usamos el loading global
          setError,
          setSuccessMessage
        );

        const aulasIDB = new AulasParaResponsablesIDB(
          "API02",
          () => {}, // No usamos el loading global
          setError,
          setSuccessMessage
        );

        // 1. Obtener estudiante
        const estudianteObtenido =
          await estudiantesIDB.obtenerMiEstudiantePorId(id_estudiante);

        if (!estudianteObtenido) {
          setError({
            success: false,
            message: "No se encontró el estudiante especificado",
            errorType: "USER_ERROR" as any,
          });
          return;
        }

        // 2. Si tiene aula, obtenerla
        if (estudianteObtenido.Id_Aula) {
          const aulaObtenida = await aulasIDB.obtenerAulaPorId(
            estudianteObtenido.Id_Aula
          );

          if (aulaObtenida) {
            // Establecer estudiante con aula
            setEstudiante({
              ...estudianteObtenido,
              aula: aulaObtenida,
            });

            // Configurar datos del aula para el profesor
            setDatosAulaProfesor({
              Nivel: aulaObtenida.Nivel as NivelEducativo,
              Grado: aulaObtenida.Grado,
              Seccion: aulaObtenida.Seccion,
            });

            // Activar carga del profesor
            setIsLoadingProfesor(true);
          } else {
            setEstudiante({
              ...estudianteObtenido,
              aula: null,
            });
            console.log("AULA NO ENCONTRADA");
          }
        } else {
          // Solo estudiante sin aula
          setEstudiante({
            ...estudianteObtenido,
            aula: null,
          });
          console.log("ESTUDIANTE SIN AULA ASIGNADA");
        }
      } catch (fetchError) {
        console.error("Error al cargar estudiante:", fetchError);
        setError({
          success: false,
          message: "Error inesperado al cargar los datos del estudiante",
          errorType: "UNKNOWN_ERROR" as any,
        });
      } finally {
        setIsLoadingEstudiante(false);
      }
    };

    cargarEstudiante();
  }, [id_estudiante]);

  // Cargar datos del profesor cuando el estudiante esté listo
  useEffect(() => {
    const cargarProfesor = async () => {
      if (!estudiante?.aula || !isLoadingProfesor) return;

      try {
        const profesoresIDB = new ProfesoresParaResponsablesIDB(
          () => {}, // No usamos el loading global
          setError,
          setSuccessMessage
        );

        // 3. Obtener profesor del aula
        let idProfesor: string | null = null;
        let nivel: NivelEducativo | null = null;

        if (
          estudiante.aula.Nivel === NivelEducativo.PRIMARIA &&
          estudiante.aula.Id_Profesor_Primaria
        ) {
          idProfesor = estudiante.aula.Id_Profesor_Primaria;
          nivel = NivelEducativo.PRIMARIA;
        } else if (
          estudiante.aula.Nivel === NivelEducativo.SECUNDARIA &&
          estudiante.aula.Id_Profesor_Secundaria
        ) {
          idProfesor = estudiante.aula.Id_Profesor_Secundaria;
          nivel = NivelEducativo.SECUNDARIA;
        }

        if (idProfesor && nivel) {
          const profesorResult =
            await profesoresIDB.consultarDatosBasicosDeProfesor(
              idProfesor,
              nivel
            );

          if (profesorResult.success && profesorResult.data) {
            // Establecer profesor con tipado correcto
            const profesorConCelular = {
              ...profesorResult.data,
              Celular: profesorResult.data.Celular || null,
            };
            setProfesor(profesorConCelular);
          }
        }
      } catch (fetchError) {
        console.error("Error al cargar profesor:", fetchError);
        // No mostrar error crítico por el profesor
      } finally {
        setIsLoadingProfesor(false);
      }
    };

    cargarProfesor();
  }, [estudiante, isLoadingProfesor]);

  // Cargar asistencias cuando se selecciona un mes
  useEffect(() => {
    if (mesSeleccionado && estudiante?.aula && asistenciasIDB) {
      cargarAsistenciasMes();
    }
  }, [mesSeleccionado, estudiante, asistenciasIDB]);

  const cargarAsistenciasMes = async () => {
    if (!mesSeleccionado || !estudiante?.aula || !asistenciasIDB) return;

    try {
      setIsLoadingAsistencias(true);
      setAsistenciasDelMes({});

      const resultado = await asistenciasIDB.consultarAsistenciasMensuales(
        estudiante,
        mesSeleccionado
      );

      if (resultado.data && resultado.data.Asistencias) {
        const asistenciasProcesadas =
          AsistenciaProcessor.procesarAsistenciasDelServidor(
            resultado.data.Asistencias,
            nivel,
            handlerAsistencia!
          );
        setAsistenciasDelMes(asistenciasProcesadas);

        if (Object.keys(asistenciasProcesadas).length > 0) {
          setError(null);
        }
      }

      if (resultado.requiereEspera && resultado.data) {
        setSuccessMessage({
          message: `Datos mostrados desde cache. ${
            resultado.message ||
            "Próxima actualización disponible en unos minutos."
          }`,
        });
      } else if (!resultado.success && !resultado.data) {
        setError({
          success: false,
          message: resultado.message || "No se pudieron cargar las asistencias",
          errorType: "NETWORK_ERROR" as any,
        });
      }
    } catch (error) {
      console.error("Error al cargar asistencias:", error);

      if (Object.keys(asistenciasDelMes).length === 0) {
        setError({
          success: false,
          message: "Error de conexión. Verifique su internet.",
          errorType: "NETWORK_ERROR" as any,
        });
      } else {
        setSuccessMessage({
          message: "Mostrando datos guardados. Error de conexión temporal.",
        });
      }
    } finally {
      setIsLoadingAsistencias(false);
    }
  };

  // Funciones utilitarias
  const obtenerMesInfo = (valor: number) => {
    return MESES.find((m: any) => m.value === valor);
  };

  const obtenerMesesDisponibles = () => {
    const fechaActual = new Date();
    const mesActual = fechaActual.getMonth() + 1; // getMonth() retorna 0-11, necesitamos 1-12

    // Filtrar meses desde marzo (3) hasta el mes actual
    return MESES.filter((mes: any) => mes.value >= 3 && mes.value <= mesActual);
  };

  const obtenerDias = (): DiaCalendario[] => {
    if (!mesSeleccionado) return [];
    return AsistenciaProcessor.obtenerDiasDelMes(
      mesSeleccionado,
      asistenciasDelMes
    );
  };

  const obtenerEstadisticas = (): EstadisticasMes => {
    return AsistenciaProcessor.calcularEstadisticasMes(asistenciasDelMes);
  };

  const obtenerHorarioEscolar = () => {
    if (!estudiante?.aula?.Nivel || !handlerAsistencia) return undefined;

    const nivel =
      estudiante.aula.Nivel === NivelEducativo.PRIMARIA
        ? NivelEducativo.PRIMARIA
        : NivelEducativo.SECUNDARIA;
    return AsistenciaProcessor.obtenerHorarioEscolar(nivel, handlerAsistencia);
  };

  // Verificar si hay error crítico
  const hayErrorCritico = error && error.message?.includes("ID de estudiante");

  if (hayErrorCritico) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-red-600 mb-4">
            <svg
              className="w-16 h-16 mx-auto mb-4"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <p className="text-lg font-semibold mb-2">Error al cargar datos</p>
          <p className="text-gray-600 mb-4 text-sm">{error.message}</p>
          <button
            onClick={() => {
              setError(null);
              window.location.reload();
            }}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
          >
            Intentar nuevamente
          </button>
        </div>
      </div>
    );
  }

  const dias = obtenerDias();
  const estadisticas = obtenerEstadisticas();
  const mesInfo = mesSeleccionado ? obtenerMesInfo(mesSeleccionado) : null;
  const horarioEscolar = obtenerHorarioEscolar();
  const nivel = estudiante?.aula?.Nivel! as NivelEducativo;

  return (
    <div className="bg-gray-50 min-h-fit flex flex-col m-4">
      {/* Header con diseño responsivo */}
      <div className="py-3 px-2 flex-shrink-0">
        <div className="container mx-auto max-w-7xl">
          {/* Layout Desktop: botón izquierda, título centrado absoluto */}
          <div className="hidden lg:flex items-center justify-between mb-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => window.history.back()}
                className="bg-black text-white items-center flex gap-2 p-2 py-1 rounded-[10px] transition-colors text-[0.95rem]"
              >
                <VolverIcon className="w-5 sxs-only:w-4 xs-only:w-4 sm-only:w-4 md-only:w-4 lg-only:w-3 xl-only:w-4" />{" "}
                Volver
              </button>
            </div>

            {/* Título centrado absoluto para desktop */}
            <h1 className="text-2xl font-bold text-gray-800 absolute left-1/2 transform -translate-x-1/2">
              ASISTENCIAS MENSUALES
            </h1>
          </div>

          {/* Layout Móvil: botón centrado arriba, título centrado abajo */}
          <div className="lg:hidden">
            {/* Botón volver centrado */}
            <div className="flex justify-center mb-3">
              <button
                onClick={() => window.history.back()}
                className="bg-black text-white items-center flex gap-2 p-2 py-1 rounded-[10px] transition-colors text-[0.95rem]"
              >
                <VolverIcon className="w-5 sxs-only:w-4 xs-only:w-4 sm-only:w-4 md-only:w-4" />{" "}
                Volver
              </button>
            </div>

            {/* Título centrado */}
            <div className="text-center">
              <h1 className="text-2xl font-bold text-gray-800">
                ASISTENCIAS MENSUALES
              </h1>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto max-w-7xl px-4 flex-1 flex items-start justify-center">
        {/* Layout principal horizontal - Desktop */}
        <div className="hidden lg:grid lg:grid-cols-4 gap-3 w-full">
          {/* Sección izquierda: Card estudiante + Datos docente (25%) */}
          <div className="space-y-3 flex flex-col items-center justify-center">
            {/* Card del estudiante */}
            {isLoadingEstudiante ? (
              <div className="bg-white rounded-lg shadow-md p-4 flex items-center justify-center">
                <div className="flex items-center gap-2">
                  <Loader className="w-5 h-5" />
                  <p className="text-sm text-gray-600">
                    Cargando estudiante...
                  </p>
                </div>
              </div>
            ) : estudiante ? (
              <MiEstudianteRelacionadoCard
                miEstudianteRelacionado={estudiante}
                minimizado={true}
              />
            ) : (
              <div className="bg-white rounded-lg shadow-md p-4 text-center">
                <p className="text-sm text-gray-600">
                  No se encontró el estudiante
                </p>
              </div>
            )}

            {/* Datos del profesor */}
            <DatosProfesorCard
              profesor={profesor}
              aula={datosAulaProfesor}
              isLoadingData={isLoadingEstudiante || isLoadingProfesor}
            />
          </div>

          {/* Sección central: Selector + Calendario (50%) */}
          <div className="col-span-2 space-y-3">
            {/* Selector de mes con horario */}
            <div className="bg-white rounded-lg shadow-md p-3">
              {isLoadingHandler ? (
                <div className="flex items-center gap-3">
                  <Loader className="w-4 h-4" />
                  <span className="text-sm text-gray-600">
                    Inicializando sistema...
                  </span>
                </div>
              ) : (
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-sm font-medium text-gray-700">
                    Mes:
                  </label>
                  <select
                    value={mesSeleccionado || ""}
                    onChange={(e) =>
                      setMesSeleccionado(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm min-w-36 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccionar mes</option>
                    {obtenerMesesDisponibles().map((mes: any) => (
                      <option key={mes.value} value={mes.value}>
                        {mes.label}
                      </option>
                    ))}
                  </select>

                  {horarioEscolar && (
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">Horario:</span>{" "}
                      {horarioEscolar.inicio} - {horarioEscolar.fin}
                    </div>
                  )}

                  <button
                    onClick={() => setMostrarLeyenda(true)}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Leyenda
                  </button>
                </div>
              )}
            </div>

            {/* Mensajes de éxito/error debajo del formulario */}
            {MOSTRAR_MENSAJES_EXITO && successMessage && (
              <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-sm">
                <div className="flex items-start gap-2">
                  <svg
                    className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5"
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

            {error && !hayErrorCritico && (
              <div className="bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2 rounded-lg text-sm">
                <div className="flex items-start gap-2">
                  <svg
                    className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <div className="flex-1">
                    <p className="font-medium">Aviso</p>
                    <p>{error.message}</p>
                    <button
                      onClick={() => setError(null)}
                      className="text-xs text-orange-700 hover:text-orange-800 underline mt-1"
                    >
                      Cerrar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Calendario */}
            <div className="flex-1">
              {mesSeleccionado && mesInfo ? (
                <CalendarioAsistencias
                  dias={dias}
                  mesNombre={mesInfo.label}
                  nivel={nivel}
                  isLoading={isLoadingAsistencias}
                  vistaMovil={vistaMovil}
                  onCambiarVista={setVistaMovil}
                />
              ) : (
                <div className="bg-white rounded-lg shadow-md p-6 text-center flex items-center justify-center min-h-[350px]">
                  <div>
                    <div className="text-gray-400 mb-3">
                      <svg
                        className="w-12 h-12 mx-auto"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-600 text-sm">
                      Seleccione un mes para ver las asistencias del estudiante
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Sección derecha: Estadísticas (25%) */}
          <div className="bg-white rounded-lg shadow-md p-3 max-h-fit">
            {mesSeleccionado &&
            mesInfo &&
            Object.keys(asistenciasDelMes).length > 0 ? (
              <EstadisticasMensuales
                estadisticas={estadisticas}
                mesNombre={mesInfo.label}
              />
            ) : (
              <div className="h-32 flex items-center justify-center">
                <p className="text-gray-500 text-sm text-center">
                  Seleccione un mes para ver las estadísticas
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Layout móvil - Apilado verticalmente */}
        <div className="lg:hidden space-y-3 w-full flex flex-col items-center justify-center">
          {/* Card del estudiante */}
          {isLoadingEstudiante ? (
            <div className="bg-white rounded-lg shadow-md p-4 flex items-center justify-center">
              <div className="flex items-center gap-2">
                <Loader className="w-5 h-5" />
                <p className="text-sm text-gray-600">Cargando estudiante...</p>
              </div>
            </div>
          ) : estudiante ? (
            <MiEstudianteRelacionadoCard
              miEstudianteRelacionado={estudiante}
              minimizado={true}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-md p-4 text-center">
              <p className="text-sm text-gray-600">
                No se encontró el estudiante
              </p>
            </div>
          )}

          {/* Datos del profesor */}
          <DatosProfesorCard
            profesor={profesor}
            aula={datosAulaProfesor}
            isLoadingData={isLoadingEstudiante || isLoadingProfesor}
          />

          {/* Selector de mes con horario */}
          <div className="bg-white rounded-lg shadow-md p-3">
            {isLoadingHandler ? (
              <div className="flex items-center gap-3">
                <Loader className="w-4 h-4" />
                <span className="text-sm text-gray-600">
                  Inicializando sistema...
                </span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="text-sm font-medium text-gray-700">
                    Mes:
                  </label>
                  <select
                    value={mesSeleccionado || ""}
                    onChange={(e) =>
                      setMesSeleccionado(
                        e.target.value ? parseInt(e.target.value) : null
                      )
                    }
                    className="px-3 py-2 border border-gray-300 rounded-md text-sm min-w-36 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Seleccionar mes</option>
                    {obtenerMesesDisponibles().map((mes: any) => (
                      <option key={mes.value} value={mes.value}>
                        {mes.short}
                      </option>
                    ))}
                  </select>

                  <button
                    onClick={() => setMostrarLeyenda(true)}
                    className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1 transition-colors"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                        clipRule="evenodd"
                      />
                    </svg>
                    Leyenda
                  </button>
                </div>

                {horarioEscolar && (
                  <div className="text-sm text-gray-600">
                    <span className="font-medium">Horario:</span>{" "}
                    {horarioEscolar.inicio} - {horarioEscolar.fin}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mensajes de éxito/error debajo del formulario */}
          {MOSTRAR_MENSAJES_EXITO && successMessage && (
            <div className="bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5"
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

          {error && !hayErrorCritico && (
            <div className="bg-orange-50 border border-orange-200 text-orange-800 px-3 py-2 rounded-lg text-sm">
              <div className="flex items-start gap-2">
                <svg
                  className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                    clipRule="evenodd"
                  />
                </svg>
                <div className="flex-1">
                  <p className="font-medium">Aviso</p>
                  <p>{error.message}</p>
                  <button
                    onClick={() => setError(null)}
                    className="text-xs text-orange-700 hover:text-orange-800 underline mt-1"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Estadísticas mensuales - Solo mostrar si hay datos */}
          {mesSeleccionado &&
            mesInfo &&
            Object.keys(asistenciasDelMes).length > 0 && (
              <div className="bg-white rounded-lg shadow-md p-3">
                <EstadisticasMensuales
                  estadisticas={estadisticas}
                  mesNombre={mesInfo.label}
                />
              </div>
            )}

          {/* Calendario */}
          {mesSeleccionado && mesInfo ? (
            <CalendarioAsistencias
              dias={dias}
              mesNombre={mesInfo.label}
              nivel={nivel}
              isLoading={isLoadingAsistencias}
              vistaMovil={vistaMovil}
              onCambiarVista={setVistaMovil}
            />
          ) : (
            <div className="bg-white rounded-lg shadow-md p-6 text-center">
              <div className="text-gray-400 mb-3">
                <svg
                  className="w-12 h-12 mx-auto"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path
                    fillRule="evenodd"
                    d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z"
                    clipRule="evenodd"
                  />
                </svg>
              </div>
              <p className="text-gray-600 text-sm">
                Seleccione un mes para ver las asistencias del estudiante
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Drawer de leyenda */}
      <AsistenciaLeyendaDrawer
        isOpen={mostrarLeyenda}
        onClose={() => setMostrarLeyenda(false)}
        mostrarSalida={
          nivel ? AsistenciaProcessor.debeMostrarSalida(nivel) : false
        }
      />
    </div>
  );
};

export default AsistenciasMensualesEstudiantesRelacionados;
