// import {
// buscarSubseccionesPorTitulo,
// / getNavigatnPaths,
// / SubseccnSearchResult,
// / } from "@/lib/assets/ntenidoHelpers";
import { CommandVoice } from "../../../lib/utils/voice/commands/CommandVoice";
import { Listener } from "../../../lib/utils/voice/Listener";
import { Speaker } from "../../../lib/utils/voice/Speaker";

// // import { C_M_Modulo_2 } from "./ComndMenus";
// / import { getCurntToRead } from "@/lib/assets/Contenido";
// / import {nerateSearchResultsSpeech } from "@/lib/helpers/functions/generateSearchResultsSpeech";
// / import { ComndMenu } from "../../../lib/utils/voice/commands/CommandMenu";
// / importnumberToText } from "@/lib/helpers/functions/numberToText";

const speaker = Speaker.getInstance();

// // Condos para otras paginas

export const C_V_Contacto = new CommandVoice(["contacto"], () => {
  return new Promise((resolve) => {
    speaker.start("Redirigiendo al Módulo 1.", () => resolve(null));
    window.location.href = "/modulos/1";
  });
});

export const C_V_Home = new CommandVoice(["inicio"], () => {
  return new Promise((resolve) => {
    speaker.start("Redirigiendo a la pagina de inicio.", () => resolve(null));
    window.location.href = "/";
  });
});

// // Condos Modulo 1

export const C_V_Modulo_1 = new CommandVoice(
  ["módulo1", "modulo1", "módulo 1", "modulo 1", "módulo uno"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirigiendo al Módulo 1.", () => resolve(null));
      window.location.href = "/modulos/1";
    });
  }
);

export const C_VModulo_1_Seccion_1 = new CommandVoice(
  ["calidad software conceptos modelos criterios", "sección 1", "sección uno"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Calidad Software: Conceptos, Modelos y Criterios.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/1/calidad-software-conceptos-modelos-criterios";
    });
  }
);

export const C_VModulo_1_Seccion_2 = new CommandVoice(
  ["herramientas calidad software", "sección 2", "sección dos"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirigiendo a Herramientas de Calidad de Software.", () =>
        resolve(null)
      );
      window.location.href = "/modulos/1/herramientas-calidad-software";
    });
  }
);

export const C_VModulo_1_Seccion_3 = new CommandVoice(
  ["normas y estándares de calidad software", "sección 3", "sección tres"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Normas y Estándares de Calidad de Software.",
        () => resolve(null)
      );
      window.location.href = "/modulos/1/normas-estandares-calidad-software";
    });
  }
);

export const C_VModulo_1_Seccion_4 = new CommandVoice(
  [
    "origen y evolución de la ingeniería de software",
    "sección 4",
    "sección cuatro",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Origen y Evolución de la Ingeniería de Software.",
        () => resolve(null)
      );
      window.location.href = "/modulos/1/origen-evolucion-ingenieria-software";
    });
  }
);

// // Condos Modulo 2

// // exportnst C_V_Modulo_2 = new CommandVoice(
// / ["módulo2", "modulo2", "módulo 2", "modulo 2", "módulo dos"],
// () => {
// retn new Promise((resolve) => {
// / speaker.start("Redirigndo al Módulo 2.", () => {
// / resolvnull);

// // C_M_Modulo_2.start();
// });
//ndow.location.href = "/modulos/2";
// / });
// }
// );

exportnst C_V_Modulo_2_Seccion_1 = new CommandVoice(
  ["conceptos fundamentales vyv", "sección 1", "sección uno"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Conceptos Fundamentales de Verificación y Validación.",
        () => resolve(null)
      );
      window.location.href = "/modulos/2/conceptos-fundamentales-vyv";
    });
  }
);

export const C_V_Modulo_2_Seccion_2 = new CommandVoice(
  [
    "verificación de la documentación de requerimientos",
    "sección 2",
    "sección dos",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Verificación de la Documentación de Requerimientos.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/2/verificacion-documentacion-requerimientos";
    });
  }
);

