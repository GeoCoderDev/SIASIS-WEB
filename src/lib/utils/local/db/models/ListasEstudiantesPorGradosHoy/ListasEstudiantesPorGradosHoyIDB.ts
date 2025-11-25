import { T_Estudiantes, T_Aulas } from "@prisma/client";
import {
  NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS,
  NOMBRE_ARCHIVO_LISTA_ESTUDIANTES,
} from "@/constants/NOMBRE_ARCHIVOS_SISTEMA";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import {
  GradosPrimaria,
  GradosSecundaria,
} from "@/constants/GRADOS_POR_NIVEL_EDUCATIVO";
import { ListaEstudiantesPorGradoParaHoy } from "@/interfaces/shared/Asistencia/ListaEstudiantesPorGradosParaHoy";
import {
  ReporteActualizacionDeListasEstudiantes,
  ReporteActualizacionDeListasEstudiantesPrimaria,
  ReporteActualizacionDeListasEstudiantesSecundaria,
} from "@/interfaces/shared/Asistencia/ReporteModificacionesListasDeEstudiantes";
import IndexedDBConnection from "../../IndexedDBConnection";
import { LogoutTypes, ErrorDetailsForLogout } from "@/interfaces/LogoutTypes";
import { logout } from "@/lib/utils/frontend/auth/logout";
import store from "@/global/store";
import TablasSistema, {
  ITablaInfo,
  TablasLocal,
} from "@/interfaces/shared/TablasSistema";
import userStorage from "../UserStorage";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import ultimaActualizacionTablasLocalesIDB from "../UltimaActualizacionTablasLocalesIDB";
import { DatabaseModificationOperations } from "@/interfaces/shared/DatabaseModificationOperations";

// Interface for the object saved in IndexedDB (individual files)
export interface ArchivoListaEstudiantesAlmacenado<T extends NivelEducativo> {
  id: string; // ex: 'Estudiantes_S_2'
  nivel: T;
  grado: T extends NivelEducativo.PRIMARIA ? GradosPrimaria : GradosSecundaria;
  datos: ListaEstudiantesPorGradoParaHoy<T>;
  fechaGuardado: string;
}

// Interface for the stored report
export interface ReporteActualizacionAlmacenado {
  id: string; // 'reporte_actualizacion_listas_de_estudiantes'
  datos: ReporteActualizacionDeListasEstudiantes;
  fechaGuardado: string;
}

export class ListasEstudiantesPorGradosHoyIDB {
  private readonly storeName: TablasLocal =
    TablasLocal.Tabla_Archivos_Asistencia_Hoy;
  private static readonly REPORTE_KEY =
    "reporte_actualizacion_listas_de_estudiantes";

