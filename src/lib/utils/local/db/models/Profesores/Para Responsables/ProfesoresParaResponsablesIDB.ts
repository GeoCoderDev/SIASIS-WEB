// =====================================================================================
// CLASE HIJA ESPECIALIZADA PARA RESPONSABLES
// =====================================================================================

import { Endpoint_Profesores_Con_Aula_Para_Responsables_API02 } from "@/lib/utils/backend/endpoints/api02/ProfesoresConAulaParaResponsables";
import { ProfesorConAulaSuccessResponse } from "@/interfaces/shared/apis/api02/profesores-con-aula/types";

import {
  IProfesorBaseLocal,
  ProfesoresBaseIDB,
  ProfesorOperationResult,
} from "../ProfesoresBaseIDB";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import {
  ErrorResponseAPIBase,
  MessageProperty,
} from "@/interfaces/shared/apis/types";

// Resultado específico para responsables
export interface ConsultaProfesorResponsableResult
  extends ProfesorOperationResult {
  origen?: "cache" | "api";
  ultimaActualizacion?: number;
}

/**
 * Clase especializada para el manejo de profesores para responsables
 * Implementa consulta específica con datos básicos y celular
 */
export class ProfesoresParaResponsablesIDB extends ProfesoresBaseIDB {
  constructor(
    setIsSomethingLoading?: (isLoading: boolean) => void,
    setError?: (error: ErrorResponseAPIBase | null) => void,
    setSuccessMessage?: (message: MessageProperty | null) => void
  ) {
    super("API02", setIsSomethingLoading, setError, setSuccessMessage);
  }

  /**
   * MÉTODO SIMPLE: Consulta datos básicos de un profesor con sync automático
   */
  public async consultarDatosBasicosDeProfesor(
    idProfesor: string,
    nivel: NivelEducativo
  ): Promise<ConsultaProfesorResponsableResult> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // SIMPLE: Solo verificar si necesita sync y consultar
      const necesitaSync = await this.necesitaSincronizacion(nivel);
      const profesorExistente = await this.obtenerProfesorPorId(
        idProfesor,
        nivel
      );

      // Si no existe o necesita sync, consultar API
      if (!profesorExistente || necesitaSync) {
        return await this.consultarProfesorDesdeAPI(idProfesor, nivel);
      }

      // Usar datos del caché
      this.handleSuccess(
        `Datos del profesor ${profesorExistente.Nombres} ${profesorExistente.Apellidos} obtenidos desde registros locales`
      );

      return {
        success: true,
        message: "Datos del profesor obtenidos exitosamente",
        data: profesorExistente,
        origen: "cache",
        ultimaActualizacion: profesorExistente.ultima_fecha_actualizacion,
      };
    } catch (error) {
      this.handleIndexedDBError(error, "consultar datos básicos de profesor");
      return {
        success: false,
        message: "No se pudieron obtener los datos del profesor",
      };
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Consulta el profesor desde la API y actualiza el cache - VERSIÓN CORREGIDA
   */
  private async consultarProfesorDesdeAPI(
    idProfesor: string,
    nivel: NivelEducativo
  ): Promise<ConsultaProfesorResponsableResult> {
    try {
      const response =
        await Endpoint_Profesores_Con_Aula_Para_Responsables_API02.realizarPeticion(
          {
            queryParams: { Id_Profesor: idProfesor, Nivel: nivel },
          }
        );

      // Procesar y guardar la respuesta
      const profesorActualizado = await this.procesarRespuestaAPI(
        response,
        nivel
      );

      if (profesorActualizado.success) {
        this.handleSuccess(
          "Se obtuvieron los datos del profesor exitosamente."
        );

        return {
          success: true,
          message: "Datos del profesor obtenidos exitosamente",
          data: profesorActualizado.data, // AHORA profesorActualizado.data CONTIENE EL OBJETO COMPLETO
          origen: "api",
        };
      }

      return {
        success: false,
        message: "No se encontraron datos del profesor solicitado.",
      };
    } catch (error) {
      console.error("Error en API de profesor:", error);
      return {
        success: false,
        message:
          "No se pudieron obtener los datos del servidor. Verifique su conexión.",
      };
    }
  }
  /**
   * Procesa la respuesta de la API y actualiza IndexedDB
   */
  private async procesarRespuestaAPI(
    response: ProfesorConAulaSuccessResponse,
    nivel: NivelEducativo
  ): Promise<ProfesorOperationResult> {
    // Mapear los datos de la respuesta al formato local
    const profesorLocal: Omit<
      IProfesorBaseLocal,
      "ultima_fecha_actualizacion"
    > = {
      // Asignar ID según el nivel
      ...(nivel === NivelEducativo.PRIMARIA
        ? { Id_Profesor_Primaria: (response.data as any).Id_Profesor_Primaria }
        : {
            Id_Profesor_Secundaria: (response.data as any)
              .Id_Profesor_Secundaria,
          }),
      Nombres: response.data.Nombres,
      Apellidos: response.data.Apellidos,
      Genero: response.data.Genero,
      Google_Drive_Foto_ID: response.data.Google_Drive_Foto_ID,
      Celular: response.data.Celular || "",
    };

    return await this.guardarProfesor(profesorLocal, nivel);
  }
}
