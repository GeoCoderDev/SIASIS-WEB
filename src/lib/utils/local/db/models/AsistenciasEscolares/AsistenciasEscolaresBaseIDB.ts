import { TablasLocal } from "@/interfaces/shared/TablasSistema";
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
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import { AsistenciaEscolarDeUnDia } from "@/interfaces/shared/AsistenciasEscolares";
import IndexedDBConnection from "../../IndexedDBConnection";
import {
  GradosPrimaria,
  GradosSecundaria,
} from "@/constants/GRADOS_POR_NIVEL_EDUCATIVO";

// =====================================================================================
// TIPOS Y CONSTANTES COMPARTIDAS
// =====================================================================================

export type AsistenciasPorDia = {
  [dia: number]: AsistenciaEscolarDeUnDia | null;
};

export interface IAsistenciaEscolarLocal {
  Id_Estudiante: string;
  Mes: number;
  Asistencias_Mensuales: string; // JSON string
  ultima_fecha_actualizacion: number; // Timestamp numérico
}

export interface AsistenciaOperationResult {
  success: boolean;
  message: string;
  data?: any;
  requiereEspera?: boolean;
  minutosEspera?: number;
  origen?: "cache" | "api" | "mixto";
  ultimaActualizacion?: number;
}

// Mapeo de nivel y grado a tabla
const MAPEO_TABLA_ASISTENCIAS: Record<string, TablasLocal> = {
  "P-1": TablasLocal.Tabla_Asistencia_Primaria_1,
  "P-2": TablasLocal.Tabla_Asistencia_Primaria_2,
  "P-3": TablasLocal.Tabla_Asistencia_Primaria_3,
  "P-4": TablasLocal.Tabla_Asistencia_Primaria_4,
  "P-5": TablasLocal.Tabla_Asistencia_Primaria_5,
  "P-6": TablasLocal.Tabla_Asistencia_Primaria_6,
  "S-1": TablasLocal.Tabla_Asistencia_Secundaria_1,
  "S-2": TablasLocal.Tabla_Asistencia_Secundaria_2,
  "S-3": TablasLocal.Tabla_Asistencia_Secundaria_3,
  "S-4": TablasLocal.Tabla_Asistencia_Secundaria_4,
  "S-5": TablasLocal.Tabla_Asistencia_Secundaria_5,
};

// =====================================================================================
// CLASE ABSTRACTA BASE
// =====================================================================================

/**
 * Clase abstracta base para el manejo de asistencias escolares
 * Proporciona funcionalidad común para todos los roles del sistema
 *
 * Roles que pueden heredar:
 * - Directivos (acceso completo a todas las aulas)
 * - Profesores de Primaria (solo su aula asignada)
 * - Tutores de Secundaria (solo su aula asignada)
 * - Auxiliares (todas las aulas de secundaria)
 * - Responsables (solo estudiantes vinculados)
 * - Cualquier rol futuro
 */
export abstract class AsistenciasEscolaresBaseIDB {
  protected dateHelper: AsistenciaDateHelper;

  constructor(
    protected setIsSomethingLoading?: (isLoading: boolean) => void,
    protected setError?: (error: ErrorResponseAPIBase | null) => void,
    protected setSuccessMessage?: (message: MessageProperty | null) => void
  ) {
    this.dateHelper = new AsistenciaDateHelper();
  }

  // =====================================================================================
  // MÉTODOS ABSTRACTOS (deben ser implementados por cada rol)
  // =====================================================================================

  /**
   * Método principal de consulta - cada rol implementa su lógica específica
   */
  protected abstract consultarAsistenciasImplementacion(
    ...args: any[]
  ): Promise<AsistenciaOperationResult>;

  /**
   * Verifica control de frecuencia según las reglas del rol
   */
  protected abstract verificarControlFrecuenciaRol(
    registro: IAsistenciaEscolarLocal,
    ...args: any[]
  ): { puedeConsultar: boolean; minutosEspera: number };

  /**
   * Determina la estrategia de consulta según el rol y contexto
   */
  protected abstract determinarEstrategiaConsulta(
    mes: number,
    ...args: any[]
  ): Promise<{
    estrategia:
      | "solo_cache"
      | "solo_api_mensual"
      | "solo_api_diaria"
      | "api_paralelo";
    razon: string;
  }>;

  // =====================================================================================
  // MÉTODOS DE MAPEO Y VALIDACIÓN (compartidos)
  // =====================================================================================

  protected obtenerNombreTabla(
    nivel: NivelEducativo,
    grado: number
  ): TablasLocal {
    const clave = `${nivel}-${grado}`;
    const tabla = MAPEO_TABLA_ASISTENCIAS[clave];

    if (!tabla) {
      throw new Error(
        `No se encontró tabla para nivel ${nivel} y grado ${grado}`
      );
    }

    return tabla;
  }

