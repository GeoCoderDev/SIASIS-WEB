import { Genero } from "@/interfaces/shared/Genero";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";

// Interface for the specific format of each role by gender
type GeneroFormat = Record<Genero, string>;

// Interface for the device format
interface DispositivoFormat {
  desktop: GeneroFormat;
  mobile: GeneroFormat;
}

// We define the complete type using Records
export type RolesEspañolType = Record<RolesSistema, DispositivoFormat>;

// Implementation with Records
export const RolesTextos: RolesEspañolType = {
  D: {
    desktop: {
      F: "Directiva",
      M: "Directivo",
    },
    mobile: {
      F: "Directiva",
      M: "Directivo",
    },
  },
  PP: {
    desktop: {
      F: "Profesora de Primaria",
      M: "Profesor de Primaria",
    },
    mobile: {
      F: "Prof. Primaria",
      M: "Prof. Primaria",
    },
  },
  A: {
    desktop: {
      F: "Auxiliar",
      M: "Auxiliar",
    },
    mobile: {
      F: "Auxiliar",
      M: "Auxiliar",
    },
  },
  PS: {
    desktop: {
      F: "Profesora de Secundaria",
      M: "Profesor de Secundaria",
    },
    mobile: {
      F: "Prof. Secundaria",
      M: "Prof. Secundaria",
    },
  },
  T: {
    desktop: {
      F: "Tutora de Secundaria",
      M: "Tutor de Secundaria",
    },
    mobile: {
      F: "Tutora Sec.",
      M: "Tutor Sec.",
    },
  },
  R: {
    desktop: {
      F: "Responsable",
      M: "Responsable",
    },
    mobile: {
      F: "Responsable",
      M: "Responsable",
    },
  },
  PA: {
    desktop: {
      F: "Personal Administrativo",
      M: "Personal Administrativo",
    },
    mobile: {
      F: "P. Administrativo",
      M: "P. Administrativo",
    },
  },
};
