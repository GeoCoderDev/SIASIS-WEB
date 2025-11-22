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
import { ModoRegistro } from "@/interfaces/shared/ModoRegistro";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";

// Main interface for queue items
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
   * Adds an item to the queue
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
      console.error("Error doing enqueue:", error);
      return false;
    }
  }

  /**
   * Gets the first item WITHOUT removing it
   */
  async getFirstItem(): Promise<ItemDeColaAsistenciaEscolar | null> {
    try {
      const items = await this.idbModel.getAll();
      return items.length > 0 ? items[0] : null;
    } catch (error) {
      console.error("Error getting first item:", error);
      return null;
    }
  }

  /**
   * Removes the first item from the queue
   */
  async dequeue(): Promise<boolean> {
    try {
      const firstItem = await this.getFirstItem();
      if (!firstItem) {
        return false;
      }

      return await this.idbModel.deleteByNumeroOrden(firstItem.NumeroDeOrden);
    } catch (error) {
      console.error("Error doing dequeue:", error);
      return false;
    }
  }

  /**
   * NEW: Removes a specific item by its order number
   */
  async deleteByOrderNumber(numeroDeOrden: number): Promise<boolean> {
    try {
      return await this.idbModel.deleteByNumeroOrden(numeroDeOrden);
    } catch (error) {
      console.error("Error deleting by order number:", error);
      return false;
    }
  }

  /**
   * NEW: Moves an item to the end of the queue (assigns a new order number)
   */
  async moveToEnd(numeroDeOrden: number): Promise<boolean> {
    try {
      // 1. Get the current item
      const item = await this.idbModel.getByNumeroOrden(numeroDeOrden);
      if (!item) {
        console.error(
          `Item with order number ${numeroDeOrden} not found`
        );
        return false;
      }

      // 2. Get new order number (at the end)
      const nuevoNumeroDeOrden = await this.getNextOrderNumber();

      // 3. Delete the current item
      const deleted = await this.idbModel.deleteByNumeroOrden(numeroDeOrden);
      if (!deleted) {
        console.error(`Could not delete item ${numeroDeOrden}`);
        return false;
      }

      // 4. Create the item with the new order number at the end
      await this.idbModel.create({
        ...item,
        NumeroDeOrden: nuevoNumeroDeOrden,
      });

      return true;
    } catch (error) {
      console.error("Error moving item to end:", error);
      return false;
    }
  }

  /**
   * Gets all items sorted by NumeroDeOrden
   */
  async getOrderItems(): Promise<ItemDeColaAsistenciaEscolar[]> {
    try {
      return await this.idbModel.getAll();
    } catch (error) {
      console.error("Error getting ordered items:", error);
      return [];
    }
  }

  /**
   * Clears all items from the queue
   */
  async clearItems(): Promise<boolean> {
    try {
      const deletedCount = await this.idbModel.deleteAll();
      return deletedCount > 0;
    } catch (error) {
      console.error("Error clearing items:", error);
      return false;
    }
  }

  /**
   * Gets a specific item by its order number
   */
  async getItemByOrderNumber(
    numeroDeOrden: number
  ): Promise<ItemDeColaAsistenciaEscolar | null> {
    try {
      return await this.idbModel.getByNumeroOrden(numeroDeOrden);
    } catch (error) {
      console.error("Error getting item by order:", error);
      return null;
    }
  }

  /**
   * Gets the next available order number
   */
  async getNextOrderNumber(): Promise<number> {
    try {
      return await this.idbModel.getProximoNumeroOrden();
    } catch (error) {
      console.error("Error getting next order number:", error);
      return Date.now(); // Fallback
    }
  }

  /**
   * Counts the total items in the queue
   */
  async count(): Promise<number> {
    try {
      return await this.idbModel.count();
    } catch (error) {
      console.error("Error counting items:", error);
      return 0;
    }
  }

  /**
   * Updates an existing item
   */
  async updateItem(item: ItemDeColaAsistenciaEscolar): Promise<boolean> {
    try {
      return await this.idbModel.update(item);
    } catch (error) {
      console.error("Error updating item:", error);
      return false;
    }
  }

  /**
   * Checks if an item exists with the given order number
   */
  async exists(numeroDeOrden: number): Promise<boolean> {
    try {
      return await this.idbModel.existsByNumeroOrden(numeroDeOrden);
    } catch (error) {
      console.error("Error checking existence:", error);
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

    // Important, set the current cancel function
    // for processing the current item
    this.currentCancelProcessFunction = fetchCancelable.cancel;

    try {
      await fetchCancelable.fetch();
    } catch (error) {
      throw error;
    }
  });

// ------------------------------------
// |          ORCHESTRATION           |
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
