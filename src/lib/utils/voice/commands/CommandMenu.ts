import { CommandVoice } from "./CommandVoice";
import { Speaker } from "../Speaker";
import { Listener } from "../Listener";

export class CommandMenu {
  private speaker: Speaker = Speaker.getInstance();
  private listener: Listener = Listener.getInstance(); // / Usamos Lisner

  constructor(
    private presentationText: string,
    private commandVoices: CommandVoice[],
    private callbackPresentationText?: (currentPath: string) => string
  ) {}

  start(currentPath?: string) {
    if (typeof window === "undefined") return;

    if (
      !("SpeechRecognition" in window || "webkitSpeechRecognition" in window)
    ) {
      this.speaker.start(
        "Lo siento, tu navegador no es compatible con los comandos de voz."
      );
      return;
    }

    const handleResult = async (transcript: string) => {
      console.log(transcript);

      for (let i = 0; i < this.commandVoices.length; i++) {
        if (this.commandVoices[i].testTranscrip(transcript)) {
          // // Hacndo uso de la recursividad
          const handleLoop = (loop: boolean | null) => {
            if (this.commandVoices[i].finalPhrase) {
              // // this.lisner.stop();
              this.speaker.start(this.commandVoices[i].finalPhrase!, () => {
                if (loop) {
                  this.commandVoices[i].action().then(handleLoop);
                }
              });
            }

            if (loop) {
              this.commandVoices[i].action().then(handleLoop);
            }
          };

          this.commandVoices[i].action().then(handleLoop);

          return;
        }
      }

      this.speaker.start("Comando no reconocido. Intenta nuevamente.");
    };

    if (this.callbackPresentationText && currentPath) {
      this.presentationText = this.callbackPresentationText(currentPath);
    }

    const startVoiceRecognition = () => {
      this.speaker.start(this.presentationText, () => {
        this.listener.start(handleResult); // /nicia Listener con el callback de resultado
      });
    };

    // // Ejecuta elnicio del reconocimiento de voz
    startVoiceRecognition();
  }
}
