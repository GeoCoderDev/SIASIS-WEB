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
  abstract dequeue(): Promise<boolean>;

  abstract getOrderItems(): Promise<T[]>;

  abstract clearItems(): Promise<boolean>;

  abstract getItemByOrderNumber(numeroDeOrden: number): Promise<T | null>;
  abstract getNextOrderNumber(): Promise<number>;
  abstract count(): Promise<number>;
  abstract updateItem(item: T): Promise<boolean>;
  abstract exists(numeroDeOrden: number): Promise<boolean>;
}

// ========================================
// CLASE CONCRETA PARA PROCESADOR DE ELEMENTOS
// ========================================

export class QueueDataItemProcessor<T extends QueueItem> {
  public currentCancelProcessFunction: () => void;

  /**
   *
   * @param process este parametro es una funcion que devuelve otra funcion que puede cancelar el proceso actual
   */
  constructor(
    private process: (this: QueueDataItemProcessor<T>, item: T) => Promise<void>
  ) {
    this.currentCancelProcessFunction = () => {};
  }

  cancel() {
    this.currentCancelProcessFunction();
  }

  async processItem(item: T) {
    try {
      await this.process(item);
    } catch (error) {
      console.error(`Error processing item ${item.NumeroDeOrden}:`, error);
    }
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

  abstract enqueue(item: T): Promise<boolean>;
  abstract dequeue(): Promise<T | undefined>;
  abstract start(): void;
  abstract stop(): void;
}

// ========================================
// QUEUE FOR DATA IMPLEMENTATION
// ========================================

export class QueueForData<T extends QueueItem> extends Queue<T> {
  private processingInterval?: NodeJS.Timeout;
  private retryCount = new Map<number, number>();

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

  async dequeue(): Promise<T | undefined> {
    const items = await this.queueRepository.getOrderItems();
    if (items.length === 0) {
      return undefined;
    }

    const firstItem = items[0];
    const removed = await this.queueRepository.dequeue();

    return removed ? firstItem : undefined;
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

    this.processingInterval = setInterval(async () => {
      if (this._queueState === QueueState.PROCESSING) {
        await this.processNextItem();
      }
    }, this.queueOptions.retryDelay);

    // Procesar primer item inmediatamente
    await this.processNextItem();
  }

  private async processNextItem(): Promise<void> {
    if (this._queueState !== QueueState.PROCESSING) {
      return;
    }

    const item = await this.dequeue();
    if (!item) {
      this._queueState = QueueState.IDLE;
      return;
    }

    let processingCompleted = false;

    try {
      await this.dataProcessor.processItem(item);
      processingCompleted = true;
      this.retryCount.delete(item.NumeroDeOrden);
    } catch (error) {
      await this.handleProcessingError(item, error);
    } finally {
      if (!processingCompleted) {
        // Si no terminó, reencolar
        await this.queueRepository.enqueue(item);
      }
    }
  }

  private async handleProcessingError(item: T, error: unknown): Promise<void> {
    const currentRetries = this.retryCount.get(item.NumeroDeOrden) || 0;

    if (currentRetries < this.queueOptions.maxRetries) {
      this.retryCount.set(item.NumeroDeOrden, currentRetries + 1);
      await this.queueRepository.enqueue(item);
      console.log(
        `Item ${item.NumeroDeOrden} reintentado (${currentRetries + 1}/${
          this.queueOptions.maxRetries
        })`
      );
    } else {
      this.retryCount.delete(item.NumeroDeOrden);
      console.error(
        `Item ${item.NumeroDeOrden} descartado después de ${this.queueOptions.maxRetries} intentos`,
        error
      );
    }
  }
}
