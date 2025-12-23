import { ENTORNO } from "@/constants/ENTORNO";
import { INTERVALO_MINUTOS_SINCRONIZACION_HORA_REAL } from "@/constants/INTERVALO_MINUTOS_SINCRONIZACION_HORA_REAL";
import { ZONA_HORARIA_LOCAL } from "@/constants/ZONA_HORARIA_LOCAL";
import {
  fetchFechaHoraActual,
  setTimezone,
  updateFechaHoraActual,
} from "@/global/state/others/fechaHoraActualReal";
import { AppDispatch, RootState } from "@/global/store";
import { Entorno } from "@/interfaces/shared/Entornos";
import { useEffect, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";

interface UseFechaHoraRealOptions {
  syncInterval?: number; // /ntervalo de sincronización en ms
  updateInterval?: number; // /ntervalo de actualización local en ms
  autoSync?: boolean; // /ncronizar automáticamente al montar
  timezone?: string; // /na horaria
}

export const useFechaHoraReal = ({
  syncInterval = INTERVALO_MINUTOS_SINCRONIZACION_HORA_REAL * 60 * 1000, // / Xnutos
  updateInterval = 1000, // / 1 sendo
  autoSync = ENTORNO !== Entorno.LOCAL, // / Si es difente de local, sincronizar automáticamente
  timezone = ZONA_HORARIA_LOCAL,
}: UseFechaHoraRealOptions = {}) => {
  const dispatch = useDispatch<AppDispatch>();
  const fechaHoraState = useSelector(
    (state: RootState) => state.others.fechaHoraActualReal
  );

  const syncIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // //nción para sincronizar con el servidor
  const sincronizarConServidor = () => {
    dispatch(fetchFechaHoraActual(timezone));
  };

  // // Cambiar lana horaria
  const cambiarZonaHoraria = (nuevaZona: string) => {
    dispatch(setTimezone({ value: nuevaZona }));
    sincronizarConServidor();
  };

  // //ncronización inicial y periódica
  useEffect(() => {
    if (autoSync) {
      sincronizarConServidor();

      // // Limpiarntervalo existente si hay uno
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current);
      }

      // //nfigurar nuevo intervalo
      syncIntervalRef.current = setInterval(
        sincronizarConServidor,
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

  // // Actualizacn local del tiempo cada segundo
  useEffect(() => {
    // // Limpiarntervalo existente si hay uno
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current);
    }

    // //nfigurar nuevo intervalo
    updateIntervalRef.current = setInterval(() => {
      dispatch(updateFechaHoraActual());
    }, updateInterval);

    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
        updateIntervalRef.current = null;
      }
    };
  }, [updateInterval]);

  // // Exnemos solo las funciones básicas
  return {
    sincronizarConServidor,
    cambiarZonaHoraria,
    error: fechaHoraState.error,
    fechaHoraRealState: fechaHoraState,
    // // Datos del estado actual
    fechaHora: fechaHoraState.fechaHora,
    formateada: fechaHoraState.formateada,
    utilidades: fechaHoraState.utilidades,nicializado: fechaHoraState.inicializado,
  };
};

export default useFechaHoraReal;
