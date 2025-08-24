// ============================================================================
//                    CONSTANTES DE EXTENSIÓN DE HORARIOS ESCOLARES
// ============================================================================

/**
 * Extensiones de tiempo (en minutos) para los horarios escolares
 * Permiten flexibilidad en los horarios de entrada y salida de estudiantes
 */

// ===== NIVEL PRIMARIA =====

/**
 * Extensión de tiempo antes del horario oficial de entrada de estudiantes de primaria
 * @example Si el horario oficial es 7:45 AM y la extensión es 60 minutos,
 * los estudiantes podrán registrar asistencia desde las 6:45 AM
 */
export const EXTENSION_ENTRADA_ESTUDIANTES_PRIMARIA = 60; // minutos

/**
 * Extensión de tiempo después del horario oficial de salida de estudiantes de primaria
 * @example Si el horario oficial es 12:45 PM y la extensión es 60 minutos,
 * los estudiantes podrán registrar asistencia hasta la 1:45 PM
 */
export const EXTENSION_SALIDA_ESTUDIANTES_PRIMARIA = 60; // minutos

// ===== NIVEL SECUNDARIA =====

/**
 * Extensión de tiempo antes del horario oficial de entrada de estudiantes de secundaria
 * @example Si el horario oficial es 1:00 PM y la extensión es 60 minutos,
 * los auxiliares podrán tomar asistencia desde las 12:00 PM
 */
export const EXTENSION_ENTRADA_ESTUDIANTES_SECUNDARIA = 60; // minutos

/**
 * Extensión de tiempo después del horario oficial de salida de estudiantes de secundaria
 * @example Si el horario oficial es 6:30 PM y la extensión es 60 minutos,
 * los auxiliares podrán tomar asistencia hasta las 7:30 PM
 */
export const EXTENSION_SALIDA_ESTUDIANTES_SECUNDARIA = 60; // minutos

// ===== UTILIDADES =====

/**
 * Convierte minutos a milisegundos
 * @param minutos Cantidad de minutos a convertir
 * @returns Milisegundos equivalentes
 */
export const minutosAMilisegundos = (minutos: number): number =>
  minutos * 60 * 1000;

/**
 * Aplica una extensión (en minutos) a una fecha/hora
 * @param fechaHora Fecha/hora base
 * @param extension Extensión en minutos (positivo para sumar, negativo para restar)
 * @returns Nueva fecha con la extensión aplicada
 */
export const aplicarExtension = (fechaHora: Date, extension: number): Date => {
  const nuevaFecha = new Date(fechaHora);
  nuevaFecha.setMinutes(nuevaFecha.getMinutes() + extension);
  return nuevaFecha;
};

/**
 * Calcula el rango de tiempo efectivo para toma de asistencia
 * @param horaInicio Hora oficial de inicio
 * @param horaFin Hora oficial de fin
 * @param extensionEntrada Extensión antes del inicio (en minutos)
 * @param extensionSalida Extensión después del fin (en minutos)
 * @returns Objeto con el rango efectivo
 */
export const calcularRangoEfectivo = (
  horaInicio: Date,
  horaFin: Date,
  extensionEntrada: number,
  extensionSalida: number
) => ({
  inicioEfectivo: aplicarExtension(horaInicio, -extensionEntrada),
  finEfectivo: aplicarExtension(horaFin, extensionSalida),
  duracionTotal:
    aplicarExtension(horaFin, extensionSalida).getTime() -
    aplicarExtension(horaInicio, -extensionEntrada).getTime(),
});
