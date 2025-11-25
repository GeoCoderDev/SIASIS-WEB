import {
  IWindow,
  SpeechRecognition,
  SpeechRecognitionEvent,
} from "./commands/CommandVoices.interface";
import { Speaker } from "./Speaker";

export class Listener {
  private static instance: Listener | null = null;
  private interrumpible: boolean = true;
  public currentCallbackOnResult?: (transcript: string) => void;
  private callbackStop?: () => void;
  private callbackStart?: () => void;
  private speaker: Speaker = Speaker.getInstance();
  private currentRecognizer?: SpeechRecognition;
  private constructor() {}

  // Method to get the unique instance of Listener
  public static getInstance(): Listener {
    if (!Listener.instance) {
      Listener.instance = new Listener();
    }
    return Listener.instance;
  }

  /**
   * Starts voice recognition.
   * @param callback Optional function to execute with the synthesis result.
   */
  public start(
    callback?: (transcript: string) => void,
    interrumpible: boolean = true
  ) {
    if (!this.interrumpible) return;

    this.interrumpible = interrumpible;
    this.currentCallbackOnResult = callback;

    const windowWithSpeech = window as unknown as IWindow;
    const SpeechRecognition =
      windowWithSpeech.SpeechRecognition ||
      windowWithSpeech.webkitSpeechRecognition;

    // Create a new SpeechRecognition instance every time start is called
    const recognition = new SpeechRecognition();
    this.currentRecognizer = recognition;
    recognition.lang = "es-ES";
    recognition.interimResults = false; // Only final results
    recognition.continuous = false; // Stop after a single result

    // Handling the event when a result is produced
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = event.results[0][0].transcript;
      transcript = transcript.replace(/\.$/, ""); // Remove the final period if it exists
      transcript = transcript.toLowerCase();
      this.currentCallbackOnResult?.(transcript);
    };

    recognition.onend = () => {
      // this.callbackStop?.();
    };

    // Event that fires when no sound is detected or the user remains silent
    recognition.onsoundend = () => {
      this.callbackStop?.();
      // this.speaker.start("No sound was detected. Try speaking again.");
    };

    recognition.onerror = (event) => {
      try {
        if (event.error === "aborted") {
          console.log(
            "Voice recognition was intentionally aborted."
          );
        } else {
          this.speaker.start(
            "An error occurred while recognizing your voice. Please try again.",
            () => {
              this.callbackStop?.();
            }
          );
        }
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        alert("An error occurred while recognizing your voice. Please try again.");
        this.callbackStop?.();
      }
    };

    recognition.start();
    this.callbackStart?.();
  }

  set onStop(callback: () => void) {
    this.callbackStop = callback;
  }
  set onStart(callback: () => void) {
    this.callbackStart = callback;
  }

  /**
   * Method to interrupt ongoing voice recognition
   */
  public stop() {
    this.callbackStop?.();
    this.currentRecognizer?.abort();
    // No need to call `recognition.stop()` because a new instance is created on each `start`
  }
}
