"use client";
import LapizFirmando from "@/components/icons/LapizFirmando";
import MarcarAsistenciaPropiaDePersonalModal from "@/components/modals/AsistenciaPropiaPersonal/MarcarAsistenciaPropiaDePersonalModal";
import store, { RootState } from "@/global/store";
import React, { useState, useEffect, useCallback, memo } from "react";
import { useSelector } from "react-redux";
import { SE_MOSTRO_TOLTIP_TOMAR_ASISTENCIA_PERSONAL_KEY } from "../PlantillaLogin";
import { useDelegacionEventos } from "@/hooks/useDelegacionDeEventos";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { AsistenciaDePersonalIDB } from "@/lib/utils/local/db/models/AsistenciaDePersonal/AsistenciaDePersonalIDB";
import {
  ModoRegistro,
  modoRegistroTextos,
} from "@/interfaces/shared/ModoRegistro";
import ConfirmacionAsistenciaMarcadaModal from "@/components/modals/AsistenciaPropiaPersonal/ConfirmacionAsistenciaMarcadaModal";
import ActivarGPSoBrindarPermisosGPSModal from "@/components/modals/AsistenciaPropiaPersonal/ActivarGPSAsistenciaPropia";
import FalloConexionAInternetAlMarcarAsistenciaPropiaModal from "@/components/modals/AsistenciaPropiaPersonal/ConexionInternetMarcarAsistenciaPropia";
import ErrorGenericoAlRegistrarAsistenciaPropiaModal from "@/components/modals/AsistenciaPropiaPersonal/ErrorGenericoAlRegistrarAsistenciaPropiaModal";
import UbicacionFueraDelColegioAlRegistrarAsistenciaPropiaModal from "@/components/modals/AsistenciaPropiaPersonal/UbicacionFueraDelColegioAlRegistrarAsistenciaPropiaModal";
import NoSePuedeUsarLaptopParaAsistenciaModal from "@/components/modals/AsistenciaPropiaPersonal/NoSePuedeUsarLaptopParaAsistenciaModal";
import DispositivoSinGPSModal from "@/components/modals/AsistenciaPropiaPersonal/DispositivoSinGPSModal";
import { DatosAsistenciaCompartidos } from "@/hooks/asistencia-personal-no-directivo/useAsistenciaCompartida";

// ✅ SIMPLIFIED INTERFACES
interface EstadoBoton {
  visible: boolean;
  tipo: ModoRegistro | null;
  color: "green" | "reddish" | "loading";
  tooltip: string;
  esCarga: boolean;
}

interface MensajeInformativo {
  mostrar: boolean;
  texto: string;
  tipo:
    | "no-schedule"
    | "event-day"
    | "out-of-year"
    | "weekend"
    | "date-unavailable";
}

// ✅ OPTIMIZED SELECTOR
const selectSidebar = (state: RootState) => ({
  height: state.elementsDimensions.navBarFooterHeight,
  isOpen: state.flags.sidebarIsOpen,
});

