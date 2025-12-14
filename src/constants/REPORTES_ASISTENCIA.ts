export const MAX_BUSINESS_DAYS_FOR_DAILY_SCHOOL_ATTENDANCE_REPORT = 20;

/**
 * Expiration time for reports in Redis (12 hours in seconds)
 */
export const SCHOOL_ATTENDANCE_REPORTS_EXPIRATION_TIME_SECONDS_REDIS_CACHE = 12 * 60 * 60; // 12 hours = 43200 seconds