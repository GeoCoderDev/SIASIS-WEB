import { SiasisAPIS } from "@/interfaces/shared/SiasisComponents";
import getRandomAPI01IntanceURL from "./getRandomAPI01InstanceURL";
import getRandomAPI02Instance from "./getRandomAPI02Instance";
import getRandomAPI03InstanceURL from "./getRandomAPI03InstanceURL";

export const SiasisAPIsGetRandomInstanceFunctions: Record<
  SiasisAPIS,
  () => string | undefined
> = {
  API01: getRandomAPI01IntanceURL,
  API02: getRandomAPI02Instance,
  API03: getRandomAPI03InstanceURL,
  "SIU01 API": () => "", // Debido a que estamos en SIU01 la ruta sera relativa
};
