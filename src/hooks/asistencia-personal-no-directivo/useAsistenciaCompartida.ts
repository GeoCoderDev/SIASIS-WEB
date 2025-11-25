// hooks/useAsistenciaCompartida.ts
import { useCallback, useEffect, useState, useRef } from "react";
import { useSelector } from "react-redux";
import store, { RootState } from "@/global/store";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { AsistenciaDePersonalIDB } from "@/lib/utils/local/db/models/AsistenciaDePersonal/AsistenciaDePersonalIDB";
import { DatosAsistenciaHoyIDB } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/DatosAsistenciaHoyIDB";
import { HandlerAsistenciaBase } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerDatosAsistenciaBase";
import { HandlerProfesorPrimariaAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerProfesorPrimariaAsistenciaResponse";
import { HandlerAuxiliarAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerAuxiliarAsistenciaResponse";
import { HandlerProfesorTutorSecundariaAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerProfesorTutorSecundariaAsistenciaResponse";
import { HandlerPersonalAdministrativoAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerPersonalAdministrativoAsistenciaResponse";
import { HorarioTomaAsistencia } from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import {
  HORAS_ANTES_INICIO_ACTIVACION,
  HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_PERSONAL,
  HORAS_DESPUES_SALIDA_LIMITE,
  INTERVALO_CONSULTA_ASISTENCIA_OPTIMIZADO_MS,
} from "@/constants/INTERVALOS_CONSULTAS_ASISTENCIAS_PROPIAS_PARA_PERSONAL_NO_DIRECTIVO";

// ✅ INTERFACES
export interface EstadoAsistenciaCompartido {
  entradaMarcada: boolean;
  salidaMarcada: boolean;
  inicializado: boolean;
}

export interface ModoActualCompartido {
  activo: boolean;
  tipo: ModoRegistro | null;
  razon: string;
}

export interface DatosAsistenciaCompartidos {
  horario: HorarioTomaAsistencia | null;
  handlerBase: HandlerAsistenciaBase | null;
  asistencia: EstadoAsistenciaCompartido;
  modoActual: ModoActualCompartido;
  inicializado: boolean;
  consultaInicialCompletada: boolean;
  // ✅ NEW FUNCTION TO REFRESH IMMEDIATELY
  refrescarAsistencia: () => Promise<void>;
}

// ✅ CONSTANTS
const RETRY_HORARIO_MS = 30000;
const TIMEOUT_EMERGENCIA_REINTENTO_MS = 3800;

// ✅ OPTIMIZED SELECTOR
const selectHoraMinutoActual = (state: RootState) => {
  const fechaHora = state.others.fechaHoraActualReal.fechaHora;
  if (!fechaHora) return null;

  const fecha = new Date(fechaHora);
  fecha.setHours(fecha.getHours() - 5);
  const timestamp = Math.floor(fecha.getTime() / 60000) * 60000;

  return {
    fecha,
    timestamp,
    hora: fecha.getHours(),
    minuto: fecha.getMinutes(),
  };
};

export const useAsistenciaCompartida = (
  rol: RolesSistema
): DatosAsistenciaCompartidos => {
  // ✅ SELECTORS
  const horaMinutoActual = useSelector(selectHoraMinutoActual);
  const reduxInicializado = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal.inicializado
  );

  // ✅ STATES
  const [horario, setHorario] = useState<HorarioTomaAsistencia | null>(null);
  const [handlerBase, setHandlerBase] = useState<HandlerAsistenciaBase | null>(
    null
  );
  const [inicializado, setInicializado] = useState(false);
  const [asistenciaIDB, setAsistenciaIDB] =
    useState<AsistenciaDePersonalIDB | null>(null);
  const [asistencia, setAsistencia] = useState<EstadoAsistenciaCompartido>({
    entradaMarcada: false,
    salidaMarcada: false,
    inicializado: false,
  });
  const [consultaInicialCompletada, setConsultaInicialCompletada] =
    useState(false);
  const [consultaInicialEnProceso, setConsultaInicialEnProceso] =
    useState(false);
  const [timerEmergenciaActivo, setTimerEmergenciaActivo] = useState(true);

  // ✅ REFS
  const retryRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const timerEmergenciaRef = useRef<NodeJS.Timeout | null>(null);
  const consultaEnProcesoRef = useRef<boolean>(false);
  const ultimoModoConsultado = useRef<ModoRegistro | null>(null);

  // ✅ FUNCTION: Get current date from Redux
  const obtenerFechaActual = useCallback((): Date | null => {
    const state = store.getState();
    const fechaHora = state.others.fechaHoraActualReal.fechaHora;
    const inicializado = state.others.fechaHoraActualReal.inicializado;

    if (!fechaHora || !inicializado) return null;

    const fecha = new Date(fechaHora);
    fecha.setHours(fecha.getHours() - 5);
    return fecha;
  }, []);

  // ✅ FUNCTION: Determine current mode based on schedule and date
  const determinarModoActual = useCallback(
    (
      horario: HorarioTomaAsistencia | null,
      fechaActual: Date | null = null
    ): ModoActualCompartido => {
      if (!horario) {
        return { activo: false, tipo: null, razon: "Schedule not available" };
      }

      const fecha = fechaActual || obtenerFechaActual();
      if (!fecha) {
        return { activo: false, tipo: null, razon: "Date not available" };
      }

      const horarioInicio = new Date(horario.Inicio);
      const horarioFin = new Date(horario.Fin);

      const inicioHoy = new Date(fecha);
      inicioHoy.setHours(
        horarioInicio.getHours(),
        horarioInicio.getMinutes(),
        0,
        0
      );

      const finHoy = new Date(fecha);
      finHoy.setHours(horarioFin.getHours(), horarioFin.getMinutes(), 0, 0);

      const unaHoraAntesInicio = new Date(
        inicioHoy.getTime() - HORAS_ANTES_INICIO_ACTIVACION * 60 * 60 * 1000
      );
      const unaHoraAntesSalida = new Date(
        finHoy.getTime() -
          HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_PERSONAL * 60 * 60 * 1000
      );
      const dosHorasDespuesSalida = new Date(
        finHoy.getTime() + HORAS_DESPUES_SALIDA_LIMITE * 60 * 60 * 1000
      );

      if (fecha < unaHoraAntesInicio) {
        return {
          activo: false,
          tipo: null,
          razon: `Too early. Activation at ${unaHoraAntesInicio.toLocaleTimeString()}`,
        };
      }

      if (fecha > dosHorasDespuesSalida) {
        return {
          activo: false,
          tipo: null,
          razon: "Attendance period finished",
        };
      }

      if (fecha < unaHoraAntesSalida) {
        return {
          activo: true,
          tipo: ModoRegistro.Entrada,
          razon: "Entry registration period",
        };
      } else {
        return {
          activo: true,
          tipo: ModoRegistro.Salida,
          razon: "Exit registration period",
        };
      }
    },
    [obtenerFechaActual]
  );

  // ✅ FUNCTION: Consult attendance for specific mode
  const consultarAsistenciaModo = useCallback(
    async (modo: ModoRegistro, razon: string): Promise<void> => {
      if (!asistenciaIDB) {
        console.log("❌ AsistenciaIDB not available");
        return;
      }

      // ✅ IMMEDIATE PROTECTION WITH REF
      if (consultaEnProcesoRef.current) {
        console.log(
          `⏭️ QUERY ALREADY IN PROGRESS - BLOCKING ${modo} (${razon})`
        );
        return;
      }

      try {
        console.log(`🔍 CONSULTING ${modo} - Reason: ${razon}`);

        // ✅ BLOCK IMMEDIATELY
        consultaEnProcesoRef.current = true;
        setConsultaInicialEnProceso(true);

        const resultado = await asistenciaIDB.consultarMiAsistenciaDeHoy(
          modo,
          rol
        );

        console.log(`✅ Result ${modo}:`, {
          marcada: resultado.marcada,
          fuente: resultado.fuente,
        });

        setAsistencia((prev) => ({
          ...prev,
          entradaMarcada:
            modo === ModoRegistro.Entrada
              ? resultado.marcada
              : prev.entradaMarcada,
          salidaMarcada:
            modo === ModoRegistro.Salida
              ? resultado.marcada
              : prev.salidaMarcada,
          inicializado: true,
        }));

        setConsultaInicialCompletada(true);
      } catch (error) {
        console.error(`❌ Error consulting ${modo}:`, error);
      } finally {
        // ✅ ALWAYS RELEASE LOCKS
        consultaEnProcesoRef.current = false;
        setConsultaInicialEnProceso(false);
      }
    },
    [asistenciaIDB, rol]
  );

  // ✅ NEW FUNCTION: Refresh attendance immediately
  const refrescarAsistencia = useCallback(async (): Promise<void> => {
    if (
      !asistenciaIDB ||
      !horario ||
      rol === RolesSistema.Directivo ||
      rol === RolesSistema.Responsable
    ) {
      console.log(
        "❌ Cannot refresh: missing data or is Director/Guardian"
      );
      return;
    }

    try {
      console.log("🔄 REFRESHING ATTENDANCE IMMEDIATELY...");

      const modoActual = determinarModoActual(horario);

      if (modoActual.activo && modoActual.tipo) {
        // Consult both modes to ensure complete synchronization
        const [resultadoEntrada, resultadoSalida] = await Promise.all([
          asistenciaIDB.consultarMiAsistenciaDeHoy(ModoRegistro.Entrada, rol),
          asistenciaIDB.consultarMiAsistenciaDeHoy(ModoRegistro.Salida, rol),
        ]);

        console.log("✅ DATA REFRESHED:", {
          entrada: resultadoEntrada.marcada,
          salida: resultadoSalida.marcada,
        });

        setAsistencia({
          entradaMarcada: resultadoEntrada.marcada,
          salidaMarcada: resultadoSalida.marcada,
          inicializado: true,
        });
      }
    } catch (error) {
      console.error("❌ Error refreshing attendance:", error);
    }
  }, [asistenciaIDB, horario, rol, determinarModoActual]);

  // ✅ FUNCTION: Get user schedule
  const obtenerHorario = useCallback(async () => {
    if (rol === RolesSistema.Directivo || rol === RolesSistema.Responsable) {
      setInicializado(true);
      return;
    }

    try {
      console.log(`🔄 Getting schedule for ${rol}`);

      const datosIDB = new DatosAsistenciaHoyIDB();
      const handler = (await datosIDB.getHandler()) as HandlerAsistenciaBase;

      if (!handler) {
        console.warn("Handler not available, retrying...");
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(obtenerHorario, RETRY_HORARIO_MS);
        return;
      }

      setHandlerBase(handler);

      let nuevoHorario: HorarioTomaAsistencia | null = null;

      switch (rol) {
        case RolesSistema.ProfesorPrimaria:
          nuevoHorario = (
            handler as HandlerProfesorPrimariaAsistenciaResponse
          ).getMiHorarioTomaAsistencia();
          break;
        case RolesSistema.Auxiliar:
          nuevoHorario = (
            handler as HandlerAuxiliarAsistenciaResponse
          ).getMiHorarioTomaAsistencia();
          break;
        case RolesSistema.ProfesorSecundaria:
        case RolesSistema.Tutor:
          const horarioPersonal = (
            handler as HandlerProfesorTutorSecundariaAsistenciaResponse
          ).getMiHorarioTomaAsistencia();
          if (horarioPersonal) {
            nuevoHorario = {
              Inicio: horarioPersonal.Hora_Entrada_Dia_Actual,
              Fin: horarioPersonal.Hora_Salida_Dia_Actual,
            };
          }
          break;
        case RolesSistema.PersonalAdministrativo:
          const horarioAdmin = (
            handler as HandlerPersonalAdministrativoAsistenciaResponse
          ).getHorarioPersonal();
          if (horarioAdmin) {
            nuevoHorario = {
              Inicio: horarioAdmin.Horario_Laboral_Entrada,
              Fin: horarioAdmin.Horario_Laboral_Salida,
            };
          }
          break;
      }

      if (nuevoHorario) {
        setHorario(nuevoHorario);
        console.log(`✅ Schedule obtained for ${rol}:`, nuevoHorario);
      } else {
        console.warn(
          "Schedule not available, User does not register attendance today..."
        );
        setHorario(null);
      }

      setInicializado(true);
    } catch (error) {
      console.error("Error getting schedule:", error);
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(obtenerHorario, RETRY_HORARIO_MS);
    }
  }, [rol]);

  // ✅ INTELLIGENT PERIODIC CONSULTATION
  const consultaPeriodicaInteligente = useCallback(() => {
    if (!consultaInicialCompletada) {
      console.log(
        "⏭️ Waiting for initial query to complete before periodic query"
      );
      return;
    }

    const modoActual = determinarModoActual(horario);

    if (!modoActual.activo || !modoActual.tipo) {
      console.log("⏭️ No periodic query: mode not active");
      return;
    }

    const yaSeMarco =
      modoActual.tipo === ModoRegistro.Entrada
        ? asistencia.entradaMarcada
        : asistencia.salidaMarcada;

    if (yaSeMarco) {
      console.log(`⏭️ No periodic query: ${modoActual.tipo} already marked`);
      return;
    }

    // ✅ ONLY CONSULT IF IT IS A DIFFERENT MODE
    if (ultimoModoConsultado.current !== modoActual.tipo) {
      console.log(
        `🔄 Mode change detected: ${ultimoModoConsultado.current} → ${modoActual.tipo}`
      );
      ultimoModoConsultado.current = modoActual.tipo;
      consultarAsistenciaModo(
        modoActual.tipo,
        "intelligent periodic consultation"
      );
    }
  }, [
    consultaInicialCompletada,
    horario,
    asistencia.entradaMarcada,
    asistencia.salidaMarcada,
    consultarAsistenciaModo,
    determinarModoActual,
  ]);

  // ✅ EMERGENCY RETRY FUNCTION
  const reintentoForzadoEmergencia = useCallback(() => {
    console.log("🚨 FORCED EMERGENCY RETRY");

    if (consultaEnProcesoRef.current) {
      console.log("⏭️ Query already in progress, skipping emergency");
      setTimerEmergenciaActivo(false);
      return;
    }

    if (!horario && !handlerBase) {
      console.log("🔄 Forcing obtenerHorario()");
      obtenerHorario();
    }

    if (!asistencia.inicializado && horario && !consultaInicialCompletada) {
      console.log("🔄 Executing emergency query");
      const modoActual = determinarModoActual(horario);
      if (modoActual.activo && modoActual.tipo) {
        consultarAsistenciaModo(modoActual.tipo, "emergency");
      }
    }

    setTimerEmergenciaActivo(false);
  }, [
    horario,
    handlerBase,
    asistencia.inicializado,
    consultaInicialCompletada,
    obtenerHorario,
    determinarModoActual,
    consultarAsistenciaModo,
  ]);

  // ✅ EFFECTS
  useEffect(() => {
    console.log("🔧 INITIALIZING AsistenciaDePersonalIDB...");
    const nuevaAsistenciaIDB = new AsistenciaDePersonalIDB("API01");
    setAsistenciaIDB(nuevaAsistenciaIDB);
    console.log("✅ AsistenciaDePersonalIDB initialized:", nuevaAsistenciaIDB);
  }, []);

  useEffect(() => {
    if (!horario && !handlerBase) {
      obtenerHorario();
    }
  }, [horario, handlerBase, obtenerHorario]);

  // ✅ INITIAL QUERY
  // ✅ INITIAL QUERY - CORRECTED VERSION
  useEffect(() => {
    // ✅ NEW CONDITION: Also run when initialized=true EVEN IF there is no schedule
    if (
      inicializado && // ✅ Main change: use 'initialized' instead of 'schedule'
      !asistencia.inicializado &&
      reduxInicializado &&
      !consultaInicialCompletada &&
      !consultaInicialEnProceso
    ) {
      console.log("🚀 STARTING INITIAL QUERY... (Redux already initialized)");

      // ✅ NEW LOGIC: Check if there is a schedule first
      if (!horario) {
        console.log(
          "❌ NO SCHEDULE - Marking as initialized without querying"
        );
        setConsultaInicialCompletada(true);
        setAsistencia((prev) => ({
          ...prev,
          inicializado: true, // ✅ KEY: Mark as initialized even if there is no schedule
        }));
        return;
      }

      // ✅ Only if there is a schedule, proceed with normal logic
      const modoActual = determinarModoActual(horario);

      if (modoActual.activo && modoActual.tipo) {
        console.log("✅ EXECUTING INITIAL QUERY - Mode:", modoActual.tipo);
        ultimoModoConsultado.current = modoActual.tipo;
        consultarAsistenciaModo(modoActual.tipo, "shared initial query");
      } else {
        console.log(
          "❌ INITIAL QUERY NOT EXECUTED - Reason:",
          modoActual.razon
        );
        setConsultaInicialCompletada(true);
        setAsistencia((prev) => ({
          ...prev,
          inicializado: true,
        }));
      }
    }
  }, [
    inicializado, // ✅ Main change: use 'initialized' instead of 'schedule'
    horario, // ✅ Keep schedule as dependency to detect changes
    asistencia.inicializado,
    reduxInicializado,
    consultaInicialCompletada,
    consultaInicialEnProceso,
    consultarAsistenciaModo,
    determinarModoActual,
  ]);

  // ✅ EMERGENCY TIMER
  useEffect(() => {
    if (!timerEmergenciaActivo) return;

    console.log(
      `⏰ Starting emergency timer: ${
        TIMEOUT_EMERGENCIA_REINTENTO_MS / 1000
      } seconds`
    );

    timerEmergenciaRef.current = setTimeout(() => {
      console.log("🚨 EMERGENCY TIMEOUT REACHED");
      reintentoForzadoEmergencia();
    }, TIMEOUT_EMERGENCIA_REINTENTO_MS);

    return () => {
      if (timerEmergenciaRef.current) {
        clearTimeout(timerEmergenciaRef.current);
        timerEmergenciaRef.current = null;
      }
    };
  }, [timerEmergenciaActivo, reintentoForzadoEmergencia]);

  // ✅ PERIODIC INTERVAL
  useEffect(() => {
    if (timerEmergenciaActivo) return;

    if (
      !asistencia.inicializado ||
      !horario ||
      !reduxInicializado ||
      !consultaInicialCompletada
    ) {
      return;
    }

    console.log(
      `⏰ Configuring query every ${
        INTERVALO_CONSULTA_ASISTENCIA_OPTIMIZADO_MS / (1000 * 60)
      } minutes`
    );

    const intervalo = setInterval(() => {
      consultaPeriodicaInteligente();
    }, INTERVALO_CONSULTA_ASISTENCIA_OPTIMIZADO_MS);

    intervalRef.current = intervalo;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    timerEmergenciaActivo,
    asistencia.inicializado,
    horario,
    reduxInicializado,
    consultaInicialCompletada,
    consultaPeriodicaInteligente,
  ]);

  // ✅ DETECT MODE CHANGE
  useEffect(() => {
    if (
      !horaMinutoActual ||
      !asistencia.inicializado ||
      !horario ||
      !reduxInicializado ||
      !consultaInicialCompletada
    )
      return;

    if (horaMinutoActual.minuto % 10 === 0) {
      console.log(
        `🕐 Mode change verification every 10min: ${horaMinutoActual.hora}:${horaMinutoActual.minuto}`
      );

      const modoActual = determinarModoActual(horario, horaMinutoActual.fecha);

      if (
        modoActual.activo &&
        modoActual.tipo &&
        ultimoModoConsultado.current !== modoActual.tipo
      ) {
        console.log(
          `🔄 MODE CHANGE DETECTED: ${ultimoModoConsultado.current} → ${modoActual.tipo}`
        );
        ultimoModoConsultado.current = modoActual.tipo;
        consultarAsistenciaModo(modoActual.tipo, "mode change by schedule");
      }
    }
  }, [
    horaMinutoActual?.timestamp,
    asistencia.inicializado,
    horario,
    reduxInicializado,
    consultaInicialCompletada,
    consultarAsistenciaModo,
    determinarModoActual,
  ]);

  // ✅ CLEANUP
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
      if (timerEmergenciaRef.current) clearTimeout(timerEmergenciaRef.current);
    };
  }, []);

  // ✅ CALCULATE CURRENT MODE
  const modoActual = determinarModoActual(horario);

  return {
    horario,
    handlerBase,
    asistencia,
    modoActual,
    inicializado,
    consultaInicialCompletada,
    refrescarAsistencia, // ✅ NEW EXPOSED FUNCTION
  };
};