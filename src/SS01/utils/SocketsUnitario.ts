import { Socket } from "socket.io";

// 🔧 Constant to enable/disable logs
const ENABLE_SOCKET_LOGS = false; // Change to false to disable logs

export class SocketEmitter<T> {
  constructor(
    private socketConnection: Socket | SocketIOClient.Socket,
    private nombreEvento: string,
    private data?: T
  ) {}

  execute(): boolean {
    try {
      // Verify that the connection exists and is connected
      if (!this.socketConnection) {
        if (ENABLE_SOCKET_LOGS) {
          console.error(
            `❌ [SocketEmitter] No hay conexión disponible para evento: ${this.nombreEvento}`
          );
        }
        return false;
      }

      if (!this.socketConnection.connected) {
        if (ENABLE_SOCKET_LOGS) {
          console.error(
            `❌ [SocketEmitter] Socket no conectado para evento: ${this.nombreEvento}`
          );
        }
        return false;
      }

      // If there is data, send it; if not, send event without payload
      if (this.data !== undefined) {
        // Do not serialize to JSON here, leave it as an object
        this.socketConnection.emit(this.nombreEvento, this.data);
        if (ENABLE_SOCKET_LOGS) {
          console.log(
            `📤 [SocketEmitter] Evento enviado: ${this.nombreEvento}`,
            this.data
          );
        }
      } else {
        this.socketConnection.emit(this.nombreEvento);
        if (ENABLE_SOCKET_LOGS) {
          console.log(
            `📤 [SocketEmitter] Evento enviado: ${this.nombreEvento} (sin payload)`
          );
        }
      }

      return true;
    } catch (error) {
      if (ENABLE_SOCKET_LOGS) {
        console.error(
          `❌ [SocketEmitter] Error al enviar evento ${this.nombreEvento}:`,
          error
        );
      }
      return false;
    }
  }
}

export class SocketHandler<T> {
  private listenerAttached: boolean = false;
  private _wrappedCallback?: (data: string) => void;

  constructor(
    private socketConnection: Socket | SocketIOClient.Socket,
    private nombreEvento: string,
    private callback: (data: T) => void
  ) {}

  hand(): boolean {
    try {
      // Verify that the connection exists
      if (!this.socketConnection) {
        if (ENABLE_SOCKET_LOGS) {
          console.error(
            `❌ [SocketHandler] No hay conexión disponible para evento: ${this.nombreEvento}`
          );
        }
        return false;
      }

      // Avoid duplicate listeners
      if (this.listenerAttached) {
        if (ENABLE_SOCKET_LOGS) {
          console.warn(
            `⚠️ [SocketHandler] Listener ya está registrado para: ${this.nombreEvento}`
          );
        }
        return true;
      }
      // Wrapper for logging and error handling
      this._wrappedCallback = (data: string) => {
        try {
          if (ENABLE_SOCKET_LOGS) {
            console.log(
              `📥 [SocketHandler] Evento recibido: ${this.nombreEvento}`,
              data
            );
          }
          this.callback(JSON.parse(data) as T);
        } catch (error) {
          if (ENABLE_SOCKET_LOGS) {
            console.error(
              `❌ [SocketHandler] Error en callback para ${this.nombreEvento}:`,
              error
            );
          }
        }
      };

      this.socketConnection.on(this.nombreEvento, this._wrappedCallback);
      this.listenerAttached = true;
      if (ENABLE_SOCKET_LOGS) {
        console.log(
          `✅ [SocketHandler] Listener registrado para: ${this.nombreEvento}`
        );
      }

      return true;
    } catch (error) {
      if (ENABLE_SOCKET_LOGS) {
        console.error(
          `❌ [SocketHandler] Error al registrar listener para ${this.nombreEvento}:`,
          error
        );
      }
      return false;
    }
  }

  // Método para remover el listener
  unhand(): boolean {
    try {
      if (!this.socketConnection || !this.listenerAttached) {
        return false;
      }
      if (this._wrappedCallback) {
        this.socketConnection.off(this.nombreEvento, this._wrappedCallback);
        this._wrappedCallback = undefined;
      }
      this.listenerAttached = false;
      if (ENABLE_SOCKET_LOGS) {
        console.log(
          `🗑️ [SocketHandler] Listener removido para: ${this.nombreEvento}`
        );
      }

      return true;
    } catch (error) {
      if (ENABLE_SOCKET_LOGS) {
        console.error(
          `❌ [SocketHandler] Error al remover listener para ${this.nombreEvento}:`,
          error
        );
      }
      return false;
    }
  }

  // Getter para verificar si el listener está activo
  get isListening(): boolean {
    return this.listenerAttached;
  }
}