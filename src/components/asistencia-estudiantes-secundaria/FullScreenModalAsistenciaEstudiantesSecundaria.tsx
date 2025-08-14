"use client";

import { saludosDia } from "@/Assets/voice/others/SaludosDelDia";
import { FechaHoraActualRealState } from "@/global/state/others/fechaHoraActualReal";
import {
  ModoRegistro,
  modoRegistroTextos,
} from "@/interfaces/shared/ModoRegistroPersonal";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { determinarPeriodoDia } from "@/lib/calc/determinarPeriodoDia";
import { TiempoRestante } from "@/lib/calc/time/tiempoRestanteHasta";
import { HandlerDirectivoAsistenciaResponse } from "@/lib/utils/local/db/models/DatosAsistenciaHoy/handlers/HandlerDirectivoAsistenciaResponse";
import userStorage from "@/lib/utils/local/db/models/UserStorage";
import { Speaker } from "@/lib/utils/voice/Speaker";
import { useEffect, useState } from "react";
import { obtenerTextoRol } from "../asistencia-personal/ListadoPersonal";
import VolverIcon from "../icons/VolverIcon";

import React from "react";

const FullScreenModalAsistenciaEstudiantesSecundaria = ({
  closeFullScreenModal,
  fechaHoraActual,
  tiempoRestante,
  handlerDatosAsistenciaHoyDirectivo,
}: {
  handlerDatosAsistenciaHoyDirectivo: HandlerDirectivoAsistenciaResponse;
  closeFullScreenModal: () => void;
  fechaHoraActual: FechaHoraActualRealState;
  tiempoRestante?: TiempoRestante | null;
}) => {
  // Estados para controlar el flujo
  const [rolSeleccionado, setRolSeleccionado] = useState<RolesSistema | null>(
    null
  );
  const [modoRegistro, setModoRegistro] = useState<ModoRegistro | null>(null);
  const [cargando, setCargando] = useState(false);

  // Obtener el saludo según la hora del día
  const periodoDelDia = determinarPeriodoDia(
    fechaHoraActual.fechaHora || new Date().toISOString()
  );
  const saludo = saludosDia[periodoDelDia];

  // Efecto para el saludo de bienvenida
  useEffect(() => {
    const saludoDeBienvenida = async () => {
      const nombreCompletoCortoDirectivoLogeado =
        await userStorage.getNombreCompletoCorto();

      const speaker = Speaker.getInstance();

      speaker.start(
        `${saludo}, Directivo ${nombreCompletoCortoDirectivoLogeado}, usted ha iniciado la toma de Asistencia de Personal`
      );
    };

    saludoDeBienvenida();
  }, [saludo]);

  // Manejador para la selección de rol
  const handleRolSelection = (rol: RolesSistema) => {
    setCargando(true);

    // Audio feedback
    const speaker = Speaker.getInstance();
    speaker.start(`Ha seleccionado el rol ${obtenerTextoRol(rol)}`);

    // Simulamos una pequeña carga para mejorar la experiencia
    setTimeout(() => {
      setRolSeleccionado(rol);
      setCargando(false);
    }, 300);
  };

  // Manejador para la selección de modo (entrada/salida)
  const handleModoSelection = (modo: ModoRegistro | null) => {
    setCargando(true);

    // Audio feedback
    const speaker = Speaker.getInstance();
    speaker.start(`Registrando ${modoRegistroTextos[modo!]}`);

    // Simulamos una pequeña carga para mejorar la experiencia
    setTimeout(() => {
      setModoRegistro(modo);
      setCargando(false);
    }, 300);
  };

  // Función para volver al paso anterior
  const handleVolver = () => {
    // Feedback por voz al retroceder
    const speaker = Speaker.getInstance();

    if (modoRegistro !== null) {
      speaker.start(`Volviendo a la selección de modo de registro`);
      setModoRegistro(null);
    } else if (rolSeleccionado !== null) {
      speaker.start(`Volviendo a la selección de rol`);
      setRolSeleccionado(null);
    }
  };

  // Determinar qué contenido mostrar según el estado actual
  const renderContenido = () => {
    // Si estamos cargando, mostrar un spinner
    if (cargando) {
      return (
        <div className="w-full h-full flex items-center justify-center bg-white bg-opacity-75">
          <div className="flex flex-col items-center">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-3 text-blue-600 font-medium text-sm">
              Cargando...
            </p>
          </div>
        </div>
      );
    }
  };

  return (
    <div className="animate__animated animate__fadeInUp [animation-duration:800ms] fixed top-0 left-0 w-full h-[100dvh] grid grid-rows-[auto_1fr_auto] bg-white z-[1001]">
      {/* Cabecera - REDUCIDA */}
      <header className="bg-blue-50 border-b border-blue-100 py-3 px-2 md-only:py-3 md-only:px-3 lg-only:py-4 lg-only:px-3 xl-only:py-4 xl-only:px-3 shadow-sm">
        <div className="max-w-7xl mx-auto flex flex-col sm-only:flex-row md-only:flex-row lg-only:flex-row xl-only:flex-row justify-between items-center gap-1 sm-only:gap-2 gap-y-3">
          <div className="flex items-center gap-3 sm-only:gap-3">
            {/* Botón "Retroceder" - solo visible cuando se ha seleccionado algo */}
            {rolSeleccionado !== null && (
              <button
                onClick={handleVolver}
                className="flex items-center text-blanco bg-color-interfaz px-2 py-1.5 sm-only:px-3 sm-only:py-2 rounded-md text-[0.9rem]"
              >
                <VolverIcon className="w-6 mr-1" />
                Retroceder
              </button>
            )}
            <div className="flex flex-col">
              <span className="text-blue-600 font-medium text-xs leading-tight">
                {fechaHoraActual.formateada?.fechaLegible}
              </span>
              <span className="text-blue-600 font-medium text-xs leading-tight">
                {fechaHoraActual.formateada?.horaAmPm}
              </span>
              <span className="text-blue-900 font-bold text-sm sm-only:text-base md-only:text-base lg-only:text-lg xl-only:text-lg leading-tight text-center sm-only:text-left md-only:text-left lg-only:text-left xl-only:text-left">
                Registro de Asistencia de Personal
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3 sm-only:gap-2 md-only:gap-3 lg-only:gap-3 xl-only:gap-3">
            <div className="flex flex-col items-end">
              <span className="text-red-600 font-medium text-xs leading-tight">
                Toma de Asistencia acaba en:
              </span>
              <span className="text-red-700 font-bold text-xs sm-only:text-sm md-only:text-sm lg-only:text-base xl-only:text-base leading-tight">
                {tiempoRestante?.formatoCorto}
              </span>
            </div>
            <button
              onClick={closeFullScreenModal}
              className="bg-red-600 hover:bg-red-700 text-white font-medium py-1 px-1.5 sm-only:py-1 sm-only:px-2 md-only:py-1.5 md-only:px-3 lg-only:py-1.5 lg-only:px-3 xl-only:py-1.5 xl-only:px-3 rounded-lg transition-colors shadow-sm text-[0.9rem] sm-only:text-[0.9rem] md-only:text-[0.8rem]  lg-only:text-base xl-only:text-base"
            >
              Cerrar
            </button>
          </div>
        </div>
      </header>

      {/* Contenido principal con scroll */}
      <main className="overflow-auto">{renderContenido()}</main>

      {/* Pie de página - REDUCIDO */}
      <footer className="bg-color-interfaz text-white border-t border-color-interfaz py-3 px-2 md-only:py-3 md-only:px-3 lg-only:py-3 lg-only:px-3 xl-only:py-3 xl-only:px-3 shadow-md">
        <div className="max-w-7xl mx-auto text-center">
          <div className="flex flex-col items-center gap-1">
            <p className="font-semibold text-xs sm-only:text-sm md-only:text-sm lg-only:text-sm xl-only:text-sm leading-tight">
              I.E. 20935 Asunción 8 - Imperial, Cañete
            </p>
            <p className="text-xs opacity-80 leading-tight">
              Sistema de Control de Asistencia ©{" "}
              {fechaHoraActual.utilidades?.año || new Date().getFullYear()}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default FullScreenModalAsistenciaEstudiantesSecundaria;
