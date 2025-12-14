export enum DiasSemana {
  Sunday = 0,
  Monday = 1,
  Tuesday = 2,
  Wednesday = 3,
  Thursday = 4,
  Friday = 5,
  Saturday = 6,
}

export const diasSemanaTextos: Record<DiasSemana, string> = {
  [DiasSemana.Sunday]: "Sunday",
  [DiasSemana.Monday]: "Monday",
  [DiasSemana.Tuesday]: "Tuesday",
  [DiasSemana.Wednesday]: "Wednesday",
  [DiasSemana.Thursday]: "Thursday",
  [DiasSemana.Friday]: "Friday",
  [DiasSemana.Saturday]: "Saturday",
};

export const diasSemanaTextosCortos: Record<DiasSemana, string> = {
  [DiasSemana.Sunday]: "Sun",
  [DiasSemana.Monday]: "Mon",
  [DiasSemana.Tuesday]: "Tue",
  [DiasSemana.Wednesday]: "Wed",
  [DiasSemana.Thursday]: "Thu",
  [DiasSemana.Friday]: "Fri",
  [DiasSemana.Saturday]: "Sat",
};
