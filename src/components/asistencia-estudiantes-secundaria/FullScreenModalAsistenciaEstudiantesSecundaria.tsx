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
    <div className="max-w-6xl mx-auto p-3 sxs-only:p-2 xs-only:p-3 sm-only:p-4 md-only:p-5 lg-only:p-6 xl-only:p-6">
      <div className="text-center mb-4 xs:mb-6 sm:mb-8">
        <h2 className="text-lg xs:text-xl sm:text-2xl font-bold text-green-800 mb-1 xs:mb-2">
          <span className="hidden xs:inline">
            ¿Cómo desea registrar la asistencia?
          </span>
          <span className="xs:hidden">Seleccione método</span>
        </h2>
        <p className="text-green-600 text-xs xs:text-sm sm:text-base">
          <span className="hidden sm:inline">
            Seleccione el método que prefiera para registrar la asistencia de{" "}
            {totalEstudiantes} estudiantes de secundaria
          </span>
          <span className="hidden max-sm:inline sm:hidden">
            Método para registrar {totalEstudiantes} estudiantes
          </span>
          <span className="xs:hidden">
            Registrar {totalEstudiantes} estudiantes
          </span>
        </p>
      </div>

      {/* Grid responsive para las tarjetas */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 xs:gap-4 sm:gap-6 md:gap-8">
        {/* Card 1: Escáner QR */}
        <div
          className="bg-white border-2 border-blue-200 rounded-xl p-3 xs:p-4 sm:p-6 md:p-8 cursor-pointer hover:border-blue-400 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
          onClick={() => handleMetodoSelection("qr")}
        >
          <div className="text-center">
            <div className="mb-3 xs:mb-4 sm:mb-6 flex justify-center">
              <div className="w-16 h-16 xs:w-20 xs:h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 flex items-center justify-center">
                <img
                  src="/images/svg/LectorDeQR.svg"
                  alt="Escáner QR"
                  className="h-full aspect-auto"
                />
              </div>
            </div>
            <h3 className="text-sm xs:text-base sm:text-lg md:text-xl font-bold text-blue-800 mb-2 xs:mb-3 sm:mb-4">
              <span className="hidden xs:inline">
                Usar mi celular como escáner de códigos QR
              </span>
              <span className="xs:hidden">Escáner QR</span>
            </h3>
            <p className="text-gray-600 text-xs xs:text-sm leading-relaxed">
              <span className="hidden sm:inline">
                Utiliza la cámara de tu dispositivo para escanear los códigos QR
                que presentan los estudiantes de secundaria. Cada estudiante
                debe presentar su código personal al llegar al colegio.
                Simplemente apunta la cámara hacia el código QR del estudiante y
                el sistema registrará automáticamente su asistencia,
                determinando si llegó puntual o con tardanza según la hora
                establecida.
              </span>
              <span className="hidden xs:inline sm:hidden">
                Usa la cámara para escanear códigos QR de los estudiantes.
                Registro automático y detección de puntualidad.
              </span>
              <span className="xs:hidden">
                Escanea códigos QR con la cámara
              </span>
            </p>
          </div>
        </div>

        {/* Card 2: Registro Manual */}
        <div
          className="bg-white border-2 border-green-200 rounded-xl p-3 xs:p-4 sm:p-6 md:p-8 cursor-pointer hover:border-green-400 hover:shadow-lg transition-all duration-300 transform hover:-translate-y-1"
          onClick={() => handleMetodoSelection("manual")}
        >
          <div className="text-center">
            <div className="mb-3 xs:mb-4 sm:mb-6 flex justify-center">
              <div className="w-16 h-16 xs:w-20 xs:h-20 sm:w-24 sm:h-24 md:w-32 md:h-32 flex items-center justify-center">
                <img
                  src="/images/svg/DatosDeEstudiante.svg"
                  alt="Registro Manual"
                  className="h-full aspect-auto"
                />
              </div>
            </div>
            <h3 className="text-sm xs:text-base sm:text-lg md:text-xl font-bold text-green-800 mb-2 xs:mb-3 sm:mb-4">
              <span className="hidden xs:inline">
                Ingresar datos puntuales de cada Estudiante
              </span>
              <span className="xs:hidden">Registro Manual</span>
            </h3>
            <p className="text-gray-600 text-xs xs:text-sm leading-relaxed">
              <span className="hidden sm:inline">
                Método alternativo para casos especiales donde el escaneo de QR
                no es posible. Úsalo cuando un estudiante olvidó su código QR,
                la cámara de tu celular presenta fallos, el código QR está
                dañado, manchado o ilegible por cualquier motivo. Selecciona
                primero el grado y sección correspondiente, luego busca al
                estudiante por su nombre y apellido en la lista.
              </span>
              <span className="hidden xs:inline sm:hidden">
                Para cuando no se puede usar QR. Selecciona grado, sección y
                busca estudiantes por nombre.
              </span>
              <span className="xs:hidden">Busca estudiantes por nombre</span>
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
            fechaHoraActual={fechaHoraActual}
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
      <header className="bg-green-50 border-b border-green-100 py-2.5 px-3.5 sxs-only:py-1.5 sxs-only:px-2.5 xs-only:py-2.5 xs-only:px-2.5 sm-only:py-2.5 sm-only:px-3.5 md-only:py-2.5 md-only:px-3.5 lg-only:py-3.5 lg-only:px-3.5 xl-only:py-3.5 xl-only:px-3.5 shadow-sm">
        <div className="max-w-7xl mx-auto">
          {/* Layout para móviles (sxs y xs) - Stack vertical */}
          <div className="flex flex-col gap-2.5 sm:hidden">
            {/* Primera fila: Botón retroceder + título */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {metodoSeleccionado !== null && (
                  <button
                    onClick={handleVolver}
                    className="flex items-center text-blanco bg-color-interfaz px-2.5 py-1.5 sxs-only:px-1.5 sxs-only:py-1 rounded-md text-xs sxs-only:text-[0.65rem] font-medium"
                  >
                    <VolverIcon className="w-3.5 sxs-only:w-2.5 mr-1" />
                    <span>Atrás</span>
                  </button>
                )}
                <span className="text-green-900 font-bold text-xs sxs-only:text-[0.65rem]">
                  Asistencia Secundaria
                </span>
              </div>
              <button
                onClick={closeFullScreenModal}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-1.5 px-2.5 sxs-only:py-1 sxs-only:px-1.5 rounded-lg transition-colors text-xs sxs-only:text-[0.65rem]"
              >
                Cerrar
              </button>
            </div>

            {/* Segunda fila: Fecha/hora + tiempo restante */}
            <div className="flex items-center justify-between text-[0.65rem] sxs-only:text-[0.6rem]">
              <div className="flex flex-col">
                <span className="text-green-600 font-medium leading-tight">
                  {fechaHoraActual.formateada?.fechaLegible}
                </span>
                <span className="text-green-600 font-medium leading-tight">
                  {fechaHoraActual.formateada?.horaAmPm}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-red-600 font-medium leading-tight">
                  Queda:
                </span>
                <span className="text-red-700 font-bold leading-tight">
                  {tiempoRestante?.formatoCorto || "Calculando..."}
                </span>
              </div>
            </div>
          </div>

          {/* Layout para tablets y desktop (sm+) - Horizontal */}
          <div className="hidden sm:flex sm:flex-row justify-between items-center gap-3.5">
            <div className="flex items-center gap-2.5">
              {metodoSeleccionado !== null && (
                <button
                  onClick={handleVolver}
                  className="flex items-center text-blanco bg-color-interfaz px-2.5 py-1.5 rounded-md text-xs font-medium"
                >
                  <VolverIcon className="w-4 mr-1" />
                  Retroceder
                </button>
              )}
              <div className="flex flex-col">
                <span className="text-green-600 font-medium text-[0.65rem] leading-tight">
                  {fechaHoraActual.formateada?.fechaLegible}
                </span>
                <span className="text-green-600 font-medium text-[0.65rem] leading-tight">
                  {fechaHoraActual.formateada?.horaAmPm}
                </span>
                <span className="text-green-900 font-bold text-xs md:text-sm lg:text-base leading-tight">
                  Asistencia de Estudiantes - Secundaria
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <div className="flex flex-col items-end">
                <span className="text-red-600 font-medium text-[0.65rem] leading-tight">
                  Tiempo restante:
                </span>
                <span className="text-red-700 font-bold text-[0.65rem] sm:text-xs lg:text-sm leading-tight">
                  {tiempoRestante?.formatoCorto || "Calculando..."}
                </span>
              </div>
              <button
                onClick={closeFullScreenModal}
                className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-2.5 rounded-lg transition-colors shadow-sm text-xs"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Contenido principal con scroll */}
      <main className="overflow-auto bg-gray-50">{renderContenido()}</main>

      {/* Pie de página */}
      <footer className="bg-green-700 text-white border-t border-green-700 py-2 px-2 sxs-only:py-1.5 sxs-only:px-1 xs-only:py-2 xs-only:px-2 sm-only:py-2.5 sm-only:px-3 md-only:py-3 md-only:px-3 shadow-md">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex flex-col items-center gap-0.5 xs:gap-1">
            <p className="font-semibold text-[0.6rem] xs:text-xs sm:text-sm leading-tight">
              <span className="hidden sm:inline">
                I.E. 20935 Asunción 8 - Imperial, Cañete
              </span>
              <span className="sm:hidden">I.E. 20935 Asunción 8</span>
            </p>
            <p className="text-[0.55rem] xs:text-xs opacity-80 leading-tight">
              <span className="hidden xs:inline">
                Sistema de Control de Asistencia - Estudiantes de Secundaria ©{" "}
                {fechaHoraActual.utilidades?.año || new Date().getFullYear()}
              </span>
              <span className="xs:hidden">
                © {fechaHoraActual.utilidades?.año || new Date().getFullYear()}
              </span>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FullScreenModalAsistenciaEstudiantesSecundaria;
