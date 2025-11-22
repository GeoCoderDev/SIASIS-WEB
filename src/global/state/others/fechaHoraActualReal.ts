import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { ReduxPayload } from "../ReducersPayload";
import getRandomAPI03IntanceURL from "@/lib/helpers/functions/getRandomAPI03InstanceURL";
import { ZONA_HORARIA_LOCAL } from "@/constants/ZONA_HORARIA_LOCAL";
import {
  DiasSemana,
  diasSemanaTextos,
  diasSemanaTextosCortos,
} from "@/interfaces/shared/DiasSemana";
import {
  Meses,
  mesesTextos,
  mesesTextosCortos,
} from "@/interfaces/shared/Meses";
import { ENTORNO } from "@/constants/ENTORNO";
import { Entorno } from "@/interfaces/shared/Entornos";
import {
  OFFSET_DIAS_ADICIONALES_SIU01,
  OFFSET_HORAS_ADICIONALES_SIU01,
  OFFSET_MINUTOS_ADICIONALES_SIU01,
  OFFSET_SEGUNDOS_ADICIONALES_SIU01,
} from "@/constants/mocks/OFFSET_FECHAS_HORAS_SIU01";

// Constant for time offset (for testing)
// Modify these values to change the offset applied to server time
export const TIME_OFFSET = {
  days: OFFSET_DIAS_ADICIONALES_SIU01, // Additional days for offset
  hours: OFFSET_HORAS_ADICIONALES_SIU01, // Add 'hours' property with a default value
  minutes: OFFSET_MINUTOS_ADICIONALES_SIU01,
  seconds: OFFSET_SEGUNDOS_ADICIONALES_SIU01,
  enabled: ENTORNO === Entorno.LOCAL, // Enable/disable offset
};

// Interfaces for formatted time data and utilities
export interface FormatosHora {
  fechaCompleta: string;
  fechaCorta: string;
  horaCompleta: string;
  horaSinSegundos: string;

  // New formats
  fechaLegible: string; // Example: "Monday, January 15, 2024"
  fechaNumericaCorta: string; // Example: "15/01/2024"
  horaAmPm: string; // Example: "10:30 AM"
}

export interface UtilidadesTiempo {
  hora: number;
  minutos: number;
  segundos: number;
  esDiaEscolar: boolean;
  diaSemana: string; // Day name (Monday, Tuesday, etc)
  diaSemanaCorto: string; // Abbreviation (Mon, Tue, etc)
  diaSemanaIndice: number; // 0-6 (0 = Sunday, 6 = Saturday)
  diaMes: number; // 1-31
  mes: string; // Month name (January, February, etc)
  mesCorto: string; // Abbreviation (Jan, Feb, etc)
  mesIndice: number; // 0-11 (0 = January, 11 = December)
  año: number; // Full year (e.g.: 2024)
  diasEnMes: number; // Number of days in the current month
  esFinDeSemana: boolean; // true if Saturday or Sunday
  trimestre: number; // 1-4 (quarter of the year)
  semanaDelAño: number; // 1-53
  diaDelAño: number; // 1-366
  esHoy: boolean; // true if date is today (ignoring time)
  timestamp: number; // timestamp in milliseconds
}

// Interface for current date and time with formatted data
export interface FechaHoraActualRealState {
  fechaHora: string | null;
  timezone: string;
  lastSync: number;
  error: string | null;
  inicializado: boolean;
  formateada: FormatosHora | null;
  utilidades: UtilidadesTiempo | null;
}

const initialState: FechaHoraActualRealState = {
  fechaHora: null,
  timezone: ZONA_HORARIA_LOCAL,
  lastSync: 0,
  error: null,
  inicializado: false,
  formateada: null,
  utilidades: null,
};

/**
 * Gets the number of days in a specific month
 * @param año Year
 * @param mes Month (0-11)
 * @returns Number of days in the month
 */
export const obtenerDiasEnMes = (año: number, mes: number): number => {
  return new Date(año, mes + 1, 0).getDate();
};

/**
 * Gets the week number of the year
 * @param fecha Date to evaluate
 * @returns Week number (1-53)
 */
