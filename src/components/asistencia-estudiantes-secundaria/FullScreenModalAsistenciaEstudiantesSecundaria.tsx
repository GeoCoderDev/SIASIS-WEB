"use client";

import React, { useEffect, useState } from "react";
import { saludosDia } from "@/Assets/voice/others/SaludosDelDia";
import { FechaHoraActualRealState } from "@/global/state/others/fechaHoraActualReal";
import { determinarPeriodoDia } from "@/lib/calc/determinarPeriodoDia";
import { TiempoRestante } from "@/lib/calc/time/tiempoRestanteHasta";
import { HandlerAuxiliarAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerAuxiliarAsistenciaResponse";
import userStorage from "@/lib/utils/local/db/models/UserStorage";
import { Speaker } from "@/lib/utils/voice/Speaker";
import RegistroEstudiantesSecundariaPorQR from "./RegistroEstudiantesSecundariaPorQR";
import RegistroEstudiantesSecundariaManual from "./RegistroEstudiantesSecundariaManual";
import VolverIcon from "../icons/VolverIcon";

// Tipos para el método de registro
type MetodoRegistro = "qr" | "manual" | null;

const FullScreenModalAsistenciaEstudiantesSecundaria = ({
  closeFullScreenModal,
  fechaHoraActual,
  tiempoRestante,
  handlerAuxiliar,
  totalEstudiantes,
  totalAulas,
}: {
  handlerAuxiliar: HandlerAuxiliarAsistenciaResponse;
  closeFullScreenModal: () => void;
  fechaHoraActual: FechaHoraActualRealState;
  tiempoRestante?: TiempoRestante | null;
  totalEstudiantes: number;
  totalAulas: number;
}) => {
  const [metodoSeleccionado, setMetodoSeleccionado] =
    useState<MetodoRegistro>(null);
  const [cargando, setCargando] = useState(false);

  // Obtener el saludo según la hora del día
  const periodoDelDia = determinarPeriodoDia(
    fechaHoraActual.fechaHora || new Date().toISOString()
  );
  const saludo = saludosDia[periodoDelDia];

  // Efecto para el saludo de bienvenida
  useEffect(() => {
    const saludoDeBienvenida = async () => {
      const nombreCompletoCortoAuxiliar =
        await userStorage.getNombreCompletoCorto();
      const speaker = Speaker.getInstance();
      speaker.start(
        `${saludo}, Auxiliar ${nombreCompletoCortoAuxiliar}, ha iniciado la toma de asistencia de estudiantes de secundaria`
      );
    };

    saludoDeBienvenida();
  }, [saludo]);

  // Manejar selección de método
  const handleMetodoSelection = (metodo: MetodoRegistro) => {
    setCargando(true);

    const speaker = Speaker.getInstance();
    speaker.start(
      metodo === "qr"
        ? "Ha seleccionado el escáner de códigos QR"
        : "Ha seleccionado el registro manual de estudiantes"
    );

    setTimeout(() => {
      setMetodoSeleccionado(metodo);
      setCargando(false);
    }, 300);
  };

  // Función para volver al paso anterior
  const handleVolver = () => {
    const speaker = Speaker.getInstance();
    speaker.start("Volviendo al menú de selección de método");
    setMetodoSeleccionado(null);
  };

  // Renderizar cards de selección de método
  const renderSeleccionMetodo = () => (
    <div className="max-w-6xl mx-auto p-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-green-800 mb-2">
          ¿Cómo desea registrar la asistencia?
        </h2>
        <p className="text-green-600">
          Seleccione el método que prefiera para registrar la asistencia de{" "}
          {totalEstudiantes} estudiantes de secundaria
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card 1: Escáner QR */}
        <div
          className="bg-white border-2 border-blue-200 rounded-xl p-8 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
          onClick={() => handleMetodoSelection("qr")}
        >
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <div className="w-32 h-32 flex items-center justify-center">
                <img
                  src="/images/svg/LectorDeQR.svg"
                  alt="Escáner QR"
                  className="h-full aspect-auto"
                />
              </div>
            </div>
            <h3 className="text-xl font-bold text-blue-800 mb-4">
              Usar mi celular como escáner de códigos QR
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Utiliza la cámara de tu dispositivo para escanear los códigos QR
              que presentan los estudiantes de secundaria. Cada estudiante debe
              presentar su código personal al llegar al colegio. Simplemente
              apunta la cámara hacia el código QR del estudiante y el sistema
              registrará automáticamente su asistencia, determinando si llegó
              puntual o con tardanza según la hora establecida.
            </p>
          </div>
        </div>

        {/* Card 2: Registro Manual */}
        <div
          className="bg-white border-2 border-green-200 rounded-xl p-8 cursor-pointer hover:border-green-400 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
          onClick={() => handleMetodoSelection("manual")}
        >
          <div className="text-center">
            <div className="mb-6 flex justify-center">
              <div className="w-32 h-32 flex items-center justify-center">
                <img
                  src="/images/svg/DatosDeEstudiante.svg"
                  alt="Registro Manual"
                  className="h-full aspect-auto"
                />
              </div>
            </div>
            <h3 className="text-xl font-bold text-green-800 mb-4">
              Ingresar datos puntuales de cada Estudiante
            </h3>
            <p className="text-gray-600 text-sm leading-relaxed">
              Método alternativo para casos especiales donde el escaneo de QR no
              es posible. Úsalo cuando un estudiante olvidó su código QR, la
              cámara de tu celular presenta fallos, el código QR está dañado,
              manchado o ilegible por cualquier motivo. Selecciona primero el
              grado y sección correspondiente, luego busca al estudiante por su
              nombre y apellido en la lista.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  // Determinar qué contenido mostrar
  const renderContenido = () => {
    if (cargando) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-white bg-opacity-75">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-green-600 font-medium text-sm">
              Cargando...
            </p>
          </div>
        </div>
      );
    }

    switch (metodoSeleccionado) {
      case "qr":
        return (
          <RegistroEstudiantesSecundariaPorQR
            handlerAuxiliar={handlerAuxiliar}
          />
        );
      case "manual":
        return (
          <RegistroEstudiantesSecundariaManual
            handlerAuxiliar={handlerAuxiliar}
          />
        );
      default:
        return renderSeleccionMetodo();
    }
  };

  return (
    <div className="animate__animated animate__fadeInUp [animation-duration:800ms] fixed top-0 left-0 w-full h-[100dvh] grid grid-rows-[auto_1fr_auto] bg-gray-50 z-[1001]">
      {/* Cabecera */}
      <header className="bg-green-50 border-b border-green-100 py-3 px-2 md:py-3 md:px-3 lg:py-4 lg:px-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row justify-between items-center gap-1 sm:gap-2 gap-y-3">
          <div className="flex items-center gap-3">
            {/* Botón "Retroceder" - solo visible cuando se ha seleccionado un método */}
            {metodoSeleccionado !== null && (
              <button
                onClick={handleVolver}
                className="flex items-center text-blanco bg-color-interfaz px-2 py-1.5 sm:px-3 sm:py-2 rounded-md text-[0.9rem]"
              >
                <VolverIcon className="w-6 mr-1" />
                Retroceder
              </button>
            )}
            <div className="flex flex-col">
              <span className="text-green-600 font-medium text-xs leading-tight">
                {fechaHoraActual.formateada?.fechaLegible}
              </span>
              <span className="text-green-600 font-medium text-xs leading-tight">
                {fechaHoraActual.formateada?.horaAmPm}
              </span>
              <span className="text-green-900 font-bold text-sm sm:text-base lg:text-lg leading-tight text-center sm:text-left">
                🎓 Asistencia de Estudiantes - Secundaria
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex flex-col items-end">
              <span className="text-red-600 font-medium text-xs leading-tight">
                Tiempo restante:
              </span>
              <span className="text-red-700 font-bold text-xs sm:text-sm lg:text-base leading-tight">
                {tiempoRestante?.formatoCorto}
              </span>
            </div>
            <button
              onClick={closeFullScreenModal}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-2 sm:py-1.5 sm:px-3 rounded-lg transition-colors shadow-sm text-sm"
            >
              Cerrar
            </button>
          </div>
        </div>
      </header>

      {/* Contenido principal con scroll */}
      <main className="overflow-auto bg-gray-50">{renderContenido()}</main>

      {/* Pie de página */}
      <footer className="bg-green-700 text-white border-t border-green-700 py-3 px-2 md:py-3 md:px-3 shadow-md">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex flex-col items-center gap-1">
            <p className="font-semibold text-xs sm:text-sm leading-tight">
              I.E. 20935 Asunción 8 - Imperial, Cañete
            </p>
            <p className="text-xs opacity-80 leading-tight">
              Sistema de Control de Asistencia - Estudiantes de Secundaria ©{" "}
              {fechaHoraActual.utilidades?.año || new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FullScreenModalAsistenciaEstudiantesSecundaria;