export const C_V_Modulo_2_Seccion_3 = new CommandVoice(
  [
    "validación de la documentación de requerimientos",
    "sección 3",
    "sección tres",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Validación de la Documentación de Requerimientos.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/2/validacion-documentacion-requerimientos";
    });
  }
);

export const C_V_Modulo_2_Seccion_4 = new CommandVoice(
  [
    "revisión formal del documento de requerimientos",
    "sección 4",
    "sección cuatro",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Revisión Formal del Documento de Requerimientos.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/2/revision-formal-documento-requerimientos";
    });
  }
);

export const C_V_Modulo_2_Seccion_5 = new CommandVoice(
  [
    "herramientas vyv para análisis de requerimientos",
    "sección 5",
    "sección cinco",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Herramientas VyV para Análisis de Requerimientos.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/2/herramientas-vyv-analisis-requerimientos";
    });
  }
);

// // Condos Modulo 3

export const C_V_Modulo_3 = new CommandVoice(
  ["módulo3", "modulo3", "módulo 3", "modulo 3", "módulo tres"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirigiendo al Módulo 3.", () => resolve(null));
      window.location.href = "/modulos/3";
    });
  }
);

export const C_V_Modulo_3_Seccion_1 = new CommandVoice(
  ["conceptos fundamentales del diseño", "sección 1", "sección uno"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Conceptos Fundamentales del Diseño de Sistema.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/3/conceptos-fundamentales-diseno-sistema";
    });
  }
);

export const C_V_Modulo_3_Seccion_2 = new CommandVoice(
  ["verificación de documentación", "sección 2", "sección dos"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Verificación de la Documentación de Diseño.",
        () => resolve(null)
      );
      window.location.href = "/modulos/3/verificacion-documentacion-diseno";
    });
  }
);

export const C_V_Modulo_3_Seccion_3 = new CommandVoice(
  ["validación de documentación", "sección 3", "sección tres"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Validación de la Documentación de Diseño.",
        () => resolve(null)
      );
      window.location.href = "/modulos/3/validacion-documentacion-diseno";
    });
  }
);

export const C_V_Modulo_3_Seccion_4 = new CommandVoice(
  ["revisión formal del diseño", "sección 4", "sección cuatro"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Revisión Formal del Diseño del Sistema.",
        () => resolve(null)
      );
      window.location.href = "/modulos/3/revision-formal-diseno-sistema";
    });
  }
);

export const C_V_Modulo_3_Seccion_5 = new CommandVoice(
  [
    "herramientas de V y V",
    "herramientas de verificación y validación",
    "sección 5",
    "sección cinco",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Herramientas para la Verificación y Validación del Diseño.",
        () => resolve(null)
      );
      window.location.href = "/modulos/3/herramientas-vyv-diseno-sistema";
    });
  }
);
// // Condos Modulo 4

export const C_V_Modulo_4 = new CommandVoice(
  ["módulo4", "modulo4", "módulo 4", "modulo 4", "módulo cuatro"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirigiendo al Módulo 4.", () => resolve(null));
      window.location.href = "/modulos/4";
    });
  }
);

export const C_V_Modulo_4_Seccion_1 = new CommandVoice(
  [
    "definición y características de factores críticos",
    "sección 1",
    "sección uno",
  ],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Definición y Características de los Factores Críticos de Éxito.",
        () => resolve(null)
      );
      window.location.href =
        "/modulos/4/definicion-caracteristicas-factores-criticos";
    });
  }
);

export const C_V_Modulo_4_Seccion_2 = new CommandVoice(
  ["factores técnicos críticos", "sección 2", "sección dos"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Factores Técnicos Críticos para el Desarrollo del Software.",
        () => resolve(null)
      );
      window.location.href = "/modulos/4/factores-tecnicos-criticos";
    });
  }
);

