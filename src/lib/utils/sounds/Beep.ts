import { Oscillator } from "./Oscilador";

export class Beep extends Oscillator {
  beepSuccess(waveType: OscillatorType = "sine"): void {
    this.playTone(800, 200, waveType);
  }

  beepError(waveType: OscillatorType = "sine"): void {
    this.playTone(300, 500, waveType);
  }
}

export const beep = new Beep();
