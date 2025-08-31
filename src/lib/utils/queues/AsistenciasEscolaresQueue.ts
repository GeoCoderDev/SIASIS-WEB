import { FetchCancelable } from "../FetchCancellable";

import { ColaAsistenciasEscolaresIDB } from "../local/db/models/ColaAsistenciasEscolares/ColaAsistenciaEscolaresIDB";

import {
  QueueDataItemProcessor,
  QueueForData,
  QueueItem,
  QueueRepository,
} from "./Queue";
import {
  RegistrarAsistenciaIndividualRequestBody,
  TipoAsistencia,
} from "@/interfaces/shared/AsistenciaRequests";
import { ActoresSistema } from "@/interfaces/shared/ActoresSistema";
import { ModoRegistro } from "@/interfaces/shared/ModoRegistroPersonal";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";

// Interfaz principal para los items de la cola
export interface ItemDeColaAsistenciaEscolar
  extends QueueItem,
    RegistrarAsistenciaIndividualRequestBody {
  Id_Estudiante: string;
  Actor: ActoresSistema.Estudiante;
  TipoAsistencia: TipoAsistencia;
  ModoRegistro: ModoRegistro;
  desfaseSegundosAsistenciaEstudiante: number;
  NivelDelEstudiante: NivelEducativo;
  Grado: number;
  Seccion: string;
}

export class AsistenciasEscolaresIDBRepository extends QueueRepository<ItemDeColaAsistenciaEscolar> {
  private idbModel: ColaAsistenciasEscolaresIDB;

  constructor(
    setIsSomethingLoading?: (isLoading: boolean) => void,
    setError?: (error: any) => void,
    setSuccessMessage?: (message: any) => void
  ) {
    super();
    this.idbModel = new ColaAsistenciasEscolaresIDB(
      setIsSomethingLoading,
      setError,
      setSuccessMessage
    );
  }

  /**
   * Añade un item a la cola
   */
  async enqueue(
    item: Omit<ItemDeColaAsistenciaEscolar, "NumeroDeOrden">
  ): Promise<boolean> {
    try {
      await this.idbModel.create({
        ...item,
        NumeroDeOrden: await this.getNextOrderNumber(),
      });
      return true;
    } catch (error) {
      console.error("Error al hacer enqueue:", error);
      return false;
    }
  }

  /**
   * Elimina y retorna el primer item de la cola (FIFO)
   */
  async dequeue(): Promise<boolean> {
    try {
      const items = await this.idbModel.getAll();
      if (items.length === 0) {
        return false;
      }

      const primerItem = items[0]; // Ya están ordenados por NumeroDeOrden
      return await this.idbModel.deleteByNumeroOrden(primerItem.NumeroDeOrden);
    } catch (error) {
      console.error("Error al hacer dequeue:", error);
      return false;
    }
  }

  /**
   * Obtiene todos los items ordenados por NumeroDeOrden
   */
  async getOrderItems(): Promise<ItemDeColaAsistenciaEscolar[]> {
    try {
      return await this.idbModel.getAll();
    } catch (error) {
      console.error("Error al obtener items ordenados:", error);
      return [];
    }
  }

  /**
   * Limpia todos los items de la cola
   */
  async clearItems(): Promise<boolean> {
    try {
      const deletedCount = await this.idbModel.deleteAll();
      return deletedCount > 0;
    } catch (error) {
      console.error("Error al limpiar items:", error);
      return false;
    }
  }

  /**
   * Obtiene un item específico por su número de orden
   */
  async getItemByOrderNumber(
    numeroDeOrden: number
  ): Promise<ItemDeColaAsistenciaEscolar | null> {
    try {
      return await this.idbModel.getByNumeroOrden(numeroDeOrden);
    } catch (error) {
      console.error("Error al obtener item por orden:", error);
      return null;
    }
  }

  /**
   * Obtiene el próximo número de orden disponible
   */
  async getNextOrderNumber(): Promise<number> {
    try {
      return await this.idbModel.getProximoNumeroOrden();
    } catch (error) {
      console.error("Error al obtener próximo número de orden:", error);
      return Date.now(); // Fallback
    }
  }

  /**
   * Cuenta el total de items en la cola
   */
  async count(): Promise<number> {
    try {
      return await this.idbModel.count();
    } catch (error) {
      console.error("Error al contar items:", error);
      return 0;
    }
  }

  /**
   * Actualiza un item existente
   */
  async updateItem(item: ItemDeColaAsistenciaEscolar): Promise<boolean> {
    try {
      return await this.idbModel.update(item);
    } catch (error) {
      console.error("Error al actualizar item:", error);
      return false;
    }
  }

  /**
   * Verifica si existe un item con el número de orden dado
   */
  async exists(numeroDeOrden: number): Promise<boolean> {
    try {
      return await this.idbModel.existsByNumeroOrden(numeroDeOrden);
    } catch (error) {
      console.error("Error al verificar existencia:", error);
      return false;
    }
  }
}

const PROCESADOR_DE_ASISTENCIAS_ESCOLARES =
  new QueueDataItemProcessor<ItemDeColaAsistenciaEscolar>(async function (
    this: QueueDataItemProcessor<ItemDeColaAsistenciaEscolar>,
    item
  ) {
    const fetchCancelable = new FetchCancelable("/api/asistencia-hoy/marcar", {
      method: "POST",
      body: JSON.stringify(item as RegistrarAsistenciaIndividualRequestBody),
      headers: {
        "Content-Type": "application/json",
      },
    });

    // Importante , setear la actual funcion de cancelacion
    // del procesamiento del item actual
    this.currentCancelProcessFunction = fetchCancelable.cancel;

    try {
      await fetchCancelable.fetch();
    } catch (error) {
      throw error;
    }
  });

// ------------------------------------
// |           ORQUESTACION           |
// ------------------------------------

export const Asistencias_Escolares_QUEUE =
  new QueueForData<ItemDeColaAsistenciaEscolar>(
    new AsistenciasEscolaresIDBRepository(),
    {
      autoStart: true,
      concurrency: 2,
      retryDelay: 1000,
      maxRetries: 3,
    },
    PROCESADOR_DE_ASISTENCIAS_ESCOLARES
  );
