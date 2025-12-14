import { RDP02 } from "../RDP02Instancias";
import { RDP03 } from "../RDP03Instancias";

// Interface for the webhook payload
export interface EMCS01Payload {
  event_type: string;
  client_payload: {
    sql: string;
    params: any[];
    instanciasAActualizar: (RDP02 | RDP03)[];
    timestamp: number;
  };
}
