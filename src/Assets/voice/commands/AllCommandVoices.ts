// import {
//   buscarSubseccionesPorTitulo,
//   getNavigationPaths,
//   SubseccionSearchResult,
// } from "@/lib/assets/ContenidoHelpers";
import { CommandVoice } from "../../../lib/utils/voice/commands/CommandVoice";
import { Listener } from "../../../lib/utils/voice/Listener";
import { Speaker } from "../../../lib/utils/voice/Speaker";

// import { C_M_Modulo_2 } from "./CommandMenus";
// import { getCurrentToRead } from "@/lib/assets/Contenido";
// import { generateSearchResultsSpeech } from "@/lib/helpers/functions/generateSearchResultsSpeech";
// import { CommandMenu } from "../../../lib/utils/voice/commands/CommandMenu";
// import { numberToText } from "@/lib/helpers/functions/numberToText";

const speaker = Speaker.getInstance();

//Commands for other pages

export const C_V_Contacto = new CommandVoice(["contact"], () => {
  return new Promise((resolve) => {
    speaker.start("Redirecting to Module 1.", () => resolve(null));
    window.location.href = "/modulos/1";
  });
});

export const C_V_Home = new CommandVoice(["home", "start"], () => {
  return new Promise((resolve) => {
    speaker.start("Redirecting to the home page.", () => resolve(null));
    window.location.href = "/";
  });
});

//Module 1 Commands

export const C_V_Modulo_1 = new CommandVoice(
  ["module1", "module 1", "module one"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirecting to Module 1.", () => resolve(null));
      window.location.href = "/modulos/1";
    });
  }
);

export const C_VModulo_1_Seccion_1 = new CommandVoice(
  ["software quality concepts models criteria", "section 1", "section one"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Software Quality: Concepts, Models and Criteria.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/1/calidad-software-conceptos-modelos-criterios";
    });
  }
);

export const C_VModulo_1_Seccion_2 = new CommandVoice(
  ["software quality tools", "section 2", "section two"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirecting to Software Quality Tools.", () =>
        resolve(null)
      );
      window.location.href = "/modulos/1/herramientas-calidad-software";
    });
  }
);

export const C_VModulo_1_Seccion_3 = new CommandVoice(
  ["software quality standards", "section 3", "section three"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Software Quality Standards.",
        () => resolve(null)
      );
      window.location.href = "/modulos/1/normas-estandares-calidad-software";
    });
  }
);

export const C_VModulo_1_Seccion_4 = new CommandVoice(
  [
    "origin and evolution of software engineering",
    "section 4",
    "section four",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Origin and Evolution of Software Engineering.",
        () => resolve(null)
      );
      window.location.href = "/modulos/1/origen-evolucion-ingenieria-software";
    });
  }
);

//Module 2 Commands

// export const C_V_Modulo_2 = new CommandVoice(
//   ["module2", "module 2", "module two"],
//   () => {
//     return new Promise((resolve) => {
//       speaker.start("Redirecting to Module 2.", () => {
//         resolve(null);

//         C_M_Modulo_2.start();
//       });
//       window.location.href = "/modulos/2";
//     });
//   }
// );

export const C_V_Modulo_2_Seccion_1 = new CommandVoice(
  ["fundamental concepts vnv", "section 1", "section one"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Fundamental Concepts of Verification and Validation.",
        () => resolve(null)
      );
      window.location.href = "/modulos/2/conceptos-fundamentales-vyv";
    });
  }
);

export const C_V_Modulo_2_Seccion_2 = new CommandVoice(
  [
    "verification of requirements documentation",
    "section 2",
    "section two",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Verification of Requirements Documentation.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/2/verificacion-documentacion-requerimientos";
    });
  }
);

export const C_V_Modulo_2_Seccion_3 = new CommandVoice(
  [
    "validation of requirements documentation",
    "section 3",
    "section three",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Validation of Requirements Documentation.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/2/validacion-documentacion-requerimientos";
    });
  }
);

export const C_V_Modulo_2_Seccion_4 = new CommandVoice(
  [
    "formal review of requirements document",
    "section 4",
    "section four",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Formal Review of the Requirements Document.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/2/revision-formal-documento-requerimientos";
    });
  }
);

export const C_V_Modulo_2_Seccion_5 = new CommandVoice(
  [
    "vnv tools for requirements analysis",
    "section 5",
    "section five",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to V&V Tools for Requirements Analysis.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/2/herramientas-vyv-analisis-requerimientos";
    });
  }
);

//Module 3 Commands

export const C_V_Modulo_3 = new CommandVoice(
  ["module3", "module 3", "module three"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirecting to Module 3.", () => resolve(null));
      window.location.href = "/modulos/3";
    });
  }
);