// ✅ REUSABLE INFORMATIONAL MESSAGE COMPONENT
const MensajeInformativoAsistencia = memo(
  ({
    mensaje,
    onCerrar,
    navbarHeight,
  }: {
    mensaje: MensajeInformativo;
    onCerrar: () => void;
    navbarHeight: number;
  }) => {
    const { delegarEvento } = useDelegacionEventos();

    useEffect(() => {
      if (!delegarEvento) return;

      // Use event delegation to close when clicking outside
      delegarEvento(
        "mousedown",
        "body",
        (event: Event) => {
          const target = event.target as HTMLElement;
          if (!target.closest("#mensaje-informativo-asistencia")) {
            onCerrar();
          }
        },
        true
      );
    }, [delegarEvento, onCerrar]);

    if (!mensaje.mostrar) return null;

    return (
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm z-[101] flex items-center justify-center px-4"
        style={{ paddingBottom: navbarHeight + 12 }}
      >
        <div
          id="mensaje-informativo-asistencia"
          className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 
                   sxs-only:w-[90%] sxs-only:max-w-none sxs-only:p-4
                   xs-only:w-[85%] xs-only:max-w-none xs-only:p-5
                   sm-only:w-[80%] sm-only:max-w-md
                   w-full max-w-lg
                   relative animate-in fade-in-0 zoom-in-95 duration-300"
        >
          {/* Close button */}
          <button
            onClick={onCerrar}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 
                     flex items-center justify-center transition-colors duration-200
                     text-gray-500 hover:text-gray-700"
            title="Close"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>

          {/* Content */}
          <div className="pr-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <svg
                  className="w-6 h-6 text-blue-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-1">
                  Attendance Information
                </h3>
                <p className="text-sm text-gray-600">I.E. 20935 Asunción 8</p>
              </div>
            </div>

            <p
              className="text-gray-700 leading-relaxed
                        sxs-only:text-sm 
                        xs-only:text-sm
                        text-base"
            >
              {mensaje.texto}
            </p>

            <div className="mt-6 pt-4 border-t border-gray-100">
              <p className="text-xs text-gray-500 text-center">
                This message is shown only once per session
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }
);

MensajeInformativoAsistencia.displayName = "MensajeInformativoAsistencia";

const MarcarAsistenciaDePersonalButton = memo(
  ({
    rol,
    datosAsistencia,
  }: {
    rol: RolesSistema;
    datosAsistencia: DatosAsistenciaCompartidos;
  }) => {
    const { delegarEvento } = useDelegacionEventos();

    // ✅ SELECTORS
    const navbarFooter = useSelector(selectSidebar);

    // ✅ EXTRACT DATA FROM SHARED HOOK (NO MORE OWN QUERIES)
    const {
      horario,
      handlerBase,
      asistencia,
      modoActual,
      inicializado,
      refrescarAsistencia,
    } = datosAsistencia;

    // ✅ SIMPLIFIED STATES (WITHOUT QUERY LOGIC)
    const [estadoBoton, setEstadoBoton] = useState<EstadoBoton>({
      visible: true,
      tipo: null,
      color: "loading",
      tooltip: "",
      esCarga: true,
    });

    const [modoRegistroMarcado, setModoRegistroMarcado] =
      useState<ModoRegistro | null>(null);

    const [mensajeInformativo, setMensajeInformativo] =
      useState<MensajeInformativo>({
        mostrar: false,
        texto: "",
        tipo: "no-schedule",
      });

    const [asistenciaIDB, setAsistenciaIDB] =
      useState<AsistenciaDePersonalIDB | null>(null);

    // ===================================================================================
    //                         State variables for modals
    // ===================================================================================
    const [mostrarModalTomarMiAsistencia, setMostrarModalTomarMiAsistencia] =
      useState(false);
    const [
      mostrarModalConfirmacioAsistenciaMarcada,
      setMostrarModalConfirmacioAsistenciaMarcada,
    ] = useState(false);
    const [
      mostrarModalFaltaActivarGPSoBrindarPermisosGPS,
      setMostrarModalFaltaActivarGPSoBrindarPermisosGPS,
    ] = useState(false);
    const [
      mostrarModalUbicacionFueraDelColegioAlRegistrarAsistenciaPropia,
      setMostrarModalFueraDelColegioAlRegistrarAsistenciaPropia,
    ] = useState(false);
    const [
      mostrarModalErrorGenericoAlRegistrarAsistenciaPropia,
      setMostrarErrorGenericoAlRegistrarAsistenciaPropia,
    ] = useState(false);
    const [
      mostrarModalFalloConexionAInternetAlMarcarAsistenciaPropia,
      setMostrarModalFalloConexionAInternetAlMarcarAsistenciaPropia,
    ] = useState(false);
    const [
      mostrarModalNoSePuedeUsarLaptop,
      setMostrarModalNoSePuedeUsarLaptop,
    ] = useState(false);
    const [mostrarModalDispositivoSinGPS, setMostrarModalDispositivoSinGPS] =
      useState(false);
    const [fechaHoraRegistro, setFechaHoraRegistro] = useState<Date | null>(
      null
    );

    // ✅ TOOLTIP MANAGEMENT
    const [tooltipOculto, setTooltipOculto] = useState(() => {
      if (typeof window !== "undefined") {
        return (
          sessionStorage.getItem(
            SE_MOSTRO_TOLTIP_TOMAR_ASISTENCIA_PERSONAL_KEY
          ) === "true"
        );
      }
      return false;
    });

    const ocultarTooltip = useCallback(() => {
      setTooltipOculto(true);
      sessionStorage.setItem(
        SE_MOSTRO_TOLTIP_TOMAR_ASISTENCIA_PERSONAL_KEY,
        "true"
      );
    }, []);

    const mostrarTooltip = useCallback(() => {
      setTooltipOculto(false);
      sessionStorage.setItem(
        SE_MOSTRO_TOLTIP_TOMAR_ASISTENCIA_PERSONAL_KEY,
        "false"
      );
    }, []);

    // ✅ FUNCTION: Hide informative message
    const ocultarMensajeInformativo = useCallback(() => {
      setMensajeInformativo((prev) => ({ ...prev, mostrar: false }));
      sessionStorage.setItem(
        SE_MOSTRO_TOLTIP_TOMAR_ASISTENCIA_PERSONAL_KEY,
        "true"
      );
    }, []);

    // ✅ FUNCTION: Get current date from Redux (without causing re-renders)
    const obtenerFechaActual = useCallback((): Date | null => {
      const state = store.getState();
      const fechaHora = state.others.fechaHoraActualReal.fechaHora;
      const inicializado = state.others.fechaHoraActualReal.inicializado;

      if (!fechaHora || !inicializado) {
        console.log("❌ Redux date not available or not initialized");
        return null;
      }

      const fecha = new Date(fechaHora);
      fecha.setHours(fecha.getHours() - 5); // Correct timezone

      return fecha;
    }, []);

    // ✅ FUNCTION: Check special conditions (USING SHARED DATA)
    const verificarCondicionesEspeciales = useCallback((): string | null => {
      if (!handlerBase) return null;

      console.log("🔍 CHECKING SPECIAL CONDITIONS...");

      // 1. Out of school year (highest priority)
      const fueraAño = handlerBase.estaFueraDeAnioEscolar();
      if (fueraAño) {
        console.log("🚫 OUT OF SCHOOL YEAR");
        return "Outside school period, attendance is not recorded";
      }

      // 2. Event day
      const diaEvento = handlerBase.esHoyDiaDeEvento();
      if (diaEvento) {
        console.log("🚫 EVENT DAY:", diaEvento.Nombre);
        return `Today is ${diaEvento.Nombre}, attendance is not recorded`;
      }

      // 3. ✅ DATE VERIFICATION (fechaLocalPeru < fechaRedux)
      const fechaRedux = obtenerFechaActual();
      if (fechaRedux) {
        const fechaLocalPeru = handlerBase.getFechaLocalPeru();

        console.log("🕐 VERIFYING DATES FOR REGISTRATION:", {
          fechaLocalPeru: fechaLocalPeru.toISOString(),
          fechaRedux: fechaRedux.toISOString(),
          fechaLocalPeruFecha: fechaLocalPeru.toDateString(),
          fechaReduxFecha: fechaRedux.toDateString(),
        });

        // Compare only dates (without hours)
        const fechaReduxSinHora = new Date(
          fechaRedux.getFullYear(),
          fechaRedux.getMonth(),
          fechaRedux.getDate()
        );
        const fechaPeruSinHora = new Date(
          fechaLocalPeru.getFullYear(),
          fechaLocalPeru.getMonth(),
          fechaLocalPeru.getDate()
        );

        if (fechaPeruSinHora < fechaReduxSinHora) {
          console.log("🚫 LOCAL DATE LESS - Showing wait message");
          return "You cannot register your attendance yet";
        }

        // 4. Weekend (after date verification)
        const diaSemana = fechaRedux.getDay(); // 0=Sunday, 1=Monday, ..., 6=Saturday
        if (diaSemana === 0) {
          // Sunday
          console.log("🚫 IS SUNDAY");
          return "Today is Sunday, attendance is not recorded";
        }
        if (diaSemana === 6) {
          // Saturday
          console.log("🚫 IS SATURDAY");
          return "Today is Saturday, attendance is not recorded";
        }
      }

      console.log("✅ NO SPECIAL CONDITIONS");
      return null;
    }, [handlerBase, obtenerFechaActual]);

    // ✅ FUNCTION: Update button state (USING SHARED DATA)
    // ✅ FUNCTION: Update button state (USING SHARED DATA) - CORRECTED VERSION
    const actualizarEstadoBoton = useCallback(() => {
      console.log("🔍 ===== START updateButtonState =====");

      // ✅ Check if we are still initializing
      const estaInicializando =
        !inicializado ||
        !asistenciaIDB ||
        (rol !== RolesSistema.Directivo &&
          rol !== RolesSistema.Responsable &&
          !handlerBase) ||
        !asistencia.inicializado;

      console.log("🎯 FULL EVALUATION:", {
        inicializado,
        asistenciaIDB: !!asistenciaIDB,
        handlerBase: !!handlerBase,
        asistenciaInicializada: asistencia.inicializado,
        estaInicializando,
        rol,
        horario: !!horario, // ✅ NEW: Show schedule status
        esDirectivoOResponsable:
          rol === RolesSistema.Directivo || rol === RolesSistema.Responsable,
      });

      // ✅ SHOW LOADING STATE while initializing
      if (estaInicializando) {
        console.log("⏳ RESULT: Keeping loading state");
        setEstadoBoton({
          visible: true,
          tipo: null,
          color: "loading",
          tooltip: "Initializing system...",
          esCarga: true,
        });
        return;
      }

      console.log("✅ INITIALIZATION COMPLETE - Evaluating conditions...");

      // ✅ NEW PRIORITY VERIFICATION: No schedule (BEFORE special conditions)
      if (inicializado && !horario) {
        console.log(
          "🚫 RESULT: Hiding due to lack of schedule (user without schedule today)"
        );
        setEstadoBoton({
          visible: false,
          tipo: null,
          color: "green",
          tooltip: "",
          esCarga: false,
        });
        return;
      }

      console.log("✅ Schedule available:", !!horario);

      // ✅ Check special conditions (AFTER schedule verification)
      const condicionEspecial = verificarCondicionesEspeciales();
      if (condicionEspecial) {
        console.log(
          "🚫 RESULT: Hiding due to special condition:",
          condicionEspecial
        );
        setEstadoBoton({
          visible: false,
          tipo: null,
          color: "green",
          tooltip: "",
          esCarga: false,
        });
        return;
      }

      console.log("✅ No special conditions");

      // ✅ USE THE CURRENT MODE CALCULATED BY THE SHARED HOOK
      console.log("🎯 CURRENT MODE EVALUATED:", {
        activo: modoActual.activo,
        tipo: modoActual.tipo,
        razon: modoActual.razon,
      });

      // ✅ If the mode is not active (outside time range), HIDE the button
      if (!modoActual.activo || !modoActual.tipo) {
        console.log(
          "🚫 RESULT: Hiding button - Outside time range:",
          modoActual.razon
        );
        setEstadoBoton({
          visible: false,
          tipo: null,
          color: "green",
          tooltip: "",
          esCarga: false,
        });
        return;
      }

      console.log("✅ Within valid time range");

      // ✅ CHECK IF ATTENDANCE FOR THE CURRENT MODE HAS ALREADY BEEN MARKED (USING SHARED DATA)
      const yaSeMarco =
        modoActual.tipo === ModoRegistro.Entrada
          ? asistencia.entradaMarcada
          : asistencia.salidaMarcada;

      console.log("🎯 ATTENDANCE VERIFICATION:", {
        modoTipo: modoActual.tipo,
        entradaMarcada: asistencia.entradaMarcada,
        salidaMarcada: asistencia.salidaMarcada,
        yaSeMarco,
      });

      if (yaSeMarco) {
        console.log(
          `🚫 RESULT: Hiding button - ${modoActual.tipo} already marked`
        );
        setEstadoBoton({
          visible: false,
          tipo: null,
          color: "green",
          tooltip: "",
          esCarga: false,
        });
        return;
      }

      // ✅ SHOW BUTTON WITH CURRENT MODE
      const esEntrada = modoActual.tipo === ModoRegistro.Entrada;
      const color = esEntrada ? "green" : "reddish";

      console.log(
        `👁️ RESULT: Showing ${color} button for ${modoActual.tipo}`
      );

      setEstadoBoton({
        visible: true,
        tipo: modoActual.tipo,
        color,
        tooltip: `¡Register your ${modoRegistroTextos[modoActual.tipo]}!`,
        esCarga: false,
      });

      console.log("🔍 ===== END updateButtonState =====");
    }, [
      inicializado,
      asistenciaIDB,
      handlerBase,
      asistencia.inicializado,
      asistencia.entradaMarcada,
      asistencia.salidaMarcada,
      horario, // ✅ CRITICAL NEW DEPENDENCY
      rol,
      modoActual,
      verificarCondicionesEspeciales,
    ]);

    // ✅ FUNCTION: Check and show informative message
    const verificarMensajeInformativo = useCallback(() => {
      // Only show if it hasn't been shown before in this session
      if (tooltipOculto) return;

      // Check conditions in order of priority
      const condicionEspecial = verificarCondicionesEspeciales();
      if (condicionEspecial) {
        let tipo: MensajeInformativo["tipo"] = "no-schedule";

        if (condicionEspecial.includes("Outside school period")) {
          tipo = "out-of-year";
        } else if (
          condicionEspecial.includes("Sunday") ||
          condicionEspecial.includes("Saturday")
        ) {
          tipo = "weekend";
        } else if (condicionEspecial.includes("You cannot yet")) {
          tipo = "date-unavailable";
        } else if (condicionEspecial.includes("attendance is not recorded")) {
          tipo = "event-day";
        }

        setMensajeInformativo({
          mostrar: true,
          texto: condicionEspecial,
          tipo,
        });
        return;
      }

      // Check if there is no schedule
      if (handlerBase && !horario) {
        setMensajeInformativo({
          mostrar: true,
          texto: "There is no attendance you should register today",
          tipo: "no-schedule",
        });
        return;
      }
    }, [tooltipOculto, verificarCondicionesEspeciales, handlerBase, horario]);

    // ✅ INITIALIZATION (ONLY AsistenciaIDB, no more queries)
    useEffect(() => {
      console.log("🔧 INITIALIZING AsistenciaDePersonalIDB...");
      const nuevaAsistenciaIDB = new AsistenciaDePersonalIDB("API01");
      setAsistenciaIDB(nuevaAsistenciaIDB);
      console.log(
        "✅ AsistenciaDePersonalIDB initialized:",
        nuevaAsistenciaIDB
      );
    }, []);

    // ✅ NEW: Check informative message when handler/schedule is obtained
    useEffect(() => {
      if (handlerBase && inicializado) {
        verificarMensajeInformativo();
      }
    }, [handlerBase, horario, inicializado, verificarMensajeInformativo]);

    // ✅ MAIN EFFECT: Update button state when shared data changes
    useEffect(() => {
      actualizarEstadoBoton();
    }, [actualizarEstadoBoton]);

    // ✅ EVENT DELEGATION FOR TOOLTIP
    useEffect(() => {
      if (!delegarEvento) return;
      delegarEvento(
        "mousedown",
        "#tooltip-mostrar-asistencia-personal, #tooltip-mostrar-asistencia-personal *",
        () => ocultarTooltip(),
        true
      );
    }, [delegarEvento, ocultarTooltip]);

    // ✅ SHOW TOOLTIP ON TYPE CHANGE (only if no informative message)
    useEffect(() => {
      if (estadoBoton.tipo && !mensajeInformativo.mostrar) {
        mostrarTooltip();
      }
    }, [estadoBoton.tipo, mensajeInformativo.mostrar, mostrarTooltip]);

    // ✅ HANDLE CLICK - Do not allow click in loading state
    const handleClick = useCallback(() => {
      if (!estadoBoton.visible || estadoBoton.esCarga) return;

      if (!tooltipOculto) ocultarTooltip();
      setMostrarModalTomarMiAsistencia(true);
    }, [
      estadoBoton.visible,
      estadoBoton.esCarga,
      tooltipOculto,
      ocultarTooltip,
    ]);

    // ✅ FUNCTION: Mark attendance for today (USING SHARED DATA)
    const marcarMiAsistenciaDeHoy = useCallback(async () => {
      try {
        if (!estadoBoton.tipo || !horario) {
          console.error("❌ No registration type or schedule available");
          return;
        }

        setModoRegistroMarcado(estadoBoton.tipo);

        // Get the expected ISO time based on the registration mode
        const fechaActual = obtenerFechaActual();
        if (!fechaActual) {
          console.error("❌ Could not get current date");
          return;
        }

        let horaEsperadaISO: string;

        if (estadoBoton.tipo === ModoRegistro.Entrada) {
          // For entry, use schedule start time
          const horaInicio = new Date(horario.Inicio);
          const fechaInicioHoy = new Date(fechaActual);
          fechaInicioHoy.setHours(
            horaInicio.getHours(),
            horaInicio.getMinutes(),
            0,
            0
          );
          horaEsperadaISO = fechaInicioHoy.toISOString();
        } else {
          // For exit, use schedule end time
          const horaFin = new Date(horario.Fin);
          const fechaFinHoy = new Date(fechaActual);
          fechaFinHoy.setHours(horaFin.getHours(), horaFin.getMinutes(), 0, 0);
          horaEsperadaISO = fechaFinHoy.toISOString();
        }

        console.log(
          `🕐 Expected ISO time for ${estadoBoton.tipo}:`,
          horaEsperadaISO
        );

        // Attempt to mark attendance using the orchestrator
        if (!asistenciaIDB) {
          console.error("❌ AsistenciaIDB not available");
          return;
        }

        // ✅ MARK ATTENDANCE
        await asistenciaIDB.marcarMiAsistenciaPropia(
          rol,
          estadoBoton.tipo,
          horaEsperadaISO
        );

        // ✅ SAVE THE SUCCESSFUL REGISTRATION DATE/TIME
        setFechaHoraRegistro(
          new Date(store.getState().others.fechaHoraActualReal.fechaHora!)
        ); // Current registration time

        await refrescarAsistencia();

        // ✅ NEW: HIDE BUTTON IMMEDIATELY AFTER SUCCESSFUL REGISTRATION
        console.log(
          `✅ Attendance of ${estadoBoton.tipo} marked successfully - Hiding button`
        );

        console.log("✅ Attendance marked successfully");
      } catch (error) {
        console.error("❌ Error marking my attendance:", error);
        throw error; // Re-throw so the modal can handle it
      }
    }, [
      estadoBoton.tipo,
      horario,
      obtenerFechaActual,
      asistenciaIDB,
      rol,
      actualizarEstadoBoton,
    ]);

    // ✅ RENDER: Informative message or button
    const mostrarTooltipActual = !tooltipOculto && !mensajeInformativo.mostrar;

    return (
      <>
        {/* ✅ INFORMATIONAL MESSAGE */}
        {mensajeInformativo.mostrar && (
          <MensajeInformativoAsistencia
            mensaje={mensajeInformativo}
            onCerrar={ocultarMensajeInformativo}
            navbarHeight={navbarFooter.height}
          />
        )}

        {/* ✅ MODALS */}
        {mostrarModalTomarMiAsistencia && (
          <MarcarAsistenciaPropiaDePersonalModal
            Rol={rol}
            eliminateModal={() => setMostrarModalTomarMiAsistencia(false)}
            modoRegistro={modoActual.tipo!}
            marcarMiAsistenciaDeHoy={marcarMiAsistenciaDeHoy}
            setMostrarModalConfirmacioAsistenciaMarcada={
              setMostrarModalConfirmacioAsistenciaMarcada
            }
            setMostrarModalFaltaActivarGPSoBrindarPermisosGPS={
              setMostrarModalFaltaActivarGPSoBrindarPermisosGPS
            }
            setMostrarModalUbicacionFueraDelColegioAlRegistrarAsistenciaPropia={
              setMostrarModalFueraDelColegioAlRegistrarAsistenciaPropia
            }
            setMostrarModalErrorGenericoAlRegistrarAsistenciaPropia={
              setMostrarErrorGenericoAlRegistrarAsistenciaPropia
            }
            setMostrarModalFalloConexionAInternet={
              setMostrarModalFalloConexionAInternetAlMarcarAsistenciaPropia
            }
            setMostrarModalNoSePuedeUsarLaptop={
              setMostrarModalNoSePuedeUsarLaptop
            }
            setMostrarModalDispositivoSinGPS={setMostrarModalDispositivoSinGPS}
          />
        )}

        {mostrarModalConfirmacioAsistenciaMarcada && (
          <ConfirmacionAsistenciaMarcadaModal
            eliminateModal={() => {
              setMostrarModalConfirmacioAsistenciaMarcada(false);
              setFechaHoraRegistro(null);
              setModoRegistroMarcado(null); // ✅ CLEAR saved mode
            }}
            fechaHoraRegistro={fechaHoraRegistro}
            modoRegistro={modoRegistroMarcado}
          />
        )}

        {mostrarModalFaltaActivarGPSoBrindarPermisosGPS && (
          <ActivarGPSoBrindarPermisosGPSModal
            modoRegistro={estadoBoton.tipo!}
            eliminateModal={() => {
              setMostrarModalFaltaActivarGPSoBrindarPermisosGPS(false);
            }}
          />
        )}

        {mostrarModalUbicacionFueraDelColegioAlRegistrarAsistenciaPropia && (
          <UbicacionFueraDelColegioAlRegistrarAsistenciaPropiaModal
            eliminateModal={() => {
              setMostrarModalFueraDelColegioAlRegistrarAsistenciaPropia(false);
            }}
          />
        )}

        {mostrarModalErrorGenericoAlRegistrarAsistenciaPropia && (
          <ErrorGenericoAlRegistrarAsistenciaPropiaModal
            eliminateModal={() => {
              setMostrarErrorGenericoAlRegistrarAsistenciaPropia(false);
            }}
          />
        )}

        {mostrarModalNoSePuedeUsarLaptop && (
          <NoSePuedeUsarLaptopParaAsistenciaModal
            eliminateModal={() => setMostrarModalNoSePuedeUsarLaptop(false)}
          />
        )}

        {mostrarModalDispositivoSinGPS && (
          <DispositivoSinGPSModal
            eliminateModal={() => setMostrarModalDispositivoSinGPS(false)}
          />
        )}

        {mostrarModalFalloConexionAInternetAlMarcarAsistenciaPropia && (
          <FalloConexionAInternetAlMarcarAsistenciaPropiaModal
            eliminateModal={() => {
              setMostrarModalFalloConexionAInternetAlMarcarAsistenciaPropia(
                false
              );
            }}
          />
        )}

        <style>
          {`
        @keyframes Modificar-Bottom-NavBarFooter {
            to {
                bottom: ${
                  navbarFooter.isOpen ? `${navbarFooter.height}px` : "0px"
                };
            }
        }
        .Mover-NavBarFooter {
            animation: Modificar-Bottom-NavBarFooter 0.3s forwards;
        }

        @keyframes tooltipFadeIn {
            from {
                opacity: 0;
                transform: translateX(15px) scale(0.9);
            }
            to {
                opacity: 1;
                transform: translateX(0) scale(1);
            }
        }

        @keyframes tooltipPulse {
            0%, 100% { transform: translateX(0) scale(1); }
            50% { transform: translateX(-2px) scale(1.02); }
        }

        @keyframes buttonPulse {
            0%, 100% {
                transform: scale(1);
                box-shadow:
                    0 6px 20px rgba(0, 0, 0, 0.2),
                    0 2px 8px 2px rgba(34, 197, 94, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2);
            }
            50% {
                transform: scale(1.05);
                box-shadow:
                    0 8px 25px rgba(0, 0, 0, 0.25),
                    0 3px 12px 3px rgba(34, 197, 94, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3);
            }
        }

        @keyframes buttonPulseRojo {
            0%, 100% {
                transform: scale(1);
                box-shadow:
                    0 6px 20px rgba(0, 0, 0, 0.2),
                    0 2px 8px 2px rgba(239, 68, 68, 0.3),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2);
            }
            50% {
                transform: scale(1.05);
                box-shadow:
                    0 8px 25px rgba(0, 0, 0, 0.25),
                    0 3px 12px 3px rgba(239, 68, 68, 0.4),
                    inset 0 1px 0 rgba(255, 255, 255, 0.3);
            }
        }

        /* ✅ NEW: Styles for mobiles with reduced shadow and more separation */
        @media (max-width: 300px) {
            .button-enhanced-verde {
                animation: buttonPulse 3s ease-in-out infinite;
                box-shadow:
                    0 4px 15px rgba(0, 0, 0, 0.15),
                    0 1px 6px 1px rgba(34, 197, 94, 0.25),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
            }
            .button-enhanced-rojizo {
                animation: buttonPulseRojo 3s ease-in-out infinite;
                box-shadow:
                    0 4px 15px rgba(0, 0, 0, 0.15),
                    0 1px 6px 1px rgba(239, 68, 68, 0.25),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
            }
        }

        @media (min-width: 300px) and (max-width: 499px) {
            .button-enhanced-verde {
                animation: buttonPulse 3s ease-in-out infinite;
                box-shadow:
                    0 4px 15px rgba(0, 0, 0, 0.15),
                    0 1px 6px 1px rgba(34, 197, 94, 0.25),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
            }
            .button-enhanced-rojizo {
                animation: buttonPulseRojo 3s ease-in-out infinite;
                box-shadow:
                    0 4px 15px rgba(0, 0, 0, 0.15),
                    0 1px 6px 1px rgba(239, 68, 68, 0.25),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
            }
        }

        @media (min-width: 500px) and (max-width: 767px) {
            .button-enhanced-verde {
                animation: buttonPulse 3s ease-in-out infinite;
                box-shadow:
                    0 4px 15px rgba(0, 0, 0, 0.15),
                    0 1px 6px 1px rgba(34, 197, 94, 0.25),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
            }
            .button-enhanced-rojizo {
                animation: buttonPulseRojo 3s ease-in-out infinite;
                box-shadow:
                    0 4px 15px rgba(0, 0, 0, 0.15),
                    0 1px 6px 1px rgba(239, 68, 68, 0.25),
                    inset 0 1px 0 rgba(255, 255, 255, 0.2) !important;
            }
        }

        /* Original styles for large screens */
        @media (min-width: 768px) {
            .button-enhanced-verde {
                animation: buttonPulse 3s ease-in-out infinite;
            }
            .button-enhanced-rojizo {
                animation: buttonPulseRojo 3s ease-in-out infinite;
            }
        }

        .tooltip-animation {
            animation: tooltipFadeIn 0.4s ease-out, tooltipPulse 2s ease-in-out infinite 1s;
        }

        @keyframes loadingPulse {
          0%, 100% {
            transform: scale(1);
            box-shadow:
              0 4px 15px rgba(0, 0, 0, 0.15),
              0 1px 6px 1px rgba(59, 130, 246, 0.25),
              inset 0 1px 0 rgba(255, 255, 255, 0.2);
          }
          50% {
            transform: scale(1.02);
            box-shadow:
              0 6px 20px rgba(0, 0, 0, 0.2),
              0 2px 8px 2px rgba(59, 130, 246, 0.35),
              inset 0 1px 0 rgba(255, 255, 255, 0.3);
          }
        }

        @keyframes spinLoader {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .button-enhanced-carga {
          animation: loadingPulse 2s ease-in-out infinite;
          cursor: not-allowed;
        }

        .loading-spinner {
          animation: spinLoader 1s linear infinite;
        }
                
        `}
        </style>

        {/* ✅ BUTTON: Now includes loading state */}
        {estadoBoton.visible && (
          <div
            className="fixed z-[102] right-0 Mover-NavBarFooter
             sxs-only:mr-3 sxs-only:mb-3
             xs-only:mr-4 xs-only:mb-4
             sm-only:mr-5 sm-only:mb-4
             mr-6 mb-5"
            style={{ bottom: navbarFooter.height + 80 }}
          >
            {/* Tooltip - Only show if NOT loading state */}
            {mostrarTooltipActual && !estadoBoton.esCarga && (
              <div
                id="tooltip-mostrar-asistencia-personal"
                className="absolute tooltip-animation
                 sxs-only:right-14 sxs-only:top-1
                 xs-only:right-16 xs-only:top-2
                 sm-only:right-18 sm-only:top-2
                 right-20 top-3"
              >
                <div
                  className={`${
                    estadoBoton.color === "green"
                      ? "bg-azul-principal"
                      : estadoBoton.color === "reddish"
                      ? "bg-red-600"
                      : "bg-blue-600"
                  } text-white px-3 py-2 rounded-lg text-sm font-medium shadow-lg relative
                   sxs-only:px-2 sxs-only:py-1 sxs-only:text-xs
                   xs-only:px-2 xs-only:py-1 xs-only:text-xs
                   sm-only:px-3 sm-only:py-2 sm-only:text-sm
                   whitespace-nowrap transition-all duration-300`}
                >
                  {estadoBoton.tooltip}
                  <div
                    className={`absolute top-1/2 transform -translate-y-1/2
                   left-full border-l-4 border-y-4 border-y-transparent ${
                     estadoBoton.color === "green"
                       ? "border-l-azul-principal"
                       : estadoBoton.color === "reddish"
                       ? "border-l-red-600"
                       : "border-l-blue-600"
                   }`}
                  ></div>
                </div>
              </div>
            )}

            {/* Button */}
            <button
              onClick={handleClick}
              disabled={estadoBoton.esCarga}
              title={
                estadoBoton.esCarga
                  ? "Initializing..."
                  : `Register ${estadoBoton.tipo}`
              }
              className={`${
                estadoBoton.esCarga
                  ? "button-enhanced-carga"
                  : mostrarTooltipActual
                  ? estadoBoton.color === "green"
                    ? "button-enhanced-verde"
                    : "button-enhanced-rojizo"
                  : "transition-all duration-300"
              }
             relative overflow-hidden aspect-square
             ${
               estadoBoton.color === "green"
                 ? "bg-gradient-to-br from-verde-principal to-green-600 hover:from-green-500 hover:to-green-700"
                 : estadoBoton.color === "reddish"
                 ? "bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800"
                 : "bg-gradient-to-br from-blue-500 to-blue-600" // Loading state
             }
             rounded-full flex items-center justify-center
             transition-all duration-300 ease-out
             ${
               estadoBoton.esCarga
                 ? "cursor-not-allowed"
                 : "hover:scale-110 active:scale-95"
             }
             shadow-[0_6px_20px_rgba(0,0,0,0.3),0_2px_8px_rgba(34,197,94,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]
             ${
               !estadoBoton.esCarga &&
               "hover:shadow-[0_10px_30px_rgba(0,0,0,0.35),0_4px_15px_rgba(34,197,94,0.5),inset_0_1px_0_rgba(255,255,255,0.3)]"
             }
             border-2 ${
               estadoBoton.color === "loading"
                 ? "border-blue-400/20"
                 : "border-green-400/20"
             }
             sxs-only:w-12 sxs-only:h-12 sxs-only:p-2
             xs-only:w-14 xs-only:h-14 xs-only:p-3
             sm-only:w-16 sm-only:h-16 sm-only:p-3
             w-18 h-18 p-4`}
            >
              {/* Shine effect on hover - only if NOT loading state */}
              {!estadoBoton.esCarga && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform -translate-x-full hover:translate-x-full transition-transform duration-700"></div>
              )}

              {/* Button content */}
              {estadoBoton.esCarga ? (
                // ✅ Loading spinner
                <div className="loading-spinner relative z-10">
                  <svg
                    className="w-8 h-8 text-white sxs-only:w-6 xs-only:w-7 sm-only:w-8"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="m4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                </div>
              ) : (
                // ✅ Normal pencil icon
                <LapizFirmando className="text-white relative z-10 drop-shadow-sm sxs-only:w-6 xs-only:w-7 sm-only:w-8 w-8" />
              )}

              {/* Notification dot when there is a tooltip - Only if NOT loading state */}
              {mostrarTooltipActual && !estadoBoton.esCarga && (
                <div
                  className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white animate-ping
                 sxs-only:w-2 sxs-only:h-2 ${
                   estadoBoton.color === "green"
                     ? "bg-blue-500"
                     : "bg-yellow-500"
                 }`}
                />
              )}

              {/* Status indicators - Only if NOT loading state */}
              {!estadoBoton.esCarga && (
                <div className="absolute -bottom-1 -left-1 flex space-x-1">
                  <div
                    className={`w-2 h-2 rounded-full border border-white transition-all ${
                      asistencia.entradaMarcada
                        ? "bg-green-400 scale-110"
                        : "bg-gray-400"
                    }`}
                    title={
                      asistencia.entradaMarcada
                        ? "Entry registered"
                        : "Entry pending"
                    }
                  />
                  <div
                    className={`w-2 h-2 rounded-full border border-white transition-all ${
                      asistencia.salidaMarcada
                        ? "bg-green-400 scale-110"
                        : "bg-gray-400"
                    }`}
                    title={
                      asistencia.salidaMarcada
                        ? "Exit registered"
                        : "Exit pending"
                    }
                  />
                </div>
              )}
            </button>
          </div>
        )}
      </>
    );
  }
);

MarcarAsistenciaDePersonalButton.displayName =
  "MarcarAsistenciaDePersonalButton";

export default MarcarAsistenciaDePersonalButton;