import { SiasisComponent } from "./shared/SiasisComponents";

export enum LogoutTypes {
  DATA_NOT_AVAILABLE_ERROR = "DATA_NOT_AVAILABLE_ERROR",
  USER_DECISION = "USER_DECISION",
  SESSION_EXPIRED = "SESSION_EXPIRED",
  SYSTEM_ERROR = "SYSTEM_ERROR",
  SYNC_ERROR = "SYNC_ERROR",
  DATABASE_ERROR = "DATABASE_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
  CORRUPT_DATA_ERROR = "CORRUPT_DATA_ERROR",
  PARSE_ERROR = "PARSE_ERROR",
  INSUFFICIENT_PERMISSIONS = "INSUFFICIENT_PERMISSIONS",
  SECURITY_ERROR = "SECURITY_ERROR",
  AUTHENTICATION_ERROR = "AUTHENTICATION_ERROR",
}

export interface ErrorDetailsForLogout {
  codigo?: string;
  origen?: string;
  mensaje?: string;
  timestamp?: number;
  contexto?: string;
  siasisComponent?: SiasisComponent | SiasisComponent[];
}
