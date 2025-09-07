import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";
import AllErrorTypes, {
  DataConflictErrorTypes,
  SystemErrorTypes,
  UserErrorTypes,
} from "@/interfaces/shared/errors";
import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { T_Aulas, T_Estudiantes } from "@prisma/client";
import IndexedDBConnection from "../../IndexedDBConnection";
import { TablasLocal } from "@/interfaces/shared/TablasSistema";

// Interfaces para asistencias escolares
export interface IAsistenciaEscolar {
  uuid: string; // UUID local para IndexedDB
  Id_Estudiante: string;
  Mes: number;
  Asistencias_Mensuales: string; // JSON string
  ultima_fecha_actualizacion?: number; // Timestamp para sincronización
}

export interface IFiltroAsistencias {
  Id_Estudiante?: string;
  Mes?: number;
  mesInicio?: number;
  mesFin?: number;
  idsEstudiantes?: string[];
}

export type EstudianteBasico = Omit<T_Estudiantes, "Id_Aula">;

export interface EstudianteConAula extends EstudianteBasico {
  aula: T_Aulas | null | undefined;
}

/**
 * Clase base para el manejo de asistencias escolares en IndexedDB
 * Maneja las 11 tablas de asistencia según nivel y grado del estudiante
 */
export abstract class AsistenciasEscolaresBaseIDB {
  constructor(
    protected siasisAPI: SiasisAPIS,
    protected setIsSomethingLoading?: (isLoading: boolean) => void,
    protected setError?: (error: ErrorResponseAPIBase | null) => void,
    protected setSuccessMessage?: (message: MessageProperty | null) => void
  ) {}

  /**
   * Obtiene el nombre de la tabla local según el nivel y grado del estudiante
   */
  protected obtenerNombreTablaLocal(
    nivel: NivelEducativo,
    grado: number
  ): TablasLocal {
    if (nivel === NivelEducativo.PRIMARIA) {
      return `asistencias_e_p_${grado}` as TablasLocal;
    } else if (nivel === NivelEducativo.SECUNDARIA) {
      return `asistencias_e_s_${grado}` as TablasLocal;
    } else {
      throw new Error(`Nivel educativo no válido: ${nivel}`);
    }
  }

  /**
   * Valida que el estudiante tenga aula asignada y extrae nivel/grado
   */
  protected validarYExtraerDatosAula(estudiante: EstudianteConAula): {
    nivel: NivelEducativo;
    grado: number;
  } {
    if (!estudiante.aula) {
      throw new Error("El estudiante no tiene aula asignada");
    }

    if (!estudiante.aula.Nivel || !estudiante.aula.Grado) {
      throw new Error("El aula del estudiante no tiene nivel o grado definido");
    }

    return {
      nivel: estudiante.aula.Nivel as NivelEducativo,
      grado: estudiante.aula.Grado,
    };
  }

