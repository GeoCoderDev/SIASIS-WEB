import { Entorno } from "@/interfaces/shared/Entornos";

export const Environments_Ports_SS01: Record<Entorno, number> = {
  [Entorno.LOCAL]: 5000,
  [Entorno.DESARROLLO]: 5000,
  [Entorno.CERTIFICACION]: 5001,
  [Entorno.TEST]: 5000,
  [Entorno.PRODUCCION]: 443,
};

export const Environments_Domains_SS01: Record<Entorno, string> = {
  [Entorno.LOCAL]: "localhost",
  [Entorno.DESARROLLO]: "siasis-ss01-dev-cert.duckdns.org",
  [Entorno.CERTIFICACION]: "siasis-ss01-dev-cert.duckdns.org",
  [Entorno.TEST]: "localhost",
  [Entorno.PRODUCCION]: "siasis-ss01-ie20935.duckdns.org",
};

export const Environments_BasePaths_SS01: Record<Entorno, string> = {
  [Entorno.LOCAL]: "/dev/socket.io/",
  [Entorno.DESARROLLO]: "/dev/socket.io/",
  [Entorno.CERTIFICACION]: "/cert/socket.io/",
  [Entorno.TEST]: "",
  [Entorno.PRODUCCION]: "",
};