export const C_V_Modulo_3_Seccion_1 = new CommandVoice(
  ["fundamental design concepts", "section 1", "section one"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Fundamental Concepts of System Design.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/3/conceptos-fundamentales-diseno-sistema";
    });
  }
);

export const C_V_Modulo_3_Seccion_2 = new CommandVoice(
  ["documentation verification", "section 2", "section two"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Verification of Design Documentation.",
        () => resolve(null)
      );
      window.location.href = "/modulos/3/verificacion-documentacion-diseno";
    });
  }
);

export const C_V_Modulo_3_Seccion_3 = new CommandVoice(
  ["documentation validation", "section 3", "section three"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Validation of Design Documentation.",
        () => resolve(null)
      );
      window.location.href = "/modulos/3/validacion-documentacion-diseno";
    });
  }
);

export const C_V_Modulo_3_Seccion_4 = new CommandVoice(
  ["formal design review", "section 4", "section four"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Formal Review of the System Design.",
        () => resolve(null)
      );
      window.location.href = "/modulos/3/revision-formal-diseno-sistema";
    });
  }
);

export const C_V_Modulo_3_Seccion_5 = new CommandVoice(
  [
    "v and v tools",
    "verification and validation tools",
    "section 5",
    "section five",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Tools for Design Verification and Validation.",
        () => resolve(null)
      );
      window.location.href = "/modulos/3/herramientas-vyv-diseno-sistema";
    });
  }
);
//Module 4 Commands

export const C_V_Modulo_4 = new CommandVoice(
  ["module4", "module 4", "module four"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirecting to Module 4.", () => resolve(null));
      window.location.href = "/modulos/4";
    });
  }
);

export const C_V_Modulo_4_Seccion_1 = new CommandVoice(
  [
    "definition and characteristics of critical factors",
    "section 1",
    "section one",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Definition and Characteristics of Critical Success Factors.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/4/definicion-caracteristicas-factores-criticos";
    });
  }
);

export const C_V_Modulo_4_Seccion_2 = new CommandVoice(
  ["critical technical factors", "section 2", "section two"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Critical Technical Factors for Software Development.",
        () => resolve(null)
      );
      window.location.href = "/modulos/4/factores-tecnicos-criticos";
    });
  }
);

export const C_V_Modulo_4_Seccion_3 = new CommandVoice(
  ["human factors", "section 3", "section three"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Human Factors in Software Development.",
        () => resolve(null)
      );
      window.location.href = "/modulos/4/factores-humanos";
    });
  }
);

export const C_V_Modulo_4_Seccion_4 = new CommandVoice(
  ["organizational factors", "section 4", "section four"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirecting to Critical Organizational Factors.", () =>
        resolve(null)
      );
      window.location.href = "/modulos/4/factores-organizacionales";
    });
  }
);

export const C_V_Modulo_4_Seccion_5 = new CommandVoice(
  ["methodologies and processes", "section 5", "section five"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Methodologies and Processes as Success Factors.",
        () => resolve(null)
      );
      window.location.href = "/modulos/4/metodologias-procesos";
    });
  }
);

export const C_V_Modulo_4_Seccion_6 = new CommandVoice(
  ["external factors", "section 6", "section six"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirecting to External Factors.", () => resolve(null));
      window.location.href = "/modulos/4/factores-externos";
    });
  }
);

export const C_V_Modulo_4_Seccion_7 = new CommandVoice(
  ["examples of critical factors", "section 7", "section seven"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirecting to Examples of Critical Success Factors in Real Projects.",
        () => resolve(null)
      );
      window.location.href = "/modulos/4/ejemplos-factores-criticos";
    });
  }
);

//Special Commands

// Function to create voice commands for each result
// function createResultCommands(
//   searchResults: SubseccionSearchResult
// ): CommandVoice[] {
//   return searchResults.map((result, index) => {
//     const num = index + 1;
//     return new CommandVoice(
//       [
//         `result ${num}`,
//         `result${num}`,
//         `result ${numberToText(num)}`,
//         `result${numberToText(num)}`,
//         `result, ${num}`,
//         `result, ${numberToText(num)}`,
//         // Additional variants for possible Edge transcriptions
//         `result ${num}.`,
//         `result, ${num}.`,
//         `result ${numberToText(num)}.`,
//         `result, ${numberToText(num)}.`,
//       ],
//       () => {
//         return new Promise((resolve) => {
//           speaker.start(`Redirecting to ${result.title}`, () => {
//             // CommandVoice.iterateNext = false;
//             window.location.href = result.path;
//             resolve(null);
//           });
//         });
//       }
//     );
//   });
// }

// export const C_V_Buscar = new CommandVoice(["search"], () => {
//   return new Promise((resolve) => {
//     speaker.start("Please, say the term you want to search for.", () => {
//       const listener = Listener.getInstance();

//       listener.start((transcript) => {
//         const searchInput = document.getElementById(
//           "global-search-bar"
//         ) as HTMLInputElement;

//         if (searchInput) {
//           searchInput.value = transcript;

//           const searchForm = document.getElementById(
//             "search-form"
//           ) as HTMLFormElement;

//           if (searchForm) {
//             searchForm.addEventListener("submit", (event) => {
//               event.preventDefault();

//               const searcherResults = buscarSubseccionesPorTitulo(transcript);

//               CommandVoice.callback1?.(searcherResults);

//               const resultsToRead =
//                 generateSearchResultsSpeech(searcherResults);
//               speaker.start("Searching...", () => {
//                 // Create commands for each result
//                 const resultCommands = createResultCommands(searcherResults);

//                 //Additional Commands

//                 // Command to repeat results
//                 const repeatResultsCommand = new CommandVoice(
//                   ["repeat results", "repeat", "repeat the results"],
//                   () => {
//                     return new Promise((resolve2) => {
//                       const resultsToRead =
//                         generateSearchResultsSpeech(searcherResults);
//                       speaker.start(resultsToRead, () => resolve2(null));
//                     });
//                   }
//                 );

//                 // Command for new search
//                 const newSearchCommand = new CommandVoice(
//                   ["new search", "search again", "search anew"],
//                   () => {
//                     return new Promise(() => {
//                       // CommandVoice.iterateNext = true;
//                       resolve(true);
//                     });
//                   }
//                 );

//                 // Combine all commands
//                 const allCommands = [
//                   ...resultCommands,
//                   repeatResultsCommand,
//                   newSearchCommand,
//                 ];

//                 // Create and start the command menu
//                 const commandMenu = new CommandMenu(resultsToRead, allCommands);

//                 commandMenu.start();
//               });
//               // resolve(null);
//             });

//             searchForm.dispatchEvent(new Event("submit"));
//           }
//         }

//         // resolve(null);
//       });
//     });
//   });
// });

// export const C_V_Leer = new CommandVoice(["read"], () => {
//   return new Promise((resolve) => {
//     if (window) {
//       const urlObject = new URL(window.location.href);
//       const contentToRead = getCurrentToRead(urlObject.pathname);
//       if (contentToRead)
//         speaker.start("Reading...", () => {
//           speaker.start(contentToRead);
//         });
//     }

//     resolve(null);
//   });
// });

// export const C_V_Siguiente = new CommandVoice(["next"], () => {
//   return new Promise((resolve) => {
//     const currentPath = CommandVoice.getCurrentPath?.();

//     if (currentPath) {
//       const nextSubsection = getNavigationPaths(currentPath, "next");

//       if (nextSubsection.path) {
//         speaker.start(
//           `Redirecting to ${nextSubsection.title} located at ${nextSubsection.breadcrumbText}`,
//           () => {
//             window.location.href = nextSubsection.path!;
//             resolve(null);
//           }
//         );
//       } else {
//         speaker.start(
//           `There is no next subsection in this module ${nextSubsection.moduleNumber}`,
//           () => resolve(null)
//         );
//       }
//     }

//     resolve(null);
//   });
// });

// export const C_V_Anterior = new CommandVoice(["previous"], () => {
//   return new Promise((resolve) => {
//     const currentPath = CommandVoice.getCurrentPath?.();

//     if (currentPath) {
//       const prevSubsection = getNavigationPaths(currentPath, "prev");

//       if (prevSubsection.path) {
//         speaker.start(
//           `Redirecting to ${prevSubsection.title} located at ${prevSubsection.breadcrumbText}`,
//           () => {
//             window.location.href = prevSubsection.path!;
//             resolve(null);
//           }
//         );
//       } else {
//         speaker.start(
//           `There is no previous subsection in this module ${prevSubsection.moduleNumber}`,
//           () => resolve(null)
//         );
//       }
//     }

//     resolve(null);
//   });
// });

export const C_V_Validador_Requerimientos = new CommandVoice(
  ["validator"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirecting to the requirements validator", () =>
        resolve(null)
      );
      window.location.href = "/herramientas/validador-requerimientos";
    });
  }
);

export const C_V_Usar_Validador = new CommandVoice(["use validator"], () => {
  return new Promise((resolve) => {
    speaker.start(
      "Is your requirement functional? If so, say yes, otherwise say no to indicate that it is a non-functional requirement",
      () => {
        const listener = Listener.getInstance();

        listener.start((transcript) => {
          const radioButton = document.querySelector<HTMLInputElement>(
            `input[name="type"][value="${
              transcript === "yes"
                ? "Functional"
                : "Non Functional"
            }"]`
          );
          if (radioButton) {
            radioButton.checked = true;
            resolve(null);
          }
        });
      }
    );
  });
});