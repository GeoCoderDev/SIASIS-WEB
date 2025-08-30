import { AbstractQueue, QueueState } from "@/lib/utils/queues/AbstractQueue";
import { useState, useEffect, useRef, useCallback } from "react";

// ==================== INTERFACES ====================

/**
 * Estado del hook useQueue
 */
export interface UseQueueState {
  /** Si la cola está procesando actualmente */
  isProcessing: boolean;
  /** Estado actual de la cola */
  state: QueueState;
  /** Número de elementos en la cola */
  queueSize: number;
  /** Si la cola está vacía */
  isEmpty: boolean;
  /** Si la cola ha sido liberada (completada y vacía) */
  isReleased: boolean;
  /** Si hay algún error en la cola */
  hasError: boolean;
}

/**
 * Acciones disponibles del hook useQueue
 */
export interface UseQueueActions<T> {
  /** Inicia el procesamiento de la cola */
  start: () => Promise<void>;
  /** Pausa el procesamiento */
  pause: () => void;
  /** Reanuda el procesamiento */
  resume: () => Promise<void>;
  /** Detiene y limpia la cola */
  stop: () => Promise<void>;
  /** Agrega un elemento a la cola */
  add: (item: T) => Promise<void>;
  /** Agrega múltiples elementos a la cola */
  addMultiple: (items: T[]) => Promise<void>;
  /** Recarga la cola desde la persistencia */
  reload: () => Promise<void>;
}

/**
 * Retorno completo del hook useQueue
 */
export interface UseQueueReturn<T> extends UseQueueState {
  /** Acciones disponibles */
  actions: UseQueueActions<T>;
  /** Referencia directa a la cola (para casos avanzados) */
  queue: AbstractQueue<T>;
}

/**
 * Opciones del hook useQueue
 */
export interface UseQueueOptions {
  /** Auto-cargar desde persistencia al montar */
  autoLoad?: boolean;
  /** Auto-iniciar procesamiento si hay elementos */
  autoStart?: boolean;
  /** Intervalo para actualizar el estado (ms) */
  updateInterval?: number;
}

// ==================== HOOK PRINCIPAL ====================

/**
 * Hook genérico para manejar cualquier tipo de cola
 *
 * @param queueInstance - Instancia de cualquier cola que herede de AbstractQueue
 * @param options - Opciones de configuración del hook
 * @returns Estado y acciones de la cola
 *
 * @example
 * ```tsx
 * // Con cola de datos
 * const dataQueue = new LocalStorageDataQueue('sync', sendToServer);
 * const { isProcessing, queueSize, actions } = useQueue(dataQueue);
 *
 * // Con cola de funciones
 * const funcQueue = new MemoryFunctionQueue();
 * const { isReleased, actions } = useQueue(funcQueue);
 * ```
 */
