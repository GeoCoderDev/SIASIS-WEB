// ==================== INTERFACES ====================

import { vibrator } from "../vibration/Vibrator";

/**
 * Interface para el estado de carga que puede ser manipulado desde componentes React
 */
export interface LoadingStateSetter {
  (isLoading: boolean): void;
}

/**
 * Interface para la persistencia de la cola
 */
export interface QueuePersistence<T> {
  /**
   * Obtiene todos los elementos de la cola desde la fuente de persistencia
   */
  getQueueItems(): Promise<T[]>;

  /**
   * Guarda los elementos en la fuente de persistencia
   */
  saveQueueItems(items: T[]): Promise<void>;

  /**
   * Limpia completamente la cola
   */
  clearQueue(): Promise<void>;

  /**
   * Verifica si la persistencia está disponible
   */
  isAvailable(): boolean;
}

/**
 * Función que retorna una promesa (para Queue de funciones)
 */
export type QueueFunction = () => Promise<any>;

/**
 * Elemento de cola con datos que será procesado por una función
 */
export interface QueueDataItem<TData = any> {
  id: string;
  data: TData;
  timestamp: number;
  retryCount?: number;
  maxRetries?: number;
}

/**
 * Procesador de datos para DataQueue
 */
export type DataProcessor<TData = any> = (data: TData) => Promise<any>;

/**
 * Estados posibles de la cola
 */
export enum QueueState {
  IDLE = "idle",
  PROCESSING = "processing",
  PAUSED = "paused",
  ERROR = "error",
  COMPLETED = "completed",
}

/**
 * Opciones de configuración para las colas
 */
export interface QueueOptions {
  /**
   * Máximo número de reintentos para elementos fallidos
   */
  maxRetries?: number;

  /**
   * Retraso entre reintentos (en ms)
   */
  retryDelay?: number;

  /**
   * Procesar elementos en paralelo o secuencialmente
   */
  concurrent?: boolean;

  /**
   * Número máximo de elementos procesados en paralelo (solo si concurrent=true)
   */
  maxConcurrency?: number;

  /**
   * Auto-iniciar el procesamiento al agregar elementos
   */
  autoStart?: boolean;
}

// ==================== CLASE ABSTRACTA BASE ====================

/**
 * Clase abstracta base para todas las colas
 */
export abstract class AbstractQueue<T> {
  protected items: T[] = [];
  protected currentState: QueueState = QueueState.IDLE;
  protected isProcessing: boolean = false;
  protected loadingStateSetter?: LoadingStateSetter;
  protected persistence: QueuePersistence<T>;
  protected options: Required<QueueOptions>;

  // Eventos
  protected onItemProcessed?: (
    item: T,
    success: boolean,
    error?: Error
  ) => void;
  protected onQueueCompleted?: () => void;
  protected onQueueError?: (error: Error) => void;
  protected onStateChanged?: (
    newState: QueueState,
    oldState: QueueState
  ) => void;

