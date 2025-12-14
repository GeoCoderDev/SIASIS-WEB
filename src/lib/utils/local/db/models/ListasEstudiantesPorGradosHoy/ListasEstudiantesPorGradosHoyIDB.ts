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

// Interfaz para el objeto guardado en IndexedDB (archivos individuales)
export interface ArchivoListaEstudiantesAlmacenado<T extends NivelEducativo> {
  id: string; // ej: 'Estudiantes_S_2'
  nivel: T;
  grado: T extends NivelEducativo.PRIMARIA ? GradosPrimaria : GradosSecundaria;
  datos: ListaEstudiantesPorGradoParaHoy<T>;
  fechaGuardado: string;
}

// Interfaz para el reporte almacenado
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
   * Maneja los errores según su tipo y realiza logout si es necesario
   */
  private handleError(
    error: unknown,
    operacion: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    detalles?: Record<string, any>
  ): void {
    console.error(
      `Error en ListasEstudiantesPorGradosHoyIDB (${operacion}):`,
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
   * Obtiene la fecha actual desde el estado de Redux
   * @returns Objeto Date con la fecha actual según el estado global o null si no se puede obtener.
   */
  private obtenerFechaActualDesdeRedux(): Date | null {
    try {
      // Obtenemos el estado actual de Redux
      const state = store.getState();

      // Accedemos a la fecha del estado global
      const fechaHoraRedux = state.others.fechaHoraActualReal.fechaHora;

      // Si tenemos fecha en Redux, la usamos
      if (fechaHoraRedux) {
        return new Date(fechaHoraRedux);
      }

      // Si no se puede obtener la fecha de Redux, retornamos null
      return null;
    } catch (error) {
      console.error(
        "Error al obtener fecha desde Redux en ListasEstudiantesPorGradosHoyIDB:",
        error
      );
      return null;
    }
  }

  /**
   * Formatea una fecha en formato ISO sin la parte de tiempo
   */
  private formatearFechaSoloDia(fecha: Date): string {
    return fecha.toISOString().split("T")[0];
  }

  /**
   * Compara si dos fechas ISO (solo día) son el mismo día
   */
  private esMismoDia(fecha1ISO: string, fecha2ISO: string): boolean {
    return fecha1ISO === fecha2ISO;
  }

  /**
   * Verifica si la fecha proporcionada corresponde a un sábado o domingo (Perú time).
   */
  private esFinDeSemana(fecha: Date | null): boolean {
    if (!fecha) {
      return false; // Si no hay fecha, no es fin de semana para esta lógica
    }
    const dayOfWeek = fecha.getDay(); // 0 (Domingo) - 6 (Sábado)
    return dayOfWeek === 0 || dayOfWeek === 6;
  }

  /**
   * Genera el nombre del archivo basado en nivel y grado
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
   * Genera la key de IndexedDB basada en nivel y grado (sin .json)
   */
  private generarKeyArchivo<T extends NivelEducativo>(
    nivel: T,
    grado: T extends NivelEducativo.PRIMARIA ? GradosPrimaria : GradosSecundaria
  ): string {
    const nombreArchivo = this.generarNombreArchivo(nivel, grado);
    return nombreArchivo.replace(".json", "");
  }

  /**
   * Obtiene el reporte de actualización desde el servidor
   */
  private async fetchReporteFromServer(): Promise<ReporteActualizacionDeListasEstudiantes> {
    try {
      const response = await fetch(
        "/api/listas-estudiantes/reporte-actualizacion"
      );
      if (!response.ok) {
        throw new Error(
          `Error en la respuesta del servidor: ${response.status} ${response.statusText}`
        );
      }
      return await response.json();
    } catch (error) {
      this.handleError(error, "fetchReporteFromServer");
      throw error;
    }
  }

  /**
   * Obtiene un archivo específico desde el servidor
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
          `Error en la respuesta del servidor: ${response.status} ${response.statusText}`
        );
      }

      const data = await response.json();
      // Remover el campo _debug si existe
      const { _debug, ...cleanData } = data;
      return cleanData as ListaEstudiantesPorGradoParaHoy<T>;
    } catch (error) {
      this.handleError(error, "fetchArchivoFromServer", { nivel, grado });
      throw error;
    }
  }

  /**
   * Guarda el reporte de actualización en IndexedDB
   */
  private async guardarReporteInterno(
    reporte: ReporteActualizacionDeListasEstudiantes
  ): Promise<void> {
    const fechaActual = this.obtenerFechaActualDesdeRedux();
    if (!fechaActual) {
      console.warn(
        "No se pudo guardar reporte porque no se obtuvo la fecha de Redux."
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
              `Error al guardar reporte en IndexedDB: ${
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
   * Guarda un archivo de lista de estudiantes en IndexedDB
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
        "No se pudo guardar archivo porque no se obtuvo la fecha de Redux."
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
              `Error al guardar archivo en IndexedDB: ${
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
   * Obtiene el reporte almacenado en IndexedDB
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
   * Obtiene un archivo almacenado en IndexedDB
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
   * Obtiene el reporte de actualización de listas de estudiantes.
   * Sincroniza los datos desde el servidor si es necesario y los devuelve.
   */
  public async obtenerReporteActualizacion(): Promise<
    | ReporteActualizacionDeListasEstudiantes
    | ReporteActualizacionDeListasEstudiantesPrimaria
    | ReporteActualizacionDeListasEstudiantesSecundaria
    | null
  > {
    const fechaHoyRedux = this.obtenerFechaActualDesdeRedux();

    // Si no se pudo obtener la fecha de Redux, no hacer nada y retornar null
    if (!fechaHoyRedux) {
      return null;
    }

    try {
      const storedData = await this.obtenerReporteAlmacenado();
      const fechaHoyISO = this.formatearFechaSoloDia(fechaHoyRedux);

      // No sincronizar si es fin de semana
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

      // Filtrar según el rol del usuario
      return this.filtrarReporteSegunRol(reporteCompleto);
    } catch (error) {
      console.error("Error al obtener o sincronizar reporte:", error);
      return null;
    }
  }

  /**
   * Obtiene el contenido de un archivo específico por nivel y grado.
   * @param nivel Nivel educativo (PRIMARIA o SECUNDARIA)
   * @param grado Grado específico del nivel
   * @param actualizarIndexedDB Si es true, actualiza los modelos de estudiantes y aulas en IndexedDB
   */
  public async obtenerListaEstudiantesPorGrado<T extends NivelEducativo>(
    nivel: T,
    grado: T extends NivelEducativo.PRIMARIA
      ? GradosPrimaria
      : GradosSecundaria,
    actualizarIndexedDB: boolean = false
  ): Promise<ListaEstudiantesPorGradoParaHoy<T> | null> {
    const fechaHoyRedux = this.obtenerFechaActualDesdeRedux();

    // Si no se pudo obtener la fecha de Redux, no hacer nada y retornar null
    if (!fechaHoyRedux) {
      return null;
    }

    try {
      const storedData = await this.obtenerArchivoAlmacenado(nivel, grado);
      const fechaHoyISO = this.formatearFechaSoloDia(fechaHoyRedux);

      // No sincronizar si es fin de semana
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

      // Si se solicita actualizar IndexedDB, usar los métodos actualizarSiEsNecesario
      if (actualizarIndexedDB) {
        await this.actualizarModelos(datosCompletos);
      }

      return datosCompletos;
    } catch (error) {
      console.error("Error al obtener o sincronizar archivo:", error);
      return null;
    }
  }

  /**
   * Actualiza los modelos de estudiantes y aulas usando el método actualizarSiEsNecesario
   * VERSIÓN CORREGIDA: Verificación única por archivo completo (no por tabla global)
   */
  private async actualizarModelos<T extends NivelEducativo>(
    datos: ListaEstudiantesPorGradoParaHoy<T>
  ): Promise<void> {
    try {
      // Importar dinámicamente los modelos para evitar dependencias circulares
      const [{ BaseEstudiantesIDB }, { BaseAulasIDB }] = await Promise.all([
        import("../Estudiantes/EstudiantesBaseIDB"),
        import("../Aulas/AulasBase"),
      ]);

      const fechaActual = this.obtenerFechaActualDesdeRedux();
      if (!fechaActual) return;

      const fechaObtenciones = fechaActual.toISOString();

      console.log("Iniciando actualización de modelos con datos:", {
        estudiantes: datos.ListaEstudiantes.length,
        aulas: datos.Aulas.length,
        nivel: datos.Nivel,
        grado: datos.Grado,
      });

      // ✅ PASO 1: Verificación única por ARCHIVO (no por tabla global)
      // Generar una clave única para este archivo específico
      const archivoKey = `${datos.Nivel}_${datos.Grado}`;
      const necesitaActualizar =
        await this.verificarSiNecesitaActualizarArchivo(
          archivoKey,
          fechaObtenciones
        );

      console.log(
        `🔍 Verificación para archivo [${archivoKey}]: ${
          necesitaActualizar
            ? "✅ Necesita actualizar"
            : "⏭️ No necesita actualizar"
        }`
      );

      if (!necesitaActualizar) {
        console.log(
          `⏭️ Saltando actualización completa de archivo ${archivoKey} - datos locales más recientes`
        );
        return;
      }

      // ✅ PASO 2: Procesar estudiantes (particionado por aula)
      let totalResultadoEstudiantes = {
        created: 0,
        updated: 0,
        deleted: 0,
        errors: 0,
        wasUpdated: false,
      };

      // Instanciar modelo de estudiantes
      const estudiantesModel = new BaseEstudiantesIDB(
        this.siasisAPI,
        this.setIsSomethingLoading,
        this.setError,
        this.setSuccessMessage
      );

      // Particionar estudiantes por aula
      const estudiantesPorAula = this.particionarEstudiantesPorAula(
        datos.ListaEstudiantes
      );

      console.log(
        `📦 Estudiantes particionados en ${estudiantesPorAula.size} grupos por aula:`,
        Array.from(estudiantesPorAula.keys())
      );

      // Procesar cada partición sin verificar fechas individuales
      for (const [idAula, estudiantesDeAula] of estudiantesPorAula) {
        console.log(
          `🔄 Procesando aula ${idAula}: ${estudiantesDeAula.length} estudiantes`
        );

        const filtroEstudiantesEspecifico = {
          Id_Aula: idAula,
        };

        // ✅ Usar directamente upsertFromServerWithFilter sin verificación de fechas
        const resultadoParcial = await estudiantesModel[
          "upsertFromServerWithFilter"
        ](filtroEstudiantesEspecifico, estudiantesDeAula);

        totalResultadoEstudiantes.created += resultadoParcial.created;
        totalResultadoEstudiantes.updated += resultadoParcial.updated;
        totalResultadoEstudiantes.deleted += resultadoParcial.deleted;
        totalResultadoEstudiantes.errors += resultadoParcial.errors;
        totalResultadoEstudiantes.wasUpdated = true;

        console.log(
          `   ✅ Aula ${idAula}: +${resultadoParcial.created} creados, ~${resultadoParcial.updated} actualizados, -${resultadoParcial.deleted} eliminados`
        );
      }

      // ✅ PASO 3: Procesar aulas (filtro por Nivel y Grado específicos)
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
        `🏢 Actualizando aulas con filtro: Nivel=${datos.Nivel}, Grado=${datos.Grado}`
      );

      // ✅ Usar directamente upsertFromServerWithFilter sin verificación de fechas
      const resultadoAulas = await aulasModel["upsertFromServerWithFilter"](
        filtroAulas,
        datos.Aulas
      );

      const resultadoAulasCompleto = { ...resultadoAulas, wasUpdated: true };

      // ✅ PASO 4: Actualizar fecha del archivo UNA SOLA VEZ al final
      await this.registrarActualizacionDeArchivo(archivoKey);

      // ✅ PASO 5: Log de resultados consolidados
      console.log("📊 Actualización de estudiantes completada (consolidado):", {
        archivo: archivoKey,
        totalTransacciones: estudiantesPorAula.size,
        wasUpdated: totalResultadoEstudiantes.wasUpdated,
        created: totalResultadoEstudiantes.created,
        updated: totalResultadoEstudiantes.updated,
        deleted: totalResultadoEstudiantes.deleted,
        errors: totalResultadoEstudiantes.errors,
      });

      console.log("🏢 Actualización de aulas completada:", {
        archivo: archivoKey,
        wasUpdated: resultadoAulasCompleto.wasUpdated,
        created: resultadoAulasCompleto.created,
        updated: resultadoAulasCompleto.updated,
        deleted: resultadoAulasCompleto.deleted,
        errors: resultadoAulasCompleto.errors,
      });

      console.log(`✅ Verificación final para ${datos.Nivel} ${datos.Grado}°:`);
      console.log(`   - Aulas procesadas: ${datos.Aulas.length}`);
      console.log(`   - Grupos de estudiantes: ${estudiantesPorAula.size}`);
      console.log(`   - Total estudiantes: ${datos.ListaEstudiantes.length}`);
    } catch (error) {
      console.error("❌ Error al actualizar modelos:", error);
      this.handleError(error, "actualizarModelos");
    }
  }

  /**
   * Verifica si necesita actualizar un archivo específico comparando fechas
   * @param archivoKey Clave única del archivo (ej: "S_1", "P_3")
   * @param fechaObtenciones Fecha de obtención de los datos del servidor
   * @returns true si necesita actualizar, false en caso contrario
   */
  private async verificarSiNecesitaActualizarArchivo(
    archivoKey: string,
    fechaObtenciones: string
  ): Promise<boolean> {
    try {
      // Usar una tabla específica para tracking de archivos
      const nombreTablaArchivo = `archivo_${archivoKey}` as TablasLocal;

      // Obtener la última actualización local de este archivo específico
      const ultimaActualizacionLocal =
        await ultimaActualizacionTablasLocalesIDB.getByTabla(
          nombreTablaArchivo
        );

      // Convertir la fecha de obtención del servidor a timestamp
      const fechaObtencionsTimestamp = new Date(fechaObtenciones).getTime();

      // Si no hay actualización local, necesita actualizar
      if (!ultimaActualizacionLocal) {
        console.log(
          `📅 Archivo ${archivoKey}: No hay actualización local registrada`
        );
        return true;
      }

      // Convertir la fecha de actualización local a timestamp
      const fechaActualizacionLocal =
        typeof ultimaActualizacionLocal.Fecha_Actualizacion === "number"
          ? ultimaActualizacionLocal.Fecha_Actualizacion
          : new Date(ultimaActualizacionLocal.Fecha_Actualizacion).getTime();

      // Comparar fechas
      const necesitaActualizar =
        fechaActualizacionLocal < fechaObtencionsTimestamp;

      console.log(
        `📅 Archivo ${archivoKey}: Local(${new Date(
          fechaActualizacionLocal
        ).toLocaleString()}) vs Servidor(${new Date(
          fechaObtencionsTimestamp
        ).toLocaleString()}) → ${
          necesitaActualizar ? "ACTUALIZAR" : "NO ACTUALIZAR"
        }`
      );

      return necesitaActualizar;
    } catch (error) {
      console.error(
        `Error al verificar fechas para archivo ${archivoKey}:`,
        error
      );
      // En caso de error, asumir que necesita actualizar
      return true;
    }
  }

  /**
   * Registra la actualización de un archivo específico
   * @param archivoKey Clave única del archivo
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

      console.log(`📅 Fecha de archivo ${archivoKey} actualizada`);
    } catch (error) {
      console.error(
        `Error al registrar actualización de archivo ${archivoKey}:`,
        error
      );
    }
  }

  /**
   * Particiona una lista de estudiantes agrupándolos por Id_Aula
   * @param estudiantes Lista completa de estudiantes
   * @returns Map con Id_Aula como clave y array de estudiantes como valor
   */
  private particionarEstudiantesPorAula<T extends T_Estudiantes>(
    estudiantes: T[]
  ): Map<string, T[]> {
    const estudiantesPorAula = new Map<string, T[]>();

    for (const estudiante of estudiantes) {
      const idAula = estudiante.Id_Aula;

      // Validar que el estudiante tenga aula asignada
      if (!idAula) {
        console.warn(
          `⚠️ Estudiante sin aula asignada: ${estudiante.Id_Estudiante} - ${estudiante.Nombres} ${estudiante.Apellidos}`
        );
        continue;
      }

      // Agregar estudiante al grupo correspondiente
      if (!estudiantesPorAula.has(idAula)) {
        estudiantesPorAula.set(idAula, []);
      }

      estudiantesPorAula.get(idAula)!.push(estudiante);
    }

    return estudiantesPorAula;
  }

  /**
   * Filtra el reporte según el rol del usuario
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
          // Directivos tienen acceso completo
          return reporte;

        case RolesSistema.ProfesorPrimaria:
          // Profesores de primaria solo ven archivos de primaria
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
          // Personal de secundaria solo ve archivos de secundaria
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
          // Por defecto, devolver estructura vacía
          return {
            EstadoDeListasDeEstudiantes: {} as any,
            Fecha_Actualizacion: reporte.Fecha_Actualizacion,
          };
      }
    } catch (error) {
      console.error("Error al filtrar reporte según rol:", error);
      // En caso de error, devolver el reporte completo
      return reporte;
    }
  }

  /**
   * Limpia todos los archivos de listas de estudiantes del cache
   */
  public async limpiarTodosLosArchivos(): Promise<void> {
    try {
      const store = await IndexedDBConnection.getStore(
        this.storeName,
        "readwrite"
      );

      // Generar todas las keys posibles de archivos de estudiantes
      const keysAEliminar: string[] = [];

      // Agregar reporte
      keysAEliminar.push(ListasEstudiantesPorGradosHoyIDB.REPORTE_KEY);

      // Agregar archivos de primaria
      Object.values(GradosPrimaria).forEach((grado) => {
        if (typeof grado === "number") {
          keysAEliminar.push(
            this.generarKeyArchivo(NivelEducativo.PRIMARIA, grado)
          );
        }
      });

      // Agregar archivos de secundaria
      Object.values(GradosSecundaria).forEach((grado) => {
        if (typeof grado === "number") {
          keysAEliminar.push(
            this.generarKeyArchivo(NivelEducativo.SECUNDARIA, grado)
          );
        }
      });

      // Eliminar cada key
      const promesasEliminacion = keysAEliminar.map((key) => {
        return new Promise<void>((resolve, reject) => {
          const request = store.delete(key);
          request.onsuccess = () => resolve();
          request.onerror = () => reject(request.error);
        });
      });

      await Promise.allSettled(promesasEliminacion);
      console.log(
        "Todos los archivos de listas de estudiantes han sido limpiados del cache"
      );
    } catch (error) {
      console.error("Error al limpiar archivos:", error);
      this.handleError(error, "limpiarTodosLosArchivos");
    }
  }

  /**
   * Actualiza todas las listas de estudiantes disponibles según el reporte de actualización.
   * Sincroniza todas las listas que aparezcan en el reporte filtrado por rol.
   * Hace hasta 3 intentos por archivo si es necesario actualizarlo.
   * @param actualizarIndexedDB Si debe actualizar los modelos de estudiantes y aulas en IndexedDB
   * @returns Resumen de la operación con estadísticas de éxito y fallos
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
        "🚀 Iniciando actualización masiva de todas las listas disponibles..."
      );

      // 1. Obtener el reporte de actualización (ya viene filtrado por rol)
      const reporte = await this.obtenerReporteActualizacion();

      if (!reporte) {
        console.error("❌ No se pudo obtener el reporte de actualización");
        return resultado;
      }

      const archivosEnReporte = Object.keys(
        reporte.EstadoDeListasDeEstudiantes
      );
      console.log(
        `📋 Archivos encontrados en reporte: ${archivosEnReporte.length}`
      );

      if (archivosEnReporte.length === 0) {
        console.log("ℹ️ No hay archivos para procesar en el reporte");
        return resultado;
      }

      // 2. Procesar cada archivo secuencialmente
      for (const nombreArchivo of archivosEnReporte) {
        resultado.totalProcesadas++;

        try {
          // Extraer nivel y grado del nombre del archivo
          const { nivel, grado } =
            this.extraerNivelYGradoDeNombreArchivo(nombreArchivo);

          if (!nivel || grado === null) {
            console.warn(
              `⚠️ No se pudo extraer nivel/grado de: ${nombreArchivo}`
            );
            resultado.fallidas++;
            resultado.detalles.push({
              archivo: nombreArchivo,
              nivel: "desconocido",
              grado: 0,
              exito: false,
              intentos: 0,
              error: "No se pudo extraer nivel/grado del nombre del archivo",
            });
            continue;
          }

          console.log(`\n🔄 Procesando: ${nombreArchivo} (${nivel} ${grado}°)`);

          // 3. Intentar actualizar con hasta 3 reintentos
          let exito = false;
          let ultimoError = "";
          let intentos = 0;
          const MAX_INTENTOS = 3;

          for (intentos = 1; intentos <= MAX_INTENTOS; intentos++) {
            try {
              console.log(
                `📥 Intento ${intentos}/${MAX_INTENTOS} para ${nombreArchivo}...`
              );

              // Obtener la lista (esto internamente verifica si necesita actualización)
              const lista = await this.obtenerListaEstudiantesPorGrado(
                nivel as any,
                grado as any,
                actualizarIndexedDB
              );

              if (lista) {
                exito = true;
                console.log(
                  `✅ ${nombreArchivo} procesado exitosamente en intento ${intentos}`
                );
                resultado.exitosas++;
                resultado.detalles.push({
                  archivo: nombreArchivo,
                  nivel,
                  grado,
                  exito: true,
                  intentos,
                });
                break; // Salir del bucle de reintentos
              } else {
                throw new Error("Lista retornó null");
              }
            } catch (error) {
              ultimoError =
                error instanceof Error ? error.message : String(error);
              console.warn(
                `⚠️ Intento ${intentos} falló para ${nombreArchivo}: ${ultimoError}`
              );

              // Si no es el último intento, esperar un poco antes del siguiente
              if (intentos < MAX_INTENTOS) {
                const tiempoEspera = intentos * 1000; // 1s, 2s, 3s
                console.log(
                  `⏳ Esperando ${tiempoEspera}ms antes del siguiente intento...`
                );
                await new Promise((resolve) =>
                  setTimeout(resolve, tiempoEspera)
                );
              }
            }
          }

          // Si no tuvo éxito después de todos los intentos
          if (!exito) {
            console.error(
              `❌ ${nombreArchivo} falló después de ${MAX_INTENTOS} intentos. Último error: ${ultimoError}`
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

            // TODO: Aquí el usuario puede agregar lógica adicional para manejar archivos que fallaron
            // Por ejemplo: guardar en una cola de reintentos, enviar notificación, etc.
            console.log(
              `💡 TODO: Implementar manejo especial para ${nombreArchivo} que falló después de ${MAX_INTENTOS} intentos`
            );
          }

          // Pequeña pausa entre archivos para no sobrecargar
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (error) {
          console.error(`❌ Error procesando ${nombreArchivo}:`, error);
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

      // 3. Mostrar resumen final
      console.log(
        "\n📊 ==================== RESUMEN FINAL ===================="
      );
      console.log(`📁 Total procesadas: ${resultado.totalProcesadas}`);
      console.log(`✅ Exitosas: ${resultado.exitosas}`);
      console.log(`❌ Fallidas: ${resultado.fallidas}`);
      console.log(
        `⏭️ No necesitaron actualización: ${resultado.noNecesitaronActualizacion}`
      );

      if (resultado.fallidas > 0) {
        console.log("\n💥 Archivos que fallaron:");
        resultado.detalles
          .filter((d) => !d.exito)
          .forEach((detalle) => {
            console.log(
              `   - ${detalle.archivo}: ${detalle.error} (${detalle.intentos} intentos)`
            );
          });
      }

      console.log("🏁 Actualización masiva completada.");

      return resultado;
    } catch (error) {
      console.error("❌ Error en actualización masiva:", error);
      this.handleError(error, "actualizarTodasLasListasDisponibles");
      return resultado;
    }
  }

  /**
   * Extrae el nivel educativo y grado de un nombre de archivo
   * @param nombreArchivo Nombre del archivo (ej: "Estudiantes_P_3.json")
   * @returns Objeto con nivel y grado extraídos
   */
  private extraerNivelYGradoDeNombreArchivo(nombreArchivo: string): {
    nivel: NivelEducativo | null;
    grado: number | null;
  } {
    try {
      // Remover la extensión .json si existe
      const sinExtension = nombreArchivo.replace(".json", "");

      // Patrón: Estudiantes_P_1 o Estudiantes_S_2
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

      // Validar que el grado sea válido para el nivel
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
        `Error al extraer nivel y grado de ${nombreArchivo}:`,
        error
      );
      return { nivel: null, grado: null };
    }
  }
}

// Exportar la clase para que pueda ser instanciada según necesidad
export default ListasEstudiantesPorGradosHoyIDB;
