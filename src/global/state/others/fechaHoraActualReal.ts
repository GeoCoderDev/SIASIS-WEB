import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { ReduxPayload } from "../ReducersPayload";
import getRandomAPI03IntanceURL from "@/lib/helpers/functions/getRandomAPI03InstanceURL";
import { LOCAL_TIME_ZONE } from "@/constants/ZONA_HORARIA_LOCAL";
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
  SIU01_ADDITIONAL_DAYS_OFFSET,
  SIU01_ADDITIONAL_HOURS_OFFSET,
  SIU01_ADDITIONAL_MINUTES_OFFSET,
  SIU01_ADDITIONAL_SECONDS_OFFSET,
} from "@/constants/mocks/OFFSET_FECHAS_HORAS_SIU01";

// Constant for time offset (for testing)
// Modify these values to change the offset applied to server time
export const TIME_OFFSET = {
  days: SIU01_ADDITIONAL_DAYS_OFFSET, // Additional days for offset
  hours: SIU01_ADDITIONAL_HOURS_OFFSET, // Add 'hours' property with a default value
  minutes: SIU01_ADDITIONAL_MINUTES_OFFSET,
  seconds: SIU01_ADDITIONAL_SECONDS_OFFSET,
  enabled: ENTORNO === Entorno.LOCAL, // Enable/disable offset
};

// Interfaces for formatted time data and utilities
export interface TimeFormats {
  fullDate: string;
  shortDate: string;
  fullTime: string;
  timeWithoutSeconds: string;

  // New formats
  readableDate: string; // Example: "Monday, January 15, 2024"
  shortNumericDate: string; // Example: "15/01/2024"
  timeAmPm: string; // Example: "10:30 AM"
}

export interface TimeUtilities {
  hour: number;
  minutes: number;
  seconds: number;
  isSchoolDay: boolean;
  weekDay: string; // Day name (Monday, Tuesday, etc)
  shortWeekDay: string; // Abbreviation (Mon, Tue, etc)
  weekDayIndex: number; // 0-6 (0 = Sunday, 6 = Saturday)
  monthDay: number; // 1-31
  month: string; // Month name (January, February, etc)
  shortMonth: string; // Abbreviation (Jan, Feb, etc)
  monthIndex: number; // 0-11 (0 = January, 11 = December)
  year: number; // Full year (e.g.: 2024)
  daysInMonth: number; // Number of days in the current month
  isWeekend: boolean; // true if Saturday or Sunday
  quarter: number; // 1-4 (quarter of the year)
  weekOfYear: number; // 1-53
  dayOfYear: number; // 1-366
  isToday: boolean; // true if date is today (ignoring time)
  timestamp: number; // timestamp in milliseconds
}

// Interface for current date and time with formatted data
export interface RealCurrentDateTimeState {
  dateTime: string | null;
  timezone: string;
  lastSync: number;
  error: string | null;
  initialized: boolean;
  formatted: TimeFormats | null;
  utilities: TimeUtilities | null;
}

const initialState: RealCurrentDateTimeState = {
  dateTime: null,
  timezone: ZONA_HORARIA_LOCAL,
  lastSync: 0,
  error: null,
  initialized: false,
  formatted: null,
  utilities: null,
};

/**
 * Gets the number of days in a specific month
 * @param year Year
 * @param month Month (0-11)
 * @returns Number of days in the month
 */
export const getDaysInMonth = (year: number, month: number): number => {
  return new Date(year, month + 1, 0).getDate();
};

/**
 * Gets the week number of the year
 * @param date Date to evaluate
 * @returns Week number (1-53)
 */
export const getWeekOfYear = (date: Date): number => {
  // Create a copy of the date to avoid modifying the original
  const dateCopy = new Date(date);

  // Get the first day of the year
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);

  // Adjust to the first day of the week (Sunday)
  const weekDay = firstDayOfYear.getDay();
  firstDayOfYear.setDate(firstDayOfYear.getDate() - weekDay);

  // Calculate days elapsed since the beginning of the year
  const msDiff = dateCopy.getTime() - firstDayOfYear.getTime();
  const daysSinceStart = Math.floor(msDiff / (24 * 60 * 60 * 1000));

  // Calculate the week
  const week = Math.ceil((daysSinceStart + 1) / 7);

  return week;
};