  protected validarNivelYGrado(nivel: NivelEducativo, grado: number): boolean {
    if (nivel === NivelEducativo.PRIMARIA) {
      return Object.values(GradosPrimaria).includes(grado);
    } else if (nivel === NivelEducativo.SECUNDARIA) {
      return Object.values(GradosSecundaria).includes(grado);
    }
    return false;
  }

  protected validarMesConsulta(mes: number): {
    esValido: boolean;
    mensaje: string;
  } {
    if (mes < 1 || mes > 12) {
      return { esValido: false, mensaje: "Debe seleccionar un mes válido." };
    }

    const mesActual = this.dateHelper.obtenerMesActual()!;
    if (mes > mesActual) {
      return {
        esValido: false,
        mensaje: "No se pueden consultar asistencias de meses futuros.",
      };
    }

    return { esValido: true, mensaje: "" };
  }

  /**
   * Obtiene información básica de un estudiante (su aula)
   */
  protected async obtenerInfoEstudiante(
    idEstudiante: string
  ): Promise<{ nivel: NivelEducativo; grado: number; idAula: string } | null> {
    try {
      const { BaseEstudiantesIDB } = await import(
        "@/lib/utils/local/db/models/Estudiantes/EstudiantesBaseIDB"
      );
      const estudiantesIDB = new BaseEstudiantesIDB();
      const todosEstudiantes = await estudiantesIDB.getTodosLosEstudiantes(
        false
      );
      const estudiante = todosEstudiantes.find(
        (e) => e.Id_Estudiante === idEstudiante
      );

      if (!estudiante || !estudiante.Id_Aula) return null;

      // Obtener información del aula
      const { BaseAulasIDB } = await import(
        "@/lib/utils/local/db/models/Aulas/AulasBase"
      );
      const aulasIDB = new BaseAulasIDB();
      const todasLasAulas = await aulasIDB.getTodasLasAulas();
      const aula = todasLasAulas.find((a) => a.Id_Aula === estudiante.Id_Aula);

      if (!aula) return null;

      return {
        nivel: aula.Nivel as NivelEducativo,
        grado: aula.Grado,
        idAula: aula.Id_Aula,
      };
    } catch (error) {
      console.error("Error obteniendo información de estudiante:", error);
      return null;
    }
  }

  // =====================================================================================
  // OPERACIONES CON INDEXEDDB (compartidas)
  // =====================================================================================

