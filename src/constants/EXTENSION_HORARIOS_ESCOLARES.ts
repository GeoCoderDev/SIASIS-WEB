// ============================================================================
//                    SCHOOL SCHEDULE EXTENSION CONSTANTS
// ============================================================================

/**
 * Time extensions (in minutes) for school schedules
 * Allow flexibility in student entry and exit times
 */

// ===== PRIMARY LEVEL =====

/**
 * Time extension before the official entry time for primary school students
 * @example If the official time is 7:45 AM and the extension is 60 minutes,
 * students will be able to register attendance from 6:45 AM
 */
export const PRIMARY_STUDENT_ENTRY_EXTENSION = 60; // minutes

/**
 * Time extension after the official exit time for primary school students
 * @example If the official time is 12:45 PM and the extension is 60 minutes,
 * students will be able to register attendance until 1:45 PM
 */
export const PRIMARY_STUDENT_EXIT_EXTENSION = 60; // minutes

// ===== SECONDARY LEVEL =====

/**
 * Time extension before the official entry time for secondary school students
 * @example If the official time is 1:00 PM and the extension is 60 minutes,
 * assistants will be able to take attendance from 12:00 PM
 */
export const SECONDARY_STUDENT_ENTRY_EXTENSION = 60; // minutes

/**
 * Time extension after the official exit time for secondary school students
 * @example If the official time is 6:30 PM and the extension is 60 minutes,
 * assistants will be able to take attendance until 7:30 PM
 */
export const SECONDARY_STUDENT_EXIT_EXTENSION = 60; // minutes

// ===== UTILITIES =====

/**
 * Converts minutes to milliseconds
 * @param minutes Amount of minutes to convert
 * @returns Equivalent milliseconds
 */
export const minutesToMilliseconds = (minutes: number): number =>
  minutes * 60 * 1000;

/**
 * Applies an extension (in minutes) to a date/time
 * @param dateTime Base date/time
 * @param extension Extension in minutes (positive to add, negative to subtract)
 * @returns New date with the applied extension
 */
export const applyExtension = (dateTime: Date, extension: number): Date => {
  const newDate = new Date(dateTime);
  newDate.setMinutes(newDate.getMinutes() + extension);
  return newDate;
};

/**
 * Calculates the effective time range for attendance taking
 * @param startTime Official start time
 * @param endTime Official end time
 * @param entryExtension Extension before start (in minutes)
 * @param exitExtension Extension after end (in minutes)
 * @returns Object with the effective range
 */
export const calculateEffectiveRange = (
  startTime: Date,
  endTime: Date,
  entryExtension: number,
  exitExtension: number
) => ({
  effectiveStart: applyExtension(startTime, -entryExtension),
  effectiveEnd: applyExtension(endTime, exitExtension),
  totalDuration:
    applyExtension(endTime, exitExtension).getTime() -
    applyExtension(startTime, -entryExtension).getTime(),
});