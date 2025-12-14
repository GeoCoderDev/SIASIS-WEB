import { SuccessResponseAPIBase } from "../../../types";

// Import or define interfaces for the response
export interface CambiarContraseñaRequestBody {
  contraseñaActual: string;
  nuevaContraseña: string;
}

export interface CambiarContraseñaSuccessResponse
  extends SuccessResponseAPIBase {
  success: true;
  message: string;
}
