"use client";

import { useEffect, useState } from "react";
import { useSelector } from "react-redux";
import { RootState } from "@/global/store";
import { HandlerAuxiliarAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerAuxiliarAsistenciaResponse";

import { T_Estudiantes, T_Aulas } from "@prisma/client";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";

import { alterarUTCaZonaPeruana } from "@/lib/helpers/alteradores/alterarUTCaZonaPeruana";
import { HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS } from "@/constants/HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS";
import { tiempoRestanteHasta } from "@/lib/calc/time/tiempoRestanteHasta";
import { DatosAsistenciaHoyIDB } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/DatosAsistenciaHoyIDB";
import { DiasSemana, diasSemanaTextos } from "@/interfaces/shared/DiasSemana";
import { Meses, mesesTextos } from "@/interfaces/shared/Meses";

// Iconos
import PlayIcon from "@/components/icons/thinStyle/PlayIcon";
import ThinCalendarIcon from "@/components/icons/thinStyle/ThinCalendarIcon";
import ThinRelojNonfillIcon from "@/components/icons/thinStyle/ThinRelojNonfillIcon";
import ThinLoader from "@/components/icons/thinStyle/ThinLoader";
import ThinInformationIcon from "@/components/icons/thinStyle/ThinInformationIcon";

import { ENTORNO } from "@/constants/ENTORNO";
import { Entorno } from "@/interfaces/shared/Entornos";
import { BaseEstudiantesIDB } from "@/lib/utils/local/db/models/Estudiantes/EstudiantesBaseIDB";
import { BaseAulasIDB } from "@/lib/utils/local/db/models/Aulas/AulasBase";
import FullScreenModalAsistenciaEstudiantesSecundaria from "@/components/asistencia-estudiantes-secundaria/FullScreenModalAsistenciaEstudiantesSecundaria";

// Función auxiliar para formatear hora correctamente
const formatearHora12 = (fecha: Date): string => {
  return fecha.toLocaleTimeString("es-PE", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: "America/Lima",
  });
};

