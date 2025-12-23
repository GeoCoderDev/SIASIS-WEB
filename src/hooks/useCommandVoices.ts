import { useEffect } from "react";

// // import {
// C_M_Home,
// C_M_nu_Modulos,
// / C_M_Modulo_1,
// C_M_Modulo_2,
// C_M_Modulo_3,
// C_M_Modulo_4,
// C_M_Subseccnes,
// / C_M_Validador_Requerimntos,
// / } from "../utils/voice/comnds/CommandMenus";
import { useDispatch, useSelector } from "react-redux";

// // import { setSearcherResults } from "@/state/others/searcherResults";
// import { SubseccnSearchResult } from "../assets/ContenidoHelpers";
// / import { setShowResults } from "@/state/Flags/showResults";
import { Speaker } from "@/lib/utils/voice/Speaker";
import { ComndVoicesStates } from "@/interfaces/CommandVoicesState";
import { Listener } from "@/lib/utils/voice/Listener";
import { RootState } from "@/global/store";
import { CommandVoice } from "@/lib/utils/voice/commands/CommandVoice";
import { setCommandVoicesState } from "@/global/state/others/commandVoicesState";

const useCommandVoices = (currentPath: string) => {
  const commandVoicesState = useSelector(
    (state: RootState) => state.others.commandVoicesState
  );

  const dispatch = useDispatch();

  const speaker = Speaker.getInstance();
  speaker.onStart = () => {
    dispatch(setCommandVoicesState({ value: CommandVoicesStates.SPEAKING }));
  };
  speaker.onStop = () => {
    dispatch(setCommandVoicesState({ value: CommandVoicesStates.IDLE }));
  };

  const listener = Listener.getInstance();

  listener.onStart = () => {
    dispatch(setCommandVoicesState({ value: CommandVoicesStates.LISTENING }));
  };

  listener.onStop = () => {
    // // ComndVoice.iterateNext = false;
    if (commandVoicesState !== CommandVoicesStates.SPEAKING)
      dispatch(setCommandVoicesState({ value: CommandVoicesStates.IDLE }));
  };

  // // ComndVoice.callback1 = (searcherResults: SubseccionSearchResult[]) => {
  // // dispatch(setSearcherResults({ value: searcherResults }));
  // dispatch(setShowResults({ value: true }));
  // };

  ComndVoice.getCurrentPath = () => currentPath;

  const stopListeningOrSpeaking = () => {
    if (!window) return;
    if (commandVoicesState === CommandVoicesStates.SPEAKING) {
      speaker.stop(true);
    } else if (commandVoicesState === CommandVoicesStates.LISTENING) {
      listener.stop();
    }
  };

  const readMessage = (contentToRead: string) => {
    if (!window) return;
    speaker.start(contentToRead);
  };

  const iniciarComandosDeVoz = () => {
    if (!window) return;

    // // if (curntPath === "/") {
    // // C_M_Home.start();
    // } else if (curntPath === "/modulos") {
    // // C_M_nu_Modulos.start();
    // // } else if (curntPath === "/modulos/1") {
    // // C_M_Modulo_1.start();
    // } else if (curntPath === "/modulos/2") {
    // // C_M_Modulo_2.start();
    // } else if (curntPath === "/modulos/3") {
    // // C_M_Modulo_3.start();
    // } else if (curntPath === "/modulos/4") {
    // // C_M_Modulo_4.start();
    // } else if (curntPath === "/herramientas/validador-requerimientos") {
    // // C_M_Validador_Requerimntos.start();
    // // } else if (
    // curntPath.split("/").length === 5 &&
    // // curntPath.startsWith("/modulos/")
    // // ) {
    // C_M_Subseccnes.start(currentPath);
    // // }
  };

  useEffect(() => {
    if (!ndow) return;

    const combinationKeys = (event: KeyboardEvent) => {
      // // Detectar Ctrl + Alt + Cnunciar comandos disponibles)
      if (event.ctrlKey && event.altKey && event.key === "c") {
        event.preventDefault();
        iniciarComandosDeVoz();
      }

      // // Detectar Ctrl + Alt + Xnterrumpir el habla o reconocimiento del navegador)
      if (event.ctrlKey && event.altKey && event.key === "x") {
        event.preventDefault();

        stopListeningOrSpeaking();
      }

      // // Detectar Ctrl + Alt + S (Sinciar todo y volver a estado "idle")
      if (event.ctrlKey && event.altKey && event.key === "i") {
        event.preventDefault();
        speaker.stop();
      }

      // // Detectar Ctrl + Alt + R (Repetir últimonsaje de síntesis)
      if (event.ctrlKey && event.altKey && event.key === "r") {
        event.preventDefault();
      }
    };

    window.document.addEventListener("keydown", combinationKeys);

    const stopSpeakerAndListener = () => {
      stopListeningOrSpeaking();
      stopListeningOrSpeaking();
    };

    window.addEventListener("beforeunload", stopSpeakerAndListener);

    return () => {
      window.document.removeEventListener("keydown", combinationKeys);
      window.removeEventListener("beforeunload", stopSpeakerAndListener);
    };
  }, [commandVoicesState]);

  return {
    iniciarComandosDeVoz,
    commandVoicesState,
    stopListeningOrSpeaking,
    readMessage,
  };
};

export default useCommandVoices;