  constructor(
    protected siasisAPI: SiasisAPIS | SiasisAPIS[],
    protected setIsSomethingLoading?: (isLoading: boolean) => void,
    protected setError?: (error: ErrorResponseAPIBase | null) => void,
    protected setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Handles errors according to their type and performs logout if necessary
   */
  private handleError(
    error: unknown,
    operacion: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detalles?: Record<string, any>
  ): void {
    console.error(
      `Error in ListasEstudiantesPorGradosHoyIDB (${operacion}):`,
      error
    );

    const errorDetails: ErrorDetailsForLogout = {
      origen: `ListasEstudiantesPorGradosHoyIDB.${operacion}`,
      mensaje: error instanceof Error ? error.message : String(error),
      timestamp: Date.now(),
      contexto: JSON.stringify(detalles || {}),
      siasisComponent: "CLN01",
    };

    let logoutType: LogoutTypes;

    if (error instanceof Error) {
      if (error.name === "QuotaExceededError" || error.name === "AbortError") {
        logoutType = LogoutTypes.ERROR_BASE_DATOS;
      } else if (
        error.message.includes("fetch") ||
        error.message.includes("network")
      ) {
        logoutType = LogoutTypes.ERROR_RED;
      } else if (
        error.message.includes("JSON") ||
        error.message.includes("parse")
      ) {
        logoutType = LogoutTypes.ERROR_DATOS_CORRUPTOS;
      } else {
        logoutType = LogoutTypes.ERROR_SISTEMA;
      }
    } else {
      logoutType = LogoutTypes.ERROR_SISTEMA;
    }

    logout(logoutType, errorDetails);
  }

  /**
   * Gets the current date from the Redux state
   * @returns Date object with the current date according to the global state or null if it cannot be obtained.
   */
  private obtenerFechaActualDesdeRedux(): Date | null {
    try {
      // We get the current state of Redux
      const state = store.getState();

      // We access the date from the global state
      const fechaHoraRedux = state.others.fechaHoraActualReal.fechaHora;

      // If we have a date in Redux, we use it
      if (fechaHoraRedux) {
        return new Date(fechaHoraRedux);
      }

      // If the date cannot be obtained from Redux, we return null
      return null;
    } catch (error) {
      console.error(
        "Error getting date from Redux in ListasEstudiantesPorGradosHoyIDB:",
        error
      );
      return null;
    }
  }

  /**
   * Formats a date in ISO format without the time part
   */
  private formatearFechaSoloDia(fecha: Date): string {
    return fecha.toISOString().split("T")[0];
  }

  /**
   * Compares if two ISO dates (day only) are the same day
   */
  private esMismoDia(fecha1ISO: string, fecha2ISO: string): boolean {
    return fecha1ISO === fecha2ISO;
  }

  /**
   * Checks if the provided date corresponds to a Saturday or Sunday (Peru time).
   */
  private esFinDeSemana(fecha: Date | null): boolean {
    if (!fecha) {
      return false; // If there is no date, it is not a weekend for this logic
    }
    const dayOfWeek = fecha.getDay(); // 0 (Sunday) - 6 (Saturday)
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  /**
   * Generates the file name based on level and grade
   */
  private generarNombreArchivo<T extends NivelEducativo>(
    nivel: T,
    grado: T extends NivelEducativo.PRIMARIA ? GradosPrimaria : GradosSecundaria
  ): NOMBRE_ARCHIVO_LISTA_ESTUDIANTES {
    if (nivel === NivelEducativo.PRIMARIA) {
      return NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[
        NivelEducativo.PRIMARIA
      ][grado as GradosPrimaria] as NOMBRE_ARCHIVO_LISTA_ESTUDIANTES;
    } else {
      return NOMBRES_ARCHIVOS_LISTAS_ESTUDIANTES_DIARIAS[
        NivelEducativo.SECUNDARIA
      ][grado as GradosSecundaria] as NOMBRE_ARCHIVO_LISTA_ESTUDIANTES;
    }
  }

  /**
   * Generates the IndexedDB key based on level and grade (without .json)
   */
  private generarKeyArchivo<T extends NivelEducativo>(
    nivel: T,
    grado: T extends NivelEducativo.PRIMARIA ? GradosPrimaria : GradosSecundaria
  ): string {
    const nombreArchivo = this.generarNombreArchivo(nivel, grado);
    return nombreArchivo.replace(".json", "");
  }

  /**
   * Gets the update report from the server
   */
  private async fetchReporteFromServer(): Promise<ReporteActualizacionDeListasEstudiantes> {
    try {
      const response = await fetch(
        "/api/listas-estudiantes/reporte-actualizacion"
      );
      if (!response.ok) {
        throw new Error(
          `Error in server response: ${response.status} ${response.statusText}`
        );
      }
      return await response.json();
    } catch (error) {
      this.handleError(error, "fetchReporteFromServer");
      throw error;
    }
  }

  /**
   * Gets a specific file from the server
   */
  private async fetchArchivoFromServer<T extends NivelEducativo>(
    nivel: T,
    grado: T extends NivelEducativo.PRIMARIA ? GradosPrimaria : GradosSecundaria
  ): Promise<ListaEstudiantesPorGradoParaHoy<T>> {
    try {
      const nombreArchivo = this.generarNombreArchivo(nivel, grado);
      const response = await fetch(
        `/api/listas-estudiantes?nombreLista=${nombreArchivo}`
      );

      if (!response.ok) {
        throw new Error(
          `Error in server response: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      // Remove the _debug field if it exists
      const { _debug, ...cleanData } = data;
      return cleanData as ListaEstudiantesPorGradoParaHoy<T>;
    } catch (error) {
      this.handleError(error, "fetchArchivoFromServer", { nivel, grado });
      throw error;
    }
  }

  /**
   * Saves the update report in IndexedDB
   */
  private async guardarReporteInterno(
    reporte: ReporteActualizacionDeListasEstudiantes
  ): Promise<void> {
    const fechaActual = this.obtenerFechaActualDesdeRedux();
    if (!fechaActual) {
      console.warn(
        "Could not save report because the date was not obtained from Redux."
      );
      return;
    }

    try {
      const store = await IndexedDBConnection.getStore(
        this.storeName,
        "readwrite"
      );

      const reporteAlmacenado: ReporteActualizacionAlmacenado = {
        id: ListasEstudiantesPorGradosHoyIDB.REPORTE_KEY,
        datos: reporte,
        fechaGuardado: this.formatearFechaSoloDia(fechaActual),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(
          reporteAlmacenado,
          ListasEstudiantesPorGradosHoyIDB.REPORTE_KEY
        );

        request.onsuccess = () => {
          resolve();
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.onerror = (event: any) => {
          reject(
            new Error(
              `Error saving report to IndexedDB: ${
                (event.target as IDBRequest).error
              }`
            )
          );
        };
      });
    } catch (error) {
      this.handleError(error, "guardarReporteInterno");
      throw error;
    }
  }

  /**
   * Saves a student list file in IndexedDB
   */
  private async guardarArchivoInterno<T extends NivelEducativo>(
    nivel: T,
    grado: T extends NivelEducativo.PRIMARIA
      ? GradosPrimaria
      : GradosSecundaria,
    datos: ListaEstudiantesPorGradoParaHoy<T>
  ): Promise<void> {
    const fechaActual = this.obtenerFechaActualDesdeRedux();
    if (!fechaActual) {
      console.warn(
        "Could not save file because the date was not obtained from Redux."
      );
      return;
    }

    try {
      const store = await IndexedDBConnection.getStore(
        this.storeName,
        "readwrite"
      );

      const keyArchivo = this.generarKeyArchivo(nivel, grado);
      const archivoAlmacenado: ArchivoListaEstudiantesAlmacenado<T> = {
        id: keyArchivo,
        nivel,
        grado,
        datos,
        fechaGuardado: this.formatearFechaSoloDia(fechaActual),
      };

      return new Promise((resolve, reject) => {
        const request = store.put(archivoAlmacenado, keyArchivo);

        request.onsuccess = () => {
          resolve();
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        request.onerror = (event: any) => {
          reject(
            new Error(
              `Error saving file to IndexedDB: ${
                (event.target as IDBRequest).error
              }`
            )
          );
        };
      });
    } catch (error) {
      this.handleError(error, "guardarArchivoInterno", { nivel, grado });
      throw error;
    }
  }

  /**
   * Gets the stored report from IndexedDB
   */
  private async obtenerReporteAlmacenado(): Promise<ReporteActualizacionAlmacenado | null> {
    try {
      const store = await IndexedDBConnection.getStore(this.storeName);
      return new Promise((resolve, reject) => {
        const request = store.get(ListasEstudiantesPorGradosHoyIDB.REPORTE_KEY);
        request.onsuccess = () => {
          resolve(request.result || null);
        };
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleError(error, "obtenerReporteAlmacenado");
      return null;
    }
  }

  /**
   * Gets a stored file from IndexedDB
   */
  private async obtenerArchivoAlmacenado<T extends NivelEducativo>(
    nivel: T,
    grado: T extends NivelEducativo.PRIMARIA ? GradosPrimaria : GradosSecundaria
  ): Promise<ArchivoListaEstudiantesAlmacenado<T> | null> {
    try {
      const store = await IndexedDBConnection.getStore(this.storeName);
      const keyArchivo = this.generarKeyArchivo(nivel, grado);

      return new Promise((resolve, reject) => {
        const request = store.get(keyArchivo);
        request.onsuccess = () => {
          resolve(request.result || null);
        };
        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleError(error, "obtenerArchivoAlmacenado", { nivel, grado });
      return null;
    }
  }

  /**
   * Gets the student list update report.
   * Synchronizes data from the server if necessary and returns it.
   */
  public async obtenerReporteActualizacion(): Promise<
    | ReporteActualizacionDeListasEstudiantes
    | ReporteActualizacionDeListasEstudiantesPrimaria
    | ReporteActualizacionDeListasEstudiantesSecundaria
    | null
  > {
    const fechaHoyRedux = this.obtenerFechaActualDesdeRedux();

    // If the date could not be obtained from Redux, do nothing and return null
    if (!fechaHoyRedux) {
      return null;
    }

    try {
      const storedData = await this.obtenerReporteAlmacenado();
      const fechaHoyISO = this.formatearFechaSoloDia(fechaHoyRedux);

      // Do not synchronize if it is a weekend
      if (this.esFinDeSemana(fechaHoyRedux) && storedData) {
        return this.filtrarReporteSegunRol(storedData.datos);
      }

      let reporteCompleto: ReporteActualizacionDeListasEstudiantes;

      if (
        !storedData ||
        !this.esMismoDia(storedData.fechaGuardado, fechaHoyISO)
      ) {
        reporteCompleto = await this.fetchReporteFromServer();
        await this.guardarReporteInterno(reporteCompleto);
      } else {
        reporteCompleto = storedData.datos;
      }

      // Filter according to user role
      return this.filtrarReporteSegunRol(reporteCompleto);
    } catch (error) {
      console.error("Error getting or synchronizing report:", error);
      return null;
    }
  }

  /**
   * Gets the content of a specific file by level and grade.
   * @param nivel Educational level (PRIMARY or SECONDARY)
   * @param grado Specific grade of the level
   * @param actualizarIndexedDB If true, updates the student and classroom models in IndexedDB
   */
  public async obtenerListaEstudiantesPorGrado<T extends NivelEducativo>(
    nivel: T,
    grado: T extends NivelEducativo.PRIMARIA
      ? GradosPrimaria
      : GradosSecundaria,
    actualizarIndexedDB: boolean = false
  ): Promise<ListaEstudiantesPorGradoParaHoy<T> | null> {
    const fechaHoyRedux = this.obtenerFechaActualDesdeRedux();

    // If the date could not be obtained from Redux, do nothing and return null
    if (!fechaHoyRedux) {
      return null;
    }

    try {
      const storedData = await this.obtenerArchivoAlmacenado(nivel, grado);
      const fechaHoyISO = this.formatearFechaSoloDia(fechaHoyRedux);

      // Do not synchronize if it is a weekend
      if (this.esFinDeSemana(fechaHoyRedux) && storedData) {
        return storedData.datos;
      }

      let datosCompletos: ListaEstudiantesPorGradoParaHoy<T>;

      if (
        !storedData ||
        !this.esMismoDia(storedData.fechaGuardado, fechaHoyISO)
      ) {
        datosCompletos = await this.fetchArchivoFromServer(nivel, grado);
        await this.guardarArchivoInterno(nivel, grado, datosCompletos);
      } else {
        datosCompletos = storedData.datos;
      }

      // If updating IndexedDB is requested, use the updateIfNeeded methods
      if (actualizarIndexedDB) {
        await this.actualizarModelos(datosCompletos);
      }

      return datosCompletos;
    } catch (error) {
      console.error("Error getting or synchronizing file:", error);
      return null;
    }
  }

  /**
   * Updates the student and classroom models using the updateIfNeeded method
   * FIXED VERSION: Unique verification per complete file (not per global table)
   */
  private async actualizarModelos<T extends NivelEducativo>(
    datos: ListaEstudiantesPorGradoParaHoy<T>
  ): Promise<void> {
    try {
      // Dynamically import models to avoid circular dependencies
      const [{ BaseEstudiantesIDB }, { BaseAulasIDB }] = await Promise.all([
        import("../Estudiantes/EstudiantesBaseIDB"),
        import("../Aulas/AulasBase"),
      ]);

      const fechaActual = this.obtenerFechaActualDesdeRedux();
      if (!fechaActual) return;

      const fechaObtenciones = fechaActual.toISOString();

      console.log("Starting model update with data:", {
        estudiantes: datos.ListaEstudiantes.length,
        aulas: datos.Aulas.length,
        nivel: datos.Nivel,
        grado: datos.Grado,
      });

      // ✅ STEP 1: Unique verification per FILE (not per global table)
      // Generate a unique key for this specific file
      const archivoKey = `${datos.Nivel}_${datos.Grado}`;
      const necesitaActualizar =
        await this.verificarSiNecesitaActualizarArchivo(
          archivoKey,
          fechaObtenciones
        );

      console.log(
        `🔍 Verification for file [${archivoKey}]: ${
          necesitaActualizar
            ? "✅ Needs update"
            : "⏭️ Does not need update"
        }`
      );

      if (!necesitaActualizar) {
        console.log(
          `⏭️ Skipping full update of file ${archivoKey} - local data is more recent`
        );
        return;
      }

      // ✅ STEP 2: Process students (partitioned by classroom)
      let totalResultadoEstudiantes = {
        created: 0,
        updated: 0,
        deleted: 0,
        errors: 0,
        wasUpdated: false,
      };

      // Instantiate student model
      const estudiantesModel = new BaseEstudiantesIDB(
        this.siasisAPI,
        this.setIsSomethingLoading,
        this.setError,
        this.setSuccessMessage
      );

      // Partition students by classroom
      const estudiantesPorAula = this.particionarEstudiantesPorAula(
        datos.ListaEstudiantes
      );

      console.log(
        `📦 Students partitioned into ${estudiantesPorAula.size} groups by classroom:`,
        Array.from(estudiantesPorAula.keys())
      );

      // Process each partition without checking individual dates
      for (const [idAula, estudiantesDeAula] of estudiantesPorAula) {
        console.log(
          `🔄 Processing classroom ${idAula}: ${estudiantesDeAula.length} students`
        );

        const filtroEstudiantesEspecifico = {
          Id_Aula: idAula,
        };

        // ✅ Use upsertFromServerWithFilter directly without date verification
        const resultadoParcial = await estudiantesModel[
          "upsertFromServerWithFilter"
        ](filtroEstudiantesEspecifico, estudiantesDeAula);

        totalResultadoEstudiantes.created += resultadoParcial.created;
        totalResultadoEstudiantes.updated += resultadoParcial.updated;
        totalResultadoEstudiantes.deleted += resultadoParcial.deleted;
        totalResultadoEstudiantes.errors += resultadoParcial.errors;
        totalResultadoEstudiantes.wasUpdated = true;

        console.log(
          `   ✅ Classroom ${idAula}: +${resultadoParcial.created} created, ~${resultadoParcial.updated} updated, -${resultadoParcial.deleted} deleted`
        );
      }

      // ✅ STEP 3: Process classrooms (filter by specific Level and Grade)
      const aulasModel = new BaseAulasIDB(
        this.siasisAPI,
        this.setIsSomethingLoading,
        this.setError,
        this.setSuccessMessage
      );

      const filtroAulas = {
        Nivel: datos.Nivel,
        Grado: datos.Grado,
      };

      console.log(
        `🏢 Updating classrooms with filter: Level=${datos.Nivel}, Grade=${datos.Grado}`
      );

      // ✅ Use upsertFromServerWithFilter directly without date verification
      const resultadoAulas = await aulasModel["upsertFromServerWithFilter"](
        filtroAulas,
        datos.Aulas
      );

      const resultadoAulasCompleto = { ...resultadoAulas, wasUpdated: true };

      // ✅ STEP 4: Update the file date ONLY ONCE at the end
      await this.registrarActualizacionDeArchivo(archivoKey);

      // ✅ STEP 5: Log consolidated results
      console.log("📊 Student update completed (consolidated):", {
        archivo: archivoKey,
        totalTransacciones: estudiantesPorAula.size,
        wasUpdated: totalResultadoEstudiantes.wasUpdated,
        created: totalResultadoEstudiantes.created,
        updated: totalResultadoEstudiantes.updated,
        deleted: totalResultadoEstudiantes.deleted,
        errors: totalResultadoEstudiantes.errors,
      });

      console.log("🏢 Classroom update completed:", {
        archivo: archivoKey,
        wasUpdated: resultadoAulasCompleto.wasUpdated,
        created: resultadoAulasCompleto.created,
        updated: resultadoAulasCompleto.updated,
        deleted: resultadoAulasCompleto.deleted,
        errors: resultadoAulasCompleto.errors,
      });

      console.log(`✅ Final verification for ${datos.Nivel} ${datos.Grado}°:`);
      console.log(`   - Classrooms processed: ${datos.Aulas.length}`);
      console.log(`   - Student groups: ${estudiantesPorAula.size}`);
      console.log(`   - Total students: ${datos.ListaEstudiantes.length}`);
    } catch (error) {
      console.error("❌ Error updating models:", error);
      this.handleError(error, "actualizarModelos");
    }
  }

  /**
   * Checks if a specific file needs to be updated by comparing dates
   * @param archivoKey Unique key of the file (ex: "S_1", "P_3")
   * @param fechaObtenciones Date of obtaining the data from the server
   * @returns true if it needs to be updated, false otherwise
   */
  private async verificarSiNecesitaActualizarArchivo(
    archivoKey: string,
    fechaObtenciones: string
  ): Promise<boolean> {
    try {
      // Use a specific table for file tracking
      const nombreTablaArchivo = `archivo_${archivoKey}` as TablasLocal;

      // Get the last local update of this specific file
      const ultimaActualizacionLocal =
        await ultimaActualizacionTablasLocalesIDB.getByTabla(
          nombreTablaArchivo
        );

      // Convert the server data obtaining date to a timestamp
      const fechaObtencionsTimestamp = new Date(fechaObtenciones).getTime();

      // If there is no local update, it needs to be updated
      if (!ultimaActualizacionLocal) {
        console.log(
          `📅 File ${archivoKey}: No local update registered`
        );
        return true;
      }

      // Convert the local update date to a timestamp
      const fechaActualizacionLocal =
        typeof ultimaActualizacionLocal.Fecha_Actualizacion === "number"
          ? ultimaActualizacionLocal.Fecha_Actualizacion
          : new Date(ultimaActualizacionLocal.Fecha_Actualizacion).getTime();

      // Compare dates
      const necesitaActualizar =
        fechaActualizacionLocal < fechaObtencionsTimestamp;

      console.log(
        `📅 File ${archivoKey}: Local(${new Date(
          fechaActualizacionLocal
        ).toLocaleString()}) vs Server(${new Date(
          fechaObtencionsTimestamp
        ).toLocaleString()}) → ${
          necesitaActualizar ? "UPDATE" : "DO NOT UPDATE"
        }`
      );

      return necesitaActualizar;
    } catch (error) {
      console.error(
        `Error checking dates for file ${archivoKey}:`,
        error
      );
      // In case of error, assume it needs to be updated
      return true;
    }
  }

  /**
   * Registers the update of a specific file
   * @param archivoKey Unique key of the file
   */
  private async registrarActualizacionDeArchivo(
    archivoKey: string
  ): Promise<void> {
    try {
      const nombreTablaArchivo = `archivo_${archivoKey}` as TablasLocal;

      await ultimaActualizacionTablasLocalesIDB.registrarActualizacion(
        nombreTablaArchivo,
        DatabaseModificationOperations.UPDATE
      );

      console.log(`📅 File date ${archivoKey} updated`);
    } catch (error) {
      console.error(
        `Error registering file update ${archivoKey}:`,
        error
      );
    }
  }

  /**
   * Partitions a list of students by grouping them by Id_Aula
   * @param estudiantes Full list of students
   * @returns Map with Id_Aula as key and array of students as value
   */
  private particionarEstudiantesPorAula<T extends T_Estudiantes>(
    estudiantes: T[]
  ): Map<string, T[]> {
    const estudiantesPorAula = new Map<string, T[]>();

    for (const estudiante of estudiantes) {
      const idAula = estudiante.Id_Aula;

      // Validate that the student has a classroom assigned
      if (!idAula) {
        console.warn(
          `⚠️ Student without assigned classroom: ${estudiante.Id_Estudiante} - ${estudiante.Nombres} ${estudiante.Apellidos}`
        );
        continue;
      }

      // Add student to the corresponding group
      if (!estudiantesPorAula.has(idAula)) {
        estudiantesPorAula.set(idAula, []);
      }

      estudiantesPorAula.get(idAula)!.push(estudiante);
    }

    return estudiantesPorAula;
  }

  /**
   * Filters the report according to the user's role
   */
  private async filtrarReporteSegunRol(
    reporte: ReporteActualizacionDeListasEstudiantes
  ): Promise<
    | ReporteActualizacionDeListasEstudiantes
    | ReporteActualizacionDeListasEstudiantesPrimaria
    | ReporteActualizacionDeListasEstudiantesSecundaria
  > {
    try {
      const rol = await userStorage.getRol();

      switch (rol) {
        case RolesSistema.Directivo:
          // Directors have full access
          return reporte;

        case RolesSistema.ProfesorPrimaria:
          // Primary school teachers only see primary school files
          const listasPrimaria = {} as any;
          Object.entries(reporte.EstadoDeListasDeEstudiantes).forEach(
            ([archivo, fecha]) => {
              if (archivo.includes("Estudiantes_P_")) {
                listasPrimaria[archivo] = fecha;
              }
            }
          );
          return {
            EstadoDeListasDeEstudiantes: listasPrimaria,
            Fecha_Actualizacion: reporte.Fecha_Actualizacion,
          };

        case RolesSistema.Auxiliar:
        case RolesSistema.ProfesorSecundaria:
        case RolesSistema.Tutor:
          // Secondary school staff only see secondary school files
          const listasSecundaria = {} as any;
          Object.entries(reporte.EstadoDeListasDeEstudiantes).forEach(
            ([archivo, fecha]) => {
              if (archivo.includes("Estudiantes_S_")) {
                listasSecundaria[archivo] = fecha;
              }
            }
          );
          return {
            EstadoDeListasDeEstudiantes: listasSecundaria,
            Fecha_Actualizacion: reporte.Fecha_Actualizacion,
          };

        default:
          // By default, return an empty but valid structure
          return {
            EstadoDeListasDeEstudiantes: {} as any,
            Fecha_Actualizacion: reporte.Fecha_Actualizacion,
          };
      }
    } catch (error) {
      console.error("Error filtering report by role:", error);
      // In case of error, return the full report
      return reporte;
    }
  }

  /**
   * Clears all student list files from the cache
   */
  public async limpiarTodosLosArchivos(): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.storeName,
        "readwrite"
      );

      // Generate all possible keys for student list files
      const keysAEliminar: string[] = [];

      // Add report
      keysAEliminar.push(ListasEstudiantesPorGradosHoyIDB.REPORTE_KEY);

      // Add primary school files
      Object.values(GradosPrimaria).forEach((grado) => {
        if (typeof grado === "number") {
          keysAEliminar.push(
            this.generarKeyArchivo(NivelEducativo.PRIMARIA, grado)
          );
        }
      });

      // Add secondary school files
      Object.values(GradosSecundaria).forEach((grado) => {
        if (typeof grado === "number") {
          keysAEliminar.push(
            this.generarKeyArchivo(NivelEducativo.SECUNDARIA, grado)
          );
        }
      });

      // Delete each key
      const promesasEliminacion = keysAEliminar.map((key) => {
        return new Promise<void>((resolve, reject) => {
          const request = store.delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });

      await Promise.allSettled(promesasEliminacion);
      console.log(
        "All student list files have been cleared from the cache"
      );
    } catch (error) {
      console.error("Error clearing files:", error);
      this.handleError(error, "limpiarTodosLosArchivos");
    }
  }

  /**
   * Updates all available student lists according to the update report.
   * Synchronizes all lists that appear in the report filtered by role.
   * Makes up to 3 attempts per file if it needs to be updated.
   * @param actualizarIndexedDB If it should update the student and classroom models in IndexedDB
   * @returns Summary of the operation with success and failure statistics
   */
  public async actualizarTodasLasListasDisponibles(
    actualizarIndexedDB: boolean = true
  ): Promise<{
    totalProcesadas: number;
    exitosas: number;
    fallidas: number;
    noNecesitaronActualizacion: number;
    detalles: Array<{
      archivo: string;
      nivel: string;
      grado: number;
      exito: boolean;
      intentos: number;
      error?: string;
    }>;
  }> {
    const resultado = {
      totalProcesadas: 0,
      exitosas: 0,
      fallidas: 0,
      noNecesitaronActualizacion: 0,
      detalles: [] as Array<{
        archivo: string;
        nivel: string;
        grado: number;
        exito: boolean;
        intentos: number;
        error?: string;
      }>,
    };

    try {
      console.log(
        "🚀 Starting bulk update of all available lists..."
      );

      // 1. Get the update report (already filtered by role)
      const reporte = await this.obtenerReporteActualizacion();

      if (!reporte) {
        console.error("❌ Could not get update report");
        return resultado;
      }

      const archivosEnReporte = Object.keys(
        reporte.EstadoDeListasDeEstudiantes
      );
      console.log(
        `📋 Files found in report: ${archivosEnReporte.length}`
      );

      if (archivosEnReporte.length === 0) {
        console.log("ℹ️ No files to process in the report");
        return resultado;
      }

      // 2. Process each file sequentially
      for (const nombreArchivo of archivosEnReporte) {
        resultado.totalProcesadas++;

        try {
          // Extract level and grade from the file name
          const { nivel, grado } =
            this.extraerNivelYGradoDeNombreArchivo(nombreArchivo);

          if (!nivel || grado === null) {
            console.warn(
              `⚠️ Could not extract level/grade from: ${nombreArchivo}`
            );
            resultado.fallidas++;
            resultado.detalles.push({
              archivo: nombreArchivo,
              nivel: "unknown",
              grado: 0,
              exito: false,
              intentos: 0,
              error: "Could not extract level/grade from file name",
            });
            continue;
          }

          console.log(`\n🔄 Processing: ${nombreArchivo} (${nivel} ${grado}°)`);

          // 3. Try to update with up to 3 retries
          let exito = false;
          let ultimoError = "";
          let intentos = 0;
          const MAX_INTENTOS = 3;

          for (intentos = 1; intentos <= MAX_INTENTOS; intentos++) {
            try {
              console.log(
                `📥 Attempt ${intentos}/${MAX_INTENTOS} for ${nombreArchivo}...`
              );

              // Get the list (this internally checks if it needs an update)
              const lista = await this.obtenerListaEstudiantesPorGrado(
                nivel as any,
                grado as any,
                actualizarIndexedDB
              );

              if (lista) {
                exito = true;
                console.log(
                  `✅ ${nombreArchivo} processed successfully on attempt ${intentos}`
                );
                resultado.exitosas++;
                resultado.detalles.push({
                  archivo: nombreArchivo,
                  nivel,
                  grado,
                  exito: true,
                  intentos,
                });
                break; // Exit the retry loop
              } else {
                throw new Error("List returned null");
              }
            } catch (error) {
              ultimoError =
                error instanceof Error ? error.message : String(error);
              console.warn(
                `⚠️ Attempt ${intentos} failed for ${nombreArchivo}: ${ultimoError}`
              );

              // If it's not the last attempt, wait a bit before the next one
              if (intentos < MAX_INTENTOS) {
                const tiempoEspera = intentos * 1000; // 1s, 2s, 3s
                console.log(
                  `⏳ Waiting ${tiempoEspera}ms before the next attempt...`
                );
                await new Promise((resolve) =>
                  setTimeout(resolve, tiempoEspera)
                );
              }
            }
          }

          // If it was not successful after all attempts
          if (!exito) {
            console.error(
              `❌ ${nombreArchivo} failed after ${MAX_INTENTOS} attempts. Last error: ${ultimoError}`
            );
            resultado.fallidas++;
            resultado.detalles.push({
              archivo: nombreArchivo,
              nivel,
              grado,
              exito: false,
              intentos: MAX_INTENTOS,
              error: ultimoError,
            });

            // TODO: Here the user can add additional logic to handle failed files
            // For example: save to a retry queue, send notification, etc.
            console.log(
              `💡 TODO: Implement special handling for ${nombreArchivo} that failed after ${MAX_INTENTOS} attempts`
            );
          }

          // Small pause between files to not overload
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`❌ Error processing ${nombreArchivo}:`, error);
          resultado.fallidas++;
          resultado.detalles.push({
            archivo: nombreArchivo,
            nivel: "error",
            grado: 0,
            exito: false,
            intentos: 0,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // 3. Show final summary
      console.log(
        "\n📊 ==================== FINAL SUMMARY ===================="
      );
      console.log(`📁 Total processed: ${resultado.totalProcesadas}`);
      console.log(`✅ Successful: ${resultado.exitosas}`);
      console.log(`❌ Failed: ${resultado.fallidas}`);
      console.log(
        `⏭️ Did not need update: ${resultado.noNecesitaronActualizacion}`
      );

      if (resultado.fallidas > 0) {
        console.log("\n💥 Files that failed:");
        resultado.detalles
          .filter((d) => !d.exito)
          .forEach((detalle) => {
            console.log(
              `   - ${detalle.archivo}: ${detalle.error} (${detalle.intentos} attempts)`
            );
          });
      }

      console.log("🏁 Bulk update completed.");

      return resultado;
    } catch (error) {
      console.error("❌ Error in bulk update:", error);
      this.handleError(error, "actualizarTodasLasListasDisponibles");
      return resultado;
    }
  }

  /**
   * Extracts the educational level and grade from a file name
   * @param nombreArchivo File name (ex: "Estudiantes_P_3.json")
   * @returns Object with extracted level and grade
   */
  private extraerNivelYGradoDeNombreArchivo(nombreArchivo: string): {
    nivel: NivelEducativo | null;
    grado: number | null;
  } {
    try {
      // Remove the .json extension if it exists
      const sinExtension = nombreArchivo.replace(".json", "");

      // Pattern: Estudiantes_P_1 or Estudiantes_S_2
      const match = sinExtension.match(/Estudiantes_([PS])_(\d+)/);

      if (!match) {
        return { nivel: null, grado: null };
      }

      const [, nivelChar, gradoStr] = match;
      const grado = parseInt(gradoStr, 10);

      let nivel: NivelEducativo | null = null;

      if (nivelChar === "P") {
        nivel = NivelEducativo.PRIMARIA;
      } else if (nivelChar === "S") {
        nivel = NivelEducativo.SECUNDARIA;
      }

      // Validate that the grade is valid for the level
      if (nivel === NivelEducativo.PRIMARIA) {
        const gradosValidosPrimaria = Object.values(GradosPrimaria).filter(
          (g) => typeof g === "number"
        ) as number[];
        if (!gradosValidosPrimaria.includes(grado)) {
          return { nivel: null, grado: null };
        }
      } else if (nivel === NivelEducativo.SECUNDARIA) {
        const gradosValidosSecundaria = Object.values(GradosSecundaria).filter(
          (g) => typeof g === "number"
        ) as number[];
        if (!gradosValidosSecundaria.includes(grado)) {
          return { nivel: null, grado: null };
        }
      }

      return { nivel, grado };
    } catch (error) {
      console.error(
        `Error extracting level and grade from ${nombreArchivo}:`,
        error
      );
      return { nivel: null, grado: null };
    }
  }
}

// Export the class so it can be instantiated as needed
export default ListasEstudiantesPorGradosHoyIDB;
