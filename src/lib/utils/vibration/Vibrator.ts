export enum VIBRATIONS {
  SHORT = 200,
  MEDIUM = 500,
  LONG = 800,
}

export class Vibrator {
  private isSupported: boolean;

  constructor() {
    // Check if the vibration API is available
    this.isSupported = "vibrate" in navigator;

    // Show warning if not supported
    if (!this.isSupported) {
      console.warn(
        "Vibration API is not supported on this device/browser"
      );
    }
  }

  /**
   * Executes a simple vibration for a specific duration
   * @param duration Duration in milliseconds
   * @returns boolean - true if executed successfully, false if not supported
   */
  vibrate(duration: number): boolean {
    if (!this.isSupported) {
      console.warn("Vibration not supported - simulating vibration");
      return false;
    }

    try {
      // Validate that the duration is a positive number
      if (duration <= 0) {
        console.warn("Vibration duration must be greater than 0");
        return false;
      }

      navigator.vibrate(duration);
      return true;
    } catch (error) {
      console.error("Error executing vibration:", error);
      return false;
    }
  }

  /**
   * Executes a custom vibration pattern
   * @param pattern Array alternating vibration duration and pause [vibrate, pause, vibrate, pause, ...]
   * @example vibratePattern([200, 100, 200, 100, 500]) - vibrates 200ms, pauses 100ms, vibrates 200ms, pauses 100ms, vibrates 500ms
   */
  vibratePattern(pattern: number[]): boolean {
    if (!this.isSupported) {
      console.warn("Vibration not supported - simulating pattern");
      return false;
    }

    try {
      if (!Array.isArray(pattern) || pattern.length === 0) {
        console.warn("Vibration pattern must be a non-empty array");
        return false;
      }

      navigator.vibrate(pattern);
      return true;
    } catch (error) {
      console.error("Error executing vibration pattern:", error);
      return false;
    }
  }

  /**
   * Stops any ongoing vibration
   */
  stop(): boolean {
    if (!this.isSupported) {
      console.warn("Vibration not supported");
      return false;
    }

    try {
      navigator.vibrate(0); // 0 stops the vibration
      return true;
    } catch (error) {
      console.error("Error stopping vibration:", error);
      return false;
    }
  }

  /**
   * Confirmation vibration (short-short pattern)
   * Useful for confirming actions like marking attendance
   */
  vibrateConfirmation(): boolean {
    return this.vibratePattern([100, 50, 100]);
  }

  /**
   * Error vibration (long-short-short pattern)
   * Useful for indicating errors or invalid actions
   */
  vibrateError(): boolean {
    return this.vibratePattern([400, 100, 100, 50, 100]);
  }

  /**
   * Success vibration (ascending pattern)
   * Useful for confirming successful operations
   */
  vibrateSuccess(): boolean {
    return this.vibratePattern([150, 75, 200, 75, 300]);
  }

  /**
   * Soft alert vibration
   * Useful for non-critical notifications
   */
  vibrateAlert(): boolean {
    return this.vibratePattern([200, 200, 200, 200, 200]);
  }

  /**
   * Checks if vibration is supported on the device
   */
  isVibrationSupported(): boolean {
    return this.isSupported;
  }
}

// Singleton instance for use throughout the application
export const vibrator = new Vibrator();