  constructor(persistence: QueuePersistence<T>, options: QueueOptions = {}) {
    this.persistence = persistence;
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      concurrent: options.concurrent ?? false,
      maxConcurrency: options.maxConcurrency ?? 3,
      autoStart: options.autoStart ?? true,
    };
  }

  /**
   * Establece la función para manipular el estado de carga
   */
  setLoadingSetter(setter: LoadingStateSetter): void {
    this.loadingStateSetter = setter;
  }

  /**
   * Carga los elementos desde la persistencia
   */
  async loadFromPersistence(): Promise<void> {
    try {
      if (this.persistence.isAvailable()) {
        this.items = await this.persistence.getQueueItems();
      }
    } catch (error) {
      console.error("Error al cargar desde persistencia:", error);
    }
  }

  /**
   * Guarda los elementos en la persistencia
   */
  async saveToPersistence(): Promise<void> {
    try {
      if (this.persistence.isAvailable()) {
        await this.persistence.saveQueueItems(this.items);
      }
    } catch (error) {
      console.error("Error al guardar en persistencia:", error);
    }
  }

  /**
   * Cambia el estado de la cola
   */
  protected changeState(newState: QueueState): void {
    const oldState = this.currentState;
    this.currentState = newState;

    // Actualizar estado de carga si está configurado
    if (this.loadingStateSetter) {
      this.loadingStateSetter(newState === QueueState.PROCESSING);
    }

    // Disparar evento de cambio de estado
    if (this.onStateChanged) {
      this.onStateChanged(newState, oldState);
    }
  }

  /**
   * Agrega un elemento a la cola
   */
  async add(item: T): Promise<void> {
    this.items.push(item);
    await this.saveToPersistence();

    if (this.options.autoStart && this.currentState === QueueState.IDLE) {
      await this.start();
    }
  }

  /**
   * Agrega múltiples elementos a la cola
   */
  async addMultiple(items: T[]): Promise<void> {
    this.items.push(...items);
    await this.saveToPersistence();

    if (this.options.autoStart && this.currentState === QueueState.IDLE) {
      await this.start();
    }
  }

  /**
   * Inicia el procesamiento de la cola
   */
  async start(): Promise<void> {
    if (this.isProcessing || this.items.length === 0) {
      return;
    }

    this.isProcessing = true;
    this.changeState(QueueState.PROCESSING);

    try {
      if (this.options.concurrent) {
        await this.processConcurrent();
      } else {
        await this.processSequential();
      }

      this.changeState(QueueState.COMPLETED);
      if (this.onQueueCompleted) {
        this.onQueueCompleted();
      }
    } catch (error) {
      this.changeState(QueueState.ERROR);
      if (this.onQueueError) {
        this.onQueueError(error as Error);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Pausa el procesamiento de la cola
   */
  pause(): void {
    if (this.currentState === QueueState.PROCESSING) {
      this.changeState(QueueState.PAUSED);
    }
  }

  /**
   * Reanuda el procesamiento de la cola
   */
  async resume(): Promise<void> {
    if (this.currentState === QueueState.PAUSED) {
      await this.start();
    }
  }

  /**
   * Detiene y limpia la cola
   */
  async stop(): Promise<void> {
    this.isProcessing = false;
    this.items = [];
    await this.persistence.clearQueue();
    this.changeState(QueueState.IDLE);
  }

  // ==================== MÉTODOS ABSTRACTOS ====================

  /**
   * Procesa un elemento individual (debe ser implementado por las clases hijas)
   */
  protected abstract processItem(item: T): Promise<boolean>;

  // ==================== MÉTODOS PRIVADOS ====================

  /**
   * Procesamiento secuencial
   */
  private async processSequential(): Promise<void> {
    while (
      this.items.length > 0 &&
      this.isProcessing &&
      this.currentState === QueueState.PROCESSING
    ) {
      const item = this.items.shift()!;
      await this.executeItem(item);
      await this.saveToPersistence();
    }
  }

  /**
   * Procesamiento concurrente
   */
  private async processConcurrent(): Promise<void> {
    const promises: Promise<void>[] = [];

    while (
      this.items.length > 0 &&
      this.isProcessing &&
      this.currentState === QueueState.PROCESSING
    ) {
      const batch = this.items.splice(0, this.options.maxConcurrency);
      const batchPromises = batch.map((item) => this.executeItem(item));
      promises.push(...batchPromises);

      // Esperar que se complete el batch antes de continuar
      await Promise.allSettled(batchPromises);
      await this.saveToPersistence();
    }

    // Esperar que todas las promesas se resuelvan
    await Promise.allSettled(promises);
  }

  /**
   * Ejecuta un elemento con manejo de errores y reintentos
   */
  private async executeItem(item: T): Promise<void> {
    let success = false;
    let lastError: Error | undefined;

    for (
      let attempt = 0;
      attempt <= this.options.maxRetries && !success;
      attempt++
    ) {
      try {
        success = await this.processItem(item);
        if (!success && attempt < this.options.maxRetries) {
          await this.delay(this.options.retryDelay);
        }
      } catch (error) {
        lastError = error as Error;
        if (attempt < this.options.maxRetries) {
          await this.delay(this.options.retryDelay);
        }
      }
    }

    if (this.onItemProcessed) {
      this.onItemProcessed(item, success, lastError);
    }
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ==================== GETTERS Y MÉTODOS PÚBLICOS ====================

  /**
   * Obtiene el estado actual de la cola
   */
  getState(): QueueState {
    return this.currentState;
  }

  /**
   * Verifica si la cola está procesando
   */
  isProcessingQueue(): boolean {
    return this.isProcessing;
  }

  /**
   * Verifica si la cola está vacía
   */
  isEmpty(): boolean {
    return this.items.length === 0;
  }

  /**
   * Obtiene el número de elementos en la cola
   */
  getQueueSize(): number {
    return this.items.length;
  }

  /**
   * Verifica si la cola ha sido liberada (completada y vacía)
   */
  isReleased(): boolean {
    return this.currentState === QueueState.COMPLETED && this.isEmpty();
  }

  // ==================== EVENT HANDLERS ====================

  /**
   * Configura el callback para cuando se procesa un elemento
   */
  onItemProcessedCallback(
    callback: (item: T, success: boolean, error?: Error) => void
  ): void {
    this.onItemProcessed = callback;
  }

  /**
   * Configura el callback para cuando se completa la cola
   */
  onQueueCompletedCallback(callback: () => void): void {
    this.onQueueCompleted = callback;
  }

  /**
   * Configura el callback para errores de la cola
   */
  onQueueErrorCallback(callback: (error: Error) => void): void {
    this.onQueueError = callback;
  }

  /**
   * Configura el callback para cambios de estado
   */
  onStateChangedCallback(
    callback: (newState: QueueState, oldState: QueueState) => void
  ): void {
    this.onStateChanged = callback;
  }
}

// ==================== QUEUE DE FUNCIONES ====================

/**
 * Cola para ejecutar funciones que retornan promesas
 */
export abstract class FunctionQueue extends AbstractQueue<QueueFunction> {
  protected async processItem(func: QueueFunction): Promise<boolean> {
    try {
      await func();
      return true;
    } catch (error) {
      console.error("Error ejecutando función en cola:", error);
      return false;
    }
  }

  /**
   * Agrega una función a la cola
   */
  async addFunction(func: QueueFunction): Promise<void> {
    await this.add(func);
  }

  /**
   * Agrega múltiples funciones a la cola
   */
  async addFunctions(functions: QueueFunction[]): Promise<void> {
    await this.addMultiple(functions);
  }
}

// ==================== QUEUE DE DATOS ====================

/**
 * Cola para procesar datos con una función específica
 */
export abstract class DataQueue<TData = any> extends AbstractQueue<
  QueueDataItem<TData>
> {
  private dataProcessor: DataProcessor<TData>;

  constructor(
    persistence: QueuePersistence<QueueDataItem<TData>>,
    dataProcessor: DataProcessor<TData>,
    options: QueueOptions = {}
  ) {
    super(persistence, options);
    this.dataProcessor = dataProcessor;
  }

  protected async processItem(item: QueueDataItem<TData>): Promise<boolean> {
    try {
      await this.dataProcessor(item.data);
      return true;
    } catch (error) {
      console.error(`Error procesando datos (ID: ${item.id}):`, error);
      return false;
    }
  }

  /**
   * Agrega datos a la cola
   */
  async addData(data: TData, options?: { maxRetries?: number }): Promise<void> {
    const item: QueueDataItem<TData> = {
      id: this.generateId(),
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: options?.maxRetries ?? this.options.maxRetries,
    };

    await this.add(item);
  }

  /**
   * Agrega múltiples datos a la cola
   */
  async addMultipleData(dataList: TData[]): Promise<void> {
    const items: QueueDataItem<TData>[] = dataList.map((data) => ({
      id: this.generateId(),
      data,
      timestamp: Date.now(),
      retryCount: 0,
      maxRetries: this.options.maxRetries,
    }));

    await this.addMultiple(items);
  }

  /**
   * Cambia el procesador de datos
   */
  setDataProcessor(processor: DataProcessor<TData>): void {
    this.dataProcessor = processor;
  }

  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}






// // ==================== EJEMPLO DE IMPLEMENTACIONES CONCRETAS ====================

// /**
//  * Ejemplo: Cola de funciones con persistencia en LocalStorage
//  */
// export class LocalStorageFunctionQueue extends FunctionQueue {
//   constructor(storageKey: string = "function_queue", options?: QueueOptions) {
//     const persistence: QueuePersistence<QueueFunction> = {
//       async getQueueItems(): Promise<QueueFunction[]> {
//         // Nota: Las funciones no se pueden serializar,
//         // esta implementación requeriría un enfoque diferente
//         return [];
//       },
//       async saveQueueItems(items: QueueFunction[]): Promise<void> {
//         // Las funciones no se pueden guardar directamente
//         console.warn("Las funciones no pueden ser persistidas en LocalStorage");
//       },
//       async clearQueue(): Promise<void> {
//         localStorage.removeItem(storageKey);
//       },
//       isAvailable(): boolean {
//         return typeof Storage !== "undefined";
//       },
//     };

//     super(persistence, options || {});
//   }
// }



   


/**
 * Ejemplo: Cola de datos con persistencia en LocalStorage
 */
// export class LocalStorageDataQueue<TData> extends DataQueue<TData> {
//   constructor(
//     storageKey: string,
//     dataProcessor: DataProcessor<TData>,
//     options?: QueueOptions
//   ) {
//     const persistence: QueuePersistence<QueueDataItem<TData>> = {
//       async getQueueItems(): Promise<QueueDataItem<TData>[]> {
//         try {
//           const stored = localStorage.getItem(storageKey);
//           return stored ? JSON.parse(stored) : [];
//         } catch {
//           return [];
//         }
//       },
//       async saveQueueItems(items: QueueDataItem<TData>[]): Promise<void> {
//         localStorage.setItem(storageKey, JSON.stringify(items));
//       },
//       async clearQueue(): Promise<void> {
//         localStorage.removeItem(storageKey);
//       },
//       isAvailable(): boolean {
//         return typeof Storage !== "undefined";
//       },
//     };

//     super(persistence, dataProcessor, options || {});
//   }
// }


// class MemoryFunctionQueue extends FunctionQueue {
//   constructor() {
//     const memoryPersistence = {
//       async getQueueItems() { return []; },
//       async saveQueueItems() {},
//       async clearQueue() {},
//       isAvailable() { return true; }
//     };
//     super(memoryPersistence, { concurrent: true, maxConcurrency: 3 });
//   }
// }

// const operationsQueue = new MemoryFunctionQueue();

// // Agregar operaciones
// await operationsQueue.addFunction(async () => {
//   await vibrator.vibrateSuccess();
// });

// await operationsQueue.addFunction(async () => {
//   await saveToIndexedDB(data);
// });