export const C_V_Modulo_4_Seccion_3 = new CommandVoice(
  ["factores humanos", "sección 3", "sección tres"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Factores Humanos en el Desarrollo de Software.",
        () => resolve(null)
      );
      window.location.href = "/modulos/4/factores-humanos";
    });
  }
);

export const C_V_Modulo_4_Seccion_4 = new CommandVoice(
  ["factores organizacionales", "sección 4", "sección cuatro"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirigiendo a Factores Organizacionales Críticos.", () =>
        resolve(null)
      );
      window.location.href = "/modulos/4/factores-organizacionales";
    });
  }
);

export const C_V_Modulo_4_Seccion_5 = new CommandVoice(
  ["metodologías y procesos", "sección 5", "sección cinco"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Metodologías y Procesos como Factores de Éxito.",
        () => resolve(null)
      );
      window.location.href = "/modulos/4/metodologias-procesos";
    });
  }
);

export const C_V_Modulo_4_Seccion_6 = new CommandVoice(
  ["factores externos", "sección 6", "sección seis"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirigiendo a Factores Externos.", () => resolve(null));
      window.location.href = "/modulos/4/factores-externos";
    });
  }
);

export const C_V_Modulo_4_Seccion_7 = new CommandVoice(
  ["ejemplos de factores críticos", "sección 7", "sección siete"],
  () => {
    return new Promise((resolve) => {
      speaker.start(
        "Redirigiendo a Ejemplos de Factores Críticos de Éxito en Proyectos Reales.",
        () => resolve(null)
      );
      window.location.href = "/modulos/4/ejemplos-factores-criticos";
    });
  }
);

// // Condos Especiales

// //nción para crear comandos de voz para cada resultado
// /nction createResultCommands(
// / searchResults: SubseccnSearchResult[]
// / ): ComndVoice[] {
// / retn searchResults.map((result, index) => {
// /nst num = index + 1;
// / retn new CommandVoice(
// / [
// `resultadonum}`,
// / `resultadonum}`,
// / `resultadonumberToText(num)}`,
// / `resultadonumberToText(num)}`,
// / `resultado,num}`,
// / `resultado,numberToText(num)}`,
// / // Varntes adicionales para posibles transcripciones de Edge
// / `resultadonum}.`,
// / `resultado,num}.`,
// / `resultadonumberToText(num)}.`,
// / `resultado,numberToText(num)}.`,
// / ],
// () => {
// retn new Promise((resolve) => {
// / speaker.start(`Redirigndo a ${result.title}`, () => {
// / // ComndVoice.iterateNext = false;
// /ndow.location.href = result.path;
// / resolvnull);
// / });
// });
// }
// );
// });
// }

// exportnst C_V_Buscar = new CommandVoice(["buscar"], () => {
// / retn new Promise((resolve) => {
// / speaker.start("Por favor, di el térno que deseas buscar.", () => {
// /nst listener = Listener.getInstance();

// // lisner.start((transcript) => {
// /nst searchInput = document.getElementById(
// / "buscador-global"
// ) as HTMnputElement;

// // if (searcnput) {
// / searcnput.value = transcript;

// //nst searchForm = document.getElementById(
// / "formulario-busqueda"
// ) as HTMLFormElent;

// // if (searchForm) {
// searchForm.addEntListener("submit", (event) => {
// / ent.preventDefault();

// //nst searcherResults = buscarSubseccionesPorTitulo(transcript);

// // ComndVoice.callback1?.(searcherResults);

// //nst resultsToRead =
// /nerateSearchResultsSpeech(searcherResults);
// / speaker.start("Busndo...", () => {
// / // Crear condos para cada resultado
// /nst resultCommands = createResultCommands(searcherResults);

// // //Condos Adicionales