/**
 * Gets the day of the year (1-366)
 * @param date Date to evaluate
 * @returns Day of the year
 */
export const getDayOfYear = (date: Date): number => {
  const startOfYear = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - startOfYear.getTime();
  return Math.floor(diff / (24 * 60 * 60 * 1000));
};

/**
 * Gets the quarter of the year (1-4)
 * @param date Date to evaluate
 * @returns Quarter number
 */
export const getQuarter = (date: Date): number => {
  return Math.ceil((date.getMonth() + 1) / 3);
};

/**
 * Checks if two dates correspond to the same day (ignoring time)
 * @param date1 First date
 * @param date2 Second date
 * @returns true if both dates are on the same day
 */
export const isSameDay = (date1: Date, date2: Date): boolean => {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
};

// Thunk to get server time
export const fetchRealCurrentDateTime = createAsyncThunk(
  "fechaHoraActualReal/fetch",
  async (timezone: string = ZONA_HORARIA_LOCAL, { rejectWithValue }) => {
    try {
      const response = await fetch(
        `${getRandomAPI03IntanceURL()}/api/time?timezone=${timezone}`
      );

      if (!response.ok) {
        throw new Error("Error getting server time");
      }

      const data = await response.json();

      // Create a date using the timestamp already adjusted to the timezone
      const localDate = new Date(data.serverTime);

      // Apply the offset if enabled
      if (TIME_OFFSET.enabled) {
        localDate.setDate(localDate.getDate() + TIME_OFFSET.days);
        localDate.setHours(localDate.getHours() + TIME_OFFSET.hours);
        localDate.setMinutes(localDate.getMinutes() + TIME_OFFSET.minutes);
        localDate.setSeconds(localDate.getSeconds() + TIME_OFFSET.seconds);
      }

      return {
        dateTime: localDate.toISOString(),
        timezone: data.timezone,
        lastSync: Date.now(),
      };
    } catch (error) {
      return rejectWithValue(
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
);

// Helper function to update formats and utilities
const updateFormatsAndUtilities = (state: RealCurrentDateTimeState) => {
  if (!state.dateTime) {
    state.formatted = null;
    state.utilities = null;
    return;
  }

  const dateTimeDate = new Date(state.dateTime);
  const now = new Date();

  // Update formats without specifying timeZone to avoid double adjustment
  state.formatted = {
    fullDate: new Intl.DateTimeFormat("es-PE", {
      dateStyle: "full",
      timeStyle: "long",
    }).format(dateTimeDate),

    shortDate: new Intl.DateTimeFormat("es-PE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(dateTimeDate),

    fullTime: new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(dateTimeDate),

    timeWithoutSeconds: new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(dateTimeDate),

    // New formats
    readableDate: `${
      diasSemanaTextos[dateTimeDate.getDay() as DiasSemana]
    }, ${dateTimeDate.getDate()} de ${
      mesesTextos[(dateTimeDate.getMonth() + 1) as Meses]
    } de ${dateTimeDate.getFullYear()}`,

    shortNumericDate: `${dateTimeDate
      .getDate()
      .toString()
      .padStart(2, "0")}/${(dateTimeDate.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${dateTimeDate.getFullYear()}`,

    timeAmPm: new Intl.DateTimeFormat("es-PE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }).format(dateTimeDate),
  };

  // Get additional date data
  const weekDayIndex = dateTimeDate.getDay() as DiasSemana;
  const monthDay = dateTimeDate.getDate();
  const monthIndex = (dateTimeDate.getMonth() + 1) as Meses;
  const year = dateTimeDate.getFullYear();
  const hour = dateTimeDate.getHours();
  const minutes = dateTimeDate.getMinutes();
  const seconds = dateTimeDate.getSeconds();

  // Calculate derived values
  const daysInMonth = getDaysInMonth(year, monthIndex);
  const isWeekend = weekDayIndex === 0 || weekDayIndex === 6;
  const quarter = getQuarter(dateTimeDate);
  const weekOfYear = getWeekOfYear(dateTimeDate);
  const dayOfYear = getDayOfYear(dateTimeDate);
  const isToday = isSameDay(dateTimeDate, now);
  const timestamp = dateTimeDate.getTime();

  // Update utilities
  state.utilities = {
    hour,
    minutes,
    seconds,
    isSchoolDay: weekDayIndex >= 1 && weekDayIndex <= 5, // Monday to Friday

    // New fields
    weekDay: diasSemanaTextos[weekDayIndex],
    shortWeekDay: diasSemanaTextosCortos[weekDayIndex],
    weekDayIndex,
    monthDay,
    month: mesesTextos[monthIndex],
    shortMonth: mesesTextosCortos[monthIndex],
    monthIndex,
    year,
    daysInMonth,
    isWeekend,
    quarter,
    weekOfYear,
    dayOfYear,
    isToday,
    timestamp,
  };

  // Mark as initialized
  state.initialized = true;
};

const realCurrentDateTimeSlice = createSlice({
  name: "fechaHoraActualReal",
  initialState,
  reducers: {
    setRealCurrentDateTime: (
      state,
      action: PayloadAction<ReduxPayload<string | null>>
    ) => {
      state.dateTime = action.payload.value;
      updateFormatsAndUtilities(state);
    },
    updateRealCurrentDateTime: (state) => {
      if (state.dateTime) {
        // Parse the current date
        const currentDate = new Date(state.dateTime);

        // Add one second so time advances
        currentDate.setSeconds(currentDate.getSeconds() + 1);

        // Update state with the new date
        state.dateTime = currentDate.toISOString();

        // Update formats and utilities
        updateFormatsAndUtilities(state);
      }
    },
    setTimezone: (state, action: PayloadAction<ReduxPayload<string>>) => {
      state.timezone = action.payload.value;
      // Update formats and utilities with the new timezone
      updateFormatsAndUtilities(state);
    },
    advanceHour: (state, action: PayloadAction<ReduxPayload<number>>) => {
      if (state.dateTime) {
        const currentDate = new Date(state.dateTime);
        currentDate.setHours(currentDate.getHours() + action.payload.value);
        state.dateTime = currentDate.toISOString();
        updateFormatsAndUtilities(state);
      }
    },
    advanceDay: (state, action: PayloadAction<ReduxPayload<number>>) => {
      if (state.dateTime) {
        const currentDate = new Date(state.dateTime);
        currentDate.setDate(currentDate.getDate() + action.payload.value);
        state.dateTime = currentDate.toISOString();
        updateFormatsAndUtilities(state);
      }
    },
    advanceMonth: (state, action: PayloadAction<ReduxPayload<number>>) => {
      if (state.dateTime) {
        const currentDate = new Date(state.dateTime);
        currentDate.setMonth(currentDate.getMonth() + action.payload.value);
        state.dateTime = currentDate.toISOString();
        updateFormatsAndUtilities(state);
      }
    },
  },
  extraReducers: (builder) => {
    builder
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .addCase(fetchRealCurrentDateTime.pending, (state: any) => {
        state.error = null;
      })
      .addCase(fetchRealCurrentDateTime.fulfilled, (state, action) => {
        state.dateTime = action.payload.dateTime;
        state.timezone = action.payload.timezone;
        state.lastSync = action.payload.lastSync;
        state.error = null;

        // Update formats and utilities
        updateFormatsAndUtilities(state);
      })
      .addCase(fetchRealCurrentDateTime.rejected, (state, action) => {
        state.error = (action.payload as string) || "Unknown error";
      });
  },
});

export const {
  setRealCurrentDateTime,
  updateRealCurrentDateTime,
  setTimezone,
  advanceHour,
  advanceDay,
  advanceMonth,
} = realCurrentDateTimeSlice.actions;

export default realCurrentDateTimeSlice.reducer;