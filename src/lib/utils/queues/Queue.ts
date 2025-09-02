// ========================================
// INTERFACES Y ENUMS
// ========================================

export interface QueueItem {
  NumeroDeOrden: number;
}

export interface QueueOptions {
  maxRetries: number;
  retryDelay: number;
  autoStart: boolean;
  concurrency: number;
}

export enum QueueState {
  IDLE = "IDLE",
  PROCESSING = "PROCESSING",
}

// ========================================
// CLASE ABSTRACTA QUEUE REPOSITORY
// ========================================

export abstract class QueueRepository<T extends QueueItem> {
  /**
   * En este metodo se debe agregar el item a la cola generando el numero de orden en este mismo metodo
   * @param item
   */
  abstract enqueue(
    itemSinNumeroDeOrden: Omit<T, "NumeroDeOrden">
  ): Promise<boolean>;

  /**
   * Elimina el primer elemento de la cola
   */
  abstract dequeue(): Promise<boolean>;

  /**
   * Obtiene el primer elemento sin eliminarlo
   */
  abstract getFirstItem(): Promise<T | null>;

  abstract getOrderItems(): Promise<T[]>;

  abstract clearItems(): Promise<boolean>;

  abstract getItemByOrderNumber(numeroDeOrden: number): Promise<T | null>;
  abstract getNextOrderNumber(): Promise<number>;
  abstract count(): Promise<number>;
  abstract updateItem(item: T): Promise<boolean>;
  abstract exists(numeroDeOrden: number): Promise<boolean>;

  /**
   * Elimina un item específico por su número de orden
   */
  abstract deleteByOrderNumber(numeroDeOrden: number): Promise<boolean>;

  /**
   * Mueve un item al final de la cola (le asigna un nuevo número de orden)
   */
  abstract moveToEnd(numeroDeOrden: number): Promise<boolean>;
}

// ========================================
// CLASE CONCRETA PARA PROCESADOR DE ELEMENTOS
// ========================================

export class QueueDataItemProcessor<T extends QueueItem> {
  public currentCancelProcessFunction: () => void;

  /**
   * @param process este parametro es una funcion que procesa un item
   */
  constructor(
    private process: (this: QueueDataItemProcessor<T>, item: T) => Promise<void>
  ) {
    this.currentCancelProcessFunction = () => {};
  }

  cancel() {
    this.currentCancelProcessFunction();
  }

  async processItem(item: T): Promise<void> {
    await this.process(item);
  }
}

// ========================================
// CLASE ABSTRACTA QUEUE
// ========================================

export abstract class Queue<T extends QueueItem> {
  protected _queueState: QueueState = QueueState.IDLE;

  constructor(
    protected queueRepository: QueueRepository<T>,
    protected queueOptions: QueueOptions
  ) {}

  get queueState(): QueueState {
    return this._queueState;
  }

  abstract enqueue(item: Omit<T, "NumeroDeOrden">): Promise<boolean>;
  abstract start(): void;
  abstract stop(): void;
}

// ========================================
// QUEUE FOR DATA IMPLEMENTATION CORREGIDA
// ========================================

export class QueueForData<T extends QueueItem> extends Queue<T> {
  private processingInterval?: NodeJS.Timeout;
  private retryCount = new Map<number, number>();
  private isProcessingItem = false; // Flag para evitar procesamiento concurrente

  constructor(
    protected queueRepository: QueueRepository<T>,
    protected queueOptions: QueueOptions,
    private dataProcessor: QueueDataItemProcessor<T>
  ) {
    super(queueRepository, queueOptions);

    if (queueOptions.autoStart) {
      this.start();
    }
  }

  async enqueue(item: Omit<T, "NumeroDeOrden">): Promise<boolean> {
    const success = await this.queueRepository.enqueue(item);

    if (
      success &&
      this.queueOptions.autoStart &&
      this._queueState === QueueState.IDLE
    ) {
      this.start();
    }

    return success;
  }

  start(): void {
    if (this._queueState === QueueState.PROCESSING) {
      return;
    }

    this._queueState = QueueState.PROCESSING;
    this.processQueue();
  }

  stop(): void {
    this._queueState = QueueState.IDLE;

    // Cancelar el procesador actual si existe
    this.dataProcessor.cancel();

    // Limpiar el intervalo
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  private async processQueue(): Promise<void> {
    if (this._queueState !== QueueState.PROCESSING) {
      return;
    }

    // Procesar primer item inmediatamente
    await this.processNextItem();

    // Configurar intervalo para seguir procesando
    this.processingInterval = setInterval(async () => {
      if (
        this._queueState === QueueState.PROCESSING &&
        !this.isProcessingItem
      ) {
        await this.processNextItem();
      }
    }, this.queueOptions.retryDelay);
  }

  private async processNextItem(): Promise<void> {
    if (this._queueState !== QueueState.PROCESSING || this.isProcessingItem) {
      return;
    }

    // PASO 1: Obtener el primer elemento SIN eliminarlo
    const item = await this.queueRepository.getFirstItem();
    if (!item) {
      this._queueState = QueueState.IDLE;
      if (this.processingInterval) {
        clearInterval(this.processingInterval);
        this.processingInterval = undefined;
      }
      return;
    }

    this.isProcessingItem = true;
    let processingSuccessful = false;

    try {
      // PASO 2: Procesar el elemento
      console.log(`Procesando item ${item.NumeroDeOrden}...`);
      await this.dataProcessor.processItem(item);

      // PASO 3: Si el procesamiento fue exitoso, eliminar el elemento
      processingSuccessful = true;
      await this.queueRepository.deleteByOrderNumber(item.NumeroDeOrden);

      // Limpiar contador de reintentos
      this.retryCount.delete(item.NumeroDeOrden);

      console.log(
        `Item ${item.NumeroDeOrden} procesado exitosamente y eliminado de la cola`
      );
    } catch (error) {
      // PASO 4: Si hay error, manejar reintentos
      console.error(`Error procesando item ${item.NumeroDeOrden}:`, error);
      await this.handleProcessingError(item, error);
    } finally {
      this.isProcessingItem = false;
    }
  }

  private async handleProcessingError(item: T, error: unknown): Promise<void> {
    const currentRetries = this.retryCount.get(item.NumeroDeOrden) || 0;

    if (currentRetries < this.queueOptions.maxRetries) {
      // Incrementar contador de reintentos
      this.retryCount.set(item.NumeroDeOrden, currentRetries + 1);

      // Mover el item al final de la cola para reintentarlo después
      const moved = await this.queueRepository.moveToEnd(item.NumeroDeOrden);

      if (moved) {
        console.log(
          `Item ${
            item.NumeroDeOrden
          } movido al final de la cola para reintento (${currentRetries + 1}/${
            this.queueOptions.maxRetries
          })`
        );
      } else {
        console.error(
          `Error al mover item ${item.NumeroDeOrden} al final de la cola`
        );
        // Como fallback, eliminar el item actual y crear uno nuevo al final
        await this.queueRepository.deleteByOrderNumber(item.NumeroDeOrden);
        await this.queueRepository.enqueue(item);
      }
    } else {
      // Se agotaron los reintentos, eliminar el item y logear el error
      await this.queueRepository.deleteByOrderNumber(item.NumeroDeOrden);
      this.retryCount.delete(item.NumeroDeOrden);

      console.error(
        `Item ${item.NumeroDeOrden} descartado definitivamente después de ${this.queueOptions.maxRetries} intentos fallidos`,
        error
      );
    }
  }
}