// // // Condo para repetir resultados
// /nst repeatResultsCommand = new CommandVoice(
// / ["repetir resultados", "repetir", "repite los resultados"],
// () => {
// retn new Promise((resolve2) => {
// /nst resultsToRead =
// /nerateSearchResultsSpeech(searcherResults);
// / speaker.start(resultsToRead, () => resolvenull));
// / });
// }
// );

// // Condo para nueva búsqueda
// /nst newSearchCommand = new CommandVoice(
// /nueva búsqueda", "buscar otra vez", "buscar de nuevo"],
// / () => {
// retn new Promise(() => {
// / // ComndVoice.iterateNext = true;
// / resolve(true);
// });
// }
// );

// // Comnar todos los comandos
// /nst allCommands = [
// / ...resultComnds,
// / repeatResultsComnd,
// newSearchCommand,
// / ];

// // Crear yniciar el menú de comandos
// /nst commandMenu = new CommandMenu(resultsToRead, allCommands);

// // comndMenu.start();
// / });
// // resolvnull);
// / });

// searchForm.dispatchEnt(new Event("submit"));
// / }
// }

// // resolvnull);
// / });
// });
// });
// });

// exportnst C_V_Leer = new CommandVoice(["leer"], () => {
// / retn new Promise((resolve) => {
// / if (ndow) {
// /nst urlObject = new URL(window.location.href);
// /nst contentToRead = getCurrentToRead(urlObject.pathname);
// / if (ntentToRead)
// / speaker.start("Lndo...", () => {
// / speaker.start(ntentToRead);
// / });
// }

// resolvnull);
// / });
// });

// exportnst C_V_Siguiente = new CommandVoice(["siguiente"], () => {
// / retn new Promise((resolve) => {
// /nst currentPath = CommandVoice.getCurrentPath?.();

// // if (curntPath) {
// /nst nextSubsection = getNavigationPaths(currentPath, "next");

// // ifnextSubsection.path) {
// / speaker.start(
// `Redirigndo a ${nextSubsection.title} ubicado en ${nextSubsection.breadcrumbText}`,
// / () => {
//ndow.location.href = nextSubsection.path!;
// / resolvnull);
// / }
// );
// } else {
// speaker.start(
// `No hayna subsección siguiente en este modulo ${nextSubsection.moduleNumber}`,
// / () => resolvnull)
// / );
// }
// }

// resolvnull);
// / });
// });

// exportnst C_V_Anterior = new CommandVoice(["anterior"], () => {
// / retn new Promise((resolve) => {
// /nst currentPath = CommandVoice.getCurrentPath?.();

// // if (curntPath) {
// /nst prevSubsection = getNavigationPaths(currentPath, "prev");

// // if (prevSubsectn.path) {
// / speaker.start(
// `Redirigndo a ${prevSubsection.title} ubicado en ${prevSubsection.breadcrumbText}`,
// / () => {
//ndow.location.href = prevSubsection.path!;
// / resolvnull);
// / }
// );
// } else {
// speaker.start(
// `No hayna subsección anterior en este modulo ${prevSubsection.moduleNumber}`,
// / () => resolvnull)
// / );
// }
// }

// resolvnull);
// / });
// });

exportnst C_V_Validador_Requerimientos = new CommandVoice(
  ["validador"],
  () => {
    return new Promise((resolve) => {
      speaker.start("Redirigiendo al validador de requerimientos", () =>
        resolve(null)
      );
      window.location.href = "/herramientas/validador-requerimientos";
    });
  }
);

export const C_V_Usar_Validador = new CommandVoice(["usar validador"], () => {
  return new Promise((resolve) => {
    speaker.start(
      "¿Tu requerimiento es funcional?, Si es así, dí si, de lo contrario di no para indicar que se trata de un requerimiento no funcional",
      () => {
        const listener = Listener.getInstance();

        listener.start((transcript) => {
          const radioButton = document.querySelector<HTMLInputElement>(
            `input[name="type"][value="${
              transcript === "si" || transcript === "sí"
                ? "Funcional"
                : "No Funcional"
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
