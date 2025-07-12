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
import { ModoRegistro } from "@/interfaces/shared/ModoRegistroPersonal";
import {
  HORAS_ANTES_INICIO_ACTIVACION,
  HORAS_ANTES_SALIDA_CAMBIO_MODO,
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
}

// ✅ CONSTANTES
const RETRY_HORARIO_MS = 30000;
const TIMEOUT_EMERGENCIA_REINTENTO_MS = 3800;

// ✅ SELECTOR OPTIMIZADO
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
  // ✅ SELECTORES
  const horaMinutoActual = useSelector(selectHoraMinutoActual);
  const reduxInicializado = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal.inicializado
  );

  // ✅ ESTADOS
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

  // ✅ FUNCIÓN: Obtener fecha actual de Redux
  const obtenerFechaActual = useCallback((): Date | null => {
    const state = store.getState();
    const fechaHora = state.others.fechaHoraActualReal.fechaHora;
    const inicializado = state.others.fechaHoraActualReal.inicializado;

    if (!fechaHora || !inicializado) return null;

    const fecha = new Date(fechaHora);
    fecha.setHours(fecha.getHours() - 5);
    return fecha;
  }, []);

  // ✅ FUNCIÓN: Determinar modo actual basado en horario y fecha
  const determinarModoActual = useCallback(
    (
      horario: HorarioTomaAsistencia | null,
      fechaActual: Date | null = null
    ): ModoActualCompartido => {
      if (!horario) {
        return { activo: false, tipo: null, razon: "Horario no disponible" };
      }

      const fecha = fechaActual || obtenerFechaActual();
      if (!fecha) {
        return { activo: false, tipo: null, razon: "Fecha no disponible" };
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
        finHoy.getTime() - HORAS_ANTES_SALIDA_CAMBIO_MODO * 60 * 60 * 1000
      );
      const dosHorasDespuesSalida = new Date(
        finHoy.getTime() + HORAS_DESPUES_SALIDA_LIMITE * 60 * 60 * 1000
      );

      if (fecha < unaHoraAntesInicio) {
        return {
          activo: false,
          tipo: null,
          razon: `Muy temprano. Activación a las ${unaHoraAntesInicio.toLocaleTimeString()}`,
        };
      }

      if (fecha > dosHorasDespuesSalida) {
        return {
          activo: false,
          tipo: null,
          razon: "Período de asistencia finalizado",
        };
      }

      if (fecha < unaHoraAntesSalida) {
        return {
          activo: true,
          tipo: ModoRegistro.Entrada,
          razon: "Período de registro de entrada",
        };
      } else {
        return {
          activo: true,
          tipo: ModoRegistro.Salida,
          razon: "Período de registro de salida",
        };
      }
    },
    [obtenerFechaActual]
  );

  // ✅ FUNCIÓN: Consultar asistencia del modo específico
  const consultarAsistenciaModo = useCallback(
    async (modo: ModoRegistro, razon: string): Promise<void> => {
      if (!asistenciaIDB) {
        console.log("❌ AsistenciaIDB no disponible");
        return;
      }

      // ✅ PROTECCIÓN INMEDIATA CON REF
      if (consultaEnProcesoRef.current) {
        console.log(
          `⏭️ CONSULTA YA EN PROCESO - BLOQUEANDO ${modo} (${razon})`
        );
        return;
      }

      try {
        console.log(`🔍 CONSULTANDO ${modo} - Razón: ${razon}`);

        // ✅ BLOQUEAR INMEDIATAMENTE
        consultaEnProcesoRef.current = true;
        setConsultaInicialEnProceso(true);

        const resultado = await asistenciaIDB.consultarMiAsistenciaDeHoy(
          modo,
          rol
        );

        console.log(`✅ Resultado ${modo}:`, {
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
        console.error(`❌ Error al consultar ${modo}:`, error);
      } finally {
        // ✅ LIBERAR LOCKS SIEMPRE
        consultaEnProcesoRef.current = false;
        setConsultaInicialEnProceso(false);
      }
    },
    [asistenciaIDB, rol]
  );

  // ✅ FUNCIÓN: Obtener horario del usuario
  const obtenerHorario = useCallback(async () => {
    if (rol === RolesSistema.Directivo || rol === RolesSistema.Responsable) {
      setInicializado(true);
      return;
    }

    try {
      console.log(`🔄 Obteniendo horario para ${rol}`);

      const datosIDB = new DatosAsistenciaHoyIDB();
      const handler = (await datosIDB.getHandler()) as HandlerAsistenciaBase;

      if (!handler) {
        console.warn("Handler no disponible, reintentando...");
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
        console.log(`✅ Horario obtenido para ${rol}:`, nuevoHorario);
      } else {
        console.warn(
          "Horario no disponible, El usuario no registra asistencia hoy..."
        );
        setHorario(null);
      }

      setInicializado(true);
    } catch (error) {
      console.error("Error al obtener horario:", error);
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(obtenerHorario, RETRY_HORARIO_MS);
    }
  }, [rol]);

  // ✅ CONSULTA PERIÓDICA INTELIGENTE
  const consultaPeriodicaInteligente = useCallback(() => {
    if (!consultaInicialCompletada) {
      console.log(
        "⏭️ Esperando consulta inicial completada antes de consulta periódica"
      );
      return;
    }

    const modoActual = determinarModoActual(horario);

    if (!modoActual.activo || !modoActual.tipo) {
      console.log("⏭️ Sin consulta periódica: modo no activo");
      return;
    }

    const yaSeMarco =
      modoActual.tipo === ModoRegistro.Entrada
        ? asistencia.entradaMarcada
        : asistencia.salidaMarcada;

    if (yaSeMarco) {
      console.log(`⏭️ Sin consulta periódica: ${modoActual.tipo} ya marcada`);
      return;
    }

    // ✅ SOLO CONSULTAR SI ES UN MODO DIFERENTE
    if (ultimoModoConsultado.current !== modoActual.tipo) {
      console.log(
        `🔄 Cambio de modo detectado: ${ultimoModoConsultado.current} → ${modoActual.tipo}`
      );
      ultimoModoConsultado.current = modoActual.tipo;
      consultarAsistenciaModo(
        modoActual.tipo,
        "consulta periódica inteligente"
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

  // ✅ FUNCIÓN: Reintento de emergencia
  const reintentoForzadoEmergencia = useCallback(() => {
    console.log("🚨 REINTENTO FORZADO DE EMERGENCIA");

    if (consultaEnProcesoRef.current) {
      console.log("⏭️ Ya hay consulta en proceso, saltando emergencia");
      setTimerEmergenciaActivo(false);
      return;
    }

    if (!horario && !handlerBase) {
      console.log("🔄 Forzando obtenerHorario()");
      obtenerHorario();
    }

    if (!asistencia.inicializado && horario && !consultaInicialCompletada) {
      console.log("🔄 Ejecutando consulta de emergencia");
      const modoActual = determinarModoActual(horario);
      if (modoActual.activo && modoActual.tipo) {
        consultarAsistenciaModo(modoActual.tipo, "emergencia");
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

  // ✅ EFECTOS
  useEffect(() => {
    console.log("🔧 INICIALIZANDO AsistenciaDePersonalIDB...");
    const nuevaAsistenciaIDB = new AsistenciaDePersonalIDB("API01");
    setAsistenciaIDB(nuevaAsistenciaIDB);
    console.log("✅ AsistenciaDePersonalIDB inicializada:", nuevaAsistenciaIDB);
  }, []);

  useEffect(() => {
    if (!horario && !handlerBase) {
      obtenerHorario();
    }
  }, [horario, handlerBase, obtenerHorario]);

  // ✅ CONSULTA INICIAL
  useEffect(() => {
    if (
      horario &&
      !asistencia.inicializado &&
      reduxInicializado &&
      !consultaInicialCompletada &&
      !consultaInicialEnProceso
    ) {
      console.log("🚀 INICIANDO CONSULTA INICIAL... (Redux ya inicializado)");

      const modoActual = determinarModoActual(horario);

      if (modoActual.activo && modoActual.tipo) {
        console.log("✅ EJECUTANDO CONSULTA INICIAL - Modo:", modoActual.tipo);
        ultimoModoConsultado.current = modoActual.tipo;
        consultarAsistenciaModo(modoActual.tipo, "consulta inicial compartida");
      } else {
        console.log(
          "❌ NO SE EJECUTA CONSULTA INICIAL - Razón:",
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
    horario,
    asistencia.inicializado,
    reduxInicializado,
    consultaInicialCompletada,
    consultaInicialEnProceso,
    consultarAsistenciaModo,
    determinarModoActual,
  ]);

  // ✅ TIMER DE EMERGENCIA
  useEffect(() => {
    if (!timerEmergenciaActivo) return;

    console.log(
      `⏰ Iniciando timer de emergencia: ${
        TIMEOUT_EMERGENCIA_REINTENTO_MS / 1000
      } segundos`
    );

    timerEmergenciaRef.current = setTimeout(() => {
      console.log("🚨 TIMEOUT DE EMERGENCIA ALCANZADO");
      reintentoForzadoEmergencia();
    }, TIMEOUT_EMERGENCIA_REINTENTO_MS);

    return () => {
      if (timerEmergenciaRef.current) {
        clearTimeout(timerEmergenciaRef.current);
        timerEmergenciaRef.current = null;
      }
    };
  }, [timerEmergenciaActivo, reintentoForzadoEmergencia]);

  // ✅ INTERVALO PERIÓDICO
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
      `⏰ Configurando consulta cada ${
        INTERVALO_CONSULTA_ASISTENCIA_OPTIMIZADO_MS / (1000 * 60)
      } minutos`
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

  // ✅ DETECTAR CAMBIO DE MODO
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
        `🕐 Verificación de cambio de modo cada 10min: ${horaMinutoActual.hora}:${horaMinutoActual.minuto}`
      );

      const modoActual = determinarModoActual(horario, horaMinutoActual.fecha);

      if (
        modoActual.activo &&
        modoActual.tipo &&
        ultimoModoConsultado.current !== modoActual.tipo
      ) {
        console.log(
          `🔄 CAMBIO DE MODO DETECTADO: ${ultimoModoConsultado.current} → ${modoActual.tipo}`
        );
        ultimoModoConsultado.current = modoActual.tipo;
        consultarAsistenciaModo(modoActual.tipo, "cambio de modo por horario");
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

  // ✅ CALCULAR MODO ACTUAL
  const modoActual = determinarModoActual(horario);

  return {
    horario,
    handlerBase,
    asistencia,
    modoActual,
    inicializado,
    consultaInicialCompletada,
  };
};
