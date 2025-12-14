import {
  SocketHandler,
  SocketEmitter,
} from "../../../../utils/SocketsUnitario";
import { NombresEventosTomaAsistenciaDePersonalSS01 } from "../interfaces/NombresEventosAsistenciaDePersonal";
import {
  ELIMINE_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD,
  SALUDAME_PAYLOAD,
  SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD,
  SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD,
  UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_PAYLOAD,
} from "../interfaces/PayloadEventosAsisteciaDePersonal";
import { SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935 } from "../interfaces/SalasTomaAsistenciaDePersonal";
import { MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD } from "../interfaces/PayloadEventosAsisteciaDePersonal";

export class TomaAsistenciaPersonalSIU01Events {
  public static socketConnection: SocketIOClient.Socket | null = null;

  // Método para verificar si hay conexión disponible
  private static checkConnection(): boolean {
    if (!this.socketConnection) {
      console.error(
        "❌ [TomaAsistenciaPersonalSIU01Events] No hay conexión Socket.IO disponible"
      );
      return false;
    }
    if (!this.socketConnection.connected) {
      console.error(
        "❌ [TomaAsistenciaPersonalSIU01Events] Socket.IO no está conectado"
      );
      return false;
    }
    return true;
  }

  static SALUDAME_SOCKET_EMITTER = class {
    private socketEmitter: SocketEmitter<SALUDAME_PAYLOAD> | null = null;

    constructor() {
      if (TomaAsistenciaPersonalSIU01Events.checkConnection()) {
        this.socketEmitter = new SocketEmitter<SALUDAME_PAYLOAD>(
          TomaAsistenciaPersonalSIU01Events.socketConnection!,
          NombresEventosTomaAsistenciaDePersonalSS01.SALUDAME
        );
      }
    }

    execute(): boolean {
      if (!this.socketEmitter) {
        console.error(
          "❌ [SALUDAME_SOCKET_EMITTER] No se pudo inicializar el emisor"
        );
        return false;
      }

      try {
        this.socketEmitter.execute();
        console.log(
          "✅ [SALUDAME_SOCKET_EMITTER] Evento enviado correctamente"
        );
        return true;
      } catch (error) {
        console.error(
          "❌ [SALUDAME_SOCKET_EMITTER] Error al enviar evento:",
          error
        );
        return false;
      }
    }
  };

  static RESPUESTA_SALUDO_HANDLER = class {
    private socketHandler: SocketHandler<SALUDAME_PAYLOAD> | null = null;

    constructor(callback: (saludo: SALUDAME_PAYLOAD) => void) {
      if (TomaAsistenciaPersonalSIU01Events.checkConnection()) {
        this.socketHandler = new SocketHandler<SALUDAME_PAYLOAD>(
          TomaAsistenciaPersonalSIU01Events.socketConnection!,
          NombresEventosTomaAsistenciaDePersonalSS01.RESPUESTA_SALUDO,
          callback
        );
      }
    }

    hand(): boolean {
      if (!this.socketHandler) {
        console.error(
          "❌ [RESPUESTA_SALUDO_HANDLER] No se pudo inicializar el handler"
        );
        return false;
      }

      try {
        this.socketHandler.hand();
        console.log(
          "✅ [RESPUESTA_SALUDO_HANDLER] Event listener registrado correctamente"
        );
        return true;
      } catch (error) {
        console.error(
          "❌ [RESPUESTA_SALUDO_HANDLER] Error al registrar listener:",
          error
        );
        return false;
      }
    }

    // Método para limpiar el listener
    unhand(): boolean {
      if (!this.socketHandler) {
        return false;
      }

      try {
        // Asumir que SocketHandler tiene un método para limpiar
        if (TomaAsistenciaPersonalSIU01Events.socketConnection) {
          TomaAsistenciaPersonalSIU01Events.socketConnection.off(
            NombresEventosTomaAsistenciaDePersonalSS01.RESPUESTA_SALUDO
          );
          console.log(
            "✅ [RESPUESTA_SALUDO_HANDLER] Event listener removido correctamente"
          );
        }
        return true;
      } catch (error) {
        console.error(
          "❌ [RESPUESTA_SALUDO_HANDLER] Error al remover listener:",
          error
        );
        return false;
      }
    }
  };

  static UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_EMITTER = class {
    private socketEmitter: SocketEmitter<UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_PAYLOAD> | null =
      null;

    constructor(
      Sala_Toma_Asistencia_de_Personal: SALAS_TOMA_ASISTENCIA_PERSONAL_IE20935
    ) {
      if (TomaAsistenciaPersonalSIU01Events.checkConnection()) {
        this.socketEmitter =
          new SocketEmitter<UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_PAYLOAD>(
            TomaAsistenciaPersonalSIU01Events.socketConnection!,
            NombresEventosTomaAsistenciaDePersonalSS01.UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL,
            { Sala_Toma_Asistencia_de_Personal }
          );
      }
    }

    execute(): boolean {
      if (!this.socketEmitter) {
        console.error(
          "❌ [UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_EMITTER] No se pudo inicializar el emisor"
        );
        return false;
      }

      try {
        this.socketEmitter.execute();
        console.log(
          "✅ [UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_EMITTER] Evento enviado correctamente"
        );
        return true;
      } catch (error) {
        console.error(
          "❌ [UNIRME_A_SALA_DE_TOMA_DE_ASISTENCIA_DE_PERSONAL_EMITTER] Error al enviar evento:",
          error
        );
        return false;
      }
    }
  };

