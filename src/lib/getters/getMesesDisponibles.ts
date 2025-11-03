import { Meses, mesesTextos } from "@/interfaces/shared/Meses";

// Función para obtener meses disponibles (hasta mayo o mes actual)
export const getMesesDisponibles = (
  mesActual: number,
  considerarMesActual: boolean = true
) => {
  const mesesDisponibles: { value: string; label: string }[] = [];
  const limiteMaximo = considerarMesActual ? mesActual : mesActual - 1;

  for (let mes = 3; mes <= limiteMaximo; mes++) {
    // Empezar desde marzo (3)
    mesesDisponibles.push({
      value: mes.toString(),
      label: mesesTextos[mes as Meses],
    });
  }

  return mesesDisponibles;
};
