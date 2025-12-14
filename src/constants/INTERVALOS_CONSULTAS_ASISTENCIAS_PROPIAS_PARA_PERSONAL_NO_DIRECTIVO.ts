// In /constants/ATTENDANCE_QUERY_INTERVALS.ts
export const ATTENDANCE_QUERY_INTERVAL_MINUTES = 5;
export const ATTENDANCE_QUERY_INTERVAL_MS =
  ATTENDANCE_QUERY_INTERVAL_MINUTES * 60 * 1000;

// Tolerances for button activation
export const HOURS_BEFORE_START_ACTIVATION = 2; // 2 hours before start
export const HOURS_BEFORE_EXIT_MODE_CHANGE_FOR_STAFF = 1; // 1 hour before exit
export const HOURS_AFTER_EXIT_LIMIT = 2; // 2 hours after exit

// ✅ NEW: Optimized query interval
export const OPTIMIZED_ATTENDANCE_QUERY_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes