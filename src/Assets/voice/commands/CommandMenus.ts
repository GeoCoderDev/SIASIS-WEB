// import { getSubsectionTitle } from "@/lib/assets/ContenidoHelpers";
// import { CommandMenu } from "../../../lib/utils/voice/commands/CommandMenu";
// import {
//   C_V_Anterior,
//   C_V_Buscar,
//   C_V_Home,
//   C_V_Leer,
//   C_V_Modulo_1,
//   C_V_Modulo_2,
//   C_V_Modulo_2_Seccion_1,
//   C_V_Modulo_2_Seccion_2,
//   C_V_Modulo_2_Seccion_3,
//   C_V_Modulo_2_Seccion_4,
//   C_V_Modulo_2_Seccion_5,
//   C_V_Modulo_3,
//   C_V_Modulo_3_Seccion_1,
//   C_V_Modulo_3_Seccion_2,
//   C_V_Modulo_3_Seccion_3,
//   C_V_Modulo_3_Seccion_4,
//   C_V_Modulo_3_Seccion_5,
//   C_V_Modulo_4,
//   C_V_Modulo_4_Seccion_1,
//   C_V_Modulo_4_Seccion_2,
//   C_V_Modulo_4_Seccion_3,
//   C_V_Modulo_4_Seccion_4,
//   C_V_Modulo_4_Seccion_5,
//   C_V_Modulo_4_Seccion_6,
//   C_V_Modulo_4_Seccion_7,
//   C_V_Siguiente,
//   C_V_Usar_Validador,
//   C_V_Validador_Requerimientos,
//   C_VModulo_1_Seccion_1,
//   C_VModulo_1_Seccion_2,
//   C_VModulo_1_Seccion_3,
//   C_VModulo_1_Seccion_4,
// } from "./AllCommandVoices";

// export const C_M_Home = new CommandMenu(
//   "Welcome. On this main page, you can navigate quickly using voice commands. To directly access the available modules, say: 'Module one', 'Module two', 'Module three' or 'Module four'. On the other hand, to use the requirements validator you can say validator",
//   [
//     C_V_Modulo_1,
//     C_V_Modulo_2,
//     C_V_Modulo_3,
//     C_V_Modulo_4,
//     C_V_Validador_Requerimientos,
//   ]
// );

// export const C_M_Menu_Modulos = new CommandMenu(
//   "You can say: 'Search' to perform a search, to use the requirements validator you can say validator, you can also say 'Module 1', 'Module 2', 'Module 3' or 'Module 4' to access the different modules. " +
//     "Module 1 is about 'Origin, Models, Standards and Tools for Software Quality'. " +
//     "Module 2 covers 'Verification and Validation of Requirements Analysis Documentation'. " +
//     "Module 3 focuses on 'Verification and Validation of System Design Documentation'. " +
//     "And Module 4 addresses 'Critical Success Factors for Software Development'.",
//   [
//     C_V_Buscar,
//     C_V_Modulo_1,
//     C_V_Modulo_2,
//     C_V_Modulo_3,
//     C_V_Modulo_4,
//     C_V_Validador_Requerimientos,
//   ]
// );

// export const C_M_Modulo_1 = new CommandMenu(
//   `You are in Module 1: *Software Quality*. This module consists of four sections:
//   - Say 'Section 1' to access *Concepts, models and criteria of software quality*.
//   - Say 'Section 2' to explore *Tools to evaluate software quality*.
//   - Say 'Section 3' to visit *Software quality standards and norms*.
//   - Say 'Section 4' to discover *Origin and evolution of software engineering*.

//   In addition, you can:
//   - Use the 'Search' command to locate specific information in this module.
//   - Go to other modules:
//     - Say 'Module 2' to access *Verification and Validation*.
//     - Say 'Module 3' to explore *System Design Documentation*.
//     - Say 'Module 4' to discover *Critical Success Factors for Software Development*. On the other hand, to use the requirements validator you can say validator.
//   What do you want to do?`,
//   [
//     C_VModulo_1_Seccion_1,
//     C_VModulo_1_Seccion_2,
//     C_VModulo_1_Seccion_3,
//     C_VModulo_1_Seccion_4,
//     C_V_Buscar,
//     C_V_Modulo_2,
//     C_V_Modulo_3,
//     C_V_Modulo_4,
//     C_V_Validador_Requerimientos,
//   ]
// );

// export const C_M_Modulo_2 = new CommandMenu(
//   `You are in Module 2: *Verification and Validation*. This module consists of five sections:
//   - Say 'Section 1' to access *Fundamental concepts of Verification and Validation*.
//   - Say 'Section 2' to explore *Verification of requirements documentation*.
//   - Say 'Section 3' to visit *Validation of requirements documentation*.
//   - Say 'Section 4' to discover *Formal review of the requirements document*.
//   - Say 'Section 5' to access *Tools for Verification and Validation in requirements analysis*.

//   You can also:
//   - Use the 'Search' command to locate specific information in this module.
//   - Navigate to other modules:
//     - Say 'Module 1' to explore *Software Quality*.
//     - Say 'Module 3' to access *System Design Documentation*.
//     - Say 'Module 4' to discover *Critical Success Factors for Software Development*. On the other hand, to use the requirements validator you can say validator.
//   What do you want to do?`,
//   [
//     C_V_Modulo_2_Seccion_1,
//     C_V_Modulo_2_Seccion_2,
//     C_V_Modulo_2_Seccion_3,
//     C_V_Modulo_2_Seccion_4,
//     C_V_Modulo_2_Seccion_5,
//     C_V_Buscar,
//     C_V_Modulo_1,
//     C_V_Modulo_3,
//     C_V_Modulo_4,
//     C_V_Validador_Requerimientos,
//   ]
// );

// export const C_M_Modulo_3 = new CommandMenu(
//   `You are in Module 3: *System Design Documentation*. This module consists of five sections:
//   - Say 'Section 1' to access *Fundamental design concepts*.
//   - Say 'Section 2' to explore *Documentation verification*.
//   - Say 'Section 3' to visit *Documentation validation*.
//   - Say 'Section 4' to discover *Formal design review*.
//   - Say 'Section 5' to access *Verification and Validation Tools*.

//   In addition:
//   - Use the 'Search' command to find specific information in this module.
//   - Navigate to other modules:
//     - Say 'Module 1' to explore *Software Quality*.
//     - Say 'Module 2' to access *Verification and Validation*.
//     - Say 'Module 4' to discover *Critical Success Factors for Software Development*. On the other hand, to use the requirements validator you can say validator.

//   What do you want to do?`,
//   [
//     C_V_Modulo_3_Seccion_1,
//     C_V_Modulo_3_Seccion_2,
//     C_V_Modulo_3_Seccion_3,
//     C_V_Modulo_3_Seccion_4,
//     C_V_Modulo_3_Seccion_5,
//     C_V_Buscar,
//     C_V_Modulo_1,
//     C_V_Modulo_2,
//     C_V_Modulo_4,
//     C_V_Validador_Requerimientos,
//   ]
// );

// export const C_M_Modulo_4 = new CommandMenu(
//   `You are in Module 4: *Critical Success Factors for Software Development*. This module consists of seven sections:
//   - Say 'Section 1' to explore *Definition and characteristics of critical factors*.
//   - Say 'Section 2' to access *Critical technical factors*.
//   - Say 'Section 3' to visit *Human factors*.
//   - Say 'Section 4' to discover *Organizational factors*.
//   - Say 'Section 5' to explore *Methodologies and processes*.
//   - Say 'Section 6' to access *External factors*.
//   - Say 'Section 7' to visit *Examples of critical factors*.

//   In addition:
//   - Use the 'Search' command to locate specific information in this module.
//   - Navigate to other modules:
//     - Say 'Module 1' to explore *Software Quality*.
//     - Say 'Module 2' to access *Verification and Validation*.
//     - Say 'Module 3' to discover *System Design Documentation*.
//     On the other hand, to use the requirements validator you can say validator.
//   What do you want to do?`,
//   [
//     C_V_Modulo_4_Seccion_1,
//     C_V_Modulo_4_Seccion_2,
//     C_V_Modulo_4_Seccion_3,
//     C_V_Modulo_4_Seccion_4,
//     C_V_Modulo_4_Seccion_5,
//     C_V_Modulo_4_Seccion_6,
//     C_V_Modulo_4_Seccion_7,
//     C_V_Buscar,
//     C_V_Modulo_1,
//     C_V_Modulo_2,
//     C_V_Modulo_3,
//     C_V_Validador_Requerimientos,
//   ]
// );

// export const C_M_Subsecciones = new CommandMenu(
//   ``,
//   [
//     C_V_Leer,
//     C_V_Siguiente,
//     C_V_Anterior,
//     C_V_Buscar,
//     C_V_Modulo_1,
//     C_V_Modulo_2,
//     C_V_Modulo_3,
//     C_V_Modulo_4,
//     C_V_Validador_Requerimientos,
//   ],
//   (currentPath: string) => {
//     const subsectionTitle = getSubsectionTitle(currentPath);
//     return `You are in the subsection: ${subsectionTitle}.
//     Available voice commands:
//     - Say "read" to listen to the content.
//     - Say "next" to advance to the next subsection.
//     - Say "previous" to return to the previous subsection.
//     - To stop reading at any time, press Control plus Alt plus X.

//     You can also go directly to any of the modules by saying:
//     "module one", "module two", "module three" or "module four".
//      On the other hand, to use the requirements validator you can say validator.
//     What do you want to do?`;
//   }
// );

// export const C_M_Validador_Requerimientos = new CommandMenu(
//   `You are in the requirements validator, to return to the home page you can say home, if you want to validate any requirement say use validator`,
//   [C_V_Home, C_V_Usar_Validador]
// );