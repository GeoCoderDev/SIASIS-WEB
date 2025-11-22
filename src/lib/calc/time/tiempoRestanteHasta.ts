import { FechaHoraActualRealState } from "@/global/state/others/fechaHoraActualReal";

export interface TiempoRestante {
  total: number;
  dias: number;
  horas: number;
  minutos: number;
  segundos: number;
  yaVencido: boolean;
  formateado: string;
  // New fields
  formatoCorto: string; // Example: "2d 5h 30m"
  porcentajeCompletado: number; // 0-100, useful for progress bars
  enRango: boolean; // true if time is within a specified range
}

// Selector function to get remaining time until a target date
export const tiempoRestanteHasta = (
  state: { fechaHoraActualReal: FechaHoraActualRealState },
  fechaObjetivoPeruana: string | Date,
  fechaInicio?: string | Date
): TiempoRestante | null => {
  if (!state.fechaHoraActualReal.fechaHora) return null;

  // We use the current date directly without additional timezone transformations
  const fechaActual = fechaInicio
    ? typeof fechaInicio === "string"
      ? new Date(fechaInicio)
      : fechaInicio
    : new Date(state.fechaHoraActualReal.fechaHora);

  // Convert the target date to a Date object
  const fechaObjetivoObj =
    typeof fechaObjetivoPeruana === "string"
      ? new Date(fechaObjetivoPeruana)
      : fechaObjetivoPeruana;

  // Calculate difference in milliseconds
  const diffMs = fechaObjetivoObj.getTime() - fechaActual.getTime();

  // Calculate percentage completed if a start date is provided
  let porcentajeCompletado = 0;
  let enRango = false;

  if (fechaInicio) {
    const fechaInicioObj =
      typeof fechaInicio === "string" ? new Date(fechaInicio) : fechaInicio;

    const duracionTotal = fechaObjetivoObj.getTime() - fechaInicioObj.getTime();
    const tiempoTranscurrido = fechaActual.getTime() - fechaInicioObj.getTime();

    if (duracionTotal > 0) {
      porcentajeCompletado = Math.min(
        100,
        Math.max(0, (tiempoTranscurrido / duracionTotal) * 100)
      );
      enRango = tiempoTranscurrido >= 0 && tiempoTranscurrido <= duracionTotal;
    }
  }

  // If the date has already passed
  if (diffMs <= 0) {
    return {
      total: 0,
      dias: 0,
      horas: 0,
      minutos: 0,
      segundos: 0,
      yaVencido: true,
      formateado: "Fecha vencida",
      formatoCorto: "Vencido",
      porcentajeCompletado: 100,
      enRango: false,
    };
  }

  // Convert to time units
  const segundos = Math.floor((diffMs / 1000) % 60);
  const minutos = Math.floor((diffMs / (1000 * 60)) % 60);
  const horas = Math.floor((diffMs / (1000 * 60 * 60)) % 24);
  const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  // Readable format
  let formateado = "";
  if (dias > 0) formateado += `${dias} día${dias > 1 ? "s" : ""} `;
  if (horas > 0 || dias > 0)
    formateado += `${horas} hora${horas > 1 ? "s" : ""} `;
  if (minutos > 0 || horas > 0 || dias > 0)
    formateado += `${minutos} minuto${minutos > 1 ? "s" : ""} `;
  formateado += `${segundos} segundo${segundos > 1 ? "s" : ""}`;

  // Short format
  let formatoCorto = "";
  if (dias > 0) formatoCorto += `${dias}d `;
  if (horas > 0 || dias > 0) formatoCorto += `${horas}h `;
  if (minutos > 0 || (horas === 0 && dias === 0))
    formatoCorto += `${minutos}m `;
  if (horas === 0 && dias === 0) formatoCorto += `${segundos}s`;
  formatoCorto = formatoCorto.trim();

  return {
    total: diffMs,
    dias,
    horas,
    minutos,
    segundos,
    yaVencido: false,
    formateado,
    formatoCorto,
    porcentajeCompletado: fechaInicio ? porcentajeCompletado : 0,
    enRango: fechaInicio ? enRango : true,
  };
};
