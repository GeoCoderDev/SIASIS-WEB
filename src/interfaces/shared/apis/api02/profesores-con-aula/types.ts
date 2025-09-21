import {
  ProfesorPrimariaGenericoConCelular,
  ProfesorSecundariaGenericoConCelular,
} from "@/interfaces/shared/Profesores";
import { ErrorResponseAPIBase } from "../../types";

export interface ProfesorConAulaSuccessResponse {
  success: true;
  data:
    | ProfesorPrimariaGenericoConCelular
    | ProfesorSecundariaGenericoConCelular;
}

export interface ProfesorConAulaErrorAPI02 extends ErrorResponseAPIBase {}
