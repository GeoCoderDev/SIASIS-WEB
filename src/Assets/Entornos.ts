import { Entorno } from "@/interfaces/shared/Entornos";

export const Environments_Texts: Record<Entorno, string> = {
  [Entorno.LOCAL]: "LOCAL",
  [Entorno.DESARROLLO]: "DEVELOPMENT",
  [Entorno.CERTIFICACION]: "CERTIFICATION",
  [Entorno.TEST]: "TEST",
  [Entorno.PRODUCCION]: "PRODUCTION",
};

export const Environments_Emojis: Record<Entorno, string> = {
  [Entorno.LOCAL]: "🏠",
  [Entorno.DESARROLLO]: "🛠️",
  [Entorno.CERTIFICACION]: "✅",
  [Entorno.TEST]: "📝",
  [Entorno.PRODUCCION]: "🚀",
};