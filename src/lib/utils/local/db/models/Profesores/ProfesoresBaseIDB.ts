import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { TablasLocal, TablasRemoto } from "@/interfaces/shared/TablasSistema";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import AllErrorTypes, {
  SystemErrorTypes,
  DataConflictErrorTypes,
  UserErrorTypes,
} from "@/interfaces/shared/errors";
import { AsistenciaDateHelper } from "../utils/AsistenciaDateHelper";
import IndexedDBConnection from "../../IndexedDBConnection";
import UltimaModificacionTablasIDB from "../UltimaModificacionTablasIDB";

// Interfaz base para profesores (campos mínimos accesibles por todos los roles)
export interface IProfesorBaseLocal {
  // Campos específicos por nivel
  Id_Profesor_Primaria?: string; // Solo para primaria
  Id_Profesor_Secundaria?: string; // Solo para secundaria

  // Campos comunes
  Nombres: string;
  Apellidos: string;
  Genero: string;
  Google_Drive_Foto_ID?: string | null;
  Celular: string;

  // Campo de sincronización
  ultima_fecha_actualizacion: number;
}

// Filtros para consultas
export interface IProfesorFilter {
  idProfesor?: string;
  nivel?: NivelEducativo;
  nombres?: string;
  apellidos?: string;
}

// Resultado de operaciones
export interface ProfesorOperationResult {
  success: boolean;
  message: string;
  data?: any;
  count?: number;
}

// Mapeo de nivel a tabla local
const MAPEO_TABLA_PROFESORES: Record<NivelEducativo, TablasLocal> = {
  [NivelEducativo.PRIMARIA]: TablasLocal.Tabla_Profesores_Primaria,
  [NivelEducativo.SECUNDARIA]: TablasLocal.Tabla_Profesores_Secundaria,
};

// Mapeo de nivel a tabla remota (para sincronización)
const MAPEO_TABLA_REMOTA_PROFESORES: Record<NivelEducativo, TablasRemoto> = {
  [NivelEducativo.PRIMARIA]: TablasRemoto.Tabla_Profesores_Primaria,
  [NivelEducativo.SECUNDARIA]: TablasRemoto.Tabla_Profesores_Secundaria,
};

/**
 * Clase base para el manejo de profesores en IndexedDB
 * Maneja tanto profesores de primaria como de secundaria
 */
export class ProfesoresBaseIDB {
  protected dateHelper: AsistenciaDateHelper;

  constructor(
    protected siasisAPI: SiasisAPIS = "API01",
    protected setIsSomethingLoading?: (isLoading: boolean) => void,
    protected setError?: (error: ErrorResponseAPIBase | null) => void,
    protected setSuccessMessage?: (message: MessageProperty | null) => void
  ) {
    this.dateHelper = new AsistenciaDateHelper();
  }

  // =====================================================================================
  // MÉTODOS DE MAPEO Y UTILIDADES
  // =====================================================================================

  /**
   * Obtiene el nombre de la tabla correspondiente según el nivel
   */
  protected obtenerNombreTabla(nivel: NivelEducativo): TablasLocal {
    const tabla = MAPEO_TABLA_PROFESORES[nivel];
    if (!tabla) {
      throw new Error(`No se encontró tabla para nivel ${nivel}`);
    }
    return tabla;
  }

  /**
   * Obtiene el nombre de la tabla remota para sincronización
   */
  protected obtenerTablaRemota(nivel: NivelEducativo): TablasRemoto {
    const tabla = MAPEO_TABLA_REMOTA_PROFESORES[nivel];
    if (!tabla) {
      throw new Error(`No se encontró tabla remota para nivel ${nivel}`);
    }
    return tabla;
  }

  /**
   * Genera la clave según el nivel del profesor
   */
  protected generarClaveProfesor(
    idProfesor: string,
    nivel: NivelEducativo
  ): string {
    // La clave es simplemente el ID del profesor, pero se almacena en la tabla correspondiente al nivel
    return idProfesor;
  }