export const obtenerSemanaDelAño = (fecha: Date): number => {
  // Create a copy of the date to avoid modifying the original
  const fechaCopia = new Date(fecha);

  // Get the first day of the year
  const primerDiaAño = new Date(fecha.getFullYear(), 0, 1);

  // Adjust to the first day of the week (Sunday)
  const diaSemana = primerDiaAño.getDay();
  primerDiaAño.setDate(primerDiaAño.getDate() - diaSemana);

  // Calculate days elapsed since the beginning of the year
  const msDiff = fechaCopia.getTime() - primerDiaAño.getTime();
  const diasDesdeInicio = Math.floor(msDiff / (24 * 60 * 60 * 1000));

  // Calculate the week
  const semana = Math.ceil((diasDesdeInicio + 1) / 7);

  return semana;
};

/**
 * Gets the day of the year (1-366)
 * @param fecha Date to evaluate
 * @returns Day of the year
 */
export const obtenerDiaDelAño = (fecha: Date): number => {
  const inicioAño = new Date(fecha.getFullYear(), 0, 0);
  const diff = fecha.getTime() - inicioAño.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
};

/**
 * Gets the quarter of the year (1-4)
 * @param fecha Date to evaluate
 * @returns Quarter number
 */
export const obtenerTrimestre = (fecha: Date): number => {
  return Math.ceil((fecha.getMonth() + 1) / 3);
};

/**
 * Checks if two dates correspond to the same day (ignoring time)
 * @param fecha1 First date
 * @param fecha2 Second date
 * @returns true if both dates are on the same day
 */
export const esMismoDia = (fecha1: Date, fecha2: Date): boolean => {
  return (
    fecha1.getFullYear() === fecha2.getFullYear() &&
    fecha1.getMonth() === fecha2.getMonth() + 1 &&
    fecha1.getDate() === fecha2.getDate()
  );
};

