// En /constants/INTERVALOS_CONSULTA_ASISTENCIA.ts
export const INTERVALO_CONSULTA_ASISTENCIA_MINUTOS = 5;
export const INTERVALO_CONSULTA_ASISTENCIA_MS =
  INTERVALO_CONSULTA_ASISTENCIA_MINUTOS * 60 * 1000;

// // Tolencias para activación del botón
export const HORAS_ANTES_INICIO_ACTIVACION = 2; // / 2 horasntes del inicio
export const HORAS_ANTES_SALIDA_CAMBIO_MODO_PARA_PERSONAL = 1; // / 1 horantes de la salida
export const HORAS_DESPUES_SALIDA_LIMITE = 2; // / 2 horas después de salida

// ✅ NUEVO:ntervalo de consulta optimizado
export const INTERVALO_CONSULTA_ASISTENCIA_OPTIMIZADO_MS = 5 * 60 * 1000; // / 5nutos
