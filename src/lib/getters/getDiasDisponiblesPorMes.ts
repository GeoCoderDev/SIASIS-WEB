/**
 * Devuelve los días disponibles para un mes dado.
 * Reglas:
 * - Devuelve sólo días de lunes a viernes del mes.
 * - Si el día actual (diaActual) es un día de lunes a viernes se excluye,
 *   excepto cuando la horaActual >= 22, en cuyo caso se permite incluirlo.
 *
 * Asunciones razonables:
 * - `mesSeleccionado` es el número de mes en formato 1..12.
 * - `diaActual` es el número de día del mes (1..31). Si `diaActual` no
 *   pertenece al mes indicado, se ignora la regla especial de exclusión.
 * - `horaActual` es entero 0..23.
 */
export const getDiasDisponiblesPorMes = (
  mesSeleccionado: number,
  diaActual: number,
  horaActual: number
): { numeroDiaDelMes: number; NombreDiaSemana: string }[] => {
  const resultados: { numeroDiaDelMes: number; NombreDiaSemana: string }[] = [];

  // Aceptamos mesSeleccionado en 1..12
  if (mesSeleccionado < 1 || mesSeleccionado > 12) return resultados;

  const year = new Date().getFullYear();
  const monthIndex = mesSeleccionado - 1; // 0-based para Date
  const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();

  const nombresSemana = [
    "Domingo",
    "Lunes",
    "Martes",
    "Miércoles",
    "Jueves",
    "Viernes",
    "Sábado",
  ];

  // Validar si diaActual pertenece a este mes
  const diaActualValido = diaActual >= 1 && diaActual <= daysInMonth;

  for (let dia = 1; dia <= daysInMonth; dia++) {
    const fecha = new Date(year, monthIndex, dia);
    const dow = fecha.getDay(); // 0 domingo .. 6 sabado

    // Solo lunes(1) a viernes(5)
    if (dow >= 1 && dow <= 5) {
      // Si es el día actual y es día laborable, aplicamos la regla de la hora
      if (dia === diaActual && diaActualValido) {
        if (horaActual >= 22) {
          resultados.push({
            numeroDiaDelMes: dia,
            NombreDiaSemana: nombresSemana[dow],
          });
        } else {
          // omitimos el día actual porque aún no son las 22
        }
      } else {
        resultados.push({
          numeroDiaDelMes: dia,
          NombreDiaSemana: nombresSemana[dow],
        });
      }
    }
  }

  return resultados;
};