  /**
   * 1. Obtener asistencias de un estudiante específico para un mes
   */
  public async getById(
    estudiante: EstudianteConAula,
    mes: number
  ): Promise<IAsistenciaEscolar | null> {
    try {
      const { nivel, grado } = this.validarYExtraerDatosAula(estudiante);
      const nombreTabla = this.obtenerNombreTablaLocal(nivel, grado);

      const store = await IndexedDBConnection.getStore(nombreTabla);
      const index = store.index("por_estudiante_mes");
      const key = [estudiante.Id_Estudiante, mes];

      return new Promise<IAsistenciaEscolar | null>((resolve, reject) => {
        const request = index.get(key);

        request.onsuccess = () => {
          resolve(request.result || null);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `Error al obtener asistencia del estudiante ${estudiante.Id_Estudiante} del mes ${mes}:`,
        error
      );
      this.handleIndexedDBError(
        error,
        `obtener asistencia del estudiante ${estudiante.Id_Estudiante} del mes ${mes}`
      );
      return null;
    }
  }

  /**
   * 2. Obtener todas las asistencias de un mes con filtros opcionales
   * Requiere especificar nivel y grado para determinar la tabla
   */
  public async getByMes(
    nivel: NivelEducativo,
    grado: number,
    mes: number,
    filtros?: IFiltroAsistencias
  ): Promise<IAsistenciaEscolar[]> {
    try {
      const nombreTabla = this.obtenerNombreTablaLocal(nivel, grado);
      const store = await IndexedDBConnection.getStore(nombreTabla);
      const index = store.index("por_mes");

      return new Promise<IAsistenciaEscolar[]>((resolve, reject) => {
        const request = index.getAll(mes);

        request.onsuccess = () => {
          let resultados = request.result as IAsistenciaEscolar[];

          // Aplicar filtros adicionales si existen
          if (filtros) {
            if (filtros.Id_Estudiante) {
              resultados = resultados.filter(
                (asistencia) =>
                  asistencia.Id_Estudiante === filtros.Id_Estudiante
              );
            }

            if (filtros.idsEstudiantes && filtros.idsEstudiantes.length > 0) {
              resultados = resultados.filter((asistencia) =>
                filtros.idsEstudiantes!.includes(asistencia.Id_Estudiante)
              );
            }
          }

          resolve(resultados);
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(`Error al obtener asistencias del mes ${mes}:`, error);
      this.handleIndexedDBError(error, `obtener asistencias del mes ${mes}`);
      return [];
    }
  }

  /**
   * 3. Crear nueva entrada de asistencia
   */
  public async add(
    estudiante: EstudianteConAula,
    asistencia: Omit<IAsistenciaEscolar, "uuid">
  ): Promise<boolean> {
    try {
      const { nivel, grado } = this.validarYExtraerDatosAula(estudiante);
      const nombreTabla = this.obtenerNombreTablaLocal(nivel, grado);

      // Generar UUID y agregar timestamp de actualización
      const asistenciaConUUID: IAsistenciaEscolar = {
        uuid: crypto.randomUUID(),
        ...asistencia,
        ultima_fecha_actualizacion: Date.now(),
      };

      const store = await IndexedDBConnection.getStore(
        nombreTabla,
        "readwrite"
      );

      return new Promise<boolean>((resolve, reject) => {
        const request = store.add(asistenciaConUUID);

        request.onsuccess = () => {
          this.handleSuccess(
            `Asistencia creada exitosamente para el estudiante ${asistencia.Id_Estudiante}`
          );
          resolve(true);
        };

        request.onerror = () => {
          console.error("Error al crear asistencia:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error al crear asistencia:", error);
      this.handleIndexedDBError(error, "crear asistencia");
      return false;
    }
  }

  /**
   * 4. Actualizar asistencia existente
   */
  public async update(
    estudiante: EstudianteConAula,
    asistencia: IAsistenciaEscolar
  ): Promise<boolean> {
    try {
      const { nivel, grado } = this.validarYExtraerDatosAula(estudiante);
      const nombreTabla = this.obtenerNombreTablaLocal(nivel, grado);

      // Actualizar timestamp de actualización
      const asistenciaActualizada: IAsistenciaEscolar = {
        ...asistencia,
        ultima_fecha_actualizacion: Date.now(),
      };

      const store = await IndexedDBConnection.getStore(
        nombreTabla,
        "readwrite"
      );

      return new Promise<boolean>((resolve, reject) => {
        const request = store.put(asistenciaActualizada);

        request.onsuccess = () => {
          this.handleSuccess(
            `Asistencia actualizada exitosamente para el estudiante ${asistencia.Id_Estudiante}`
          );
          resolve(true);
        };

        request.onerror = () => {
          console.error("Error al actualizar asistencia:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error al actualizar asistencia:", error);
      this.handleIndexedDBError(error, "actualizar asistencia");
      return false;
    }
  }

  /**
   * 5. Eliminar asistencia específica
   */
  public async delete(
    estudiante: EstudianteConAula,
    mes: number
  ): Promise<boolean> {
    try {
      // Primero obtener el registro para tener el UUID
      const asistencia = await this.getById(estudiante, mes);

      if (!asistencia) {
        this.setError?.({
          success: false,
          message: `No se encontró asistencia del estudiante ${estudiante.Id_Estudiante} para el mes ${mes}`,
          errorType: UserErrorTypes.USER_NOT_FOUND,
        });
        return false;
      }

      const { nivel, grado } = this.validarYExtraerDatosAula(estudiante);
      const nombreTabla = this.obtenerNombreTablaLocal(nivel, grado);
      const store = await IndexedDBConnection.getStore(
        nombreTabla,
        "readwrite"
      );

      return new Promise<boolean>((resolve, reject) => {
        const request = store.delete(asistencia.uuid);

        request.onsuccess = () => {
          this.handleSuccess(
            `Asistencia eliminada exitosamente para el estudiante ${estudiante.Id_Estudiante} del mes ${mes}`
          );
          resolve(true);
        };

        request.onerror = () => {
          console.error("Error al eliminar asistencia:", request.error);
          reject(request.error);
        };
      });
    } catch (error) {
      console.error(
        `Error al eliminar asistencia del estudiante ${estudiante.Id_Estudiante} del mes ${mes}:`,
        error
      );
      this.handleIndexedDBError(
        error,
        `eliminar asistencia del estudiante ${estudiante.Id_Estudiante} del mes ${mes}`
      );
      return false;
    }
  }

  /**
   * 6. Verificar si existe registro de asistencia
   */
  public async exists(
    estudiante: EstudianteConAula,
    mes: number
  ): Promise<boolean> {
    try {
      const asistencia = await this.getById(estudiante, mes);
      return asistencia !== null;
    } catch (error) {
      console.error(
        `Error al verificar existencia de asistencia del estudiante ${estudiante.Id_Estudiante} del mes ${mes}:`,
        error
      );
      return false;
    }
  }

  /**
   * 7. Contar registros con filtros opcionales para una tabla específica
   */
  public async count(
    nivel: NivelEducativo,
    grado: number,
    filtros?: IFiltroAsistencias
  ): Promise<number> {
    try {
      const nombreTabla = this.obtenerNombreTablaLocal(nivel, grado);
      const store = await IndexedDBConnection.getStore(nombreTabla);

      return new Promise<number>((resolve, reject) => {
        const request = store.openCursor();
        let contador = 0;

        request.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest)
            .result as IDBCursorWithValue;

          if (cursor) {
            const asistencia = cursor.value as IAsistenciaEscolar;
            let incluir = true;

            // Aplicar filtros si existen
            if (filtros) {
              if (
                filtros.Id_Estudiante &&
                asistencia.Id_Estudiante !== filtros.Id_Estudiante
              ) {
                incluir = false;
              }

              if (filtros.Mes && asistencia.Mes !== filtros.Mes) {
                incluir = false;
              }

              if (filtros.mesInicio && asistencia.Mes < filtros.mesInicio) {
                incluir = false;
              }

              if (filtros.mesFin && asistencia.Mes > filtros.mesFin) {
                incluir = false;
              }

              if (
                filtros.idsEstudiantes &&
                filtros.idsEstudiantes.length > 0 &&
                !filtros.idsEstudiantes.includes(asistencia.Id_Estudiante)
              ) {
                incluir = false;
              }
            }

            if (incluir) {
              contador++;
            }

            cursor.continue();
          } else {
            resolve(contador);
          }
        };

        request.onerror = () => {
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error al contar asistencias:", error);
      this.handleIndexedDBError(error, "contar asistencias");
      return 0;
    }
  }

  /**
   * 8. Limpiar tabla específica por nivel y grado
   */
  public async clear(nivel: NivelEducativo, grado: number): Promise<boolean> {
    try {
      const nombreTabla = this.obtenerNombreTablaLocal(nivel, grado);
      const store = await IndexedDBConnection.getStore(
        nombreTabla,
        "readwrite"
      );

      return new Promise<boolean>((resolve, reject) => {
        const request = store.clear();

        request.onsuccess = () => {
          this.handleSuccess(
            `Tabla de asistencias ${nombreTabla} limpiada exitosamente`
          );
          resolve(true);
        };

        request.onerror = () => {
          console.error(
            "Error al limpiar tabla de asistencias:",
            request.error
          );
          reject(request.error);
        };
      });
    } catch (error) {
      console.error("Error al limpiar tabla de asistencias:", error);
      this.handleIndexedDBError(error, "limpiar tabla de asistencias");
      return false;
    }
  }

  /**
   * Método adicional: Limpiar todas las tablas de asistencias
   */
  public async clearAll(): Promise<boolean> {
    try {
      const tablasLimpiadas = [];

      // Limpiar tablas de primaria (1-6)
      for (let grado = 1; grado <= 6; grado++) {
        try {
          await this.clear(NivelEducativo.PRIMARIA, grado);
          tablasLimpiadas.push(`${NivelEducativo.PRIMARIA}-${grado}`);
        } catch (error) {
          console.error(
            `Error limpiando tabla primaria grado ${grado}:`,
            error
          );
        }
      }

      // Limpiar tablas de secundaria (1-5)
      for (let grado = 1; grado <= 5; grado++) {
        try {
          await this.clear(NivelEducativo.SECUNDARIA, grado);
          tablasLimpiadas.push(`${NivelEducativo.SECUNDARIA}-${grado}`);
        } catch (error) {
          console.error(
            `Error limpiando tabla secundaria grado ${grado}:`,
            error
          );
        }
      }

      this.handleSuccess(
        `${tablasLimpiadas.length} tablas de asistencias limpiadas exitosamente`
      );
      return true;
    } catch (error) {
      console.error("Error al limpiar todas las tablas de asistencias:", error);
      this.handleIndexedDBError(
        error,
        "limpiar todas las tablas de asistencias"
      );
      return false;
    }
  }

  /**
   * Establece un mensaje de éxito
   */
  protected handleSuccess(message: string): void {
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
    });
  }
}
