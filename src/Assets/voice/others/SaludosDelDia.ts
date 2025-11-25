export enum PeriodoDia {
  MORNING = "Morning",
  AFTERNOON = "Afternoon",
  NIGHT = "Night",
}

export const saludosDia: Record<PeriodoDia, string> = {
  [PeriodoDia.MORNING]: "Good morning",
  [PeriodoDia.AFTERNOON]: "Good afternoon",
  [PeriodoDia.NIGHT]: "Good evening",
};