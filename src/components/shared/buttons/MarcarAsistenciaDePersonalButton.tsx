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
} from "@/interfaces/shared/ModoRegistroPersonal";
import ConfirmacionAsistenciaMarcadaModal from "@/components/modals/AsistenciaPropiaPersonal/ConfirmacionAsistenciaMarcadaModal";
import ActivarGPSoBrindarPermisosGPSModal from "@/components/modals/AsistenciaPropiaPersonal/ActivarGPSAsistenciaPropia";
import FalloConexionAInternetAlMarcarAsistenciaPropiaModal from "@/components/modals/AsistenciaPropiaPersonal/ConexionInternetMarcarAsistenciaPropia";
import ErrorGenericoAlRegistrarAsistenciaPropiaModal from "@/components/modals/AsistenciaPropiaPersonal/ErrorGenericoAlRegistrarAsistenciaPropiaModal";
import UbicacionFueraDelColegioAlRegistrarAsistenciaPropiaModal from "@/components/modals/AsistenciaPropiaPersonal/UbicacionFueraDelColegioAlRegistrarAsistenciaPropiaModal";
import NoSePuedeUsarLaptopParaAsistenciaModal from "@/components/modals/AsistenciaPropiaPersonal/NoSePuedeUsarLaptopParaAsistenciaModal";
import DispositivoSinGPSModal from "@/components/modals/AsistenciaPropiaPersonal/DispositivoSinGPSModal";
import { DatosAsistenciaCompartidos } from "@/hooks/asistencia-personal-no-directivo/useAsistenciaCompartida";

// ✅ INTERFACES SIMPLIFICADAS
interface EstadoBoton {
  visible: boolean;
  tipo: ModoRegistro | null;
  color: "verde" | "rojizo" | "carga";
  tooltip: string;
  esCarga: boolean;
}

interface MensajeInformativo {
  mostrar: boolean;
  texto: string;
  tipo:
    | "sin-horario"
    | "dia-evento"
    | "fuera-año"
    | "fin-semana"
    | "fecha-no-disponible";
}

// ✅ SELECTOR OPTIMIZADO
const selectSidebar = (state: RootState) => ({
  height: state.elementsDimensions.navBarFooterHeight,
  isOpen: state.flags.sidebarIsOpen,
});