  /**
   * Obtiene el campo ID correspondiente según el nivel
   */
  protected obtenerCampoId(nivel: NivelEducativo): string {
    return nivel === NivelEducativo.PRIMARIA
      ? "Id_Profesor_Primaria"
      : "Id_Profesor_Secundaria";
  }

  // =====================================================================================
  // MÉTODOS DE SINCRONIZACIÓN
  // =====================================================================================

  /**
   * Verifica si necesita sincronización comparando con la última modificación remota
   */
  protected async necesitaSincronizacion(
    nivel: NivelEducativo
  ): Promise<boolean> {
    try {
      const tablaRemota = this.obtenerTablaRemota(nivel);
      const ultimaModificacionIDB = new UltimaModificacionTablasIDB(
        this.siasisAPI
      );
      const ultimaModificacion = await ultimaModificacionIDB.getByTabla(
        tablaRemota
      );

      if (!ultimaModificacion) {
        return false; // Si no hay registro de modificación, no sincronizar
      }

      // Verificar si hay registros locales
      const registrosLocales = await this.obtenerTodosLosProfesores(nivel);
      if (registrosLocales.length === 0) {
        return true; // No hay datos locales, necesita sincronización inicial
      }

      // Buscar el registro con la última actualización local
      const ultimaActualizacionLocal = Math.max(
        ...registrosLocales.map((r) => r.ultima_fecha_actualizacion)
      );

      const fechaModificacionRemota = new Date(
        ultimaModificacion.Fecha_Modificacion
      ).getTime();

      return ultimaActualizacionLocal < fechaModificacionRemota;
    } catch (error) {
      console.error("Error al verificar sincronización:", error);
      return true; // En caso de error, mejor sincronizar
    }
  }

  // =====================================================================================
  // MÉTODOS CRUD BÁSICOS
  // =====================================================================================

