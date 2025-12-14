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
  HOURS_BEFORE_START_ACTIVATION,
  HOURS_BEFORE_EXIT_MODE_CHANGE_FOR_STAFF,
  HOURS_AFTER_EXIT_LIMIT,
  OPTIMIZED_ATTENDANCE_QUERY_INTERVAL_MS,
} from "@/constants/INTERVALOS_CONSULTAS_ASISTENCIAS_PROPIAS_PARA_PERSONAL_NO_DIRECTIVO";

// ✅ INTERFACES
export interface SharedAttendanceState {
  entryMarked: boolean;
  exitMarked: boolean;
  initialized: boolean;
}

export interface CurrentSharedMode {
  active: boolean;
  type: ModoRegistro | null;
  reason: string;
}

export interface SharedAttendanceData {
  schedule: HorarioTomaAsistencia | null;
  baseHandler: HandlerAsistenciaBase | null;
  attendance: SharedAttendanceState;
  currentMode: CurrentSharedMode;
  initialized: boolean;
  initialQueryCompleted: boolean;
  // ✅ NEW FUNCTION TO REFRESH IMMEDIATELY
  refreshAttendance: () => Promise<void>;
}

// ✅ CONSTANTS
const SCHEDULE_RETRY_MS = 30000;
const EMERGENCY_RETRY_TIMEOUT_MS = 3800;

// ✅ OPTIMIZED SELECTOR
const selectCurrentHourMinute = (state: RootState) => {
  const dateTime = state.others.fechaHoraActualReal.dateTime;
  if (!dateTime) return null;

  const date = new Date(dateTime);
  date.setHours(date.getHours() - 5);
  const timestamp = Math.floor(date.getTime() / 60000) * 60000;

  return {
    date,
    timestamp,
    hour: date.getHours(),
    minute: date.getMinutes(),
  };
};

