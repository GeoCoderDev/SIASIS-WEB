// delegacionDeEventos.ts
import { TypeEventAvailable } from "@/lib/utils/interfaces/TypeEventAvailable";
import { useEffect, useState } from "react";


export const useEventDelegation = () => {
  const [delegateEvent, setDelegateEvent] =
    useState<
      (
        typeEvent: TypeEventAvailable,
        querySelectorOrElement: string | HTMLElement,
        callback: (e: Event) => void,
        except?: boolean
      ) => number
    >();
  const [removeEvent, setRemoveEvent] =
    useState<(typeEvent: TypeEventAvailable, eventId: number) => void>();

  useEffect(() => {
    if (typeof window !== "undefined") {
      import("../lib/utils/delegacionEventos").then(({ initializeDelegacion }) => {
        const {
          delegarEvento: delegateEventRec,
          eliminarEventoDelegado: removeEventRec,
        } = initializeDelegacion();

        setDelegateEvent(() => delegateEventRec);
        setRemoveEvent(() => removeEventRec);
      });
    }
  }, []);

  return { delegateEvent, removeEvent };
};