export function useQueue<T>(
  queueInstance: AbstractQueue<T>,
  options: UseQueueOptions = {}
): UseQueueReturn<T> {
  const { autoLoad = true, autoStart = false, updateInterval = 500 } = options;

  // ==================== STATE ====================

  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [state, setState] = useState<QueueState>(QueueState.IDLE);
  const [queueSize, setQueueSize] = useState<number>(0);
  const [isEmpty, setIsEmpty] = useState<boolean>(true);
  const [isReleased, setIsReleased] = useState<boolean>(false);
  const [hasError, setHasError] = useState<boolean>(false);

  // Referencias
  const queueRef = useRef<AbstractQueue<T>>(queueInstance);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef<boolean>(true);

  // ==================== UPDATE STATE FUNCTION ====================

  /**
   * Actualiza el estado del hook basándose en la cola
   */
  const updateState = useCallback(() => {
    if (!mountedRef.current || !queueRef.current) return;

    const queue = queueRef.current;
    const newIsProcessing = queue.isProcessingQueue();
    const newState = queue.getState();
    const newQueueSize = queue.getQueueSize();
    const newIsEmpty = queue.isEmpty();
    const newIsReleased = queue.isReleased();
    const newHasError = newState === QueueState.ERROR;

    setIsProcessing(newIsProcessing);
    setState(newState);
    setQueueSize(newQueueSize);
    setIsEmpty(newIsEmpty);
    setIsReleased(newIsReleased);
    setHasError(newHasError);
  }, []);

  // ==================== QUEUE SETUP ====================

  useEffect(() => {
    const queue = queueRef.current;

    // Configurar el setter de loading state
    queue.setLoadingSetter(setIsProcessing);

    // Configurar callbacks de eventos
    queue.onStateChangedCallback(
      (newState: QueueState, oldState: QueueState) => {
        if (mountedRef.current) {
          updateState();
        }
      }
    );

    queue.onQueueCompletedCallback(() => {
      if (mountedRef.current) {
        updateState();
      }
    });

    queue.onQueueErrorCallback((error: Error) => {
      if (mountedRef.current) {
        console.error("Queue error:", error);
        updateState();
      }
    });

    // Auto-load si está habilitado
    if (autoLoad) {
      queue.loadFromPersistence().then(() => {
        if (mountedRef.current) {
          updateState();
          // Auto-start si hay elementos y está habilitado
          if (autoStart && !queue.isEmpty()) {
            queue.start();
          }
        }
      });
    }

    // Configurar intervalo de actualización
    if (updateInterval > 0) {
      intervalRef.current = setInterval(updateState, updateInterval);
    }

    // Actualización inicial
    updateState();

    return () => {
      mountedRef.current = false;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [updateState, autoLoad, autoStart, updateInterval]);

  // ==================== ACTIONS ====================

  const actions: UseQueueActions<T> = {
    start: useCallback(async () => {
      try {
        await queueRef.current.start();
        updateState();
      } catch (error) {
        console.error("Error starting queue:", error);
        updateState();
      }
    }, [updateState]),

    pause: useCallback(() => {
      queueRef.current.pause();
      updateState();
    }, [updateState]),

    resume: useCallback(async () => {
      try {
        await queueRef.current.resume();
        updateState();
      } catch (error) {
        console.error("Error resuming queue:", error);
        updateState();
      }
    }, [updateState]),

    stop: useCallback(async () => {
      try {
        await queueRef.current.stop();
        updateState();
      } catch (error) {
        console.error("Error stopping queue:", error);
        updateState();
      }
    }, [updateState]),

    add: useCallback(
      async (item: T) => {
        try {
          await queueRef.current.add(item);
          updateState();
        } catch (error) {
          console.error("Error adding item to queue:", error);
          updateState();
        }
      },
      [updateState]
    ),

    addMultiple: useCallback(
      async (items: T[]) => {
        try {
          await queueRef.current.addMultiple(items);
          updateState();
        } catch (error) {
          console.error("Error adding multiple items to queue:", error);
          updateState();
        }
      },
      [updateState]
    ),

    reload: useCallback(async () => {
      try {
        await queueRef.current.loadFromPersistence();
        updateState();
      } catch (error) {
        console.error("Error reloading queue:", error);
        updateState();
      }
    }, [updateState]),
  };

  // ==================== RETURN ====================

  return {
    // Estado
    isProcessing,
    state,
    queueSize,
    isEmpty,
    isReleased,
    hasError,
    // Acciones
    actions,
    // Referencia directa (para casos avanzados)
    queue: queueRef.current,
  };
}

// ==================== HOOK ESPECIALIZADO PARA DATOS ====================

/**
 * Hook especializado para colas de datos con helper adicional
 */
export function useDataQueue<TData>(
  queueInstance: AbstractQueue<any>, // El tipo específico se maneja internamente
  options: UseQueueOptions = {}
) {
  const baseHook = useQueue(queueInstance, options);

  // Función helper para agregar datos (asume que es una DataQueue)
  const addData = useCallback(
    async (data: TData) => {
      try {
        // Casting seguro - asumimos que el usuario pasó una DataQueue
        const dataQueue = queueInstance as any;
        if (dataQueue.addData) {
          await dataQueue.addData(data);
          // Forzar actualización del estado
          setTimeout(() => {
            // El intervalo se encargará de actualizar el estado
          }, 50);
        } else {
          console.error("La cola no es una DataQueue - use add() en su lugar");
        }
      } catch (error) {
        console.error("Error adding data to queue:", error);
      }
    },
    [queueInstance]
  );

  const addMultipleData = useCallback(
    async (dataList: TData[]) => {
      try {
        const dataQueue = queueInstance as any;
        if (dataQueue.addMultipleData) {
          await dataQueue.addMultipleData(dataList);
          setTimeout(() => {
            // El intervalo se encargará de actualizar el estado
          }, 50);
        } else {
          console.error(
            "La cola no es una DataQueue - use addMultiple() en su lugar"
          );
        }
      } catch (error) {
        console.error("Error adding multiple data to queue:", error);
      }
    },
    [queueInstance]
  );

  return {
    ...baseHook,
    // Acciones específicas para datos
    addData,
    addMultipleData,
  };
}


// ==================== EJEMPLOS DE USO ====================

/*
// Ejemplo 1: Cola para sincronizar con servidor
const SyncComponent: React.FC = () => {
  const syncQueue = useMemo(() => 
    new LocalStorageDataQueue('attendance_sync', async (data) => {
      await fetch('/api/sync', { 
        method: 'POST', 
        body: JSON.stringify(data) 
      });
    }), []
  );

  const { isProcessing, queueSize, isReleased, actions } = useQueue(syncQueue, {
    autoLoad: true,
    autoStart: true
  });

  const handleSyncData = async () => {
    await actions.add({
      studentId: '123',
      status: 'present',
      timestamp: Date.now()
    });
  };

  return (
    <div>
      <p>Estado: {isProcessing ? 'Sincronizando...' : 'Inactivo'}</p>
      <p>Pendientes: {queueSize}</p>
      <p>Completado: {isReleased ? 'Sí' : 'No'}</p>
      
      <button onClick={handleSyncData}>Agregar Datos</button>
      <button onClick={actions.start}>Iniciar</button>
      <button onClick={actions.pause}>Pausar</button>
      <button onClick={actions.stop}>Detener</button>
    </div>
  );
};

// Ejemplo 2: Cola de funciones simple
const OperationsComponent: React.FC = () => {
  const funcQueue = useMemo(() => new MemoryFunctionQueue(), []);
  
  const { isProcessing, queueSize, actions } = useQueue(funcQueue);

  const addOperation = async () => {
    await actions.add(async () => {
      // Cualquier operación asíncrona
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log('Operación completada');
    });
  };

  return (
    <div>
      <p>Procesando: {isProcessing}</p>
      <p>Operaciones pendientes: {queueSize}</p>
      <button onClick={addOperation}>Agregar Operación</button>
    </div>
  );
};

// Ejemplo 3: Con hook especializado para datos
const DataSyncComponent: React.FC = () => {
  const dataQueue = useMemo(() => 
    new LocalStorageDataQueue('data_sync', sendToServer), []
  );
  
  const { isProcessing, queueSize, addData, addMultipleData } = useDataQueue(dataQueue);

  return (
    <div>
      <p>Sincronizando: {isProcessing}</p>
      <p>Elementos: {queueSize}</p>
      <button onClick={() => addData({ id: 1, name: 'test' })}>
        Agregar Datos
      </button>
    </div>
  );
};
*/