// Thunk to get server time
export const fetchFechaHoraActual = createAsyncThunk(
  "fechaHoraActualReal/fetch",
  async (timezone: string = ZONA_HORARIA_LOCAL, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${getRandomAPI03IntanceURL()}/api/time?timezone=${timezone}`
      );

      if (!response.ok) {
        throw new Error("Error al obtener la hora del servidor");
      }

      const data = await response.json();

      // Create a date using the timestamp already adjusted to the timezone
      const fechaLocal = new Date(data.serverTime);

      // Apply the offset if enabled
      if (TIME_OFFSET.enabled) {
        fechaLocal.setDate(fechaLocal.getDate() + TIME_OFFSET.days);
        fechaLocal.setHours(fechaLocal.getHours() + TIME_OFFSET.hours);
        fechaLocal.setMinutes(fechaLocal.getMinutes() + TIME_OFFSET.minutes);
        fechaLocal.setSeconds(fechaLocal.getSeconds() + TIME_OFFSET.seconds);
      }

      return {
        fechaHora: fechaLocal.toISOString(),
        timezone: data.timezone,
        lastSync: Date.now(),
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Error desconocido"
      );
    }
  }
);

// Helper function to update formats and utilities
const actualizarFormatosYUtilidades = (state: FechaHoraActualRealState) => {
  if (!state.fechaHora) {
    state.formateada = null;
    state.utilidades = null;
    return;
  }

  const fechaHoraDate = new Date(state.fechaHora);
  const ahora = new Date();

  // Update formats without specifying timeZone to avoid double adjustment
  state.formateada = {
    fechaCompleta: new Intl.DateTimeFormat("es-PE", {
      dateStyle: "full",
      timeStyle: "long",
    }).format(fechaHoraDate),

    fechaCorta: new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(fechaHoraDate),

    horaCompleta: new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(fechaHoraDate),

    horaSinSegundos: new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(fechaHoraDate),

    // New formats
    fechaLegible: `${
      diasSemanaTextos[fechaHoraDate.getDay() as DiasSemana]
    }, ${fechaHoraDate.getDate()} de ${
      mesesTextos[(fechaHoraDate.getMonth() + 1) as Meses]
    } de ${fechaHoraDate.getFullYear()}`,

    fechaNumericaCorta: `${fechaHoraDate
      .getDate()
      .toString()
      .padStart(2, "0")}/${(fechaHoraDate.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${fechaHoraDate.getFullYear()}`,

    horaAmPm: new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(fechaHoraDate),
  };

  // Get additional date data
  const diaSemanaIndice = fechaHoraDate.getDay() as DiasSemana;
  const diaMes = fechaHoraDate.getDate();
  const mesIndice = (fechaHoraDate.getMonth() + 1) as Meses;
  const año = fechaHoraDate.getFullYear();
  const hora = fechaHoraDate.getHours();
  const minutos = fechaHoraDate.getMinutes();
  const segundos = fechaHoraDate.getSeconds();

  // Calculate derived values
  const diasEnMes = obtenerDiasEnMes(año, mesIndice);
  const esFinDeSemana = diaSemanaIndice === 0 || diaSemanaIndice === 6;
  const trimestre = obtenerTrimestre(fechaHoraDate);
  const semanaDelAño = obtenerSemanaDelAño(fechaHoraDate);
  const diaDelAño = obtenerDiaDelAño(fechaHoraDate);
  const esHoy = esMismoDia(fechaHoraDate, ahora);
  const timestamp = fechaHoraDate.getTime();

  // Update utilities
  state.utilidades = {
    hora,
    minutos,
    segundos,
    esDiaEscolar: diaSemanaIndice >= 1 && diaSemanaIndice <= 5, // Monday to Friday

    // New fields
    diaSemana: diasSemanaTextos[diaSemanaIndice],
    diaSemanaCorto: diasSemanaTextosCortos[diaSemanaIndice],
    diaSemanaIndice,
    diaMes,
    mes: mesesTextos[mesIndice],
    mesCorto: mesesTextosCortos[mesIndice],
    mesIndice,
    año,
    diasEnMes,
    esFinDeSemana,
    trimestre,
    semanaDelAño,
    diaDelAño,
    esHoy,
    timestamp,
  };

  // Mark as initialized
  state.inicializado = true;
};

const fechaHoraActualRealSlice = createSlice({
  name: "fechaHoraActualReal",
  initialState,
  reducers: {
    setFechaHoraActualReal: (
      state,
      action: PayloadAction<ReduxPayload<string | null>>
    ) => {
      state.fechaHora = action.payload.value;
      actualizarFormatosYUtilidades(state);
    },
    updateFechaHoraActual: (state) => {
      if (state.fechaHora) {
        // Parse the current date
        const fechaActual = new Date(state.fechaHora);

        // Add one second so time advances
        fechaActual.setSeconds(fechaActual.getSeconds() + 1);

        // Update state with the new date
        state.fechaHora = fechaActual.toISOString();

        // Update formats and utilities
        actualizarFormatosYUtilidades(state);
      }
    },
    setTimezone: (state, action: PayloadAction<ReduxPayload<string>>) => {
      state.timezone = action.payload.value;
      // Update formats and utilities with the new timezone
      actualizarFormatosYUtilidades(state);
    },
    avanzarHora: (state, action: PayloadAction<ReduxPayload<number>>) => {
      if (state.fechaHora) {
        const fechaActual = new Date(state.fechaHora);
        fechaActual.setHours(fechaActual.getHours() + action.payload.value);
        state.fechaHora = fechaActual.toISOString();
        actualizarFormatosYUtilidades(state);
      }
    },
    avanzarDia: (state, action: PayloadAction<ReduxPayload<number>>) => {
      if (state.fechaHora) {
        const fechaActual = new Date(state.fechaHora);
        fechaActual.setDate(fechaActual.getDate() + action.payload.value);
        state.fechaHora = fechaActual.toISOString();
        actualizarFormatosYUtilidades(state);
      }
    },
    avanzarMes: (state, action: PayloadAction<ReduxPayload<number>>) => {
      if (state.fechaHora) {
        const fechaActual = new Date(state.fechaHora);
        fechaActual.setMonth(fechaActual.getMonth() + 1 + action.payload.value);
        state.fechaHora = fechaActual.toISOString();
        actualizarFormatosYUtilidades(state);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .addCase(fetchFechaHoraActual.pending, (state: any) => {
        state.error = null;
      })
      .addCase(fetchFechaHoraActual.fulfilled, (state, action) => {
        state.fechaHora = action.payload.fechaHora;
        state.timezone = action.payload.timezone;
        state.lastSync = action.payload.lastSync;
        state.error = null;

        // Update formats and utilities
        actualizarFormatosYUtilidades(state);
      })
      .addCase(fetchFechaHoraActual.rejected, (state, action) => {
        state.error = (action.payload as string) || "Error desconocido";
      });
  },
});

export const {
  setFechaHoraActualReal,
  updateFechaHoraActual,
  setTimezone,
  avanzarHora,
  avanzarDia,
  avanzarMes,
} = fechaHoraActualRealSlice.actions;

export default fechaHoraActualRealSlice.reducer;