  protected async obtenerRegistroPorClave(
    nivel: NivelEducativo,
    grado: number,
    idEstudiante: string,
    mes: number
  ): Promise<IAsistenciaEscolarLocal | null> {
    try {
      if (!this.validarNivelYGrado(nivel, grado)) {
        throw new Error(`Grado ${grado} no válido para nivel ${nivel}`);
      }

      const nombreTabla = this.obtenerNombreTabla(nivel, grado);
      const store = await IndexedDBConnection.getStore(nombreTabla);
      const claveCompuesta = [idEstudiante, mes];

      return new Promise<IAsistenciaEscolarLocal | null>((resolve, reject) => {
        const request = store.get(claveCompuesta);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      this.handleIndexedDBError(
        error,
        `obtener registro ${idEstudiante}-${mes}`
      );
      return null;
    }
  }

  protected async obtenerRegistrosEstudiantesDelMes(
    nivel: NivelEducativo,
    grado: number,
    mes: number
  ): Promise<IAsistenciaEscolarLocal[]> {
    try {
      if (!this.validarNivelYGrado(nivel, grado)) {
        throw new Error(`Grado ${grado} no válido para nivel ${nivel}`);
      }

      const nombreTabla = this.obtenerNombreTabla(nivel, grado);
      const store = await IndexedDBConnection.getStore(nombreTabla);
      const index = store.index("por_mes");

      return new Promise<IAsistenciaEscolarLocal[]>((resolve, reject) => {
        const request = index.getAll(mes);
        request.onsuccess = () =>
          resolve(request.result as IAsistenciaEscolarLocal[]);
        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      this.handleIndexedDBError(error, `obtener registros del mes ${mes}`);
      return [];
    }
  }

  protected async guardarRegistroAsistencia(
    nivel: NivelEducativo,
    grado: number,
    registro: Omit<IAsistenciaEscolarLocal, "ultima_fecha_actualizacion">
  ): Promise<AsistenciaOperationResult> {
    try {
      if (!this.validarNivelYGrado(nivel, grado)) {
        throw new Error(`Grado ${grado} no válido para nivel ${nivel}`);
      }

      const nombreTabla = this.obtenerNombreTabla(nivel, grado);
      const store = await IndexedDBConnection.getStore(
        nombreTabla,
        "readwrite"
      );

      const registroCompleto: IAsistenciaEscolarLocal = {
        ...registro,
        ultima_fecha_actualizacion: this.dateHelper.obtenerTimestampPeruano(),
      };

      return new Promise<AsistenciaOperationResult>((resolve, reject) => {
        const request = store.put(registroCompleto);

        request.onsuccess = () => {
          resolve({
            success: true,
            message: "Registro guardado exitosamente",
            data: registroCompleto,
          });
        };

        request.onerror = () => reject(request.error);
      });
    } catch (error) {
      this.handleIndexedDBError(error, "guardar registro");
      return {
        success: false,
        message: `Error al guardar: ${
          error instanceof Error ? error.message : "Error desconocido"
        }`,
      };
    }
  }

  // =====================================================================================
  // UTILIDADES DE PARSEO (compartidas)
  // =====================================================================================

  protected parsearAsistenciasMensuales(
    asistenciasJson: string
  ): AsistenciasPorDia {
    try {
      return JSON.parse(asistenciasJson) as AsistenciasPorDia;
    } catch (error) {
      console.error("Error al parsear asistencias:", error);
      return {};
    }
  }

  protected stringificarAsistenciasMensuales(
    asistencias: AsistenciasPorDia
  ): string {
    try {
      return JSON.stringify(asistencias);
    } catch (error) {
      console.error("Error al stringificar asistencias:", error);
      return "{}";
    }
  }

  // =====================================================================================
  // MANEJO DE ERRORES Y MENSAJES (compartido)
  // =====================================================================================

  protected crearResultadoError(mensaje: string): AsistenciaOperationResult {
    this.setError?.({ success: false, message: mensaje });
    return { success: false, message: mensaje };
  }

  protected handleSuccess(message: string): void {
    this.setSuccessMessage?.({ message });
  }

  protected handleIndexedDBError(error: unknown, operacion: string): void {
    console.error(`Error en IndexedDB (${operacion}):`, error);

    let errorType: AllErrorTypes = SystemErrorTypes.UNKNOWN_ERROR;
    let message = `Error al ${operacion}`;

    if (error instanceof Error) {
      if (error.name === "ConstraintError") {
        errorType = DataConflictErrorTypes.VALUE_ALREADY_IN_USE;
        message = `Error de restricción: valor duplicado`;
      } else if (error.name === "NotFoundError") {
        errorType = UserErrorTypes.USER_NOT_FOUND;
        message = `Recurso no encontrado`;
      } else if (error.name === "QuotaExceededError") {
        errorType = SystemErrorTypes.DATABASE_ERROR;
        message = `Almacenamiento excedido`;
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

  // =====================================================================================
  // UTILIDADES GENERALES (compartidas)
  // =====================================================================================

  protected obtenerNombreMes(mes: number): string {
    const nombres = [
      "",
      "enero",
      "febrero",
      "marzo",
      "abril",
      "mayo",
      "junio",
      "julio",
      "agosto",
      "septiembre",
      "octubre",
      "noviembre",
      "diciembre",
    ];
    return nombres[mes] || "mes desconocido";
  }

  protected esDiaEscolar(): boolean {
    const fechaActual = this.dateHelper.obtenerFechaHoraActualDesdeRedux();
    if (!fechaActual) return false;

    const diaSemana = fechaActual.getDay();
    return diaSemana >= 1 && diaSemana <= 5;
  }

  protected obtenerNombreDia(dia: number): string {
    const dias = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    return dias[dia] || "Desconocido";
  }

  // =====================================================================================
  // MÉTODOS HELPER PARA CONSULTAS (compartidos)
  // =====================================================================================

  protected async obtenerDatosDesdeCache(
    nivel: NivelEducativo,
    grado: number,
    idEstudiante: string,
    mes: number
  ): Promise<AsistenciaOperationResult> {
    const registro = await this.obtenerRegistroPorClave(
      nivel,
      grado,
      idEstudiante,
      mes
    );

    if (!registro) {
      return { success: false, message: "No hay datos en caché" };
    }

    const asistenciasParsed = this.parsearAsistenciasMensuales(
      registro.Asistencias_Mensuales
    );

    return {
      success: true,
      message: "Datos obtenidos desde caché",
      data: {
        Mes: mes,
        Asistencias: asistenciasParsed,
        registroCompleto: registro,
      },
      origen: "cache",
      ultimaActualizacion: registro.ultima_fecha_actualizacion,
    };
  }

  protected async actualizarTimestampSinModificarDatos(
    nivel: NivelEducativo,
    grado: number,
    idEstudiante: string,
    mes: number
  ): Promise<void> {
    try {
      const registroExistente = await this.obtenerRegistroPorClave(
        nivel,
        grado,
        idEstudiante,
        mes
      );

      if (registroExistente) {
        const registroActualizado: Omit<
          IAsistenciaEscolarLocal,
          "ultima_fecha_actualizacion"
        > = {
          Id_Estudiante: registroExistente.Id_Estudiante,
          Mes: registroExistente.Mes,
          Asistencias_Mensuales: registroExistente.Asistencias_Mensuales,
        };

        await this.guardarRegistroAsistencia(nivel, grado, registroActualizado);
      }
    } catch (error) {
      console.error("Error actualizando timestamp:", error);
    }
  }
}