// ✅ COMPONENTE DE MENSAJE INFORMATIVO REUTILIZABLE
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

      // Usar delegación de eventos para cerrar al hacer click fuera
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
          {/* Botón cerrar */}
          <button
            onClick={onCerrar}
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 
                     flex items-center justify-center transition-colors duration-200
                     text-gray-500 hover:text-gray-700"
            title="Cerrar"
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

          {/* Contenido */}
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
                  Información de Asistencia
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
                Este mensaje se muestra solo una vez por sesión
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

    // ✅ SELECTORES
    const navbarFooter = useSelector(selectSidebar);

    // ✅ EXTRAER DATOS DEL HOOK COMPARTIDO (NO MÁS CONSULTAS PROPIAS)
    const {
      horario,
      handlerBase,
      asistencia,
      modoActual,
      inicializado,
      refrescarAsistencia,
    } = datosAsistencia;

    // ✅ ESTADOS SIMPLIFICADOS (SIN LÓGICA DE CONSULTA)
    const [estadoBoton, setEstadoBoton] = useState<EstadoBoton>({
      visible: true,
      tipo: null,
      color: "carga",
      tooltip: "",
      esCarga: true,
    });

    const [mensajeInformativo, setMensajeInformativo] =
      useState<MensajeInformativo>({
        mostrar: false,
        texto: "",
        tipo: "sin-horario",
      });

    const [asistenciaIDB, setAsistenciaIDB] =
      useState<AsistenciaDePersonalIDB | null>(null);

    // ===================================================================================
    //                         Variables de estado para modales
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

    // ✅ FUNCIÓN: Ocultar mensaje informativo
    const ocultarMensajeInformativo = useCallback(() => {
      setMensajeInformativo((prev) => ({ ...prev, mostrar: false }));
      sessionStorage.setItem(
        SE_MOSTRO_TOLTIP_TOMAR_ASISTENCIA_PERSONAL_KEY,
        "true"
      );
    }, []);

    // ✅ FUNCIÓN: Obtener fecha actual de Redux (sin causar re-renders)
    const obtenerFechaActual = useCallback((): Date | null => {
      const state = store.getState();
      const fechaHora = state.others.fechaHoraActualReal.fechaHora;
      const inicializado = state.others.fechaHoraActualReal.inicializado;

      if (!fechaHora || !inicializado) {
        console.log("❌ Fecha Redux no disponible o no inicializada");
        return null;
      }

      const fecha = new Date(fechaHora);
      fecha.setHours(fecha.getHours() - 5); // Corregir zona horaria

      return fecha;
    }, []);

    // ✅ FUNCIÓN: Verificar condiciones especiales (USANDO DATOS COMPARTIDOS)
    const verificarCondicionesEspeciales = useCallback((): string | null => {
      if (!handlerBase) return null;

      console.log("🔍 VERIFICANDO CONDICIONES ESPECIALES...");

      // 1. Fuera del año escolar (prioridad más alta)
      const fueraAño = handlerBase.estaFueraDeAnioEscolar();
      if (fueraAño) {
        console.log("🚫 FUERA DEL AÑO ESCOLAR");
        return "Fuera del período escolar, no se registra asistencia";
      }

      // 2. Día de evento
      const diaEvento = handlerBase.esHoyDiaDeEvento();
      if (diaEvento) {
        console.log("🚫 DÍA DE EVENTO:", diaEvento.Nombre);
        return `Hoy es ${diaEvento.Nombre}, no se registra asistencia`;
      }

      // 3. ✅ VERIFICACIÓN DE FECHAS (fechaLocalPeru < fechaRedux)
      const fechaRedux = obtenerFechaActual();
      if (fechaRedux) {
        const fechaLocalPeru = handlerBase.getFechaLocalPeru();

        console.log("🕐 VERIFICANDO FECHAS PARA REGISTRO:", {
          fechaLocalPeru: fechaLocalPeru.toISOString(),
          fechaRedux: fechaRedux.toISOString(),
          fechaLocalPeruFecha: fechaLocalPeru.toDateString(),
          fechaReduxFecha: fechaRedux.toDateString(),
        });

        // Comparar solo fechas (sin horas)
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
          console.log("🚫 FECHA LOCAL MENOR - Mostrando mensaje de espera");
          return "Aún no puedes registrar tu asistencia";
        }

        // 4. Fin de semana (después de verificar fechas)
        const diaSemana = fechaRedux.getDay(); // 0=domingo, 1=lunes, ..., 6=sábado
        if (diaSemana === 0) {
          // Domingo
          console.log("🚫 ES DOMINGO");
          return "Hoy es domingo, no se registra asistencia";
        }
        if (diaSemana === 6) {
          // Sábado
          console.log("🚫 ES SÁBADO");
          return "Hoy es sábado, no se registra asistencia";
        }
      }

      console.log("✅ NO HAY CONDICIONES ESPECIALES");
      return null;
    }, [handlerBase, obtenerFechaActual]);

    // ✅ FUNCIÓN: Actualizar estado del botón (USANDO DATOS COMPARTIDOS)
    const actualizarEstadoBoton = useCallback(() => {
      console.log("🔍 ===== INICIO actualizarEstadoBoton =====");

      // ✅ Verificar si aún estamos en proceso de inicialización
      const estaInicializando =
        !inicializado ||
        !asistenciaIDB ||
        (rol !== RolesSistema.Directivo &&
          rol !== RolesSistema.Responsable &&
          !handlerBase) ||
        !asistencia.inicializado;

      console.log("🎯 EVALUACIÓN COMPLETA:", {
        inicializado,
        asistenciaIDB: !!asistenciaIDB,
        handlerBase: !!handlerBase,
        asistenciaInicializada: asistencia.inicializado,
        estaInicializando,
        rol,
        esDirectivoOResponsable:
          rol === RolesSistema.Directivo || rol === RolesSistema.Responsable,
      });

      // ✅ MOSTRAR ESTADO DE CARGA mientras se inicializa
      if (estaInicializando) {
        console.log("⏳ RESULTADO: Manteniendo estado de carga");
        setEstadoBoton({
          visible: true,
          tipo: null,
          color: "carga",
          tooltip: "Inicializando sistema...",
          esCarga: true,
        });
        return;
      }

      console.log("✅ INICIALIZACIÓN COMPLETADA - Evaluando condiciones...");

      // ✅ Verificar condiciones especiales
      const condicionEspecial = verificarCondicionesEspeciales();
      if (condicionEspecial) {
        console.log(
          "🚫 RESULTADO: Ocultando por condición especial:",
          condicionEspecial
        );
        setEstadoBoton({
          visible: false,
          tipo: null,
          color: "verde",
          tooltip: "",
          esCarga: false,
        });
        return;
      }

      console.log("✅ Sin condiciones especiales");

      // ✅ Verificar si no hay horario (después de condiciones especiales)
      if (handlerBase && !horario) {
        console.log("🚫 RESULTADO: Ocultando por falta de horario");
        setEstadoBoton({
          visible: false,
          tipo: null,
          color: "verde",
          tooltip: "",
          esCarga: false,
        });
        return;
      }

      console.log("✅ Horario disponible:", !!horario);

      // ✅ USAR EL MODO ACTUAL CALCULADO POR EL HOOK COMPARTIDO
      console.log("🎯 MODO ACTUAL EVALUADO:", {
        activo: modoActual.activo,
        tipo: modoActual.tipo,
        razon: modoActual.razon,
      });

      // ✅ Si el modo no está activo (fuera del rango de tiempo), OCULTAR el botón
      if (!modoActual.activo || !modoActual.tipo) {
        console.log(
          "🚫 RESULTADO: Ocultando botón - Fuera del rango de tiempo:",
          modoActual.razon
        );
        setEstadoBoton({
          visible: false,
          tipo: null,
          color: "verde",
          tooltip: "",
          esCarga: false,
        });
        return;
      }

      console.log("✅ Dentro del rango de tiempo válido");

      // ✅ VERIFICAR SI YA SE MARCÓ LA ASISTENCIA DEL MODO ACTUAL (USANDO DATOS COMPARTIDOS)
      const yaSeMarco =
        modoActual.tipo === ModoRegistro.Entrada
          ? asistencia.entradaMarcada
          : asistencia.salidaMarcada;

      console.log("🎯 VERIFICACIÓN DE ASISTENCIA:", {
        modoTipo: modoActual.tipo,
        entradaMarcada: asistencia.entradaMarcada,
        salidaMarcada: asistencia.salidaMarcada,
        yaSeMarco,
      });

      if (yaSeMarco) {
        console.log(
          `🚫 RESULTADO: Ocultando botón - ${modoActual.tipo} ya marcada`
        );
        setEstadoBoton({
          visible: false,
          tipo: null,
          color: "verde",
          tooltip: "",
          esCarga: false,
        });
        return;
      }

      // ✅ MOSTRAR BOTÓN CON EL MODO ACTUAL
      const esEntrada = modoActual.tipo === ModoRegistro.Entrada;
      const color = esEntrada ? "verde" : "rojizo";

      console.log(
        `👁️ RESULTADO: Mostrando botón ${color} para ${modoActual.tipo}`
      );

      setEstadoBoton({
        visible: true,
        tipo: modoActual.tipo,
        color,
        tooltip: `¡Registra tu ${modoRegistroTextos[modoActual.tipo]}!`,
        esCarga: false,
      });

      console.log("🔍 ===== FIN actualizarEstadoBoton =====");
    }, [
      inicializado,
      asistenciaIDB,
      handlerBase,
      asistencia.inicializado,
      asistencia.entradaMarcada,
      asistencia.salidaMarcada,
      horario,
      rol,
      modoActual,
      verificarCondicionesEspeciales,
    ]);

    // ✅ FUNCIÓN: Verificar y mostrar mensaje informativo
    const verificarMensajeInformativo = useCallback(() => {
      // Solo mostrar si no se ha mostrado antes en esta sesión
      if (tooltipOculto) return;

      // Verificar condiciones en orden de prioridad
      const condicionEspecial = verificarCondicionesEspeciales();
      if (condicionEspecial) {
        let tipo: MensajeInformativo["tipo"] = "sin-horario";

        if (condicionEspecial.includes("Fuera del período")) {
          tipo = "fuera-año";
        } else if (
          condicionEspecial.includes("domingo") ||
          condicionEspecial.includes("sábado")
        ) {
          tipo = "fin-semana";
        } else if (condicionEspecial.includes("Aún no puedes")) {
          tipo = "fecha-no-disponible";
        } else if (condicionEspecial.includes("no se registra asistencia")) {
          tipo = "dia-evento";
        }

        setMensajeInformativo({
          mostrar: true,
          texto: condicionEspecial,
          tipo,
        });
        return;
      }

      // Verificar si no hay horario
      if (handlerBase && !horario) {
        setMensajeInformativo({
          mostrar: true,
          texto: "No hay asistencia que debas registrar hoy",
          tipo: "sin-horario",
        });
        return;
      }
    }, [tooltipOculto, verificarCondicionesEspeciales, handlerBase, horario]);

    // ✅ INICIALIZACIÓN (SOLO AsistenciaIDB, sin más consultas)
    useEffect(() => {
      console.log("🔧 INICIALIZANDO AsistenciaDePersonalIDB...");
      const nuevaAsistenciaIDB = new AsistenciaDePersonalIDB("API01");
      setAsistenciaIDB(nuevaAsistenciaIDB);
      console.log(
        "✅ AsistenciaDePersonalIDB inicializada:",
        nuevaAsistenciaIDB
      );
    }, []);

    // ✅ NUEVO: Verificar mensaje informativo cuando se obtiene handler/horario
    useEffect(() => {
      if (handlerBase && inicializado) {
        verificarMensajeInformativo();
      }
    }, [handlerBase, horario, inicializado, verificarMensajeInformativo]);

    // ✅ EFECTO PRINCIPAL: Actualizar estado del botón cuando cambien los datos compartidos
    useEffect(() => {
      actualizarEstadoBoton();
    }, [actualizarEstadoBoton]);

    // ✅ DELEGACIÓN DE EVENTOS PARA TOOLTIP
    useEffect(() => {
      if (!delegarEvento) return;
      delegarEvento(
        "mousedown",
        "#tooltip-mostrar-asistencia-personal, #tooltip-mostrar-asistencia-personal *",
        () => ocultarTooltip(),
        true
      );
    }, [delegarEvento, ocultarTooltip]);

    // ✅ MOSTRAR TOOLTIP AL CAMBIAR TIPO (solo si no hay mensaje informativo)
    useEffect(() => {
      if (estadoBoton.tipo && !mensajeInformativo.mostrar) {
        mostrarTooltip();
      }
    }, [estadoBoton.tipo, mensajeInformativo.mostrar, mostrarTooltip]);

    // ✅ HANDLE CLICK - No permitir click en estado de carga
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

    // ✅ FUNCIÓN: Marcar asistencia de hoy (USANDO DATOS COMPARTIDOS)
    const marcarMiAsistenciaDeHoy = useCallback(async () => {
      try {
        if (!estadoBoton.tipo || !horario) {
          console.error("❌ No hay tipo de registro o horario disponible");
          return;
        }

        // Obtener la hora esperada ISO basada en el modo de registro
        const fechaActual = obtenerFechaActual();
        if (!fechaActual) {
          console.error("❌ No se pudo obtener la fecha actual");
          return;
        }

        let horaEsperadaISO: string;

        if (estadoBoton.tipo === ModoRegistro.Entrada) {
          // Para entrada, usar hora de inicio del horario
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
          // Para salida, usar hora de fin del horario
          const horaFin = new Date(horario.Fin);
          const fechaFinHoy = new Date(fechaActual);
          fechaFinHoy.setHours(horaFin.getHours(), horaFin.getMinutes(), 0, 0);
          horaEsperadaISO = fechaFinHoy.toISOString();
        }

        console.log(
          `🕐 Hora esperada ISO para ${estadoBoton.tipo}:`,
          horaEsperadaISO
        );

        // Intentar marcar asistencia usando el orquestador
        if (!asistenciaIDB) {
          console.error("❌ AsistenciaIDB no disponible");
          return;
        }

        // ✅ MARCAR ASISTENCIA
        await asistenciaIDB.marcarMiAsistenciaPropia(
          rol,
          estadoBoton.tipo,
          horaEsperadaISO
        );

        // ✅ GUARDAR LA FECHA/HORA DE REGISTRO EXITOSO
        setFechaHoraRegistro(
          new Date(store.getState().others.fechaHoraActualReal.fechaHora!)
        ); // Hora actual del registro

        await refrescarAsistencia();

        // ✅ NUEVO: OCULTAR BOTÓN INMEDIATAMENTE DESPUÉS DEL REGISTRO EXITOSO
        console.log(
          `✅ Asistencia de ${estadoBoton.tipo} marcada exitosamente - Ocultando botón`
        );

        console.log("✅ Asistencia marcada exitosamente");
      } catch (error) {
        console.error("❌ Error al marcar mi asistencia:", error);
        throw error; // Re-lanzar para que el modal lo maneje
      }
    }, [
      estadoBoton.tipo,
      horario,
      obtenerFechaActual,
      asistenciaIDB,
      rol,
      actualizarEstadoBoton,
    ]);

    // ✅ RENDER: Mensaje informativo o botón
    const mostrarTooltipActual = !tooltipOculto && !mensajeInformativo.mostrar;

    return (
      <>
        {/* ✅ MENSAJE INFORMATIVO */}
        {mensajeInformativo.mostrar && (
          <MensajeInformativoAsistencia
            mensaje={mensajeInformativo}
            onCerrar={ocultarMensajeInformativo}
            navbarHeight={navbarFooter.height}
          />
        )}

        {/* ✅ MODALES */}
        {mostrarModalTomarMiAsistencia && (
          <MarcarAsistenciaPropiaDePersonalModal
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
              setFechaHoraRegistro(null); // Limpiar la fecha al cerrar
            }}
            fechaHoraRegistro={fechaHoraRegistro}
            modoRegistro={estadoBoton.tipo}
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

        /* ✅ NUEVOS: Estilos para móviles con sombra reducida y más separación */
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

        /* Estilos originales para pantallas grandes */
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

        {/* ✅ BOTÓN: Ahora incluye estado de carga */}
        {estadoBoton.visible && (
          <div
            className="fixed z-[102] right-0 Mover-NavBarFooter
             sxs-only:mr-3 sxs-only:mb-3
             xs-only:mr-4 xs-only:mb-4
             sm-only:mr-5 sm-only:mb-4
             mr-6 mb-5"
            style={{ bottom: navbarFooter.height + 80 }}
          >
            {/* Tooltip - Solo mostrar si NO es estado de carga */}
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
                    estadoBoton.color === "verde"
                      ? "bg-azul-principal"
                      : estadoBoton.color === "rojizo"
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
                     estadoBoton.color === "verde"
                       ? "border-l-azul-principal"
                       : estadoBoton.color === "rojizo"
                       ? "border-l-red-600"
                       : "border-l-blue-600"
                   }`}
                  ></div>
                </div>
              </div>
            )}

            {/* Botón */}
            <button
              onClick={handleClick}
              disabled={estadoBoton.esCarga}
              title={
                estadoBoton.esCarga
                  ? "Inicializando..."
                  : `Registrar ${estadoBoton.tipo}`
              }
              className={`${
                estadoBoton.esCarga
                  ? "button-enhanced-carga"
                  : mostrarTooltipActual
                  ? estadoBoton.color === "verde"
                    ? "button-enhanced-verde"
                    : "button-enhanced-rojizo"
                  : "transition-all duration-300"
              }
             relative overflow-hidden aspect-square
             ${
               estadoBoton.color === "verde"
                 ? "bg-gradient-to-br from-verde-principal to-green-600 hover:from-green-500 hover:to-green-700"
                 : estadoBoton.color === "rojizo"
                 ? "bg-gradient-to-br from-red-500 to-red-700 hover:from-red-600 hover:to-red-800"
                 : "bg-gradient-to-br from-blue-500 to-blue-600" // Estado de carga
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
               estadoBoton.color === "carga"
                 ? "border-blue-400/20"
                 : "border-green-400/20"
             }
             sxs-only:w-12 sxs-only:h-12 sxs-only:p-2
             xs-only:w-14 xs-only:h-14 xs-only:p-3
             sm-only:w-16 sm-only:h-16 sm-only:p-3
             w-18 h-18 p-4`}
            >
              {/* Efecto de brillo en hover - solo si no es estado de carga */}
              {!estadoBoton.esCarga && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -skew-x-12 transform -translate-x-full hover:translate-x-full transition-transform duration-700"></div>
              )}

              {/* Contenido del botón */}
              {estadoBoton.esCarga ? (
                // ✅ Spinner de carga
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
                // ✅ Icono normal de lápiz
                <LapizFirmando className="text-white relative z-10 drop-shadow-sm sxs-only:w-6 xs-only:w-7 sm-only:w-8 w-8" />
              )}

              {/* Punto de notificación cuando hay tooltip - Solo si NO es estado de carga */}
              {mostrarTooltipActual && !estadoBoton.esCarga && (
                <div
                  className={`absolute -top-1 -right-1 w-3 h-3 rounded-full border-2 border-white animate-ping
                 sxs-only:w-2 sxs-only:h-2 ${
                   estadoBoton.color === "verde"
                     ? "bg-blue-500"
                     : "bg-yellow-500"
                 }`}
                />
              )}

              {/* Indicadores de estado - Solo si NO es estado de carga */}
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
                        ? "Entrada registrada"
                        : "Entrada pendiente"
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
                        ? "Salida registrada"
                        : "Salida pendiente"
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