  static MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER = class {
    private socketEmitter: SocketEmitter<MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD> | null =
      null;

    constructor(data: MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD) {
      if (TomaAsistenciaPersonalSIU01Events.checkConnection()) {
        this.socketEmitter =
          new SocketEmitter<MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD>(
            TomaAsistenciaPersonalSIU01Events.socketConnection!,
            NombresEventosTomaAsistenciaDePersonalSS01.MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL,
            data
          );
      }
    }

    execute(): boolean {
      if (!this.socketEmitter) {
        console.error(
          "❌ [MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER] No se pudo inicializar el emisor"
        );
        return false;
      }

      try {
        this.socketEmitter.execute();
        console.log(
          "✅ [MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER] Evento enviado correctamente"
        );
        return true;
      } catch (error) {
        console.error(
          "❌ [MARQUE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER] Error al enviar evento:",
          error
        );
        return false;
      }
    }
  };

  static ELIMINE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER = class {
    private socketEmitter: SocketEmitter<ELIMINE_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD> | null =
      null;

    constructor(data: ELIMINE_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD) {
      if (TomaAsistenciaPersonalSIU01Events.checkConnection()) {
        this.socketEmitter =
          new SocketEmitter<ELIMINE_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD>(
            TomaAsistenciaPersonalSIU01Events.socketConnection!,
            NombresEventosTomaAsistenciaDePersonalSS01.ELIMINE_LA_ASISTENCIA_DE_ESTE_PERSONAL,
            data
          );
      }
    }

    execute(): boolean {
      if (!this.socketEmitter) {
        console.error(
          "❌ [ELIMINE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER] No se pudo inicializar el emisor"
        );
        return false;
      }

      try {
        this.socketEmitter.execute();
        console.log(
          "✅ [ELIMINE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER] Evento enviado correctamente"
        );
        return true;
      } catch (error) {
        console.error(
          "❌ [ELIMINE_LA_ASISTENCIA_DE_ESTE_PERSONAL_EMITTER] Error al enviar evento:",
          error
        );
        return false;
      }
    }
  };

  static SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER = class {
    private socketHandler: SocketHandler<SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD> | null =
      null;

    constructor(
      callback: (
        data: SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD
      ) => void
    ) {
      if (TomaAsistenciaPersonalSIU01Events.checkConnection()) {
        this.socketHandler =
          new SocketHandler<SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD>(
            TomaAsistenciaPersonalSIU01Events.socketConnection!,
            NombresEventosTomaAsistenciaDePersonalSS01.SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL,
            callback
          );
      }
    }

    hand(): boolean {
      if (!this.socketHandler) {
        console.error(
          "❌ [SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER] No se pudo inicializar el handler"
        );
        return false;
      }

      try {
        this.socketHandler.hand();
        console.log(
          "✅ [SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER] Event listener registrado correctamente"
        );
        return true;
      } catch (error) {
        console.error(
          "❌ [SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER] Error al registrar listener:",
          error
        );
        return false;
      }
    }

    // Método para limpiar el listener
    unhand(): boolean {
      if (!this.socketHandler) {
        return false;
      }

      try {
        // Asumir que SocketHandler tiene un método para limpiar
        if (TomaAsistenciaPersonalSIU01Events.socketConnection) {
          TomaAsistenciaPersonalSIU01Events.socketConnection.off(
            NombresEventosTomaAsistenciaDePersonalSS01.SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL
          );
          console.log(
            "✅ [SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER] Event listener removido correctamente"
          );
        }
        return true;
      } catch (error) {
        console.error(
          "❌ [SE_ACABA_DE_MARCAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER] Error al remover listener:",
          error
        );
        return false;
      }
    }
  };

  static SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER = class {
    private socketHandler: SocketHandler<SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD> | null =
      null;

    constructor(
      callback: (
        data: SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD
      ) => void
    ) {
      if (TomaAsistenciaPersonalSIU01Events.checkConnection()) {
        this.socketHandler =
          new SocketHandler<SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_PAYLOAD>(
            TomaAsistenciaPersonalSIU01Events.socketConnection!,
            NombresEventosTomaAsistenciaDePersonalSS01.SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL,
            callback
          );
      }
    }

    hand(): boolean {
      if (!this.socketHandler) {
        console.error(
          "❌ [SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER] No se pudo inicializar el handler"
        );
        return false;
      }

      try {
        this.socketHandler.hand();
        console.log(
          "✅ [SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER] Event listener registrado correctamente"
        );
        return true;
      } catch (error) {
        console.error(
          "❌ [SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER] Error al registrar listener:",
          error
        );
        return false;
      }
    }

    // Método para limpiar el listener
    unhand(): boolean {
      if (!this.socketHandler) {
        return false;
      }

      try {
        // Asumir que SocketHandler tiene un método para limpiar
        if (TomaAsistenciaPersonalSIU01Events.socketConnection) {
          TomaAsistenciaPersonalSIU01Events.socketConnection.off(
            NombresEventosTomaAsistenciaDePersonalSS01.SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL
          );
          console.log(
            "✅ [SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER] Event listener removido correctamente"
          );
        }
        return true;
      } catch (error) {
        console.error(
          "❌ [SE_ACABA_DE_ELIMINAR_LA_ASISTENCIA_DE_ESTE_PERSONAL_HANDLER] Error al remover listener:",
          error
        );
        return false;
      }
    }
  };

  // Método estático para limpiar todos los listeners
  static cleanup(): void {
    if (this.socketConnection) {
      this.socketConnection.removeAllListeners();
      console.log(
        "🧹 [TomaAsistenciaPersonalSIU01Events] Todos los listeners limpiados"
      );
    }
  }

  // Método para verificar el estado de la conexión
  static getConnectionStatus(): {
    hasConnection: boolean;
    isConnected: boolean;
    socketId?: string;
  } {
    return {
      hasConnection: !!this.socketConnection,
      isConnected: this.socketConnection?.connected || false,
      socketId: this.socketConnection?.id,
    };
  }
}
