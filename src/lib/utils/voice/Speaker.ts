export class Speaker {
  private static instance: Speaker | null = null;
  private synth: SpeechSynthesis;

  private interrumpible: boolean = true;
  public currentCallback?: () => void;
  private callbackStop?: () => void;
  private callbackStart?: () => void;

  // Private constructor to prevent direct instantiation
  private constructor() {
    if (!window?.speechSynthesis) {
      throw new Error("SpeechSynthesis is not available in this browser.");
    }
    this.synth = window.speechSynthesis;
  }

  // Method to get the unique instance
  public static getInstance(): Speaker {
    if (!Speaker.instance) {
      Speaker.instance = new Speaker();
    }
    return Speaker.instance;
  }

  /**
   * This method plays the voice message.
   * @param message Text to synthesize.
   * @param callback Optional function to execute when synthesis ends.
   * @param interrumpible Indicates if the synthesis can be interrupted.
   * @returns The SpeechSynthesis object if interruptible, or undefined if not.
   */
  public start(
    message: string,
    callback?: () => void,
    interrumpible: boolean = true
  ) {
    if (!this.interrumpible) return;

    this.stop();

    this.interrumpible = interrumpible;


    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "es-ES";
    this.currentCallback = callback;
    // When synthesis ends, speaking is set to false and the callback is executed
    utterance.onend = () => {

      this.callbackStop?.();
      callback?.();
    };
    this.synth.speak(utterance);
    
    this.callbackStart?.();
  }

  /**
   * Method to interrupt ongoing voice synthesis
   * @param omitToCallback This parameter specifies if a callback should be executed after the speaker stops
   */
  public stop(omitToCallback: boolean = false) {
    if (this.interrumpible) {
      this.synth.cancel();
      this.callbackStop?.();

      if (omitToCallback) {
        this.currentCallback?.();
      }
    }
  }

  set onStop(callback: () => void) {
    this.callbackStop = callback;
  }

  set onStart(callback: () => void) {
    this.callbackStart = callback;
  }

  public silenceOmit() {}
}
