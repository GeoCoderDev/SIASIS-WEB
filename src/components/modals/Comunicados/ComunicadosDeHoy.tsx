"use client";

import { HandlerAsistenciaBase } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerDatosAsistenciaBase";

import { T_Comunicados } from "@prisma/client";
import React, { useEffect, useState } from "react";
import ComunicadoModal from "./ComunicadoModal";

export const SE_MOSTRARON_COMUNICADOS_DE_HOY_KEY = "today-communiques-SHOWED";
export const SE_MOSTRARON_COMUNICADOS_DE_HOY_VALOR_INICIAL = "false";

const ComunicadosDeHoy = () => {
  const [comunicados, setComunicados] = useState<T_Comunicados[]>([]);
  const [mostrarComunicados, setMostrarComunicados] = useState(false);
  const [comunicadosVisibles, setComunicadosVisibles] = useState<{
    [key: number]: boolean;
  }>({});

  const getComunicadosDeHoy = async () => {
    try {
      const { DatosAsistenciaHoyIDB } = await import(
        "@/lib/utils/local/db/models/DatosAsistenciaHoy/DatosAsistenciaHoyIDB"
      );
      const datosAsistenciaHoyDirectivoIDB = new DatosAsistenciaHoyIDB();

      const handlerAsistenciaResponse =
        (await datosAsistenciaHoyDirectivoIDB.getHandler()) as HandlerAsistenciaBase;

      if (!handlerAsistenciaResponse) {
        console.warn(
          "Could not get attendance handler to get communiques. Retrying in 2.5 seconds..."
        );
        setTimeout(() => {
          getComunicadosDeHoy();
        }, 2500);

        return;
      }

      const comunicadosDeHoy = handlerAsistenciaResponse.getComunicados();
      console.info("Today's communiques obtained:", comunicadosDeHoy);

      // Sort communiques by conclusion date (those that expire first appear first)
      const comunicadosOrdenados = comunicadosDeHoy.sort((a, b) => {
        const fechaA = new Date(a.Fecha_Conclusion);
        const fechaB = new Date(b.Fecha_Conclusion);
        return fechaA.getTime() - fechaB.getTime();
      });

      setComunicados(comunicadosOrdenados);

      // Initialize visibility state of all communiques as visible
      const estadoVisibilidad: { [key: number]: boolean } = {};
      comunicadosOrdenados.forEach((comunicado) => {
        estadoVisibilidad[comunicado.Id_Comunicado] = true;
      });
      setComunicadosVisibles(estadoVisibilidad);
    } catch (error) {
      throw error;
    }
  };

  // Check if communiques should be shown
  useEffect(() => {
    const comunicadosMostrados = sessionStorage.getItem(
      SE_MOSTRARON_COMUNICADOS_DE_HOY_KEY
    );

    // If the variable does not exist or is false, show communiques
    if (!comunicadosMostrados || comunicadosMostrados === "false") {
      setMostrarComunicados(true);
    }
  }, []);

  // Function to close a specific communique
  const cerrarComunicado = (idComunicado: number) => {
    setComunicadosVisibles((prev) => ({
      ...prev,
      [idComunicado]: false,
    }));
  };

  // Effect to check if all communiques have been closed
  useEffect(() => {
    const todosLosIds = comunicados.map((c) => c.Id_Comunicado);
    const todosCerrados = todosLosIds.every(
      (id) => comunicadosVisibles[id] === false
    );

    // If there are communiques and all are closed, update sessionStorage
    if (comunicados.length > 0 && todosCerrados) {
      sessionStorage.setItem(SE_MOSTRARON_COMUNICADOS_DE_HOY_KEY, "true");
    }
  }, [comunicadosVisibles, comunicados]);

  useEffect(() => {
    getComunicadosDeHoy();
  }, []);

  return (
    <>
      {mostrarComunicados &&
        comunicados.map(
          (comunicado, index) =>
            // Only show the communique if it is marked as visible
            comunicadosVisibles[comunicado.Id_Comunicado] && (
              <div
                key={comunicado.Id_Comunicado}
                style={{
                  zIndex: 1005 + index, // Each successive modal will have a higher z-index
                }}
              >
                <ComunicadoModal
                  comunicado={comunicado}
                  eliminateModal={() =>
                    cerrarComunicado(comunicado.Id_Comunicado)
                  }
                />
              </div>
            )
        )}
    </>
  );
};

export default ComunicadosDeHoy;