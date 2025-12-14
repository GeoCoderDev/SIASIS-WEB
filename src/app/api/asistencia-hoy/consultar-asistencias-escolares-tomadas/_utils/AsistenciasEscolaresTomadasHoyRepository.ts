import {
  getCurrentDateInPeru,
  getCurrentDateTimeInPeru,
} from "@/app/api/_helpers/obtenerFechaActualPeru";
import { getTodayAttendanceData } from "@/app/api/_utils/obtenerDatosAsistenciaHoy";
import {
  AsistenciaDiariaEscolarResultado,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { redisClient } from "../../../../../../config/Redis/RedisClient";
import {
  NOMBRE_CLAVE_GOOGLE_DRIVE_IDs_LISTAS_ASISTENCIAS_ESCOLARES_HOY,
  NOMBRE_CLAVE_JOBS_EN_EJECUCION_LISTAS_ASISTENCIAS_ESCOLARES_HOY,
  GoogleDriveIDsListasAsistenciasEscolaresHoy,
  JobsEnEjecucionListasAsistenciasEscolaresHoy,
} from "@/interfaces/shared/Asistencia/ListasAsistenciasEscolaresHoy";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import {
  CONTROL_ASISTENCIA_DE_SALIDA_PRIMARIA,
  CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA,
} from "@/constants/ASISTENCIA_ENTRADA_SALIDA_ESCOLAR";
import { ENTORNO } from "@/constants/ENTORNO";
import { Entorno } from "@/interfaces/shared/Entornos";
import {
  INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_PRIMARIA,
  INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_SECUNDARIA,
} from "@/constants/INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_RDP01";
import {
  HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_PRIMARIA,
  HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_SECUNDARIA,
} from "@/constants/INTERVALOS_ASISTENCIAS_ESCOLARES";
import { GrupoInstaciasDeRedisPorTipoAsistencia } from "../../marcar/route";

// =====================================
// CONFIGURATION CONSTANTS
// =====================================

/**
 * Enable/disable specific update by section in GitHub Actions
 * false = Only updates by grade (current behavior)
 * true = Updates specifically by section
 */
export const USE_SECTION_UPDATE = false;

/**
 * Fallback probability to Redis by role (0-100%)
 * 0 = Never use fallback
 * 100 = Always use fallback
 * 50 = 50% probability of using fallback
 */
export const FALLBACK_PROBABILITY_BY_ROLE: Record<RolesSistema, number> = {
  [RolesSistema.Directivo]: 80,
  [RolesSistema.ProfesorPrimaria]: 60,
  [RolesSistema.Auxiliar]: 40,
  [RolesSistema.ProfesorSecundaria]: 20,
  [RolesSistema.Tutor]: 60,
  [RolesSistema.Responsable]: 30,
  [RolesSistema.PersonalAdministrativo]: 0,
};

/**
 * From how many hours before departure should departure assistance be consulted
 */
export const HOURS_BEFORE_DEPARTURE_FOR_QUERY: Record<NivelEducativo, number> =
  {
    [NivelEducativo.PRIMARIA]:
      HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_SECUNDARIA, // 1 hour before departure
    [NivelEducativo.SECUNDARIA]:
      HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_ESTUDIANTES_DE_PRIMARIA, // 1 hour before departure
  };

/**
 * Time window configuration for using Google Drive
 * [Level][Mode]["HoursBefore" | "HoursAfter"]
 */
export const GOOGLE_DRIVE_TIME_WINDOWS = {
  [NivelEducativo.PRIMARIA]: {
    [ModoRegistro.Entrada]: {
      HoursBefore: 1, // 1 hour before entry time
      HoursAfter: 2, // 2 hours after entry time
    },
    [ModoRegistro.Salida]: {
      HoursBefore: 1, // 1 hour before departure time
      HoursAfter: 2, // 2 hours after departure time
    },
  },
  [NivelEducativo.SECUNDARIA]: {
    [ModoRegistro.Entrada]: {
      HoursBefore: 1, // 1 hour before entry time
      HoursAfter: 2, // 2 hours after entry time
    },
    [ModoRegistro.Salida]: {
      HoursBefore: 1, // 1 hour before departure time
      HoursAfter: 2, // 2 hours after departure time
    },
  },
} as const;

/**
 * Configuration of roles that can use the Google Drive mechanism
 */
export const ROLES_WITH_GOOGLE_DRIVE: Record<RolesSistema, boolean> = {
  [RolesSistema.Directivo]: true,
  [RolesSistema.ProfesorPrimaria]: true,
  [RolesSistema.Auxiliar]: true,
  [RolesSistema.ProfesorSecundaria]: false, // No access to students
  [RolesSistema.Tutor]: true,
  [RolesSistema.Responsable]: true,
  [RolesSistema.PersonalAdministrativo]: false, // No access to endpoint
};

/**
 * GitHub Actions variables
 */
export const GITHUB_CONFIG = {
  TOKEN: process.env.TGSH01_GITHUB_STATIC_PERSONAL_ACCESS_TOKEN,
  REPOSITORY_OWNER: process.env.TGSH01_GITHUB_WEBHOOK_REPOSITORY_OWNER_USERNAME,
  REPOSITORY_NAME: process.env.TGSH01_GITHUB_WEBHOOK_REPOSITORY_NAME,
} as const;

// =====================================
// INTERFACES
// =====================================

interface SchoolAttendancesFile {
  // New structure: Section -> Student_ID -> Attendance
  TodaySchoolAttendances: Record<
    string,
    Record<
      string,
      {
        E?: { DesfaseSegundos: number };
        S?: { DesfaseSegundos: number };
      }
    >
  >;
  Update_Date: string;
}

interface QueryResult {
  data:
    | AsistenciaDiariaEscolarResultado
    | AsistenciaDiariaEscolarResultado[]
    | null;
  message: string;
}

// =====================================
// DATE UTILITIES WITHOUT new Date()
// =====================================

/**
 * Creates a Date object from an ISO string but using the Peru time reference
 */
async function createDateFromString(dateString: string): Promise<Date> {
  const currentPeruDate = await getCurrentDateTimeInPeru();
  const parsedDate = Date.parse(dateString);

  if (isNaN(parsedDate)) {
    console.warn(
      `[DATE] Invalid date string: ${dateString}, using current date from Peru`
    );
    return currentPeruDate;
  }

  return new Date(parsedDate);
}

/**
 * Calculates difference in milliseconds between two dates using Peru reference
 */
async function calculateDifferenceMillis(
  dateString: string,
  referenceDate?: Date
): Promise<number> {
  const refDate = referenceDate || (await getCurrentDateTimeInPeru());
  const refTimestamp = refDate.getTime();
  const objectTimestamp = Date.parse(dateString);

  if (isNaN(objectTimestamp)) {
    console.warn(`[DATE] Could not parse date: ${dateString}`);
    return 0;
  }

  return refTimestamp - objectTimestamp;
}

/**
 * Creates date with hour offset from current Peru date
 */
async function createDateWithOffset(offsetHours: number): Promise<Date> {
  const currentPeruDate = await getCurrentDateTimeInPeru();
  const timestampWithOffset =
    currentPeruDate.getTime() + offsetHours * 60 * 60 * 1000;
  return new Date(timestampWithOffset);
}

/**
 * Determines if fallback to Redis should be used based on role probability
 * @param role User role making the request
 * @returns true if fallback should be used, false otherwise
 */
function shouldUseFallbackByProbability(role: RolesSistema): boolean {
  const probability = FALLBACK_PROBABILITY_BY_ROLE[role];
  const randomNumber = Math.floor(Math.random() * 100) + 1; // 1-100

  const useFallback = randomNumber <= probability;

  console.log(`[FallbackProbability] 🎲 Role: ${role}`);
  console.log(
    `[FallbackProbability] 📊 Configured probability: ${probability}%`
  );
  console.log(`[FallbackProbability] 🎯 Random number: ${randomNumber}`);
  console.log(`[FallbackProbability] ✅ Use fallback?: ${useFallback}`);

  return useFallback;
}

/**
 * Gets the update interval based on the educational level
 */
function getUpdateInterval(level: NivelEducativo): number {
  return level === NivelEducativo.PRIMARIA
    ? INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_PRIMARIA
    : INTERVALO_ACTUALIZACION_LISTAS_ESTUDIANTES_HORAS_PICO_EN_MINUTOS_SECUNDARIA;
}

// =====================================
// SIMPLIFIED CACHE BASED ON FILE DATE WITH NEW STRUCTURE
// =====================================

class AttendanceListsCache {
  private static cache = new Map<
    string,
    {
      data: SchoolAttendancesFile;
      fileUpdateDate: number; // Timestamp of file's Update_Date
    }
  >();

  /**
   * Gets file metadata from Google Drive without downloading it completely
   */
  private static async getGoogleDriveFileDate(
    googleDriveId: string
  ): Promise<number | null> {
    try {
      console.log(
        `[AttendanceListsCache] 🔍 Getting file date: ${googleDriveId}`
      );

      // Attempt to get only the file header to verify its modification date
      const url = `https://drive.google.com/uc?export=download&id=${googleDriveId}`;

      // Perform a HEAD request to get headers without downloading content
      const response = await fetch(url, { method: "HEAD" });

      if (response.ok) {
        const lastModified = response.headers.get("last-modified");
        if (lastModified) {
          const modificationDate = Date.parse(lastModified);
          console.log(
            `[AttendanceListsCache] 📅 File modification date (header): ${new Date(
              modificationDate
            ).toISOString()}`
          );
          return modificationDate;
        }
      }

      // If the HEAD method does not work, make a request with Range to get only the beginning of the file
      console.log(
        `[AttendanceListsCache] ⚠️ HEAD not available, trying with Range...`
      );

      const rangeResponse = await fetch(url, {
        headers: {
          Range: "bytes=0-1023", // Only the first 1024 bytes
        },
      });

      if (rangeResponse.ok || rangeResponse.status === 206) {
        // 206 = Partial Content
        const partialContent = await rangeResponse.text();

        // Search for the update date in the partial JSON
        const match = partialContent.match(
          /"Update_Date"\s*:\s*"([^"]+)"/
        );
        if (match) {
          const fileDate = Date.parse(match[1]);
          console.log(
            `[AttendanceListsCache] 📅 File date (from partial JSON): ${match[1]}`
          );
          return fileDate;
        }
      }

      console.log(
        `[AttendanceListsCache] ❌ Could not get file date`
      );
      return null;
    } catch (error) {
      console.error(
        `[AttendanceListsCache] ❌ Error getting file date:`,
        error
      );
      return null;
    }
  }

  /**
   * Checks if the data is internally updated
   */
  private static async isInternallyUpdated(
    data: SchoolAttendancesFile,
    level: NivelEducativo
  ): Promise<{ isUpdated: boolean; reason: string }> {
    const nowDate = await getCurrentDateTimeInPeru();
    const differenceMinutes =
      (await calculateDifferenceMillis(data.Update_Date, nowDate)) /
      (1000 * 60);

    const maxInterval = getUpdateInterval(level);
    const isUpdated = differenceMinutes <= maxInterval;

    return {
      isUpdated,
      reason: `Difference: ${differenceMinutes.toFixed(
        2
      )} min vs limit (${level}): ${maxInterval} min`,
    };
  }

  /**
   * Checks if the specific requested data is available in the cache
   * Updated to work with the new section structure
   */
  private static checkDataAvailability(
    data: SchoolAttendancesFile,
    studentId: string,
    section: string,
    needsEntry: boolean,
    needsExit: boolean
  ): { available: boolean; reason: string } {
    // Check if the section exists
    const sectionData = data.TodaySchoolAttendances[section];
    if (!sectionData) {
      return {
        available: false,
        reason: `Section ${section} not found in data`,
      };
    }

    // Check if the student exists in that section
    const studentAttendance = sectionData[studentId];
    if (!studentAttendance) {
      return {
        available: false,
        reason: `Student ${studentId} not found in section ${section}`,
      };
    }

    // Check availability according to what is needed
    const hasEntry = !!studentAttendance.E;
    const hasExit = !!studentAttendance.S;

    if (needsEntry && !hasEntry) {
      return {
        available: false,
        reason: `Missing entry for student ${studentId} in section ${section}`,
      };
    }

    if (needsExit && !hasExit) {
      return {
        available: false,
        reason: `Missing exit for student ${studentId} in section ${section}`,
      };
    }

    return {
      available: true,
      reason: `Data available in section ${section}: entry=${hasEntry}, exit=${hasExit}`,
    };
  }

  /**
   * Checks availability for classroom query
   * Compares with the total number of expected students
   */
  private static checkClassroomAvailability(
    data: SchoolAttendancesFile,
    section: string,
    expectedTotalStudents: number,
    needsEntry: boolean,
    needsExit: boolean
  ): { available: boolean; reason: string } {
    // Check if the section exists
    const sectionData = data.TodaySchoolAttendances[section];
    if (!sectionData) {
      return {
        available: false,
        reason: `Section ${section} not found in data`,
      };
    }

    const foundStudents = Object.keys(sectionData);
    const foundCount = foundStudents.length;

    // Check if we have the expected number of students
    if (foundCount < expectedTotalStudents) {
      return {
        available: false,
        reason: `Missing students in section ${section}: found ${foundCount}/${expectedTotalStudents}`,
      };
    }

    // Check data availability according to what is needed
    let studentsWithEntry = 0;
    let studentsWithExit = 0;

    for (const [studentId, attendance] of Object.entries(sectionData)) {
      if (attendance.E) studentsWithEntry++;
      if (attendance.S) studentsWithExit++;
    }

    // For classroom queries, verify that at least some students have the necessary data
    const minimumPercentage = 0.8; // 80% of students must have the data
    const minimumRequired = Math.ceil(foundCount * minimumPercentage);

    if (needsEntry && studentsWithEntry < minimumRequired) {
      return {
        available: false,
        reason: `Insufficient entries in section ${section}: ${studentsWithEntry}/${minimumRequired} required`,
      };
    }

    if (needsExit && studentsWithExit < minimumRequired) {
      return {
        available: false,
        reason: `Insufficient exits in section ${section}: ${studentsWithExit}/${minimumRequired} required`,
      };
    }

    return {
      available: true,
      reason: `Sufficient data in section ${section}: ${foundCount}/${expectedTotalStudents} students, entries=${studentsWithEntry}, exits=${studentsWithExit}`,
    };
  }

  /**
   * Checks if the cache needs to be updated considering specific data availability
   * OPTIMIZED: Only fetches from Google Drive if really necessary
   * UPDATED: Support for new section structure and classroom queries
   */
  private static async needsUpdate(
    key: string,
    googleDriveId: string,
    entry: {
      data: SchoolAttendancesFile;
      fileUpdateDate: number;
    },
    level: NivelEducativo,
    specificQuery?: {
      studentId: string;
      section: string;
      needsEntry: boolean;
      needsExit: boolean;
    },
    classroomQuery?: {
      section: string;
      expectedTotalStudents: number;
      needsEntry: boolean;
      needsExit: boolean;
    }
  ): Promise<{ needsUpdate: boolean; reason: string }> {
    console.log(
      `[AttendanceListsCache] 🔍 Checking for update necessity for: ${key}`
    );

    // 1. FIRST PRIORITY: If there is a specific student query, check availability BEFORE fetching
    if (specificQuery) {
      const { available, reason: availabilityReason } =
        this.checkDataAvailability(
          entry.data,
          specificQuery.studentId,
          specificQuery.section,
          specificQuery.needsEntry,
          specificQuery.needsExit
        );

      console.log(
        `[AttendanceListsCache] 📊 Student data availability: ${availabilityReason}`
      );

      // If specific data is available, do not update - DO NOT FETCH
      if (available) {
        console.log(
          `[AttendanceListsCache] ✅ STUDENT DATA AVAILABLE - Not updating, avoiding fetch`
        );
        return {
          needsUpdate: false,
          reason: `Student data available (${availabilityReason}) - No fetch to Google Drive`,
        };
      }

      console.log(
        `[AttendanceListsCache] ❌ MISSING STUDENT DATA - Checking update`
      );
    }

    // 2. SECOND PRIORITY: If there is a classroom query, check availability BEFORE fetching
    if (classroomQuery) {
      const { available, reason: availabilityReason } =
        this.checkClassroomAvailability(
          entry.data,
          classroomQuery.section,
          classroomQuery.expectedTotalStudents,
          classroomQuery.needsEntry,
          classroomQuery.needsExit
        );

      console.log(
        `[AttendanceListsCache] 📊 Classroom data availability: ${availabilityReason}`
      );

      // For classroom queries, ALWAYS update if expired (as requested by the user)
      const updatedData = await this.isInternallyUpdated(
        entry.data,
        level
      );
      const outdatedInternalData = !updatedData.isUpdated;

      if (outdatedInternalData) {
        console.log(
          `[AttendanceListsCache] ⚠️ CLASSROOM QUERY + EXPIRED DATA - Must update`
        );

        // Fetch to check if there is a newer version
        const currentFileDate = await this.getGoogleDriveFileDate(
          googleDriveId
        );
        const isNewerVersion =
          currentFileDate &&
          currentFileDate > entry.fileUpdateDate;

        if (isNewerVersion) {
          const differenceMinutes =
            (currentFileDate - entry.fileUpdateDate) /
            (1000 * 60);
          return {
            needsUpdate: true,
            reason: `Classroom query + newer file (difference: ${differenceMinutes.toFixed(
              2
            )} min)`,
          };
        }

        return {
          needsUpdate: true,
          reason: `Classroom query + outdated internal data: ${updatedData.reason}`,
        };
      }

      // If data is updated and sufficient, do not update
      if (available) {
        console.log(
          `[AttendanceListsCache] ✅ SUFFICIENT AND UPDATED CLASSROOM DATA - Not updating`
        );
        return {
          needsUpdate: false,
          reason: `Sufficient and updated classroom data (${availabilityReason})`,
        };
      }

      // If data is missing but updated, update
      console.log(
        `[AttendanceListsCache] ❌ INSUFFICIENT CLASSROOM DATA - Updating`
      );
      return {
        needsUpdate: true,
        reason: `Insufficient classroom data: ${availabilityReason}`,
      };
    }

    // 3. Check if internal data is outdated (without fetch)
    const updatedData = await this.isInternallyUpdated(
      entry.data,
      level
    );
    const outdatedInternalData = !updatedData.isUpdated;

    // 4. ONLY if internal data is outdated AND specific data is missing, fetch from Google Drive
    if (specificQuery && outdatedInternalData) {
      console.log(
        `[AttendanceListsCache] 🌐 Outdated internal data and missing specific data - Fetching from Google Drive`
      );

      const currentFileDate = await this.getGoogleDriveFileDate(
        googleDriveId
      );
      const isNewerVersion =
        currentFileDate &&
        currentFileDate > entry.fileUpdateDate;

      if (isNewerVersion) {
        const differenceMinutes =
          (currentFileDate - entry.fileUpdateDate) /
          (1000 * 60);
        return {
          needsUpdate: true,
          reason: `Missing data + newer file in Google Drive (difference: ${differenceMinutes.toFixed(
            2
          )} min)`,
        };
      }

      return {
        needsUpdate: true,
        reason: `Specific data not available + outdated internal data: ${updatedData.reason}`,
      };
    }

    // 5. For specific queries with updated internal data, do not update
    if (specificQuery && !outdatedInternalData) {
      return {
        needsUpdate: true,
        reason: `Specific data not available but internal data still valid - Update to get missing data`,
      };
    }

    // 6. Without specific query, apply traditional logic (fetch)
    console.log(
      `[AttendanceListsCache] 🌐 Without specific query - Traditional verification with fetch`
    );

    const currentFileDate = await this.getGoogleDriveFileDate(
      googleDriveId
    );
    const isNewerVersion =
      currentFileDate &&
      currentFileDate > entry.fileUpdateDate;

    if (isNewerVersion) {
      const differenceMinutes =
        (currentFileDate - entry.fileUpdateDate) / (1000 * 60);
      return {
        needsUpdate: true,
        reason: `Newer file detected in Google Drive (difference: ${differenceMinutes.toFixed(
          2
        )} min)`,
      };
    }

    if (outdatedInternalData) {
      return {
        needsUpdate: true,
        reason: `Outdated internal data: ${updatedData.reason}`,
      };
    }

    return {
      needsUpdate: false,
      reason: "Valid cache - updated file and internal data",
    };
  }

  /**
   * Gets data from cache, automatically checking for newer versions
   * OPTIMIZATION: Prioritizes data availability over update
   * UPDATED: Support for new section structure and classroom queries
   */
  static async get(
    key: string,
    level: NivelEducativo,
    googleDriveId?: string,
    specificQuery?: {
      studentId: string;
      section: string;
      needsEntry: boolean;
      needsExit: boolean;
    },
    classroomQuery?: {
      section: string;
      expectedTotalStudents: number;
      needsEntry: boolean;
      needsExit: boolean;
    }
  ): Promise<SchoolAttendancesFile | null> {
    const entry = this.cache.get(key);
    if (!entry) {
      console.log(
        `[AttendanceListsCache] ❌ No cache entry for: ${key}`
      );
      return null;
    }

    console.log(`[AttendanceListsCache] 📊 Checking cache for: ${key}`);
    console.log(
      `[AttendanceListsCache] 📅 File date in cache: ${entry.data.Update_Date}`
    );

    // If there is a specific query, print what is being searched
    if (specificQuery) {
      console.log(
        `[AttendanceListsCache] 🎯 Specific query: student=${specificQuery.studentId}, section=${specificQuery.section}, entry=${specificQuery.needsEntry}, exit=${specificQuery.needsExit}`
      );
    }

    if (classroomQuery) {
      console.log(
        `[AttendanceListsCache] 🏫 Classroom query: section=${classroomQuery.section}, expectedTotal=${classroomQuery.expectedTotalStudents}, entry=${classroomQuery.needsEntry}, exit=${classroomQuery.needsExit}`
      );
    }

    // If googleDriveId is not provided, only check internal data
    if (!googleDriveId) {
      const updatedData = await this.isInternallyUpdated(
        entry.data,
        level
      );

      if (!updatedData.isUpdated) {
        console.log(
          `[AttendanceListsCache] 🗑️ Cache invalidated by internal data: ${updatedData.reason}`
        );
        this.cache.delete(key);
        return null;
      }

      console.log(
        `[AttendanceListsCache] ✅ Valid cache (internal verification): ${key}`
      );
      return entry.data;
    }

    // Full verification with data availability optimization
    const { needsUpdate, reason } = await this.needsUpdate(
      key,
      googleDriveId,
      entry,
      level,
      specificQuery,
      classroomQuery
    );

    console.log(`[AttendanceListsCache] 🎯 Verification result: ${reason}`);

    if (needsUpdate) {
      console.log(
        `[AttendanceListsCache] 🗑️ Invalidating cache: ${key} - ${reason}`
      );
      this.cache.delete(key);
      return null;
    }

    console.log(`[AttendanceListsCache] ✅ Valid cache: ${key}`);
    return entry.data;
  }

  static async save(
    key: string,
    data: SchoolAttendancesFile
  ): Promise<void> {
    const fileUpdateDate = Date.parse(data.Update_Date);

    console.log(`[AttendanceListsCache] 💾 Saving to cache: ${key}`);
    console.log(
      `[AttendanceListsCache] 📅 File update date: ${data.Update_Date}`
    );

    this.cache.set(key, {
      data,
      fileUpdateDate,
    });
  }

  static clear(key?: string): void {
    if (key) {
      console.log(
        `[AttendanceListsCache] 🧹 Clearing specific cache: ${key}`
      );
      this.cache.delete(key);
    } else {
      console.log(`[AttendanceListsCache] 🧹 Clearing entire cache`);
      this.cache.clear();
    }
  }

  static async getStatistics(): Promise<Record<string, any>> {
    const stats: Record<string, any> = {};

    for (const [key, entry] of this.cache.entries()) {
      // For statistics, use PRIMARY as default since we don't have the level in the key
      const defaultLevel = NivelEducativo.PRIMARIA;
      const internalData = await this.isInternallyUpdated(
        entry.data,
        defaultLevel
      );

      // Count total students in all sections
      let totalStudents = 0;
      for (const section of Object.values(
        entry.data.TodaySchoolAttendances || {}
      )) {
        totalStudents += Object.keys(section as Record<string, any>).length;
      }

      stats[key] = {
        fileDate: entry.data.Update_Date,
        studentCount: totalStudents,
        sections: Object.keys(entry.data.TodaySchoolAttendances || {})
          .length,
        fileUpdateDate: entry.fileUpdateDate,
        isUpdated: internalData.isUpdated,
        statusReason: internalData.reason,
      };
    }
    return stats;
  }
}

