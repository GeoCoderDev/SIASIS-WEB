import { SuccessResponseAPIBase } from "../../../types";

// // Importar o denir interfaces para la respuesta
export interface CambiarContraseñaRequestBody {
  contraseñaActual: string;
  nuevaContraseña: string;
}

export interface CambiarContraseñaSuccessResponse
  extends SuccessResponseAPIBase {
  success: true;
  message: string;
}