const TomarAsistenciaEstudiantesSecundaria = () => {
  const [showModal, setShowModal] = useState(ENTORNO === Entorno.LOCAL);

  const fechaHoraActual = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal
  );

  const [handlerAuxiliar, setHandlerAuxiliar] =
    useState<HandlerAuxiliarAsistenciaResponse | null>(null);

  // Estados para datos de estudiantes y aulas
  const [totalEstudiantes, setTotalEstudiantes] = useState<number>(0);
  const [totalAulas, setTotalAulas] = useState<number>(0);
  const [estudiantesSecundaria, setEstudiantesSecundaria] = useState<
    T_Estudiantes[]
  >([]);
  const [aulasSecundaria, setAulasSecundaria] = useState<T_Aulas[]>([]);

  const [sincronizando, setSincronizando] = useState(false);
  const [modoFinDeSemana, setModoFinDeSemana] = useState(false);

  const [isLoading, setIsLoading] = useState(true);

  // Modelos para estudiantes y aulas
  const [estudiantesIDB] = useState(() => new BaseEstudiantesIDB());
  const [aulasIDB] = useState(() => new BaseAulasIDB());

  const getDataAsistence = async () => {
    setSincronizando(true);
    setHandlerAuxiliar(null);

    try {
      const datosAsistenciaHoyAuxiliarIDB = new DatosAsistenciaHoyIDB();

      const handlerAuxiliarResponse =
        await datosAsistenciaHoyAuxiliarIDB.getHandler();

      setHandlerAuxiliar(
        handlerAuxiliarResponse as HandlerAuxiliarAsistenciaResponse
      );
    } catch (error) {
      console.error("Error al obtener datos de asistencia:", error);
    } finally {
      setSincronizando(false);
    }
  };

  // Cargar datos de estudiantes y aulas
  const cargarEstudiantesYAulas = async () => {
    try {
      // Obtener todas las aulas de secundaria
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aulasSecundariaObtenidas = todasLasAulas.filter(
        (aula) => aula.Nivel === NivelEducativo.SECUNDARIA
      );
      setAulasSecundaria(aulasSecundariaObtenidas);
      setTotalAulas(aulasSecundariaObtenidas.length);

      // Obtener estudiantes de secundaria
      const idsAulasSecundaria = aulasSecundariaObtenidas.map(
        (aula) => aula.Id_Aula
      );

      if (idsAulasSecundaria.length > 0) {
        const todosLosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
          false
        );

        const estudiantesSecundaria = todosLosEstudiantes.filter(
          (estudiante) =>
            estudiante.Id_Aula &&
            idsAulasSecundaria.includes(estudiante.Id_Aula)
        );

        setEstudiantesSecundaria(estudiantesSecundaria);
        setTotalEstudiantes(estudiantesSecundaria.length);
      }
    } catch (error) {
      console.error("Error al cargar estudiantes y aulas:", error);
    }
  };

  // Verificamos si ya pasó la hora de actualización de datos (5:05 AM)
  const haySincronizacionDatos =
    Number(fechaHoraActual.utilidades?.hora) >=
    HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS;

  // Carga inicial al montar el componente
  useEffect(() => {
    if (!fechaHoraActual.inicializado) return;

    getDataAsistence();
    cargarEstudiantesYAulas();
  }, [fechaHoraActual.inicializado]);

  // Efecto para verificar si necesitamos actualizar los datos cuando cambia el día
  useEffect(() => {
    if (!handlerAuxiliar || !fechaHoraActual.utilidades) return;

    const fechaDatosAsistencia = new Date(handlerAuxiliar.getFechaLocalPeru());
    const diaDatosAsistencia = fechaDatosAsistencia.getDate();
    const diaActual = fechaHoraActual.utilidades.diaMes;

    const esFinDeSemana = fechaHoraActual.utilidades.esFinDeSemana;
    setModoFinDeSemana(esFinDeSemana);

    if (
      haySincronizacionDatos &&
      diaDatosAsistencia !== diaActual &&
      !esFinDeSemana &&
      handlerAuxiliar.esDiaValidoParaClases()
    ) {
      console.log("Detectado cambio de día, actualizando datos...");
      getDataAsistence();
      cargarEstudiantesYAulas();
    }
  }, [haySincronizacionDatos, handlerAuxiliar, fechaHoraActual.utilidades]);

  // Procesamos los horarios efectivos
  const horarioEfectivo = handlerAuxiliar?.getHorarioEfectivoSecundaria();

  // Debug para ver los horarios
  useEffect(() => {
    if (horarioEfectivo) {
      console.log("🔍 DEBUG HORARIOS EFECTIVOS:");
      console.log("Inicio Efectivo:", horarioEfectivo.inicioEfectivo);
      console.log("Fin Efectivo:", horarioEfectivo.finEfectivo);
      console.log("Inicio Oficial:", horarioEfectivo.inicioOficial);
      console.log("Fin Oficial:", horarioEfectivo.finOficial);
      console.log(
        "Hora formateada fin efectivo:",
        formatearHora12(horarioEfectivo.finEfectivo)
      );
      console.log(
        "Hora formateada fin oficial:",
        formatearHora12(horarioEfectivo.finOficial)
      );
    }
  }, [horarioEfectivo]);

  const tiempoRestanteParaInicio = useSelector((state: RootState) =>
    handlerAuxiliar && horarioEfectivo
      ? tiempoRestanteHasta(
          { fechaHoraActualReal: state.others.fechaHoraActualReal },
          horarioEfectivo.inicioEfectivo
        )
      : null
  );

  const tiempoRestanteParaCierre = useSelector((state: RootState) =>
    handlerAuxiliar && horarioEfectivo
      ? tiempoRestanteHasta(
          { fechaHoraActualReal: state.others.fechaHoraActualReal },
          horarioEfectivo.finEfectivo
        )
      : null
  );

  // Función para formatear la fecha actual
  const formatearFechaActual = () => {
    if (!fechaHoraActual?.fechaHora) return "Cargando fecha...";

    const fecha = new Date(fechaHoraActual.fechaHora);
    return `${
      diasSemanaTextos[fecha.getDay() as DiasSemana]
    } ${fecha.getDate()} de ${
      mesesTextos[(fecha.getMonth() + 1) as Meses]
    } de ${fecha.getFullYear()}`;
  };

  // Función para formatear fecha de evento
  const formatearFechaEvento = (fecha: Date) => {
    const fechaObj = new Date(alterarUTCaZonaPeruana(String(fecha)));
    return `${fechaObj.getDate()} de ${
      mesesTextos[(fechaObj.getMonth() + 1) as Meses]
    } de ${fechaObj.getFullYear()}`;
  };

  const iniciarOContinuarTomaAsistencia = async () => {
    console.log(
      "Iniciando toma de asistencia para estudiantes de secundaria..."
    );
    setShowModal(true);
  };

  const determinarEstadoSistema = () => {
    // Verificar si es un día válido para clases de estudiantes
    if (handlerAuxiliar && !handlerAuxiliar.esDiaValidoParaClases()) {
      const infoRestriccion = handlerAuxiliar.getInfoRestriccionClases();

      if (infoRestriccion.motivo === "evento") {
        const evento = infoRestriccion.detalles;
        return {
          estado: "evento",
          mensaje: "No hay clases hoy",
          descripcion: `Hoy es "${evento.Nombre}", no hay clases para estudiantes.`,
          tiempoRestante: null,
          botonActivo: false,
          colorEstado: "bg-purple-50",
          mostrarContadores: false,
          nombreEvento: evento.Nombre,
          fechaInicio: evento.Fecha_Inicio,
          fechaConclusion: evento.Fecha_Conclusion,
        };
      } else if (infoRestriccion.motivo === "vacaciones_interescolares") {
        return {
          estado: "vacaciones",
          mensaje: "Vacaciones interescolares",
          descripcion:
            "Los estudiantes están en período de vacaciones interescolares.",
          tiempoRestante: null,
          botonActivo: false,
          colorEstado: "bg-blue-50",
          mostrarContadores: false,
        };
      } else if (infoRestriccion.motivo === "semana_gestion") {
        return {
          estado: "semana_gestion",
          mensaje: "Semana de gestión",
          descripcion:
            "Los estudiantes no tienen clases durante la semana de gestión.",
          tiempoRestante: null,
          botonActivo: false,
          colorEstado: "bg-yellow-50",
          mostrarContadores: false,
        };
      }
    }

    // Si estamos sincronizando
    if (sincronizando) {
      return {
        estado: "sincronizando",
        mensaje: "Sincronizando sistema...",
        descripcion: "Actualizando información para la jornada escolar",
        tiempoRestante: null,
        botonActivo: false,
        colorEstado: "bg-blue-100",
        mostrarContadores: false,
      };
    }

    // Si no tenemos datos aún
    if (
      !handlerAuxiliar ||
      !horarioEfectivo ||
      !tiempoRestanteParaInicio ||
      !tiempoRestanteParaCierre ||
      !fechaHoraActual.utilidades
    ) {
      return {
        estado: "cargando",
        mensaje: "Cargando información...",
        descripcion: "Preparando datos para la toma de asistencia...",
        tiempoRestante: null,
        botonActivo: false,
        colorEstado: "bg-gray-100",
        mostrarContadores: false,
      };
    }

    // Si es fin de semana
    if (fechaHoraActual.utilidades.esFinDeSemana || modoFinDeSemana) {
      return {
        estado: "no_disponible",
        mensaje: "No hay clases hoy",
        descripcion:
          "Hoy es fin de semana, no hay clases para estudiantes de secundaria.",
        tiempoRestante: null,
        botonActivo: false,
        colorEstado: "bg-gray-100",
        mostrarContadores: false,
      };
    }

    // Verificar si es un nuevo día pero aún no es hora de sincronizar
    const fechaActual = new Date(fechaHoraActual.fechaHora!);
    const fechaDatosAsistencia = new Date(handlerAuxiliar.getFechaLocalPeru());
    const esNuevoDia = fechaDatosAsistencia.getDate() !== fechaActual.getDate();

    if (esNuevoDia && !haySincronizacionDatos) {
      return {
        estado: "preparando",
        mensaje: "Datos pendientes de actualización",
        descripcion: `Los datos se actualizarán a partir de las ${HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS}:00.`,
        tiempoRestante: null,
        botonActivo: false,
        colorEstado: "bg-blue-50",
        mostrarContadores: false,
      };
    }

    // Si aún no es hora de inicio
    if (!tiempoRestanteParaInicio.yaVencido) {
      return {
        estado: "pendiente",
        mensaje: "En espera para iniciar",
        descripcion: `La toma de asistencia estará disponible en ${tiempoRestanteParaInicio.formateado}.`,
        tiempoRestante: tiempoRestanteParaInicio.formateado,
        botonActivo: false,
        colorEstado: "bg-orange-50",
        mostrarContadores: true,
        etiquetaEstudiantes: "Estudiantes de secundaria",
        etiquetaAulas: "Aulas de secundaria",
      };
    }

    // Si ya pasó la hora de cierre
    if (tiempoRestanteParaCierre.yaVencido) {
      return {
        estado: "cerrado",
        mensaje: "Toma de asistencia cerrada",
        descripcion: `El período de registro finalizó a las ${formatearHora12(
          horarioEfectivo.finEfectivo
        )}`,
        tiempoRestante: null,
        botonActivo: false,
        colorEstado: "bg-red-50",
        mostrarContadores: true,
        etiquetaEstudiantes: "Total estudiantes",
        etiquetaAulas: "Total aulas",
      };
    }

    // Sistema disponible para tomar asistencia
    return {
      estado: "disponible",
      mensaje: "Sistema listo para tomar asistencia",
      descripcion: `Período disponible hasta las ${formatearHora12(
        horarioEfectivo.finEfectivo
      )}`,
      tiempoRestante: tiempoRestanteParaCierre.formateado,
      botonActivo: true,
      colorEstado: "bg-green-50",
      mostrarContadores: true,
      etiquetaEstudiantes: "Estudiantes pendientes",
      etiquetaAulas: "Aulas de secundaria",
      tiempoDisponible: tiempoRestanteParaCierre.formateado,
    };
  };

  const estadoSistema = determinarEstadoSistema();

  return (
    <>
      {showModal && handlerAuxiliar && (
        <FullScreenModalAsistenciaEstudiantesSecundaria
          fechaHoraActual={fechaHoraActual}
          closeFullScreenModal={() => setShowModal(false)}
          handlerAuxiliar={handlerAuxiliar}
          totalEstudiantes={totalEstudiantes}
          totalAulas={totalAulas}
          tiempoRestante={tiempoRestanteParaCierre}
        />
      )}

      <div
        className={`w-full max-w-5xl mx-auto scale-80 transform origin-top ${
          showModal && "transition-all hidden overflow-hidden"
        }`}
      >
        {/* Título - más compacto */}
        <div className="text-center mb-2">
          <h1 className="text-lg sm:text-xl md:text-2xl font-semibold text-green-800">
            🎓 Asistencia de Estudiantes - Secundaria
          </h1>
          <p className="text-xs sm:text-sm text-green-600">
            Registre la asistencia de estudiantes de secundaria de forma
            eficiente
          </p>
        </div>

        {/* Cards de información - optimizada para horizontal */}
        <div className="mb-3">
          <div
            className={`grid gap-2 ${
              // Breakpoints optimizados para aprovechar espacio horizontal
              estadoSistema.mostrarContadores
                ? "grid-cols-2 sm:grid-cols-4 lg:grid-cols-4" // 4 cards cuando hay contadores
                : "grid-cols-2 sm:grid-cols-2 lg:grid-cols-2" // 2 cards básicos
            }`}
          >
            {/* Fecha actual - más compacta */}
            <div className="bg-green-50 rounded-lg p-2 flex items-center border border-green-200">
              <div className="bg-white p-1.5 rounded-full mr-2 shadow-sm">
                <ThinCalendarIcon className="w-4 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-green-700 font-medium truncate">
                  Fecha
                </p>
                <p className="text-xs font-bold text-gray-800 truncate">
                  {formatearFechaActual()}
                </p>
              </div>
            </div>

            {/* Estado del sistema - más compacto */}
            <div
              className={`${estadoSistema.colorEstado} rounded-lg p-2 flex items-center border border-green-200`}
            >
              <div className="bg-white p-1.5 rounded-full mr-2 shadow-sm">
                <ThinRelojNonfillIcon className="w-4 text-green-600" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-green-700 font-medium truncate">
                  Estado
                </p>
                <div className="text-xs font-bold text-gray-800">
                  {estadoSistema.estado === "sincronizando" ||
                  estadoSistema.estado === "cargando" ? (
                    <span className="flex items-center">
                      <span className="truncate">
                        {estadoSistema.estado === "sincronizando"
                          ? "Sincronizando..."
                          : "Cargando..."}
                      </span>
                      <ThinLoader className="ml-1 w-3 text-green-600 flex-shrink-0" />
                    </span>
                  ) : estadoSistema.estado === "disponible" ? (
                    "Listo"
                  ) : estadoSistema.estado === "pendiente" ? (
                    "Esperando"
                  ) : estadoSistema.estado === "cerrado" ? (
                    "Cerrado"
                  ) : estadoSistema.estado === "evento" ? (
                    "Festivo"
                  ) : estadoSistema.estado === "vacaciones" ? (
                    "Vacaciones"
                  ) : estadoSistema.estado === "semana_gestion" ? (
                    "Gestión"
                  ) : (
                    "No disponible"
                  )}
                </div>
              </div>
            </div>

            {/* Contadores condicionales - más compactos */}
            {estadoSistema.mostrarContadores && (
              <>
                {/* Estudiantes */}
                <div className="bg-emerald-50 rounded-lg p-2 flex items-center border border-emerald-200">
                  <div className="bg-white p-1.5 rounded-full mr-2 shadow-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-emerald-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 14l9-5-9-5-9 5 9 5z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-emerald-700 font-medium truncate">
                      Estudiantes
                    </p>
                    <p className="text-xs font-bold text-gray-800">
                      {totalEstudiantes}
                    </p>
                  </div>
                </div>

                {/* Aulas */}
                <div className="bg-teal-50 rounded-lg p-2 flex items-center border border-teal-200">
                  <div className="bg-white p-1.5 rounded-full mr-2 shadow-sm">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-teal-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs text-teal-700 font-medium truncate">
                      Aulas
                    </p>
                    <p className="text-xs font-bold text-gray-800">
                      {totalAulas}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Panel principal - más compacto */}
        <div className="bg-white rounded-lg border-2 border-green-200 overflow-hidden shadow-sm">
          {/* Encabezado de estado - más compacto */}
          <div
            className={`p-2.5 ${
              estadoSistema.estado === "disponible"
                ? "bg-green-500 text-white"
                : estadoSistema.estado === "pendiente"
                ? "bg-orange-500 text-white"
                : estadoSistema.estado === "cerrado"
                ? "bg-red-500 text-white"
                : estadoSistema.estado === "preparando" ||
                  estadoSistema.estado === "sincronizando"
                ? "bg-blue-500 text-white"
                : estadoSistema.estado === "evento"
                ? "bg-purple-500 text-white"
                : estadoSistema.estado === "vacaciones"
                ? "bg-cyan-500 text-white"
                : estadoSistema.estado === "semana_gestion"
                ? "bg-yellow-500 text-white"
                : "bg-gray-500 text-white"
            }`}
          >
            <h2 className="text-sm font-bold">{estadoSistema.mensaje}</h2>
            <p className="opacity-90 text-xs">{estadoSistema.descripcion}</p>
          </div>

          {/* Contenido principal - optimizado */}
          <div className="p-3">
            {/* Mensaje informativo - más compacto */}
            <div
              className={`flex items-start p-2.5 rounded-lg text-sm border-l-4 ${
                estadoSistema.estado === "disponible"
                  ? "bg-green-50 text-green-800 border-green-500"
                  : estadoSistema.estado === "pendiente"
                  ? "bg-orange-50 text-orange-800 border-orange-500"
                  : estadoSistema.estado === "cerrado"
                  ? "bg-red-50 text-red-800 border-red-500"
                  : estadoSistema.estado === "evento"
                  ? "bg-purple-50 text-purple-800 border-purple-500"
                  : estadoSistema.estado === "vacaciones"
                  ? "bg-cyan-50 text-cyan-800 border-cyan-500"
                  : "bg-gray-50 text-gray-800 border-gray-500"
              }`}
            >
              <ThinInformationIcon className="w-4 mr-2 flex-shrink-0 text-current mt-0.5" />
              <div className="text-xs leading-relaxed">
                {estadoSistema.estado === "disponible" && (
                  <span>
                    Sistema listo para registrar{" "}
                    <strong>{totalEstudiantes} estudiantes</strong> en{" "}
                    <strong>{totalAulas} aulas</strong>. Disponible hasta las{" "}
                    <strong>
                      {horarioEfectivo
                        ? formatearHora12(horarioEfectivo.finEfectivo)
                        : "cargando..."}
                    </strong>
                    .
                  </span>
                )}
                {estadoSistema.estado === "pendiente" && (
                  <span>
                    Iniciará en <strong>{estadoSistema.tiempoRestante}</strong>.
                    Sistema preparado con{" "}
                    <strong>{totalEstudiantes} estudiantes</strong> en{" "}
                    <strong>{totalAulas} aulas</strong>.
                  </span>
                )}
                {estadoSistema.estado === "cerrado" && (
                  <span>
                    Registro completado. Consulte reportes para ver los
                    resultados.
                  </span>
                )}
                {estadoSistema.estado === "evento" && (
                  <span>
                    Celebración de{" "}
                    <strong>"{estadoSistema.nombreEvento}"</strong>. No hay
                    clases programadas.
                  </span>
                )}
                {estadoSistema.estado === "vacaciones" && (
                  <span>
                    Período de vacaciones interescolares. Las clases se
                    reanudarán según el calendario oficial.
                  </span>
                )}
                {estadoSistema.estado === "semana_gestion" && (
                  <span>
                    Semana de gestión: solo actividades para personal docente y
                    administrativo.
                  </span>
                )}
                {estadoSistema.estado === "preparando" && (
                  <span>
                    Actualización automática a las{" "}
                    <strong>
                      {HORA_ACTUALIZACION_DATOS_ASISTENCIA_DIARIOS}:00 AM
                    </strong>
                    .
                  </span>
                )}
                {estadoSistema.estado === "sincronizando" && (
                  <span>
                    Actualizando información de estudiantes, aulas y horarios.
                  </span>
                )}
                {estadoSistema.estado === "no_disponible" && (
                  <span>
                    Sin clases los fines de semana. Reactivación automática el
                    próximo día hábil.
                  </span>
                )}
              </div>
            </div>

            {/* Información adicional del botón - más compacta */}
            <div className="text-center mt-2">
              <p className="text-xs text-gray-500">
                {estadoSistema.estado === "disponible"
                  ? `Listo para ${totalEstudiantes} estudiantes de secundaria`
                  : estadoSistema.estado === "pendiente"
                  ? "Se activará en el horario programado"
                  : estadoSistema.estado === "cerrado"
                  ? "Período finalizado para hoy"
                  : estadoSistema.estado === "evento"
                  ? "Sin registro en días festivos"
                  : estadoSistema.estado === "vacaciones"
                  ? "Sin clases durante vacaciones"
                  : "Sistema no disponible"}
              </p>
            </div>
          </div>
        </div>

        {/* Botón de acción - en la parte final del componente */}
        <div className="text-center mt-3">
          <button
            onClick={iniciarOContinuarTomaAsistencia}
            className={`flex items-center justify-center mx-auto px-6 py-2 rounded-lg text-sm font-medium transition-all ${
              estadoSistema.botonActivo
                ? "bg-green-500 text-white hover:bg-green-600 active:bg-green-700 shadow-md hover:shadow-lg"
                : "bg-gray-300 text-gray-500 cursor-not-allowed"
            }`}
            disabled={!estadoSistema.botonActivo}
          >
            <PlayIcon className="w-5 mr-2" />
            Iniciar Toma de Asistencia
          </button>
          <p className="text-xs text-gray-500 mt-2">
            {estadoSistema.estado === "disponible"
              ? `Sistema listo para registrar ${totalEstudiantes} estudiantes de secundaria`
              : estadoSistema.estado === "pendiente"
              ? "El botón se activará cuando inicie el horario de registro"
              : estadoSistema.estado === "cerrado"
              ? "El período de registro ha finalizado para hoy"
              : estadoSistema.estado === "evento"
              ? "No se requiere tomar asistencia durante días festivos"
              : estadoSistema.estado === "vacaciones"
              ? "No hay clases durante las vacaciones interescolares"
              : "El registro no está disponible en este momento"}
          </p>
        </div>
      </div>
    </>
  );
};

export default TomarAsistenciaEstudiantesSecundaria;
