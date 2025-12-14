import { Socket } from "socket.io";

// 🔧 Constant to enable/disable logs
const ENABLE_SOCKET_LOGS = false; // Change to false to disable logs

export class SocketEmitter<T> {
  constructor(
    private socketConnection: Socket | SocketIOClient.Socket,
    private eventName: string,
    private data?: T
  ) {}

  execute(): boolean {
    try {
      // Verify that the connection exists and is connected
      if (!this.socketConnection) {
        if (ENABLE_SOCKET_LOGS) {
          console.error(
            `❌ [SocketEmitter] No connection available for event: ${this.eventName}`
          );
        }
        return false;
      }

      if (!this.socketConnection.connected) {
        if (ENABLE_SOCKET_LOGS) {
          console.error(
            `❌ [SocketEmitter] Socket not connected for event: ${this.eventName}`
          );
        }
        return false;
      }

      // If there's data, send it; if not, send event without payload
      if (this.data !== undefined) {
        // Don't serialize to JSON here, leave it as object
        this.socketConnection.emit(this.eventName, this.data);
        if (ENABLE_SOCKET_LOGS) {
          console.log(
            `📤 [SocketEmitter] Event sent: ${this.eventName}`,
            this.data
          );
        }
      } else {
        this.socketConnection.emit(this.eventName);
        if (ENABLE_SOCKET_LOGS) {
          console.log(
            `📤 [SocketEmitter] Event sent: ${this.eventName} (without payload)`
          );
        }
      }

      return true;
    } catch (error) {
      if (ENABLE_SOCKET_LOGS) {
        console.error(
          `❌ [SocketEmitter] Error sending event ${this.eventName}:`,
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
    private eventName: string,
    private callback: (data: T) => void
  ) {}

  hand(): boolean {
    try {
      // Verify that the connection exists
      if (!this.socketConnection) {
        if (ENABLE_SOCKET_LOGS) {
          console.error(
            `❌ [SocketHandler] No connection available for event: ${this.eventName}`
          );
        }
        return false;
      }

      // Avoid duplicate listeners
      if (this.listenerAttached) {
        if (ENABLE_SOCKET_LOGS) {
          console.warn(
            `⚠️ [SocketHandler] Listener is already registered for: ${this.eventName}`
          );
        }
        return true;
      }
      // Wrapper for logging and error handling
      this._wrappedCallback = (data: string) => {
        try {
          if (ENABLE_SOCKET_LOGS) {
            console.log(
              `📥 [SocketHandler] Event received: ${this.eventName}`,
              data
            );
          }
          this.callback(JSON.parse(data) as T);
        } catch (error) {
          if (ENABLE_SOCKET_LOGS) {
            console.error(
              `❌ [SocketHandler] Error in callback for ${this.eventName}:`,
              error
            );
          }
        }
      };

      this.socketConnection.on(this.eventName, this._wrappedCallback);
      this.listenerAttached = true;
      if (ENABLE_SOCKET_LOGS) {
        console.log(
          `✅ [SocketHandler] Listener registered for: ${this.eventName}`
        );
      }

      return true;
    } catch (error) {
      if (ENABLE_SOCKET_LOGS) {
        console.error(
          `❌ [SocketHandler] Error registering listener for ${this.eventName}:`,
          error
        );
      }
      return false;
    }
  }

  // Method to remove the listener
  unhand(): boolean {
    try {
      if (!this.socketConnection || !this.listenerAttached) {
        return false;
      }
      if (this._wrappedCallback) {
        this.socketConnection.off(this.eventName, this._wrappedCallback);
        this._wrappedCallback = undefined;
      }
      this.listenerAttached = false;
      if (ENABLE_SOCKET_LOGS) {
        console.log(
          `🗑️ [SocketHandler] Listener removed for: ${this.eventName}`
        );
      }

      return true;
    } catch (error) {
      if (ENABLE_SOCKET_LOGS) {
        console.error(
          `❌ [SocketHandler] Error removing listener for ${this.eventName}:`,
          error
        );
      }
      return false;
    }
  }

  // Getter to check if the listener is active
  get isListening(): boolean {
    return this.listenerAttached;
  }
}
