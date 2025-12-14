import { Genero } from "@/interfaces/shared/Genero";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";

// Interface for the specific format of each role by gender
type GenderFormat = Record<Genero, string>;

// Interface for the device format
interface DeviceFormat {
  desktop: GenderFormat;
  mobile: GenderFormat;
}

// We define the complete type using Records
export type RolesEnglishType = Record<RolesSistema, DeviceFormat>;

// Implementation with Records
export const RolesTexts: RolesEnglishType = {
  D: {
    desktop: {
      F: "Director",
      M: "Director",
    },
    mobile: {
      F: "Director",
      M: "Director",
    },
  },
  PP: {
    desktop: {
      F: "Primary School Teacher",
      M: "Primary School Teacher",
    },
    mobile: {
      F: "Prim. Teacher",
      M: "Prim. Teacher",
    },
  },
  A: {
    desktop: {
      F: "Assistant",
      M: "Assistant",
    },
    mobile: {
      F: "Assistant",
      M: "Assistant",
    },
  },
  PS: {
    desktop: {
      F: "Secondary School Teacher",
      M: "Secondary School Teacher",
    },
    mobile: {
      F: "Sec. Teacher",
      M: "Sec. Teacher",
    },
  },
  T: {
    desktop: {
      F: "Secondary School Tutor",
      M: "Secondary School Tutor",
    },
    mobile: {
      F: "Sec. Tutor",
      M: "Sec. Tutor",
    },
  },
  R: {
    desktop: {
      F: "Guardian",
      M: "Guardian",
    },
    mobile: {
      F: "Guardian",
      M: "Guardian",
    },
  },
  PA: {
    desktop: {
      F: "Administrative Staff",
      M: "Administrative Staff",
    },
    mobile: {
      F: "Admin. Staff",
      M: "Admin. Staff",
    },
  },
};