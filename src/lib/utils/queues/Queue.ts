// ========================================
// INTERFACES AND ENUMS
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
// ABSTRACT QUEUE REPOSITORY CLASS
// ========================================

export abstract class QueueRepository<T extends QueueItem> {
  /**
   * In this method the item should be added to the queue generating the order number in this same method
   * @param item
   */
  abstract enqueue(
    itemSinNumeroDeOrden: Omit<T, "NumeroDeOrden">
  ): Promise<boolean>;

  /**
   * Removes the first element from the queue
   */
  abstract dequeue(): Promise<boolean>;

  /**
   * Gets the first element without removing it
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
   * Removes a specific item by its order number
   */
  abstract deleteByOrderNumber(numeroDeOrden: number): Promise<boolean>;

  /**
   * Moves an item to the end of the queue (assigns a new order number)
   */
  abstract moveToEnd(numeroDeOrden: number): Promise<boolean>;
}

// ========================================
// CONCRETE CLASS FOR ELEMENT PROCESSOR
// ========================================

export class QueueDataItemProcessor<T extends QueueItem> {
  public currentCancelProcessFunction: () => void;

  /**
   * @param process this parameter is a function that processes an item
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
// ABSTRACT QUEUE CLASS
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
// CORRECTED QUEUE FOR DATA IMPLEMENTATION
// ========================================

export class QueueForData<T extends QueueItem> extends Queue<T> {
  private processingInterval?: NodeJS.Timeout;
  private retryCount = new Map<number, number>();
  private isProcessingItem = false; // Flag to prevent concurrent processing

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

    // Cancel the current processor if it exists
    this.dataProcessor.cancel();

    // Clear the interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = undefined;
    }
  }

  private async processQueue(): Promise<void> {
    if (this._queueState !== QueueState.PROCESSING) {
      return;
    }

    // Process first item immediately
    await this.processNextItem();

    // Set up interval to continue processing
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

    // STEP 1: Get the first element WITHOUT removing it
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
      // STEP 2: Process the element
      console.log(`Procesando item ${item.NumeroDeOrden}...`);
      await this.dataProcessor.processItem(item);

      // STEP 3: If processing was successful, remove the element
      processingSuccessful = true;
      await this.queueRepository.deleteByOrderNumber(item.NumeroDeOrden);

      // Clear retry counter
      this.retryCount.delete(item.NumeroDeOrden);

      console.log(
        `Item ${item.NumeroDeOrden} procesado exitosamente y eliminado de la cola`
      );
    } catch (error) {
      // STEP 4: If there's an error, handle retries
      console.error(`Error procesando item ${item.NumeroDeOrden}:`, error);
      await this.handleProcessingError(item, error);
    } finally {
      this.isProcessingItem = false;
    }
  }

  private async handleProcessingError(item: T, error: unknown): Promise<void> {
    const currentRetries = this.retryCount.get(item.NumeroDeOrden) || 0;

    if (currentRetries < this.queueOptions.maxRetries) {
      // Increment retry counter
      this.retryCount.set(item.NumeroDeOrden, currentRetries + 1);

      // Move the item to the end of the queue to retry later
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
        // As fallback, delete the current item and create a new one at the end
        await this.queueRepository.deleteByOrderNumber(item.NumeroDeOrden);
        await this.queueRepository.enqueue(item);
      }
    } else {
      // Retries exhausted, remove the item and log the error
      await this.queueRepository.deleteByOrderNumber(item.NumeroDeOrden);
      this.retryCount.delete(item.NumeroDeOrden);

      console.error(
        `Item ${item.NumeroDeOrden} descartado definitivamente después de ${this.queueOptions.maxRetries} intentos fallidos`,
        error
      );
    }
  }
}
