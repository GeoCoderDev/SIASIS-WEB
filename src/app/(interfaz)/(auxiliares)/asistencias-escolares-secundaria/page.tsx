"use client";

import GeneradorTarjetaQRPorAulaModal from "@/components/modals/QR/GeneradorDeQRPorAulaModal";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import React, { useState } from "react";

const AsistenciasEscolaresSecundaria = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      {isModalOpen && (
        <GeneradorTarjetaQRPorAulaModal
          restriccion={NivelEducativo.SECUNDARIA}
          eliminarModal={() => {
            setIsModalOpen(false);
          }}
        />
      )}
      <div>
        <button
          className="bg-azul-principal text-white p-4 py-2 rounded-[1rem] outline-none"
          onClick={() => setIsModalOpen(true)}
        >
          Generar Tarjetas QR para estudiantes de Secundaria por Aula
        </button>
        <button className="bg-azul-principal text-white p-4 py-2 rounded-[1rem] outline-none">
          TEST QUEUES
        </button>
      </div>
    </>
  );
};

export default AsistenciasEscolaresSecundaria;
