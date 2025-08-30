export enum VIBRATIONS {
  SHORT = 200,
  MEDIUM = 500,
  LONG = 800,
}

export class Vibrator {
  private isSupported: boolean;

  constructor() {
    // Verificar si la API de vibración está disponible
    this.isSupported = "vibrate" in navigator;

    // Mostrar advertencia si no está soportado
    if (!this.isSupported) {
      console.warn(
        "Vibration API no está soportada en este dispositivo/navegador"
      );
    }
  }

  /**
   * Ejecuta una vibración simple por una duración específica
   * @param duration Duración en milisegundos
   * @returns boolean - true si se ejecutó correctamente, false si no está soportado
   */
  vibrate(duration: number): boolean {
    if (!this.isSupported) {
      console.warn("Vibración no soportada - simulando vibración");
      return false;
    }

    try {
      // Validar que la duración sea un número positivo
      if (duration <= 0) {
        console.warn("Duración de vibración debe ser mayor a 0");
        return false;
      }

      navigator.vibrate(duration);
      return true;
    } catch (error) {
      console.error("Error al ejecutar vibración:", error);
      return false;
    }
  }

  /**
   * Ejecuta un patrón de vibración personalizado
   * @param pattern Array alternando duración de vibración y pausa [vibrar, pausa, vibrar, pausa, ...]
   * @example vibratePattern([200, 100, 200, 100, 500]) - vibra 200ms, pausa 100ms, vibra 200ms, pausa 100ms, vibra 500ms
   */
  vibratePattern(pattern: number[]): boolean {
    if (!this.isSupported) {
      console.warn("Vibración no soportada - simulando patrón");
      return false;
    }

    try {
      if (!Array.isArray(pattern) || pattern.length === 0) {
        console.warn("Patrón de vibración debe ser un array no vacío");
        return false;
      }

      navigator.vibrate(pattern);
      return true;
    } catch (error) {
      console.error("Error al ejecutar patrón de vibración:", error);
      return false;
    }
  }

  /**
   * Detiene cualquier vibración en curso
   */
  stop(): boolean {
    if (!this.isSupported) {
      console.warn("Vibración no soportada");
      return false;
    }

    try {
      navigator.vibrate(0); // 0 detiene la vibración
      return true;
    } catch (error) {
      console.error("Error al detener vibración:", error);
      return false;
    }
  }

  /**
   * Vibración de confirmación (patrón corto-corto)
   * Útil para confirmar acciones como marcar asistencia
   */
  vibrateConfirmation(): boolean {
    return this.vibratePattern([100, 50, 100]);
  }

  /**
   * Vibración de error (patrón largo-corto-corto)
   * Útil para indicar errores o acciones inválidas
   */
  vibrateError(): boolean {
    return this.vibratePattern([400, 100, 100, 50, 100]);
  }

  /**
   * Vibración de éxito (patrón ascendente)
   * Útil para confirmar operaciones exitosas
   */
  vibrateSuccess(): boolean {
    return this.vibratePattern([150, 75, 200, 75, 300]);
  }

  /**
   * Vibración de alerta suave
   * Útil para notificaciones no críticas
   */
  vibrateAlert(): boolean {
    return this.vibratePattern([200, 200, 200, 200, 200]);
  }

  /**
   * Verifica si la vibración está soportada en el dispositivo
   */
  isVibrationSupported(): boolean {
    return this.isSupported;
  }
}

// Instancia singleton para usar en toda la aplicación
export const vibrator = new Vibrator();
