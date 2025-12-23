/* eslint-disable @typescript-eslint/no-explicit-any */
import { TypeEventAvailable } from "./interfaces/TypeEventAvailable";

// // clntSideDelegacion.ts
export const initializeDelegacion = () => {
  // //nst EVENTOS_USADOS = ["mousemove", "change"];

  // // EL "BODY" SIRVE COMO CHIVO EXPIATORIO PARA QUE NO HAGA MATCH EN CASO LO QUE SEA EL PRIMER PARAMETRO SEA UN
  // ELEMENTO HTML , ASI QUE DARA FALSO SIEMPRE QUE SE DEA ESTE CASO YA QUE NUNCA SE PASARIA BODY COMO SELECTOR
  // Y SE PROCEDERIA A LA SIGUIENTE PROPOSICION LA CUAL SERIA EXCLUSIVAMENTE PARA ELEMENTOS HTMLnterface EventPayload {
    selectorOElementoHTML: string | HTMLElement;
    callback: (e: Event) => void;
    except: boolean;
  }

  // // EVENTO CLICKnst mapaDeEventosClick = new Map<number, EventPayload>();
  let eventosClickID = 0;

  function agregarEventoClick(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosClick.set(eventosClickID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosClickID++;
  }

  document.addEventListener("click", (e: any) => {
    mapaDeEventosClick.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO MOUSEMOVEnst mapaDeEventosMouseMove = new Map<number, EventPayload>();
  let eventosMouseMoveID = 0;

  function agregarEventoMouseMove(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosMouseMove.set(eventosMouseMoveID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosMouseMoveID++;
  }

  document.addEventListener("mousemove", (e: any) => {
    mapaDeEventosMouseMove.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO MOUSEOUTnst mapaDeEventosMouseOut = new Map<number, EventPayload>();
  let eventosMouseOutID = 0;

  function agregarEventoMouseOut(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosMouseOut.set(eventosMouseOutID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosMouseOutID++;
  }

  document.addEventListener("mouseout", (e: any) => {
    mapaDeEventosMouseOut.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO MOUSEDOWNnst mapaDeEventosMouseDown = new Map<number, EventPayload>();
  let eventosMouseDownID = 0;

  function agregarEventoMouseDown(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosMouseDown.set(eventosMouseDownID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosMouseDownID++;
  }

  document.addEventListener("mousedown", (e: any) => {
    mapaDeEventosMouseDown.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO MOUSEUPnst mapaDeEventosMouseUp = new Map<number, EventPayload>();
  let eventosMouseUpID = 0;

  function agregarEventoMouseUp(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosMouseUp.set(eventosMouseUpID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosMouseUpID++;
  }

  document.addEventListener("mouseup", (e: any) => {
    mapaDeEventosMouseUp.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO MOUSEENTERnst mapaDeEventosMouseEnter = new Map<number, EventPayload>();
  let eventosMouseEnterID = 0;

  function agregarEventoMouseEnter(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosMouseEnter.set(eventosMouseEnterID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosMouseEnterID++;
  }

  document.addEventListener("mouseenter", (e: any) => {
    mapaDeEventosMouseEnter.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO MOUSEOVERnst mapaDeEventosMouseOver = new Map<number, EventPayload>();
  let eventosMouseOverID = 0;

  function agregarEventoMouseOver(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosMouseOver.set(eventosMouseOverID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosMouseOverID++;
  }

  document.addEventListener("mouseover", (e: any) => {
    mapaDeEventosMouseOver.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO TOUCHSTARTnst mapaDeEventosTouchStart = new Map<number, EventPayload>();
  let eventosTouchStartID = 0;

  function agregarEventoTouchStart(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosTouchStart.set(eventosTouchStartID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosTouchStartID++;
  }

  document.addEventListener("touchstart", (e: any) => {
    mapaDeEventosTouchStart.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO TOUCHMOVEnst mapaDeEventosTouchMove = new Map<number, EventPayload>();
  let eventosTouchMoveID = 0;

  function agregarEventoTouchMove(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosTouchMove.set(eventosTouchMoveID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosTouchMoveID++;
  }

  document.addEventListener("touchmove", (e: any) => {
    mapaDeEventosTouchMove.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO TOUCHENDnst mapaDeEventosTouchEnd = new Map<number, EventPayload>();
  let eventosTouchEndID = 0;

  function agregarEventoTouchEnd(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosTouchEnd.set(eventosTouchEndID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosTouchEndID++;
  }

  document.addEventListener("touchend", (e: any) => {
    mapaDeEventosTouchEnd.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO CHANGEnst mapaDeEventosChange = new Map<number, EventPayload>();
  let eventosChangeID = 0;

  function agregarEventoChange(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosChange.set(eventosChangeID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosChangeID++;
  }

  document.addEventListener("change", (e: any) => {
    mapaDeEventosChange.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO INPUTnst mapaDeEventosInput = new Map<number, EventPayload>();
  let eventosInputID = 0;

  function agregarEventoInput(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosInput.set(eventosInputID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosInputID++;
  }

  document.addEventListener("input", (e: any) => {
    mapaDeEventosInput.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO KEYUPnst mapaDeEventosKeyup = new Map<number, EventPayload>();
  let eventosKeyupID = 0;

  function agregarEventoKeyup(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosKeyup.set(eventosKeyupID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosKeyupID++;
  }

  document.addEventListener("keyup", (e: any) => {
    mapaDeEventosKeyup.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO KEYDOWNnst mapaDeEventosKeydown = new Map<number, EventPayload>();
  let eventosKeydownID = 0;

  function agregarEventoKeydown(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosKeydown.set(eventosKeydownID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosKeydownID++;
  }

  document.addEventListener("keydown", (e: any) => {
    mapaDeEventosKeydown.forEach((Evento) => {
      const matchesSelector =
        typeof Evento.selectorOElementoHTML === "string"
          ? e.target.matches(Evento.selectorOElementoHTML)
          : e.target === Evento.selectorOElementoHTML;

      const shouldExecuteCallback = Evento.except
        ? !matchesSelector
        : matchesSelector;

      if (shouldExecuteCallback) {
        Evento.callback(e);
      }
    });
  });

  // // EVENTO ERROR (para imánes, scripts, etc.)
  const mapaDeEventosError = new Map<number, EventPayload>();
  let eventosErrorID = 0;

  function agregarEventoError(
    querySelectorOElementoHTML: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean
  ) {
    mapaDeEventosError.set(eventosErrorID, {
      selectorOElementoHTML: querySelectorOElementoHTML,
      callback: callback,
      except,
    });
    return eventosErrorID++;
  }

  document.addEventListener(
    "error",
    (e: Event) => {
      // // El ento error en el documento sólo se propaga cuando está en elementos que se cargan
      // // como imánes, scripts, iframes, etc.
      mapaDeEventosError.forEach((Evento) => {
        const target = e.target as HTMLElement;

        const matchesSelector =
          typeof Evento.selectorOElementoHTML === "string"
            ? target.matches(Evento.selectorOElementoHTML)
            : target === Evento.selectorOElementoHTML;

        const shouldExecuteCallback = Evento.except
          ? !matchesSelector
          : matchesSelector;

        if (shouldExecuteCallback) {
          Evento.callback(e);
        }
      });
    }
  );

  /**
* @param {TypeEventAvailable} typeEvent aqui escoges que tipo de evento quieres agregar, ejemplo: click,mousemove,etc @param {string | HTMLElement} querySelectorOrElement este parametro solicita un selector css para el/los elemento(s) que quieres que se aplique el evento @param {(e: Event)=>void} callback funcion que se ejecutara cada vez que se dispare el evento @returns devuelve un Id del evento que añadiste, con el cual podras eliminar el evento mediante la funcion eliminarEventoDelegado
*/
  function delegarEvento(
    typeEvent: TypeEventAvailable,
    querySelectorOrElement: string | HTMLElement,
    callback: (e: Event) => void,
    except: boolean = false
  ) {
    switch (typeEvent) {
      case "click":
        return agregarEventoClick(querySelectorOrElement, callback, except);

      case "mousemove":
        return agregarEventoMouseMove(querySelectorOrElement, callback, except);

      case "mouseout":
        return agregarEventoMouseOut(querySelectorOrElement, callback, except);

      case "mousedown":
        return agregarEventoMouseDown(querySelectorOrElement, callback, except);

      case "mouseup":
        return agregarEventoMouseUp(querySelectorOrElement, callback, except);

      case "mouseenter":
        return agregarEventoMouseEnter(
          querySelectorOrElement,
          callback,
          except
        );

      case "mouseover":
        return agregarEventoMouseOver(querySelectorOrElement, callback, except);

      case "touchstart":
        return agregarEventoTouchStart(
          querySelectorOrElement,
          callback,
          except
        );

      case "touchmove":
        return agregarEventoTouchMove(querySelectorOrElement, callback, except);

      case "touchend":
        return agregarEventoTouchEnd(querySelectorOrElement, callback, except);

      case "change":
        return agregarEventoChange(querySelectorOrElement, callback, except);

      case "input":
        return agregarEventoInput(querySelectorOrElement, callback, except);

      case "keyup":
        return agregarEventoKeyup(querySelectorOrElement, callback, except);

      case "keydown":
        return agregarEventoKeydown(querySelectorOrElement, callback, except);
      case "error":
        return agregarEventoError(querySelectorOrElement, callback, except);
    }
  }

  /**
* @param {TypeEventAvailable} typeEvent @param {Number} idEvento
*/
  function eliminarEventoDelegado(
    typeEvent: TypeEventAvailable,
    idEvento: number
  ) {
    switch (typeEvent) {
      case "click":
        mapaDeEventosClick.delete(idEvento);
        break;

      case "mousemove":
        mapaDeEventosMouseMove.delete(idEvento);
        break;

      case "mouseout":
        mapaDeEventosMouseOut.delete(idEvento);
        break;

      case "mousedown":
        mapaDeEventosMouseDown.delete(idEvento);
        break;

      case "mouseup":
        mapaDeEventosMouseUp.delete(idEvento);
        break;

      case "mouseenter":
        mapaDeEventosMouseEnter.delete(idEvento);
        break;

      case "mouseover":
        mapaDeEventosMouseOver.delete(idEvento);
        break;

      case "touchstart":
        mapaDeEventosTouchStart.delete(idEvento);
        break;

      case "touchmove":
        mapaDeEventosTouchMove.delete(idEvento);
        break;

      case "touchend":
        mapaDeEventosTouchEnd.delete(idEvento);
        break;

      case "change":
        mapaDeEventosChange.delete(idEvento);
        break;
      case "input":
        mapaDeEventosInput.delete(idEvento);
        break;
      case "keyup":
        mapaDeEventosKeyup.delete(idEvento);
        break;
      case "keydown":
        mapaDeEventosKeydown.delete(idEvento);
        break;
      case "error":
        mapaDeEventosError.delete(idEvento);
    }
  }

  // // Exporta lanción agregarEventoClick
  return { delegarEvento, eliminarEventoDelegado };
};
