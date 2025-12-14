import { ENTORNO } from "@/constants/ENTORNO";
import { INTERVALO_MINUTOS_SINCRONIZACION_HORA_REAL } from "@/constants/INTERVALO_MINUTOS_SINCRONIZACION_HORA_REAL";
import { LOCAL_TIME_ZONE } from "@/constants/ZONA_HORARIA_LOCAL";
import {
  fetchRealCurrentDateTime,
  setTimezone,
  updateRealCurrentDateTime,
} from "@/global/state/others/fechaHoraActualReal";
import { AppDispatch, RootState } from "@/global/store";
import { Entorno } from "@/interfaces/shared/Entornos";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

interface UseFechaHoraRealOptions {
  syncInterval?: number; // Synchronization interval in ms
  updateInterval?: number; // Local update interval in ms
  autoSync?: boolean; // Automatically sync on mount
  timezone?: string; // Timezone
}

export const useFechaHoraReal = ({
  syncInterval = INTERVALO_MINUTOS_SINCRONIZACION_HORA_REAL * 60 * 1000, // X minutes
  updateInterval = 1000, // 1 second
  autoSync = ENTORNO !== Entorno.LOCAL, // If different from local, sync automatically
  timezone = LOCAL_TIME_ZONE,
}: UseFechaHoraRealOptions = {}) => {
  const dispatch = useDispatch<AppDispatch>();
  const realCurrentDateTimeState = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal
  );

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Function to sync with server
  const syncWithServer = () => {
    dispatch(fetchRealCurrentDateTime(timezone));
  };

  // Change timezone
  const changeTimezone = (newTimezone: string) => {
    dispatch(setTimezone({ value: newTimezone }));
    syncWithServer();
  };

  // Initial and periodic synchronization
  useEffect(() => {
    if (autoSync) {
      syncWithServer();

      // Clear existing interval if there is one
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }

      // Configure new interval
      syncIntervalRef.current = setInterval(
        syncWithServer,
        syncInterval
      );
    }

    return () => {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
        syncIntervalRef.current = null;
      }
    };
  }, [syncInterval, autoSync, timezone]);

  // Local time update every second
  useEffect(() => {
    // Clear existing interval if there is one
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    // Configure new interval
    updateIntervalRef.current = setInterval(() => {
      dispatch(updateRealCurrentDateTime());
    }, updateInterval);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [updateInterval]);

  // We expose only the basic functions
  return {
    syncWithServer,
    changeTimezone,
    error: realCurrentDateTimeState.error,
    realCurrentDateTimeState: realCurrentDateTimeState,
    // Current state data
    dateTime: realCurrentDateTimeState.dateTime,
    formatted: realCurrentDateTimeState.formatted,
    utilities: realCurrentDateTimeState.utilities,
    initialized: realCurrentDateTimeState.initialized,
  };
};

export default useFechaHoraReal;