import { DAILY_ATTENDANCE_DATA_FILENAME } from "@/constants/NOMBRE_ARCHIVOS_SISTEMA";
import { DatosAsistenciaHoyIE20935 } from "@/interfaces/shared/Asistencia/DatosAsistenciaHoyIE20935";
import { redisClient } from "../../../../config/Redis/RedisClient";
import { isJSONContent } from "../_helpers/esContenidoJSON";

/**
 * Result of the get attendance data operation
 */
export interface GetAttendanceDataResult {
  data: DatosAsistenciaHoyIE20935;
  source: "cache" | "blob" | "backup";
  message?: string;
}

/**
 * Attendance data service configuration
 */
const ATTENDANCE_DATA_SERVICE_CONFIG = {
  // Cache duration in milliseconds (2 hours)
  CACHE_DURATION: 2 * 60 * 60 * 1000,

  // Timeout for HTTP requests (10 seconds)
  TIMEOUT_HTTP: 10 * 1000,
} as const;

/**
 * Global cache for attendance data
 */
class AttendanceDataCache {
  private static data: DatosAsistenciaHoyIE20935 | null = null;
  private static lastUpdate = 0;

  static get(cacheDuration: number): DatosAsistenciaHoyIE20935 | null {
    const now = Date.now();
    if (this.data && now - this.lastUpdate < cacheDuration) {
      return this.data;
    }
    return null;
  }

  static set(data: DatosAsistenciaHoyIE20935): void {
    this.data = data;
    this.lastUpdate = Date.now();
  }

  static clear(): void {
    this.data = null;
    this.lastUpdate = 0;
  }

  static getRemainingCacheTime(cacheDuration: number): number {
    if (!this.data) return 0;
    const now = Date.now();
    const elapsedTime = now - this.lastUpdate;
    return Math.max(0, cacheDuration - elapsedTime);
  }
}

/**
 * Creates a fetch with custom timeout
 */
function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  return Promise.race([
    fetch(url),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("HTTP request timeout")), timeout)
    ),
  ]);
}

/**
 * Gets attendance data from the main blob
 */
async function getDataFromBlob(): Promise<DatosAsistenciaHoyIE20935> {
  const url = `${process.env
    .RDP04_THIS_INSTANCE_VERCEL_BLOB_BASE_URL!}/${DAILY_ATTENDANCE_DATA_FILENAME}`;

  console.log("🌐 Getting data from main blob:", url);

  const response = await fetchWithTimeout(
    url,
    ATTENDANCE_DATA_SERVICE_CONFIG.TIMEOUT_HTTP
  );

  if (!response.ok) {
    throw new Error(
      `HTTP error in blob: ${response.status} ${response.statusText}`
    );
  }

  if (!(await isJSONContent(response))) {
    throw new Error("Blob response does not contain valid JSON");
  }

  const data = await response.json();
  console.log("✅ Data successfully obtained from main blob");

  return data;
}

/**
 * Gets attendance data from Google Drive (backup)
 */
async function getDataFromBackup(): Promise<DatosAsistenciaHoyIE20935> {
  console.log("📁 Getting data from Google Drive backup...");

  // Get the Google Drive ID from Redis
  const googleDriveId = await redisClient().get(
    DAILY_ATTENDANCE_DATA_FILENAME
  );

  if (!googleDriveId) {
    throw new Error("Backup file ID not found in Redis");
  }

  const url = `https://drive.google.com/uc?export=download&id=${googleDriveId}`;

  const response = await fetchWithTimeout(
    url,
    ATTENDANCE_DATA_SERVICE_CONFIG.TIMEOUT_HTTP
  );

  if (!response.ok) {
    throw new Error(
      `HTTP error in backup: ${response.status} ${response.statusText}`
    );
  }

  if (!(await isJSONContent(response))) {
    throw new Error("Backup response does not contain valid JSON");
  }

  const data = await response.json();
  console.log("✅ Data successfully obtained from Google Drive backup");

  return data;
}

/**
 * Gets attendance data with cache, main source and backup
 *
 * @param forceUpdate - If true, ignores cache and gets fresh data
 * @returns Promise with attendance data and source information
 *
 * @example
 * ```typescript
 * // Basic usage (with cache)
 * const result = await getTodayAttendanceData();
 * console.log(result.data, result.source);
 *
 * // Force update
 * const result = await getTodayAttendanceData(true);
 * ```
 */
export async function getTodayAttendanceData(
  forceUpdate = false
): Promise<GetAttendanceDataResult> {
  // Check cache first (if update is not forced)
  if (!forceUpdate) {
    const cachedData = AttendanceDataCache.get(
      ATTENDANCE_DATA_SERVICE_CONFIG.CACHE_DURATION
    );
    if (cachedData) {
      const remainingTime = AttendanceDataCache.getRemainingCacheTime(
        ATTENDANCE_DATA_SERVICE_CONFIG.CACHE_DURATION
      );

      console.log(
        `📋 Using data from cache (valid for ${Math.round(
          remainingTime / 1000 / 60
        )} more minutes)`
      );

      return {
        data: cachedData,
        source: "cache",
        message: `Cache valid for ${Math.round(
          remainingTime / 1000 / 60
        )} more minutes`,
      };
    }
  }

  // Try to get from main source (blob)
  try {
    const data = await getDataFromBlob();

    // Update cache with new data
    AttendanceDataCache.set(data);

    return {
      data,
      source: "blob",
      message: "Data obtained from main source",
    };
  } catch (errorBlob) {
    console.warn(
      "⚠️ Error getting data from blob, trying backup:",
      errorBlob
    );

    // Try to get from backup (Google Drive)
    try {
      const data = await getDataFromBackup();

      // Update cache with backup data
      AttendanceDataCache.set(data);

      return {
        data,
        source: "backup",
        message: `Data obtained from backup. Main error: ${
          (errorBlob as Error).message
        }`,
      };
    } catch (errorRespaldo) {
      console.error("❌ Error in backup:", errorRespaldo);

      // If both fail, throw descriptive error
      throw new Error(
        `Main access and backup failed. ` +
          `Main: ${(errorBlob as Error).message}. ` +
          `Backup: ${(errorRespaldo as Error).message}`
      );
    }
  }
}

/**
 * Clears the attendance data cache
 * Useful for testing or to force a new data fetch
 */
export function clearAttendanceDataCache(): void {
  AttendanceDataCache.clear();
  console.log("🧹 Attendance data cache cleared");
}

/**
 * Gets information about the current cache state
 */
export function getCacheState(): {
  hasCache: boolean;
  remainingMinutes: number;
  lastUpdate: Date | null;
} {
  const remainingTime = AttendanceDataCache.getRemainingCacheTime(
    ATTENDANCE_DATA_SERVICE_CONFIG.CACHE_DURATION
  );

  return {
    hasCache: remainingTime > 0,
    remainingMinutes: Math.round(remainingTime / 1000 / 60),
    lastUpdate:
      AttendanceDataCache["lastUpdate"] > 0
        ? new Date(AttendanceDataCache["lastUpdate"])
        : null,
  };
}
