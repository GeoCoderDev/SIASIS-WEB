/**
 * ⏰ CONSTANTS: Schedules for the intelligent attendance query flow
 */
export const QUERY_SCHEDULES = {
  // School day schedules
  SCHOOL_DAY_START: 6, // 06:00 AM
  CONSOLIDATION_END: 22, // 10:00 PM
  ENTRY_EXIT_SEPARATOR: 12, // 12:00 PM (noon)

  // Special schedules
  FRIDAY_COMPLETE: 20, // 8:00 PM - Hour from which Friday is considered "complete"

  // Tolerances
  QUERY_TOLERANCE_MINUTES: 30, // Tolerance for queries near hour changes
};

/**
 * 📅 CONSTANTS: Days of the week
 */
export const DAYS_OF_WEEK = {
  SUNDAY: 0,
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
};

/**
 * 🎯 TYPES: For better typing
 */
export type HourOfDay =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10
  | 11
  | 12
  | 13
  | 14
  | 15
  | 16
  | 17
  | 18
  | 19
  | 20
  | 21
  | 22
  | 23;
export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6;