export const useAsistenciaCompartida = (
  role: RolesSistema
): SharedAttendanceData => {
  // ✅ SELECTORS
  const currentHourMinute = useSelector(selectCurrentHourMinute);
  const reduxInitialized = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal.initialized
  );

  // ✅ STATES
  const [schedule, setSchedule] = useState<HorarioTomaAsistencia | null>(null);
  const [baseHandler, setBaseHandler] =
    useState<HandlerAsistenciaBase | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [attendanceIDB, setAttendanceIDB] =
    useState<AsistenciaDePersonalIDB | null>(null);
  const [attendance, setAttendance] = useState<SharedAttendanceState>({
    entryMarked: false,
    exitMarked: false,
    initialized: false,
  });
  const [initialQueryCompleted, setInitialQueryCompleted] = useState(false);
  const [initialQueryInProgress, setInitialQueryInProgress] = useState(false);
  const [emergencyTimerActive, setEmergencyTimerActive] = useState(true);

  // ✅ REFS
  const retryRef = useRef<NodeJS.Timeout | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const emergencyTimerRef = useRef<NodeJS.Timeout | null>(null);
  const queryInProgressRef = useRef<boolean>(false);
  const lastConsultedMode = useRef<ModoRegistro | null>(null);

  // ✅ FUNCTION: Get current date from Redux
  const getCurrentDate = useCallback((): Date | null => {
    const state = store.getState();
    const dateTime = state.others.fechaHoraActualReal.dateTime;
    const initialized = state.others.fechaHoraActualReal.initialized;

    if (!dateTime || !initialized) return null;

    const date = new Date(dateTime);
    date.setHours(date.getHours() - 5);
    return date;
  }, []);

  // ✅ FUNCTION: Determine current mode based on schedule and date
  const determineCurrentMode = useCallback(
    (
      schedule: HorarioTomaAsistencia | null,
      currentDate: Date | null = null
    ): CurrentSharedMode => {
      if (!schedule) {
        return { active: false, type: null, reason: "Schedule not available" };
      }

      const date = currentDate || getCurrentDate();
      if (!date) {
        return { active: false, type: null, reason: "Date not available" };
      }

      const scheduleStart = new Date(schedule.Inicio);
      const scheduleEnd = new Date(schedule.Fin);

      const todayStart = new Date(date);
      todayStart.setHours(
        scheduleStart.getHours(),
        scheduleStart.getMinutes(),
        0,
        0
      );

      const todayEnd = new Date(date);
      todayEnd.setHours(scheduleEnd.getHours(), scheduleEnd.getMinutes(), 0, 0);

      const oneHourBeforeStart = new Date(
        todayStart.getTime() - HOURS_BEFORE_START_ACTIVATION * 60 * 60 * 1000
      );
      const oneHourBeforeExit = new Date(
        todayEnd.getTime() -
          HOURS_BEFORE_EXIT_MODE_CHANGE_FOR_STAFF * 60 * 60 * 1000
      );
      const twoHoursAfterExit = new Date(
        todayEnd.getTime() + HOURS_AFTER_EXIT_LIMIT * 60 * 60 * 1000
      );

      if (date < oneHourBeforeStart) {
        return {
          active: false,
          type: null,
          reason: `Too early. Activation at ${oneHourBeforeStart.toLocaleTimeString()}`,
        };
      }

      if (date > twoHoursAfterExit) {
        return {
          active: false,
          type: null,
          reason: "Attendance period finished",
        };
      }

      if (date < oneHourBeforeExit) {
        return {
          active: true,
          type: ModoRegistro.Entrada,
          reason: "Entry registration period",
        };
      } else {
        return {
          active: true,
          type: ModoRegistro.Salida,
          reason: "Exit registration period",
        };
      }
    },
    [getCurrentDate]
  );

  // ✅ FUNCTION: Consult attendance for specific mode
  const queryAttendanceMode = useCallback(
    async (mode: ModoRegistro, reason: string): Promise<void> => {
      if (!attendanceIDB) {
        console.log("❌ AsistenciaIDB not available");
        return;
      }

      // ✅ IMMEDIATE PROTECTION WITH REF
      if (queryInProgressRef.current) {
        console.log(
          `⏭️ QUERY ALREADY IN PROGRESS - BLOCKING ${mode} (${reason})`
        );
        return;
      }

      try {
        console.log(`🔍 CONSULTING ${mode} - Reason: ${reason}`);

        // ✅ BLOCK IMMEDIATELY
        queryInProgressRef.current = true;
        setInitialQueryInProgress(true);

        const result = await attendanceIDB.consultarMiAsistenciaDeHoy(
          mode,
          role
        );

        console.log(`✅ Result ${mode}:`, {
          marked: result.marcada,
          source: result.fuente,
        });

        setAttendance((prev) => ({
          ...prev,
          entryMarked:
            mode === ModoRegistro.Entrada ? result.marcada : prev.entryMarked,
          exitMarked:
            mode === ModoRegistro.Salida ? result.marcada : prev.exitMarked,
          initialized: true,
        }));

        setInitialQueryCompleted(true);
      } catch (error) {
        console.error(`❌ Error consulting ${mode}:`, error);
      } finally {
        // ✅ ALWAYS RELEASE LOCKS
        queryInProgressRef.current = false;
        setInitialQueryInProgress(false);
      }
    },
    [attendanceIDB, role]
  );

  // ✅ NEW FUNCTION: Refresh attendance immediately
  const refreshAttendance = useCallback(async (): Promise<void> => {
    if (
      !attendanceIDB ||
      !schedule ||
      role === RolesSistema.Directivo ||
      role === RolesSistema.Responsable
    ) {
      console.log(
        "❌ Cannot refresh: missing data or is Director/Guardian"
      );
      return;
    }

    try {
      console.log("🔄 REFRESHING ATTENDANCE IMMEDIATELY...");

      const currentMode = determineCurrentMode(schedule);

      if (currentMode.active && currentMode.type) {
        // Consult both modes to ensure complete synchronization
        const [entryResult, exitResult] = await Promise.all([
          attendanceIDB.consultarMiAsistenciaDeHoy(ModoRegistro.Entrada, role),
          attendanceIDB.consultarMiAsistenciaDeHoy(ModoRegistro.Salida, role),
        ]);

        console.log("✅ DATA REFRESHED:", {
          entry: entryResult.marcada,
          exit: exitResult.marcada,
        });

        setAttendance({
          entryMarked: entryResult.marcada,
          exitMarked: exitResult.marcada,
          initialized: true,
        });
      }
    } catch (error) {
      console.error("❌ Error refreshing attendance:", error);
    }
  }, [attendanceIDB, schedule, role, determineCurrentMode]);

  // ✅ FUNCTION: Get user schedule
  const getSchedule = useCallback(async () => {
    if (role === RolesSistema.Directivo || role === RolesSistema.Responsable) {
      setInitialized(true);
      return;
    }

    try {
      console.log(`🔄 Getting schedule for ${role}`);

      const dataIDB = new DatosAsistenciaHoyIDB();
      const handler = (await dataIDB.getHandler()) as HandlerAsistenciaBase;

      if (!handler) {
        console.warn("Handler not available, retrying...");
        if (retryRef.current) clearTimeout(retryRef.current);
        retryRef.current = setTimeout(getSchedule, SCHEDULE_RETRY_MS);
        return;
      }

      setBaseHandler(handler);

      let newSchedule: HorarioTomaAsistencia | null = null;

      switch (role) {
        case RolesSistema.ProfesorPrimaria:
          newSchedule = (
            handler as HandlerProfesorPrimariaAsistenciaResponse
          ).getMiHorarioTomaAsistencia();
          break;
        case RolesSistema.Auxiliar:
          newSchedule = (
            handler as HandlerAuxiliarAsistenciaResponse
          ).getMiHorarioTomaAsistencia();
          break;
        case RolesSistema.ProfesorSecundaria:
        case RolesSistema.Tutor:
          const personalSchedule = (
            handler as HandlerProfesorTutorSecundariaAsistenciaResponse
          ).getMiHorarioTomaAsistencia();
          if (personalSchedule) {
            newSchedule = {
              Inicio: personalSchedule.Hora_Entrada_Dia_Actual,
              Fin: personalSchedule.Hora_Salida_Dia_Actual,
            };
          }
          break;
        case RolesSistema.PersonalAdministrativo:
          const adminSchedule = (
            handler as HandlerPersonalAdministrativoAsistenciaResponse
          ).getHorarioPersonal();
          if (adminSchedule) {
            newSchedule = {
              Inicio: adminSchedule.Horario_Laboral_Entrada,
              Fin: adminSchedule.Horario_Laboral_Salida,
            };
          }
          break;
      }

      if (newSchedule) {
        setSchedule(newSchedule);
        console.log(`✅ Schedule obtained for ${role}:`, newSchedule);
      } else {
        console.warn(
          "Schedule not available, User does not register attendance today..."
        );
        setSchedule(null);
      }

      setInitialized(true);
    } catch (error) {
      console.error("Error getting schedule:", error);
      if (retryRef.current) clearTimeout(retryRef.current);
      retryRef.current = setTimeout(getSchedule, SCHEDULE_RETRY_MS);
    }
  }, [role]);

  // ✅ INTELLIGENT PERIODIC CONSULTATION
  const intelligentPeriodicQuery = useCallback(() => {
    if (!initialQueryCompleted) {
      console.log(
        "⏭️ Waiting for initial query to complete before periodic query"
      );
      return;
    }

    const currentMode = determineCurrentMode(schedule);

    if (!currentMode.active || !currentMode.type) {
      console.log("⏭️ No periodic query: mode not active");
      return;
    }

    const alreadyMarked =
      currentMode.type === ModoRegistro.Entrada
        ? attendance.entryMarked
        : attendance.exitMarked;

    if (alreadyMarked) {
      console.log(`⏭️ No periodic query: ${currentMode.type} already marked`);
      return;
    }

    // ✅ ONLY CONSULT IF IT IS A DIFFERENT MODE
    if (lastConsultedMode.current !== currentMode.type) {
      console.log(
        `🔄 Mode change detected: ${lastConsultedMode.current} → ${currentMode.type}`
      );
      lastConsultedMode.current = currentMode.type;
      queryAttendanceMode(
        currentMode.type,
        "intelligent periodic consultation"
      );
    }
  }, [
    initialQueryCompleted,
    schedule,
    attendance.entryMarked,
    attendance.exitMarked,
    queryAttendanceMode,
    determineCurrentMode,
  ]);

  // ✅ EMERGENCY RETRY FUNCTION
  const forcedEmergencyRetry = useCallback(() => {
    console.log("🚨 FORCED EMERGENCY RETRY");

    if (queryInProgressRef.current) {
      console.log("⏭️ Query already in progress, skipping emergency");
      setEmergencyTimerActive(false);
      return;
    }

    if (!schedule && !baseHandler) {
      console.log("🔄 Forcing getSchedule()");
      getSchedule();
    }

    if (!attendance.initialized && schedule && !initialQueryCompleted) {
      console.log("🔄 Executing emergency query");
      const currentMode = determineCurrentMode(schedule);
      if (currentMode.active && currentMode.type) {
        queryAttendanceMode(currentMode.type, "emergency");
      }
    }

    setEmergencyTimerActive(false);
  }, [
    schedule,
    baseHandler,
    attendance.initialized,
    initialQueryCompleted,
    getSchedule,
    determineCurrentMode,
    queryAttendanceMode,
  ]);

  // ✅ EFFECTS
  useEffect(() => {
    console.log("🔧 INITIALIZING AsistenciaDePersonalIDB...");
    const newAttendanceIDB = new AsistenciaDePersonalIDB("API01");
    setAttendanceIDB(newAttendanceIDB);
    console.log("✅ AsistenciaDePersonalIDB initialized:", newAttendanceIDB);
  }, []);

  useEffect(() => {
    if (!schedule && !baseHandler) {
      getSchedule();
    }
  }, [schedule, baseHandler, getSchedule]);

  // ✅ INITIAL QUERY
  // ✅ INITIAL QUERY - CORRECTED VERSION
  useEffect(() => {
    // ✅ NEW CONDITION: Also run when initialized=true EVEN IF there is no schedule
    if (
      initialized && // ✅ Main change: use 'initialized' instead of 'schedule'
      !attendance.initialized &&
      reduxInitialized &&
      !initialQueryCompleted &&
      !initialQueryInProgress
    ) {
      console.log("🚀 STARTING INITIAL QUERY... (Redux already initialized)");

      // ✅ NEW LOGIC: Check if there is a schedule first
      if (!schedule) {
        console.log(
          "❌ NO SCHEDULE - Marking as initialized without querying"
        );
        setInitialQueryCompleted(true);
        setAttendance((prev) => ({
          ...prev,
          initialized: true, // ✅ KEY: Mark as initialized even if there is no schedule
        }));
        return;
      }

      // ✅ Only if there is a schedule, proceed with normal logic
      const currentMode = determineCurrentMode(schedule);

      if (currentMode.active && currentMode.type) {
        console.log("✅ EXECUTING INITIAL QUERY - Mode:", currentMode.type);
        lastConsultedMode.current = currentMode.type;
        queryAttendanceMode(currentMode.type, "shared initial query");
      } else {
        console.log(
          "❌ INITIAL QUERY NOT EXECUTED - Reason:",
          currentMode.reason
        );
        setInitialQueryCompleted(true);
        setAttendance((prev) => ({
          ...prev,
          initialized: true,
        }));
      }
    }
  }, [
    initialized, // ✅ Main change: use 'initialized' instead of 'schedule'
    schedule, // ✅ Keep schedule as dependency to detect changes
    attendance.initialized,
    reduxInitialized,
    initialQueryCompleted,
    initialQueryInProgress,
    queryAttendanceMode,
    determineCurrentMode,
  ]);

  // ✅ EMERGENCY TIMER
  useEffect(() => {
    if (!emergencyTimerActive) return;

    console.log(
      `⏰ Starting emergency timer: ${
        EMERGENCY_RETRY_TIMEOUT_MS / 1000
      } seconds`
    );

    emergencyTimerRef.current = setTimeout(() => {
      console.log("🚨 EMERGENCY TIMEOUT REACHED");
      forcedEmergencyRetry();
    }, EMERGENCY_RETRY_TIMEOUT_MS);

    return () => {
      if (emergencyTimerRef.current) {
        clearTimeout(emergencyTimerRef.current);
        emergencyTimerRef.current = null;
      }
    };
  }, [emergencyTimerActive, forcedEmergencyRetry]);

  // ✅ PERIODIC INTERVAL
  useEffect(() => {
    if (emergencyTimerActive) return;

    if (
      !attendance.initialized ||
      !schedule ||
      !reduxInitialized ||
      !initialQueryCompleted
    ) {
      return;
    }

    console.log(
      `⏰ Configuring query every ${
        OPTIMIZED_ATTENDANCE_QUERY_INTERVAL_MS / (1000 * 60)
      } minutes`
    );

    const interval = setInterval(() => {
      intelligentPeriodicQuery();
    }, OPTIMIZED_ATTENDANCE_QUERY_INTERVAL_MS);

    intervalRef.current = interval;

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    emergencyTimerActive,
    attendance.initialized,
    schedule,
    reduxInitialized,
    initialQueryCompleted,
    intelligentPeriodicQuery,
  ]);

  // ✅ DETECT MODE CHANGE
  useEffect(() => {
    if (
      !currentHourMinute ||
      !attendance.initialized ||
      !schedule ||
      !reduxInitialized ||
      !initialQueryCompleted
    )
      return;

    if (currentHourMinute.minute % 10 === 0) {
      console.log(
        `🕐 Mode change verification every 10min: ${currentHourMinute.hour}:${currentHourMinute.minute}`
      );

      const currentMode = determineCurrentMode(schedule, currentHourMinute.date);

      if (
        currentMode.active &&
        currentMode.type &&
        lastConsultedMode.current !== currentMode.type
      ) {
        console.log(
          `🔄 MODE CHANGE DETECTED: ${lastConsultedMode.current} → ${currentMode.type}`
        );
        lastConsultedMode.current = currentMode.type;
        queryAttendanceMode(currentMode.type, "mode change by schedule");
      }
    }
  }, [
    currentHourMinute?.timestamp,
    attendance.initialized,
    schedule,
    reduxInitialized,
    initialQueryCompleted,
    queryAttendanceMode,
    determineCurrentMode,
  ]);

  // ✅ CLEANUP
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (retryRef.current) clearTimeout(retryRef.current);
      if (emergencyTimerRef.current) clearTimeout(emergencyTimerRef.current);
    };
  }, []);

  // ✅ CALCULATE CURRENT MODE
  const currentMode = determineCurrentMode(schedule);

  return {
    schedule,
    baseHandler,
    attendance,
    currentMode,
    initialized,
    initialQueryCompleted,
    refreshAttendance, // ✅ NEW EXPOSED FUNCTION
  };
};