  /**
   * Obtiene un profesor específico por ID y nivel
   */
  public async obtenerProfesorPorId(
    idProfesor: string,
    nivel: NivelEducativo
  ): Promise<IProfesorBaseLocal | null> {
    try {
      const nombreTabla = this.obtenerNombreTabla(nivel);
      const store = await IndexedDBConnection.getStore(nombreTabla);
      const clave = this.generarClaveProfesor(idProfesor, nivel);

      return new Promise<IProfesorBaseLocal | null>((resolve, reject) => {
        const request = store.get(clave);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, `obtener profesor ${idProfesor}`);
      return null;
    }
  }

  /**
   * Obtiene todos los profesores de un nivel específico
   */
  public async obtenerTodosLosProfesores(
    nivel: NivelEducativo
  ): Promise<IProfesorBaseLocal[]> {
    try {
      const nombreTabla = this.obtenerNombreTabla(nivel);
      const store = await IndexedDBConnection.getStore(nombreTabla);

      return new Promise<IProfesorBaseLocal[]>((resolve, reject) => {
        const request = store.getAll();

        request.onsuccess = () => {
          resolve(request.result as IProfesorBaseLocal[]);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `obtener todos los profesores de ${nivel}`
      );
      return [];
    }
  }

  /**
   * Guarda o actualiza un profesor - VERSIÓN CORREGIDA
   */
  public async guardarProfesor(
    profesor: Omit<IProfesorBaseLocal, "ultima_fecha_actualizacion">,
    nivel: NivelEducativo
  ): Promise<ProfesorOperationResult> {
    try {
      const nombreTabla = this.obtenerNombreTabla(nivel);
      const store = await IndexedDBConnection.getStore(
        nombreTabla,
        "readwrite"
      );

      // Agregar timestamp actual
      const profesorCompleto: IProfesorBaseLocal = {
        ...profesor,
        ultima_fecha_actualizacion: this.dateHelper.obtenerTimestampPeruano(),
      };

      return new Promise<ProfesorOperationResult>((resolve, reject) => {
        const request = store.put(profesorCompleto);

        request.onsuccess = () => {
          resolve({
            success: true,
            message: "Profesor guardado exitosamente",
            data: profesorCompleto, // DEVOLVER EL OBJETO COMPLETO, NO SOLO EL ID
          });
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, "guardar profesor");
      return {
        success: false,
        message: `Error al guardar profesor: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      };
    }
  }

  /**
   * Elimina un profesor
   */
  public async eliminarProfesor(
    idProfesor: string,
    nivel: NivelEducativo
  ): Promise<ProfesorOperationResult> {
    try {
      const nombreTabla = this.obtenerNombreTabla(nivel);
      const store = await IndexedDBConnection.getStore(
        nombreTabla,
        "readwrite"
      );
      const clave = this.generarClaveProfesor(idProfesor, nivel);

      return new Promise<ProfesorOperationResult>((resolve, reject) => {
        const request = store.delete(clave);

        request.onsuccess = () => {
          resolve({
            success: true,
            message: "Profesor eliminado exitosamente",
          });
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, `eliminar profesor ${idProfesor}`);
      return {
        success: false,
        message: `Error al eliminar profesor: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      };
    }
  }

  /**
   * Busca profesores con filtros
   */
  public async buscarProfesoresConFiltros(
    filtros: IProfesorFilter
  ): Promise<IProfesorBaseLocal[]> {
    try {
      const resultados: IProfesorBaseLocal[] = [];

      // Determinar qué niveles consultar
      const nivelesAConsultar = filtros.nivel
        ? [filtros.nivel]
        : [NivelEducativo.PRIMARIA, NivelEducativo.SECUNDARIA];

      // Ejecutar búsquedas en paralelo
      const promesasBusqueda = nivelesAConsultar.map(async (nivel) => {
        return this.buscarEnNivelEspecifico(nivel, filtros);
      });

      const resultadosPorNivel = await Promise.all(promesasBusqueda);

      // Combinar resultados
      resultadosPorNivel.forEach((profesores) => {
        resultados.push(...profesores);
      });

      return resultados;
    } catch (error) {
      this.handleIndexedDBError(error, "buscar profesores con filtros");
      return [];
    }
  }

  /**
   * Busca profesores en un nivel específico aplicando filtros
   */
  private async buscarEnNivelEspecifico(
    nivel: NivelEducativo,
    filtros: IProfesorFilter
  ): Promise<IProfesorBaseLocal[]> {
    const nombreTabla = this.obtenerNombreTabla(nivel);
    const store = await IndexedDBConnection.getStore(nombreTabla);

    return new Promise<IProfesorBaseLocal[]>((resolve, reject) => {
      const profesores: IProfesorBaseLocal[] = [];
      let request: IDBRequest;

      // Si hay ID específico, usar get directo
      if (filtros.idProfesor) {
        const clave = this.generarClaveProfesor(filtros.idProfesor, nivel);
        request = store.openCursor(IDBKeyRange.only(clave));
      } else {
        // Scan completo para otros filtros
        request = store.openCursor();
      }

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest)
          .result as IDBCursorWithValue;

        if (cursor) {
          const profesor = cursor.value as IProfesorBaseLocal;

          // Aplicar filtros adicionales
          if (this.aplicarFiltrosProfesor(profesor, filtros)) {
            profesores.push(profesor);
          }

          cursor.continue();
        } else {
          resolve(profesores);
        }
      };

      request.onerror = () => {
        reject(request.error);
      };
    });
  }

  /**
   * Aplica filtros adicionales a un profesor
   */
  private aplicarFiltrosProfesor(
    profesor: IProfesorBaseLocal,
    filtros: IProfesorFilter
  ): boolean {
    // Filtro por nombres (búsqueda parcial, case insensitive)
    if (filtros.nombres) {
      const nombresBusqueda = filtros.nombres.toLowerCase();
      const nombresProfesor = profesor.Nombres.toLowerCase();
      if (!nombresProfesor.includes(nombresBusqueda)) {
        return false;
      }
    }

    // Filtro por apellidos (búsqueda parcial, case insensitive)
    if (filtros.apellidos) {
      const apellidosBusqueda = filtros.apellidos.toLowerCase();
      const apellidosProfesor = profesor.Apellidos.toLowerCase();
      if (!apellidosProfesor.includes(apellidosBusqueda)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Actualiza múltiples profesores desde datos del servidor
   */
  protected async actualizarProfesoresDesdeServidor(
    nivel: NivelEducativo,
    profesoresServidor: Omit<IProfesorBaseLocal, "ultima_fecha_actualizacion">[]
  ): Promise<{ actualizados: number; creados: number; errores: number }> {
    const resultado = { actualizados: 0, creados: 0, errores: 0 };

    try {
      const BATCH_SIZE = 50;

      for (let i = 0; i < profesoresServidor.length; i += BATCH_SIZE) {
        const lote = profesoresServidor.slice(i, i + BATCH_SIZE);

        for (const profesorServidor of lote) {
          try {
            const idProfesor =
              nivel === NivelEducativo.PRIMARIA
                ? profesorServidor.Id_Profesor_Primaria!
                : profesorServidor.Id_Profesor_Secundaria!;

            const profesorExistente = await this.obtenerProfesorPorId(
              idProfesor,
              nivel
            );

            const resultadoOperacion = await this.guardarProfesor(
              profesorServidor,
              nivel
            );

            if (resultadoOperacion.success) {
              if (profesorExistente) {
                resultado.actualizados++;
              } else {
                resultado.creados++;
              }
            } else {
              resultado.errores++;
            }
          } catch (error) {
            console.error(`Error procesando profesor:`, error);
            resultado.errores++;
          }
        }

        // Pausa entre lotes
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    } catch (error) {
      console.error("Error en actualización masiva:", error);
      resultado.errores++;
    }

    return resultado;
  }

  // =====================================================================================
  // MÉTODOS DE UTILIDAD Y MANEJO DE ERRORES
  // =====================================================================================

  /**
   * Establece un mensaje de éxito
   */
  protected handleSuccess(message: string, data?: any): void {
    const successResponse: MessageProperty = { message };
    this.setSuccessMessage?.(successResponse);
  }

  /**
   * Maneja los errores de operaciones con IndexedDB
   */
  protected handleIndexedDBError(error: unknown, operacion: string): void {
    console.error(`Error en operación IndexedDB (${operacion}):`, error);

    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = `Error al ${operacion}`;

    if (error instanceof Error) {
      if (error.name === "ConstraintError") {
        errorType = DataConflictErrorTypes.VALUE_ALREADY_IN_USE;
        message = `Error de restricción al ${operacion}: valor duplicado`;
      } else if (error.name === "NotFoundError") {
        errorType = UserErrorTypes.USER_NOT_FOUND;
        message = `No se encontró el recurso al ${operacion}`;
      } else if (error.name === "QuotaExceededError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Almacenamiento excedido al ${operacion}`;
      } else if (error.name === "TransactionInactiveError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Transacción inactiva al ${operacion}`;
      } else {
        message = error.message || message;
      }
    }

    this.setError?.({
      success: false,
      message: message,
      errorType: errorType,
      details: {
        origen: "ProfesoresBaseIDB",
        timestamp: Date.now(),
      },
    });
  }

  /**
   * Obtiene estadísticas básicas por nivel
   */
  public async obtenerEstadisticasNivel(nivel: NivelEducativo): Promise<{
    totalProfesores: number;
    ultimaActualizacion: number | null;
  }> {
    try {
      const nombreTabla = this.obtenerNombreTabla(nivel);
      const store = await IndexedDBConnection.getStore(nombreTabla);

      return new Promise((resolve, reject) => {
        const stats = {
          totalProfesores: 0,
          ultimaActualizacion: null as number | null,
        };

        let ultimaFecha = 0;
        const request = store.openCursor();

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const profesor = cursor.value as IProfesorBaseLocal;
            stats.totalProfesores++;

            if (profesor.ultima_fecha_actualizacion > ultimaFecha) {
              ultimaFecha = profesor.ultima_fecha_actualizacion;
            }

            cursor.continue();
          } else {
            stats.ultimaActualizacion = ultimaFecha > 0 ? ultimaFecha : null;
            resolve(stats);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      this.handleIndexedDBError(error, `obtener estadísticas de ${nivel}`);
      return {
        totalProfesores: 0,
        ultimaActualizacion: null,
      };
    }
  }
}
