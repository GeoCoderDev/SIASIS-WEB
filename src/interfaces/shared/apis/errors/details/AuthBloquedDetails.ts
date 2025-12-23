export interface AuthBlockedDetails {
  tiempoActualUTC: number; // / Timestampnix en segundos
  timestampDesbloqueoUTC: number; // / Timestampnix en segundos
  tiempoRestante: string; // / Formato "Xh Ym"
  fechaDesbloqueo: stng; // / Fecha formateada
  esBloqueoPernente: boolean; // /ndica si es un bloqueo permanente
}