export class CommandVoice {
  // // public static callback1?: (searcherResults: SubseccnSearchResult[]) => void;
  public static getCurrentPath?: () => string;

  // // public static iterateNext: booln = false;
  constructor(
    private variantCommands: string[],
    public action: () => Promise<null | boolean>,
    public finalPhrase?: string
  ) {}

  testTranscrip(transcript: string) {
    return this.variantCommands.includes(transcript);
  }
}
