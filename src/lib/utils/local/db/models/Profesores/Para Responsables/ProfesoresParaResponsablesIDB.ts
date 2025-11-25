// =====================================================================================
// SPECIALIZED CHILD CLASS FOR GUARDIANS
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

// Specific result for guardians
export interface ConsultaProfesorResponsableResult
  extends ProfesorOperationResult {
  origen?: "cache" | "api";
  ultimaActualizacion?: number;
}

/**
 * Specialized class for handling teachers for guardians
 * Implements specific query with basic data and cell phone
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
   * SIMPLE METHOD: Queries basic teacher data with automatic sync
   */
  public async consultarDatosBasicosDeProfesor(
    idProfesor: string,
    nivel: NivelEducativo
  ): Promise<ConsultaProfesorResponsableResult> {
    this.setIsSomethingLoading?.(true);
    this.setError?.(null);
    this.setSuccessMessage?.(null);

    try {
      // SIMPLE: Just check if sync is needed and query
      const necesitaSync = await this.necesitaSincronizacion(nivel);
      const profesorExistente = await this.obtenerProfesorPorId(
        idProfesor,
        nivel
      );

      // If it does not exist or needs sync, query API
      if (!profesorExistente || necesitaSync) {
        return await this.consultarProfesorDesdeAPI(idProfesor, nivel);
      }

      // Use cached data
      this.handleSuccess(
        `Data of teacher ${profesorExistente.Nombres} ${profesorExistente.Apellidos} obtained from local records`
      );

      return {
        success: true,
        message: "Teacher data obtained successfully",
        data: profesorExistente,
        origen: "cache",
        ultimaActualizacion: profesorExistente.ultima_fecha_actualizacion,
      };
    } catch (error) {
      this.handleIndexedDBError(error, "query basic teacher data");
      return {
        success: false,
        message: "Could not get teacher data",
      };
    } finally {
      this.setIsSomethingLoading?.(false);
    }
  }

  /**
   * Queries the teacher from the API and updates the cache - FIXED VERSION
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

      // Process and save the response
      const profesorActualizado = await this.procesarRespuestaAPI(
        response,
        nivel
      );

      if (profesorActualizado.success) {
        this.handleSuccess(
          "Teacher data was obtained successfully."
        );

        return {
          success: true,
          message: "Teacher data obtained successfully",
          data: profesorActualizado.data, // NOW profesorActualizado.data CONTAINS THE COMPLETE OBJECT
          origen: "api",
        };
      }

      return {
        success: false,
        message: "Requested teacher data not found.",
      };
    } catch (error) {
      console.error("Error in teacher API:", error);
      return {
        success: false,
        message:
          "Could not get data from the server. Check your connection.",
      };
    }
  }
  /**
   * Processes the API response and updates IndexedDB
   */
  private async procesarRespuestaAPI(
    response: ProfesorConAulaSuccessResponse,
    nivel: NivelEducativo
  ): Promise<ProfesorOperationResult> {
    // Map the response data to the local format
    const profesorLocal: Omit<
      IProfesorBaseLocal,
      "ultima_fecha_actualizacion"
    > = {
      // Assign ID according to the level
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
