import { Meses, mesesTextos } from "@/interfaces/shared/Meses";

// Function to get available months (up to May or current month)
export const getMesesDisponibles = (
  mesActual: number,
  considerarMesActual: boolean = true
) => {
  const mesesDisponibles: { value: string; label: string }[] = [];
  const limiteMaximo = considerarMesActual ? mesActual : mesActual - 1;

  for (let mes = 3; mes <= limiteMaximo; mes++) {
    // Start from March (3)
    mesesDisponibles.push({
      value: mes.toString(),
      label: mesesTextos[mes as Meses],
    });
  }

  return mesesDisponibles;
};