// =====================================
// MAIN UPDATED REPOSITORY
// =====================================

export class TodaySchoolAttendancesRepository {
  private logPrefix = "[AttendancesRepo]";

  /**
   * Gets the current date in YYYY-MM-DD format
   */
  async getCurrentDate(): Promise<string> {
    const date = await getCurrentDateInPeru();
    console.log(`${this.logPrefix} 📅 Current date obtained: ${date}`);
    return date;
  }

  /**
   * Checks if departure attendances should be consulted
   */
  private async shouldQueryExits(level: NivelEducativo): Promise<boolean> {
    console.log(
      `${this.logPrefix} 🚪 Checking if departure attendances should be consulted for ${level}`
    );

    // Check control constants
    const controlExits =
      level === NivelEducativo.PRIMARIA
        ? CONTROL_ASISTENCIA_DE_SALIDA_PRIMARIA
        : CONTROL_ASISTENCIA_DE_SALIDA_SECUNDARIA;

    console.log(
      `${this.logPrefix} ⚙️ Departure control for ${level}: ${controlExits}`
    );

    if (!controlExits) {
      console.log(
        `${this.logPrefix} ❌ Departure control disabled for ${level}`
      );
      return false;
    }

    try {
      // Get system schedules
      const { data: attendanceData } = await getTodayAttendanceData();

      const now = await getCurrentDateTimeInPeru();
      const hoursBefore = HOURS_BEFORE_DEPARTURE_FOR_QUERY[level];

      console.log(
        `${this.logPrefix} ⏰ Configured hours before: ${hoursBefore}`
      );
      console.log(
        `${this.logPrefix} 🕐 Current time (Peru): ${now.toISOString()}`
      );

      // Get departure time according to level and create timestamp
      let exitTimeString: string;

      if (level === NivelEducativo.PRIMARIA) {
        const primarySchedule =
          attendanceData.HorariosEscolares[NivelEducativo.PRIMARIA];
        exitTimeString = String(primarySchedule.Fin);
      } else {
        const secondarySchedule =
          attendanceData.HorariosEscolares[NivelEducativo.SECUNDARIA];
        exitTimeString = String(secondarySchedule.Fin);
      }

      // Calculate limit using timestamps
      const exitTimeTimestamp = Date.parse(exitTimeString);
      const timeLimitTimestamp =
        exitTimeTimestamp - hoursBefore * 60 * 60 * 1000;
      const nowTimestamp = now.getTime();

      const shouldQuery = nowTimestamp >= timeLimitTimestamp;

      console.log(
        `${this.logPrefix} 🚪 Departure time ${level}: ${exitTimeString}`
      );
      console.log(
        `${this.logPrefix} ⏰ Time limit (timestamp): ${timeLimitTimestamp}`
      );
      console.log(`${this.logPrefix} 🕐 Now (timestamp): ${nowTimestamp}`);
      console.log(
        `${this.logPrefix} ✅ Should consult departures?: ${shouldQuery}`
      );

      return shouldQuery;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error checking if departure attendances should be consulted:`,
        error
      );
      return false;
    }
  }

  /**
   * Checks if we are in the time window to use Google Drive
   */
  private async isInTimeWindow(
    level: NivelEducativo,
    mode: ModoRegistro
  ): Promise<boolean> {
    try {
      console.log(
        `${this.logPrefix} 🕐 Checking time window for ${level} - ${mode}`
      );

      // Get system schedules
      const { data: attendanceData } = await getTodayAttendanceData();
      console.log(`${this.logPrefix} ✅ Attendance data obtained`);

      const now = await getCurrentDateTimeInPeru();
      const window = GOOGLE_DRIVE_TIME_WINDOWS[level][mode];

      console.log(
        `${this.logPrefix} 📊 Window configuration: ${window.HoursBefore}h before, ${window.HoursAfter}h after`
      );
      console.log(
        `${this.logPrefix} 🕐 Current time (Peru): ${now.toISOString()}`
      );

      // Get target time according to level and mode
      let targetTimeString: string;

      if (level === NivelEducativo.PRIMARIA) {
        const primarySchedule =
          attendanceData.HorariosEscolares[NivelEducativo.PRIMARIA];
        targetTimeString =
          mode === ModoRegistro.Entrada
            ? String(primarySchedule.Inicio)
            : String(primarySchedule.Fin);
      } else {
        const secondarySchedule =
          attendanceData.HorariosEscolares[NivelEducativo.SECUNDARIA];
        targetTimeString =
          mode === ModoRegistro.Entrada
            ? String(secondarySchedule.Inicio)
            : String(secondarySchedule.Fin);
      }

      // Calculate time window using timestamps
      const targetTimeTimestamp = Date.parse(targetTimeString);
      const windowStartTimestamp =
        targetTimeTimestamp - window.HoursBefore * 60 * 60 * 1000;
      const windowEndTimestamp =
        targetTimeTimestamp + window.HoursAfter * 60 * 60 * 1000;
      const nowTimestamp = now.getTime();

      const isInWindow =
        nowTimestamp >= windowStartTimestamp &&
        nowTimestamp <= windowEndTimestamp;

      console.log(
        `${this.logPrefix} 🎯 Target time (${mode}): ${targetTimeString}`
      );
      console.log(
        `${this.logPrefix} 🎯 Target time (timestamp): ${targetTimeTimestamp}`
      );
      console.log(
        `${this.logPrefix} 🟢 Window start (timestamp): ${windowStartTimestamp}`
      );
      console.log(
        `${this.logPrefix} 🔴 Window end (timestamp): ${windowEndTimestamp}`
      );
      console.log(`${this.logPrefix} 🕐 Now (timestamp): ${nowTimestamp}`);
      console.log(
        `${this.logPrefix} ✨ In window? (using Peru time): ${isInWindow}`
      );

      return isInWindow;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error checking time window:`,
        error
      );
      return false;
    }
  }

  /**
   * Checks if the Google Drive mechanism should be used
   */
  private async shouldUseGoogleDrive(
    role: RolesSistema,
    level: NivelEducativo,
    mode: ModoRegistro
  ): Promise<boolean> {
    console.log(
      `${this.logPrefix} 🔍 Checking if Google Drive should be used for role: ${role}`
    );

    // Check if the role is allowed to use Google Drive
    const roleAllowed = ROLES_WITH_GOOGLE_DRIVE[role];
    console.log(`${this.logPrefix} 👤 Role ${role} allowed?: ${roleAllowed}`);

    if (!roleAllowed) {
      console.log(
        `${this.logPrefix} ❌ Role ${role} does not have Google Drive permissions`
      );
      return false;
    }

    // Check time window
    const inWindow = await this.isInTimeWindow(level, mode);
    console.log(`${this.logPrefix} 🕐 In time window?: ${inWindow}`);

    const result = roleAllowed && inWindow;
    console.log(
      `${this.logPrefix} 🎯 Final result mustUseGoogleDrive: ${result}`
    );

    return result;
  }

  /**
   * Builds the result for an individual student
   * UPDATED: To work with new section structure
   */
  private async buildStudentResult(
    studentId: string,
    section: string,
    attendanceData: {
      E?: { DesfaseSegundos: number };
      S?: { DesfaseSegundos: number };
    },
    level: NivelEducativo
  ): Promise<AsistenciaDiariaEscolarResultado> {
    console.log(
      `${this.logPrefix} 🔨 Building result for student: ${studentId} in section ${section}`
    );

    const attendance: AsistenciaEscolarDeUnDia = {} as AsistenciaEscolarDeUnDia;

    // Always include entry if it exists
    if (attendanceData.E) {
      console.log(
        `${this.logPrefix} ✅ Entry found for ${studentId}: ${attendanceData.E.DesfaseSegundos}s`
      );
      attendance[ModoRegistro.Entrada] = {
        DesfaseSegundos: attendanceData.E.DesfaseSegundos,
      };
    } else {
      console.log(`${this.logPrefix} ❌ No entry for ${studentId}`);
      attendance[ModoRegistro.Entrada] = null;
    }

    // Include exit only if it should be consulted and exists
    const shouldQuery = await this.shouldQueryExits(level);
    if (shouldQuery && attendanceData.S) {
      console.log(
        `${this.logPrefix} 🚪 Exit found for ${studentId}: ${attendanceData.S.DesfaseSegundos}s`
      );
      attendance[ModoRegistro.Salida] = {
        DesfaseSegundos: attendanceData.S.DesfaseSegundos,
      };
    } else if (shouldQuery) {
      console.log(
        `${this.logPrefix} ❌ No exit for ${studentId} (must consult but does not exist)`
      );
    }

    const hasAttendance = Object.keys(attendance).some(
      (key) => attendance[key as keyof AsistenciaEscolarDeUnDia] !== null
    );

    console.log(
      `${this.logPrefix} 📊 Result for ${studentId}: hasAttendance=${hasAttendance}`
    );

    return {
      Id_Estudiante: studentId,
      AsistenciaMarcada: hasAttendance,
      Asistencia: hasAttendance ? attendance : null,
    };
  }

  /**
   * Checks if a list is updated
   */
  private async isUpdated(
    data: SchoolAttendancesFile,
    level: NivelEducativo
  ): Promise<boolean> {
    const nowDate = await getCurrentDateTimeInPeru();
    let differenceMinutes =
      (await calculateDifferenceMillis(data.Update_Date, nowDate)) /
      (1000 * 60);

    if (ENTORNO !== Entorno.PRODUCCION) {
      differenceMinutes = Math.abs(differenceMinutes);
    }

    const maxInterval = getUpdateInterval(level);
    const isUpdated = differenceMinutes <= maxInterval;

    console.log(
      `${this.logPrefix} 📅 File update date: ${data.Update_Date}`
    );
    console.log(
      `${this.logPrefix} 🕐 Current time (Peru): ${nowDate.toISOString()}`
    );
    console.log(
      `${this.logPrefix} ⏱️ Difference in minutes: ${differenceMinutes.toFixed(
        2
      )}`
    );
    console.log(
      `${this.logPrefix} ⚙️ Max interval configured for ${level}: ${maxInterval} min`
    );
    console.log(
      `${this.logPrefix} ✅ Is it updated? (using Peru time): ${isUpdated}`
    );

    return isUpdated;
  }

  /**
   * Checks if a job is running
   */
  private async isJobRunning(
    level: NivelEducativo,
    grade: number,
    attendanceType: TipoAsistencia
  ): Promise<boolean> {
    try {
      console.log(
        `${this.logPrefix} 🔄 Checking running job for ${level} grade ${grade}`
      );

      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[attendanceType]
      );
      
      console.log(
        `${this.logPrefix} 🔗 Redis client obtained for: ${attendanceType}`
      );
      const jobsString = await redisInstance.get(
        NOMBRE_CLAVE_JOBS_EN_EJECUCION_LISTAS_ASISTENCIAS_ESCOLARES_HOY
      );

      console.log(
        `${this.logPrefix} 📦 Jobs string obtained from Redis: ${
          jobsString ? "Exists" : "Does not exist"
        }`
      );

      if (!jobsString) {
        console.log(
          `${this.logPrefix} ✅ No jobs running (Redis empty)`
        );
        return false;
      }

      const jobs: JobsEnEjecucionListasAsistenciasEscolaresHoy = JSON.parse(
        jobsString as string
      );
      const jobRunning = jobs[level]?.[grade] === true;

      console.log(
        `${this.logPrefix} 📋 Parsed jobs:`,
        JSON.stringify(jobs, null, 2)
      );
      console.log(
        `${this.logPrefix} 🎯 Specific job (${level} grade ${grade}): ${jobRunning}`
      );

      return jobRunning;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error checking running jobs:`,
        error
      );
      return false;
    }
  }

  /**
   * Triggers the update of a specific list via GitHub Actions
   * UPDATED: Support for section update
   */
  private async triggerListUpdate(
    level: NivelEducativo,
    grade: number,
    section?: string
  ): Promise<void> {
    try {
      console.log(
        `${this.logPrefix} 🚀 STARTING TRIGGER for ${level} grade ${grade}${
          section ? ` section ${section}` : ""
        }`
      );

      // Verify GitHub configuration
      console.log(
        `${this.logPrefix} 🔑 GitHub Token exists: ${!!GITHUB_CONFIG.TOKEN}`
      );
      console.log(
        `${this.logPrefix} 👤 Repository Owner: ${GITHUB_CONFIG.REPOSITORY_OWNER}`
      );
      console.log(
        `${this.logPrefix} 📁 Repository Name: ${GITHUB_CONFIG.REPOSITORY_NAME}`
      );

      if (!GITHUB_CONFIG.TOKEN) {
        throw new Error("GitHub TOKEN not configured");
      }

      if (!GITHUB_CONFIG.REPOSITORY_OWNER || !GITHUB_CONFIG.REPOSITORY_NAME) {
        throw new Error("Incomplete GitHub repository configuration");
      }

      const url = `https://api.github.com/repos/${GITHUB_CONFIG.REPOSITORY_OWNER}/${GITHUB_CONFIG.REPOSITORY_NAME}/dispatches`;
      console.log(`${this.logPrefix} 🌐 GitHub Actions URL: ${url}`);

      const payload = {
        event_type: "update-attendance-lists-today",
        client_payload: {
          level: level,
          grade: grade.toString(),
          ...(USE_SECTION_UPDATE && section ? { section } : {}),
        },
      };

      console.log(
        `${this.logPrefix} 📦 Payload to send:`,
        JSON.stringify(payload, null, 2)
      );
      console.log(
        `${this.logPrefix} ⚙️ Section update enabled: ${USE_SECTION_UPDATE}`
      );

      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `token ${GITHUB_CONFIG.TOKEN}`,
          Accept: "application/vnd.github.v3+json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      console.log(
        `${this.logPrefix} 📡 GitHub Actions Response - Status: ${response.status}`
      );
      console.log(
        `${this.logPrefix} 📡 GitHub Actions Response - StatusText: ${response.statusText}`
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`${this.logPrefix} ❌ Error response body:`, errorText);
        throw new Error(
          `Error triggering GitHub Action: ${response.status} ${response.statusText} - ${errorText}`
        );
      }

      console.log(
        `${
          this.logPrefix
        } ✅ GitHub Action triggered successfully for ${level} grade ${grade}${
          section ? ` section ${section}` : ""
        }`
      );
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error triggering GitHub Action:`,
        error
      );
      throw error;
    }
  }

  /**
   * Gets a list of attendances from Google Drive
   */
  private async getListFromGoogleDrive(
    level: NivelEducativo,
    grade: number,
    attendanceType: TipoAsistencia
  ): Promise<SchoolAttendancesFile> {
    try {
      console.log(
        `${this.logPrefix} 📥 Getting list from Google Drive: ${level} grade ${grade}`
      );

      // Get Redis instance based on attendance type
      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[attendanceType]
      );
      console.log(
        `${this.logPrefix} 🔗 Redis client obtained for: ${attendanceType}`
      );
      console.log(
        `${this.logPrefix} 🔗 Redis client obtained for: ${attendanceType}`
      );

      // Get Google Drive IDs
      const idsString = await redisInstance.get(
        NOMBRE_CLAVE_GOOGLE_DRIVE_IDs_LISTAS_ASISTENCIAS_ESCOLARES_HOY
      );

      console.log(
        `${this.logPrefix} 🔑 IDs string obtained from Redis: ${
          idsString ? "Exists" : "Does not exist"
        }`
      );

      if (!idsString) {
        throw new Error("Google Drive IDs not found in Redis");
      }

      const ids: GoogleDriveIDsListasAsistenciasEscolaresHoy = JSON.parse(
        idsString as string
      );
      console.log(
        `${this.logPrefix} 📋 Parsed IDs:`,
        JSON.stringify(ids, null, 2)
      );

      const googleDriveId = ids[level]?.[grade];
      console.log(
        `${this.logPrefix} 🎯 Specific ID for ${level} grade ${grade}: ${googleDriveId}`
      );

      if (!googleDriveId) {
        throw new Error(
          `Google Drive ID not found for ${level} grade ${grade}`
        );
      }

      // Download file from Google Drive
      const url = `https://drive.google.com/uc?export=download&id=${googleDriveId}`;
      console.log(`${this.logPrefix} 🌐 Google Drive URL: ${url}`);

      const response = await fetch(url);
      console.log(
        `${this.logPrefix} 📡 Google Drive Response - Status: ${response.status}`
      );

      if (!response.ok) {
        throw new Error(
          `Error downloading from Google Drive: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log(
        `${this.logPrefix} 📄 Data obtained - Update date: ${data.Update_Date}`
      );

      // Count students in new section structure
      let totalStudents = 0;
      for (const section of Object.values(
        data.TodaySchoolAttendances || {}
      )) {
        totalStudents += Object.keys(section as Record<string, any>).length;
      }

      console.log(
        `${
          this.logPrefix
        } 📊 Total students in file: ${totalStudents} distributed in ${
          Object.keys(data.TodaySchoolAttendances || {}).length
        } sections`
      );

      return data;
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error getting list from Google Drive:`,
        error
      );
      throw error;
    }
  }

  /**
   * Queries the attendance of a specific student by their ID
   * UPDATED: New section structure and fallback probability system
   */
  async queryByStudentId(
    studentId: string,
    attendanceType: TipoAsistencia,
    level?: NivelEducativo,
    grade?: number,
    section?: string,
    role?: RolesSistema
  ): Promise<QueryResult> {
    try {
      console.log(
        `${this.logPrefix} 🔍 CONSULTING STUDENT: ${studentId}`
      );
      console.log(
        `${this.logPrefix} 📋 Parameters: role=${role}, level=${level}, grade=${grade}, section=${section}`
      );

      // If role or section is not provided, use Redis directly
      if (!role || !level || !grade || !section) {
        console.log(
          `${this.logPrefix} 🔄 Using Redis directly (missing parameters for Google Drive)`
        );
        return await this.queryFromRedis(
          studentId,
          attendanceType,
          level,
          grade,
          section
        );
      }

      // Determine if Google Drive should be used
      const useGoogleDrive = await this.shouldUseGoogleDrive(
        role,
        level,
        ModoRegistro.Entrada
      );
      console.log(
        `${this.logPrefix} 🎯 Use Google Drive?: ${useGoogleDrive}`
      );

      if (!useGoogleDrive) {
        console.log(
          `${this.logPrefix} 🔄 Using Redis (Google Drive conditions not met)`
        );
        return await this.queryFromRedis(
          studentId,
          attendanceType,
          level,
          grade,
          section
        );
      }

      // Use Google Drive
      console.log(`${this.logPrefix} ☁️ USING GOOGLE DRIVE for query`);
      const cacheKey = `${level}_${grade}`;

      // Get the Google Drive ID for date verification
      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[attendanceType]
      );
      console.log(
        `${this.logPrefix} 🔗 Redis client obtained for: ${attendanceType}`
      );
      const idsString = await redisInstance.get(
        NOMBRE_CLAVE_GOOGLE_DRIVE_IDs_LISTAS_ASISTENCIAS_ESCOLARES_HOY
      );

      let googleDriveId: string | undefined;
      if (idsString) {
        const ids: GoogleDriveIDsListasAsistenciasEscolaresHoy = JSON.parse(
          idsString as string
        );
        googleDriveId = ids[level]?.[grade];
      }

      // Determine what specific data we need to apply the optimization
      const needsEntry = true; // Always need entry
      const needsExit = await this.shouldQueryExits(level); // Only if enabled and it's time

      console.log(
        `${this.logPrefix} 🎯 Required data: entry=${needsEntry}, exit=${needsExit}`
      );

      const specificQuery = {
        studentId,
        section,
        needsEntry,
        needsExit,
      };

      // Show cache statistics
      const statsCache = await AttendanceListsCache.getStatistics();
      console.log(
        `${this.logPrefix} 📊 Current cache status:`,
        JSON.stringify(statsCache, null, 2)
      );

      // Get data from cache (with automatic optimization checking availability)
      let listData = await AttendanceListsCache.get(
        cacheKey,
        level,
        googleDriveId,
        specificQuery
      );

      if (!listData) {
        console.log(
          `${this.logPrefix} 💾 Cache invalidated or empty (specific data not available)`
        );

        // Check if job is running
        const jobRunning = await this.isJobRunning(
          level,
          grade,
          attendanceType
        );

        if (jobRunning) {
          console.log(`${this.logPrefix} 🔄 Job running detected`);

          // Apply fallback probability
          const useFallback = shouldUseFallbackByProbability(role);
          if (useFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probability allows fallback to Redis`
            );
            return await this.queryFromRedis(
              studentId,
              attendanceType,
              level,
              grade,
              section
            );
          } else {
            console.log(
              `${this.logPrefix} 🚫 Probability does not allow fallback - No data error`
            );
            return {
              data: null,
              message: `Student ${studentId} not available - system updating and fallback not allowed for role ${role}`,
            };
          }
        }

        console.log(
          `${this.logPrefix} 🟢 No job running, proceeding to get from Google Drive`
        );

        try {
          listData = await this.getListFromGoogleDrive(
            level,
            grade,
            attendanceType
          );

          const isUpdated = await this.isUpdated(listData, level);

          if (!isUpdated) {
            console.log(`${this.logPrefix} ⚠️ List NOT updated`);
            console.log(
              `${this.logPrefix} 🚀 Triggering list update...`
            );

            // Trigger update but continue with current data
            await this.triggerListUpdate(level, grade, section);
            console.log(
              `${this.logPrefix} ✅ Update triggered successfully`
            );

            // CONTINUE WITH CURRENT GOOGLE DRIVE DATA (do not fallback to Redis)
            console.log(
              `${this.logPrefix} 📋 Continuing with current Google Drive data`
            );
          } else {
            console.log(`${this.logPrefix} ✅ List is updated`);
          }

          console.log(`${this.logPrefix} 💾 Saving data to cache`);
          await AttendanceListsCache.save(cacheKey, listData);
        } catch (error) {
          console.warn(
            `${this.logPrefix} ⚠️ Error getting from Google Drive`,
            error
          );

          // Apply fallback probability
          const useFallback = shouldUseFallbackByProbability(role);
          if (useFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probability allows fallback to Redis after error`
            );
            return await this.queryFromRedis(
              studentId,
              attendanceType,
              level,
              grade,
              section
            );
          } else {
            console.log(
              `${this.logPrefix} 🚫 Probability does not allow fallback after error`
            );
            return {
              data: null,
              message: `Error getting data for ${studentId} and fallback not allowed for role ${role}`,
            };
          }
        }
      } else {
        console.log(
          `${this.logPrefix} ✅ Data obtained from cache (optimized: availability > update)`
        );
      }

      // Search student in Google Drive data with new structure
      const sectionData = listData.TodaySchoolAttendances[section];
      if (!sectionData) {
        console.log(
          `${this.logPrefix} ❌ Section ${section} not found in Google Drive`
        );

        // Apply fallback probability
        const useFallback = shouldUseFallbackByProbability(role);
        if (useFallback) {
          console.log(
            `${this.logPrefix} 🎲 Probability allows fallback to Redis for missing section`
          );
          return await this.queryFromRedis(
            studentId,
            attendanceType,
            level,
            grade,
            section
          );
        } else {
          console.log(
            `${this.logPrefix} 🚫 Probability does not allow fallback for missing section`
          );
          return {
            data: null,
            message: `Section ${section} not found and fallback not allowed for role ${role}`,
          };
        }
      }

      const studentAttendance = sectionData[studentId];
      console.log(
        `${
          this.logPrefix
        } 🎯 Student ${studentId} found in section ${section}: ${!!studentAttendance}`
      );

      if (!studentAttendance) {
        console.log(
          `${this.logPrefix} ❌ Student ${studentId} not found in section ${section}`
        );

        // Apply fallback probability
        const useFallback = shouldUseFallbackByProbability(role);
        if (useFallback) {
          console.log(
            `${this.logPrefix} 🎲 Probability allows fallback to Redis for missing student`
          );
          return await this.queryFromRedis(
            studentId,
            attendanceType,
            level,
            grade,
            section
          );
        } else {
          console.log(
            `${this.logPrefix} 🚫 Probability does not allow fallback for missing student`
          );
          return {
            data: null,
            message: `Student ${studentId} not found in section ${section} and fallback not allowed for role ${role}`,
          };
        }
      }

      // Build result
      const result = await this.buildStudentResult(
        studentId,
        section,
        studentAttendance,
        level
      );
      console.log(
        `${this.logPrefix} ✅ Result successfully built from Google Drive`
      );

      const updateStatus = await this.isUpdated(listData, level);

      return {
        data: result,
        message: `Data from Google Drive with cache optimized by availability (${level} grade ${grade} section ${section}) - Updated: ${updateStatus}`,
      };
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error querying student ${studentId}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Queries attendances for all students in a specific classroom
   * UPDATED: New section structure and mandatory totalEstudiantes parameter
   */
  async queryByClassroom(
    attendanceType: TipoAsistencia,
    level: NivelEducativo,
    grade: number,
    section: string,
    totalEstudiantes: number,
    role?: RolesSistema
  ): Promise<QueryResult> {
    try {
      console.log(
        `${this.logPrefix} 🏫 CONSULTING CLASSROOM: ${level} ${grade}° ${section} (${totalEstudiantes} expected students)`
      );
      console.log(
        `${this.logPrefix} 📋 Parameters: role=${role}, type=${attendanceType}`
      );

      // If role is not provided, use Redis directly
      if (!role) {
        console.log(
          `${this.logPrefix} 🔄 Using Redis directly (no role provided)`
        );
        return await this.queryClassroomFromRedis(
          attendanceType,
          level,
          grade,
          section
        );
      }

      // Determine if Google Drive should be used
      const useGoogleDrive = await this.shouldUseGoogleDrive(
        role,
        level,
        ModoRegistro.Entrada
      );
      console.log(
        `${this.logPrefix} 🎯 Use Google Drive for classroom?: ${useGoogleDrive}`
      );

      if (!useGoogleDrive) {
        console.log(
          `${this.logPrefix} 🔄 Using Redis for classroom (Google Drive conditions not met)`
        );
        return await this.queryClassroomFromRedis(
          attendanceType,
          level,
          grade,
          section
        );
      }

      // Use Google Drive
      console.log(
        `${this.logPrefix} ☁️ USING GOOGLE DRIVE for classroom query`
      );
      const cacheKey = `${level}_${grade}`;

      // Get the Google Drive ID for date verification
      const redisInstance = redisClient(
        GrupoInstaciasDeRedisPorTipoAsistencia[attendanceType]
      );
      console.log(
        `${this.logPrefix} 🔗 Redis client obtained for: ${attendanceType}`
      );
      const idsString = await redisInstance.get(
        NOMBRE_CLAVE_GOOGLE_DRIVE_IDs_LISTAS_ASISTENCIAS_ESCOLARES_HOY
      );

      let googleDriveId: string | undefined;
      if (idsString) {
        const ids: GoogleDriveIDsListasAsistenciasEscolaresHoy = JSON.parse(
          idsString as string
        );
        googleDriveId = ids[level]?.[grade];
      }

      // Determine what data we need for the classroom query
      const needsEntry = true;
      const needsExit = await this.shouldQueryExits(level);

      console.log(
        `${this.logPrefix} 🎯 Required data for classroom: entry=${needsEntry}, exit=${needsExit}`
      );

      const classroomQuery = {
        section,
        expectedTotalStudents: totalEstudiantes,
        needsEntry,
        needsExit,
      };

      let listData = await AttendanceListsCache.get(
        cacheKey,
        level,
        googleDriveId,
        undefined,
        classroomQuery
      );

      if (!listData) {
        console.log(
          `${this.logPrefix} 💾 No data in cache for classroom ${cacheKey} or insufficient`
        );

        // Check if job is running
        const jobRunning = await this.isJobRunning(
          level,
          grade,
          attendanceType
        );

        if (jobRunning) {
          console.log(`${this.logPrefix} 🔄 Job running for classroom`);

          // Apply fallback probability
          const useFallback = shouldUseFallbackByProbability(role);
          if (useFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probability allows fallback to Redis for classroom`
            );
            return await this.queryClassroomFromRedis(
              attendanceType,
              level,
              grade,
              section
            );
          } else {
            console.log(
              `${this.logPrefix} 🚫 Probability does not allow fallback for classroom`
            );
            return {
              data: [],
              message: `Classroom ${level} ${grade}° ${section} not available - system updating and fallback not allowed for role ${role}`,
            };
          }
        }

        console.log(
          `${this.logPrefix} 🟢 No job running for classroom, getting from Google Drive`
        );

        try {
          listData = await this.getListFromGoogleDrive(
            level,
            grade,
            attendanceType
          );

          if (!(await this.isUpdated(listData, level))) {
            console.log(
              `${this.logPrefix} ⚠️ Classroom list NOT updated, triggering update`
            );
            await this.triggerListUpdate(level, grade, section);
            console.log(
              `${this.logPrefix} ✅ Classroom update triggered, continuing with current data`
            );
          }

          await AttendanceListsCache.save(cacheKey, listData);
        } catch (error) {
          console.warn(
            `${this.logPrefix} ⚠️ Error with Google Drive for classroom`,
            error
          );

          // Apply fallback probability
          const useFallback = shouldUseFallbackByProbability(role);
          if (useFallback) {
            console.log(
              `${this.logPrefix} 🎲 Probability allows fallback to Redis after classroom error`
            );
            return await this.queryClassroomFromRedis(
              attendanceType,
              level,
              grade,
              section
            );
          } else {
            console.log(
              `${this.logPrefix} 🚫 Probability does not allow fallback after classroom error`
            );
            return {
              data: [],
              message: `Error getting classroom data and fallback not allowed for role ${role}`,
            };
          }
        }
      } else {
        console.log(
          `${this.logPrefix} ✅ Classroom data obtained from cache (automatically verified)`
        );
      }

      // Process Google Drive data with new structure
      const sectionData = listData.TodaySchoolAttendances[section];
      if (!sectionData) {
        console.log(
          `${this.logPrefix} ❌ Section ${section} not found in Google Drive`
        );

        // Apply fallback probability
        const useFallback = shouldUseFallbackByProbability(role);
        if (useFallback) {
          console.log(
            `${this.logPrefix} 🎲 Probability allows fallback to Redis for missing classroom section`
          );
          return await this.queryClassroomFromRedis(
            attendanceType,
            level,
            grade,
            section
          );
        } else {
          console.log(
            `${this.logPrefix} 🚫 Probability does not allow fallback for missing classroom section`
          );
          return {
            data: [],
            message: `Section ${section} not found in classroom and fallback not allowed for role ${role}`,
          };
        }
      }

      const results: AsistenciaDiariaEscolarResultado[] = [];
      console.log(
        `${this.logPrefix} 🔍 Processing Google Drive data for classroom section ${section}`
      );

      for (const [studentId, attendance] of Object.entries(sectionData)) {
        if (attendance.E || attendance.S) {
          const result = await this.buildStudentResult(
            studentId,
            section,
            attendance,
            level
          );
          results.push(result);
        }
      }

      console.log(
        `${this.logPrefix} 📊 ${results.length}/${totalEstudiantes} students processed from Google Drive`
      );

      return {
        data: results,
        message: `${results.length}/${totalEstudiantes} students found from Google Drive with automatically verified cache (${level} grade ${grade} section ${section})`,
      };
    } catch (error) {
      console.error(
        `${this.logPrefix} ❌ Error querying classroom ${level} ${grade}° ${section}:`,
        error
      );
      throw error;
    }
  }

  /**
   * Queries directly from Redis
   */
  private async queryFromRedis(
    studentId: string,
    attendanceType: TipoAsistencia,
    level?: NivelEducativo,
    grade?: number,
    section?: string
  ): Promise<QueryResult> {
    console.log(
      `${this.logPrefix} 🗄️ CONSULTING FROM REDIS: ${studentId}`
    );

    const currentDate = await this.getCurrentDate();
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[attendanceType]
    );
    console.log(
      `${this.logPrefix} 🔗 Redis client obtained for: ${attendanceType}`
    );
    // Determine level if not provided
    const deducedLevel =
      level ||
      (attendanceType === TipoAsistencia.ParaEstudiantesPrimaria
        ? NivelEducativo.PRIMARIA
        : NivelEducativo.SECUNDARIA);

    console.log(
      `${this.logPrefix} 📊 Deduced level for Redis: ${deducedLevel}`
    );

    // Query entry
    let entrySearchPattern: string;
    if (level && grade && section) {
      entrySearchPattern = `${currentDate}:${ModoRegistro.Entrada}:${ActoresSistema.Estudiante}:${level}:${grade}:${section}:${studentId}`;
    } else {
      entrySearchPattern = `${currentDate}:${ModoRegistro.Entrada}:${ActoresSistema.Estudiante}:*:*:*:${studentId}`;
    }

    console.log(
      `${this.logPrefix} 🔍 Entry search pattern: ${entrySearchPattern}`
    );

    let entryKeys: string[];
    if (level && grade && section) {
      const entryExists = await redisClientInstance.exists(
        entrySearchPattern
      );
      entryKeys = entryExists ? [entrySearchPattern] : [];
    } else {
      entryKeys = await redisClientInstance.keys(entrySearchPattern);
    }

    console.log(
      `${this.logPrefix} 📋 Found entry keys: ${entryKeys.length}`
    );

    // Build attendance data
    const attendanceData: {
      E?: { DesfaseSegundos: number };
      S?: { DesfaseSegundos: number };
    } = {};

    // Process entry
    if (entryKeys.length > 0) {
      const entryKey = entryKeys[0];
      console.log(
        `${this.logPrefix} 📥 Processing entry key: ${entryKey}`
      );

      const entryValue = await redisClientInstance.get(entryKey);

      if (
        entryValue &&
        Array.isArray(entryValue) &&
        entryValue.length >= 1
      ) {
        attendanceData.E = {
          DesfaseSegundos: parseInt(entryValue[0] as string),
        };
        console.log(
          `${this.logPrefix} ✅ Entry processed: ${attendanceData.E.DesfaseSegundos}s`
        );
      }
    }

    // Query exit if applicable
    const shouldQuery = await this.shouldQueryExits(deducedLevel);
    if (shouldQuery) {
      console.log(`${this.logPrefix} 🚪 Must consult exits, searching...`);

      let exitSearchPattern: string;
      if (level && grade && section) {
        exitSearchPattern = `${currentDate}:${ModoRegistro.Salida}:${ActoresSistema.Estudiante}:${level}:${grade}:${section}:${studentId}`;
      } else {
        exitSearchPattern = `${currentDate}:${ModoRegistro.Salida}:${ActoresSistema.Estudiante}:*:*:*:${studentId}`;
      }

      console.log(
        `${this.logPrefix} 🔍 Exit search pattern: ${exitSearchPattern}`
      );

      let exitKeys: string[];
      if (level && grade && section) {
        const exitExists = await redisClientInstance.exists(
          exitSearchPattern
        );
        exitKeys = exitExists ? [exitSearchPattern] : [];
      } else {
        exitKeys = await redisClientInstance.keys(exitSearchPattern);
      }

      console.log(
        `${this.logPrefix} 📋 Found exit keys: ${exitKeys.length}`
      );

      // Process exit
      if (exitKeys.length > 0) {
        const exitKey = exitKeys[0];
        console.log(
          `${this.logPrefix} 📤 Processing exit key: ${exitKey}`
        );

        const exitValue = await redisClientInstance.get(exitKey);

        if (
          exitValue &&
          Array.isArray(exitValue) &&
          exitValue.length >= 1
        ) {
          attendanceData.S = {
            DesfaseSegundos: parseInt(exitValue[0] as string),
          };
          console.log(
            `${this.logPrefix} ✅ Exit processed: ${attendanceData.S.DesfaseSegundos}s`
          );
        }
      }
    }

    // Check if anything was found
    if (!attendanceData.E && !attendanceData.S) {
      console.log(
        `${this.logPrefix} ❌ No data found in Redis for ${studentId}`
      );
      return {
        data: null,
        message: `Student ${studentId} not found in Redis`,
      };
    }

    // Build result (we need to get section somehow or use generic)
    const sectionForResult = section || "UNKNOWN";
    const result = await this.buildStudentResult(
      studentId,
      sectionForResult,
      attendanceData,
      deducedLevel
    );
    console.log(`${this.logPrefix} ✅ Result built from Redis`);

    return {
      data: result,
      message: `Data obtained from Redis`,
    };
  }

  /**
   * Queries classroom directly from Redis
   */
  private async queryClassroomFromRedis(
    attendanceType: TipoAsistencia,
    level: NivelEducativo,
    grade: number,
    section: string
  ): Promise<QueryResult> {
    console.log(
      `${this.logPrefix} 🗄️ CONSULTING CLASSROOM FROM REDIS: ${level} ${grade}° ${section}`
    );

    const currentDate = await this.getCurrentDate();
    const redisClientInstance = redisClient(
      GrupoInstaciasDeRedisPorTipoAsistencia[attendanceType]
    );
    console.log(
      `${this.logPrefix} 🔗 Redis client obtained for: ${attendanceType}`
    );

    // Query entries
    const entrySearchPattern = `${currentDate}:${ModoRegistro.Entrada}:${ActoresSistema.Estudiante}:${level}:${grade}:${section}:*`;
    console.log(
      `${this.logPrefix} 🔍 Classroom entry search pattern: ${entrySearchPattern}`
    );

    const entryKeys = await redisClientInstance.keys(entrySearchPattern);
    console.log(
      `${this.logPrefix} 📋 Found classroom entry keys: ${entryKeys.length}`
    );

    // Create map of students with their attendances
    const studentsMap = new Map<
      string,
      { E?: { DesfaseSegundos: number }; S?: { DesfaseSegundos: number } }
    >();

    // Process entries
    for (const key of entryKeys) {
      const value = await redisClientInstance.get(key);

      if (value && Array.isArray(value) && value.length >= 1) {
        const parts = key.split(":");
        if (parts.length >= 7) {
          const studentId = parts[6];
          const desfaseSegundos = parseInt(value[0] as string);

          if (!studentsMap.has(studentId)) {
            studentsMap.set(studentId, {});
          }
          studentsMap.get(studentId)!.E = {
            DesfaseSegundos: desfaseSegundos,
          };

          console.log(
            `${this.logPrefix} 📥 Entry processed for ${studentId}: ${desfaseSegundos}s`
          );
        }
      }
    }

    // Query exits if applicable
    const shouldQuery = await this.shouldQueryExits(level);
    if (shouldQuery) {
      console.log(`${this.logPrefix} 🚪 Consulting exits for classroom...`);

      const exitSearchPattern = `${currentDate}:${ModoRegistro.Salida}:${ActoresSistema.Estudiante}:${level}:${grade}:${section}:*`;
      console.log(
        `${this.logPrefix} 🔍 Classroom exit search pattern: ${exitSearchPattern}`
      );

      const exitKeys = await redisClientInstance.keys(exitSearchPattern);
      console.log(
        `${this.logPrefix} 📋 Found classroom exit keys: ${exitKeys.length}`
      );

      // Process exits
      for (const key of exitKeys) {
        const value = await redisClientInstance.get(key);

        if (value && Array.isArray(value) && value.length >= 1) {
          const parts = key.split(":");
          if (parts.length >= 7) {
            const studentId = parts[6];
            const desfaseSegundos = parseInt(value[0] as string);

            if (!studentsMap.has(studentId)) {
              studentsMap.set(studentId, {});
            }
            studentsMap.get(studentId)!.S = {
              DesfaseSegundos: desfaseSegundos,
            };

            console.log(
              `${this.logPrefix} 📤 Exit processed for ${studentId}: ${desfaseSegundos}s`
            );
          }
        }
      }
    }

    // Build results
    const results: AsistenciaDiariaEscolarResultado[] = [];

    for (const [studentId, attendanceData] of studentsMap.entries()) {
      const result = await this.buildStudentResult(
        studentId,
        section,
        attendanceData,
        level
      );
      results.push(result);
    }

    console.log(
      `${this.logPrefix} ✅ ${results.length} students processed from Redis`
    );

    return {
      data: results,
      message: `${results.length} students found from Redis`,
    };
  }
}
