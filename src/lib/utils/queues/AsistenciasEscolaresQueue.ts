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
   * Obtiene el primer item SIN eliminarlo
   */
  async getFirstItem(): Promise<ItemDeColaAsistenciaEscolar | null> {
    try {
      const items = await this.idbModel.getAll();
      return items.length > 0 ? items[0] : null;
    } catch (error) {
      console.error("Error al obtener primer item:", error);
      return null;
    }
  }

  /**
   * Elimina el primer item de la cola
   */
  async dequeue(): Promise<boolean> {
    try {
      const firstItem = await this.getFirstItem();
      if (!firstItem) {
        return false;
      }

      return await this.idbModel.deleteByNumeroOrden(firstItem.NumeroDeOrden);
    } catch (error) {
      console.error("Error al hacer dequeue:", error);
      return false;
    }
  }

  /**
   * NUEVO: Elimina un item específico por su número de orden
   */
  async deleteByOrderNumber(numeroDeOrden: number): Promise<boolean> {
    try {
      return await this.idbModel.deleteByNumeroOrden(numeroDeOrden);
    } catch (error) {
      console.error("Error al eliminar por número de orden:", error);
      return false;
    }
  }

  /**
   * NUEVO: Mueve un item al final de la cola (le asigna un nuevo número de orden)
   */
  async moveToEnd(numeroDeOrden: number): Promise<boolean> {
    try {
      // 1. Obtener el item actual
      const item = await this.idbModel.getByNumeroOrden(numeroDeOrden);
      if (!item) {
        console.error(
          `Item con número de orden ${numeroDeOrden} no encontrado`
        );
        return false;
      }

      // 2. Obtener nuevo número de orden (al final)
      const nuevoNumeroDeOrden = await this.getNextOrderNumber();

      // 3. Eliminar el item actual
      const deleted = await this.idbModel.deleteByNumeroOrden(numeroDeOrden);
      if (!deleted) {
        console.error(`No se pudo eliminar el item ${numeroDeOrden}`);
        return false;
      }

      // 4. Crear el item con el nuevo número de orden al final
      await this.idbModel.create({
        ...item,
        NumeroDeOrden: nuevoNumeroDeOrden,
      });

      return true;
    } catch (error) {
      console.error("Error al mover item al final:", error);
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
