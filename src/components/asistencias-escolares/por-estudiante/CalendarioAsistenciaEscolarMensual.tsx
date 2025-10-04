"use client";

import { useState } from "react";
import { NivelEducativo } from "@/interfaces/shared/NivelEducativo";
import {
  COLORES_ESTADOS,
  DiaCalendario,
} from "../../../app/(interfaz)/(responsable)/mis-estudiantes-relacionados/[Id_Estudiante]/asistencias-mensuales/types";
import { AsistenciaProcessor } from "../../../lib/utils/asistencia/AsistenciasEscolaresProcessor";
import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";

interface CalendarioAsistenciaEscolarMensualProps {
  dias: DiaCalendario[];
  mesNombre: string;
  nivel?: NivelEducativo;
  isLoading?: boolean;
  successMessage?: { message: string } | null;
  vistaMovil?: "calendario" | "agenda";
  onCambiarVista?: (vista: "calendario" | "agenda") => void;
}

const CalendarioAsistenciaEscolarMensual = ({
  dias,
  mesNombre,
  nivel,
  isLoading = false,
  successMessage = null,
  vistaMovil = "calendario",
  onCambiarVista = () => {},
}: CalendarioAsistenciaEscolarMensualProps) => {
  const [modalAbierto, setModalAbierto] = useState(false);
  const [diaSeleccionado, setDiaSeleccionado] = useState<DiaCalendario | null>(
    null
  );

  if (isLoading) {
    const añoActual = new Date().getFullYear();
    return (
      <div className="w-full min-w-full max-w-full sm:min-w-0 sm:max-w-none mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        <div className="bg-red-600 text-white p-4 text-center">
          <h3 className="text-lg font-bold uppercase sxs-only:text-base xs-only:text-base">
            {mesNombre} - {añoActual}
          </h3>
        </div>
        <div className="p-8 text-center">
          <div className="animate-spin w-8 h-8 border-4 border-red-600 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-sm text-gray-600">Cargando asistencias...</p>
        </div>
      </div>
    );
  }

  const diasEscolares = dias.filter((dia) => dia.esDiaEscolar);
  const mostrarSalida = nivel
    ? AsistenciaProcessor.debeMostrarSalida(nivel)
    : false;

  const obtenerEstilosDia = (dia: DiaCalendario) => {
    if (!dia.asistencia) {
      return {
        container: "bg-gray-50 border-gray-200",
        content: "text-gray-400",
      };
    }

    const colores = COLORES_ESTADOS[dia.asistencia.estado];
    return {
      container: `${colores.background}/10 ${colores.border}/30 border-2`,
      content: "text-gray-800",
    };
  };

  const abrirModal = (dia: DiaCalendario) => {
    setDiaSeleccionado(dia);
    setModalAbierto(true);
  };

  const cerrarModal = () => {
    setModalAbierto(false);
    setDiaSeleccionado(null);
  };

  const obtenerNombreDia = (diaNumero: number, mes: number) => {
    const añoActual = new Date().getFullYear();
    const fecha = new Date(añoActual, mes - 1, diaNumero);
    const dias = [
      "Domingo",
      "Lunes",
      "Martes",
      "Miércoles",
      "Jueves",
      "Viernes",
      "Sábado",
    ];
    return dias[fecha.getDay()];
  };

  const obtenerTextoEstadoCompleto = (estado: EstadosAsistenciaEscolar) => {
    switch (estado) {
      case EstadosAsistenciaEscolar.Temprano:
        return "Asistió Puntual";
      case EstadosAsistenciaEscolar.Tarde:
        return "Tardanza";
      case EstadosAsistenciaEscolar.Falta:
        return "Falta";
      case EstadosAsistenciaEscolar.Evento:
        return "Evento";
      case EstadosAsistenciaEscolar.Vacaciones:
        return "Vacaciones";
      case EstadosAsistenciaEscolar.Inactivo:
        return "Inactivo";
      default:
        return "Sin datos";
    }
  };

  const renderizarDiaDesktop = (dia: DiaCalendario) => {
    const estilos = obtenerEstilosDia(dia);
    const textoEstado = dia.asistencia
      ? AsistenciaProcessor.obtenerTextoEstado(dia.asistencia.estado)
      : "";

    if (dia.asistencia?.estado === EstadosAsistenciaEscolar.Falta) {
      return (
        <div
          className={`${estilos.container} rounded-lg p-2 h-[50px] flex flex-col items-center justify-center`}
        >
          <div className="text-sm font-semibold text-gray-700 mb-0.5">
            {dia.dia}
          </div>
          <div className="flex items-center gap-1">
            <div
              className={`w-5 h-5 ${
                COLORES_ESTADOS[dia.asistencia.estado].background
              } ${
                COLORES_ESTADOS[dia.asistencia.estado].text
              } rounded flex items-center justify-center`}
            >
              <span className="font-bold text-xs">{textoEstado}</span>
            </div>
            <div className="text-xs font-bold text-red-700">FALTA</div>
          </div>
        </div>
      );
    }

    if (!dia.asistencia) {
      return (
        <div
          className={`${estilos.container} rounded-lg p-2 h-[50px] flex items-center justify-center`}
        >
          <div className="text-center">
            <div className="text-sm font-semibold text-gray-400 mb-0.5">
              {dia.dia}
            </div>
            <div className="text-xs text-gray-400">Sin datos</div>
          </div>
        </div>
      );
    }

    return (
      <div className={`${estilos.container} rounded-lg p-2 h-[50px] relative`}>
        <div className="flex items-center justify-between mb-0.5">
          <div className="text-sm font-semibold text-gray-700">{dia.dia}</div>
          <div
            className={`w-4 h-4 ${
              COLORES_ESTADOS[dia.asistencia.estado].background
            } ${
              COLORES_ESTADOS[dia.asistencia.estado].text
            } rounded flex items-center justify-center`}
          >
            <span className="font-bold text-xs">{textoEstado}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          {/* Entrada con mejor formato */}
          {dia.asistencia.entrada && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></div>
              <span className="text-[10px] text-blue-700 font-medium">E:</span>
              <div className="text-xs truncate text-blue-800 font-semibold">
                {dia.asistencia.entrada.hora || "N/A"}
              </div>
            </div>
          )}

          {/* Salida con mejor formato (si está habilitada) */}
          {mostrarSalida && dia.asistencia.salida && (
            <div className="flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-gray-500 rounded-full flex-shrink-0"></div>
              <span className="text-[10px] text-gray-700 font-medium">S:</span>
              <div className="text-xs truncate text-gray-800 font-semibold">
                {dia.asistencia.salida.hora || "N/A"}
              </div>
            </div>
          )}

          {/* Estado especial */}
          {(dia.asistencia.estado === EstadosAsistenciaEscolar.Evento ||
            dia.asistencia.estado === EstadosAsistenciaEscolar.Vacaciones ||
            dia.asistencia.estado === EstadosAsistenciaEscolar.Inactivo) && (
            <div className="text-center">
              <div className="text-xs font-medium text-gray-600">
                {dia.asistencia.estado === EstadosAsistenciaEscolar.Evento &&
                  "Evento"}
                {dia.asistencia.estado ===
                  EstadosAsistenciaEscolar.Vacaciones && "Vacaciones"}
                {dia.asistencia.estado === EstadosAsistenciaEscolar.Inactivo &&
                  "Inactivo"}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderizarDiaMovilCalendario = (dia: DiaCalendario) => {
    const textoEstado = dia.asistencia
      ? AsistenciaProcessor.obtenerTextoEstado(dia.asistencia.estado)
      : "-";
    const colores = dia.asistencia
      ? COLORES_ESTADOS[dia.asistencia.estado]
      : {
          background: "bg-gray-100",
          text: "text-gray-400",
        };

    return (
      <div className="bg-white border border-gray-200 rounded-lg p-2 min-h-[60px] flex flex-col items-center justify-center">
        <div className="text-sm font-semibold text-gray-700 mb-1">
          {dia.dia}
        </div>
        <div
          className={`w-6 h-6 ${colores.background} ${colores.text} rounded flex items-center justify-center`}
        >
          <span className="font-bold text-xs">{textoEstado}</span>
        </div>
      </div>
    );
  };

  const renderizarVistaAgenda = () => {
    const añoActual = new Date().getFullYear();
    const mesActual =
      parseInt(mesNombre.split(" ")[0]) || new Date().getMonth() + 1;

    return (
      <div className="w-full min-w-full max-w-full sm:min-w-0 sm:max-w-none mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header con botón para cambiar vista */}
        <div className="bg-red-600 text-white p-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-bold uppercase">
              {mesNombre} - {añoActual}
            </h3>
            <button
              onClick={() => onCambiarVista("calendario")}
              className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm transition-colors"
            >
              Ver Calendario
            </button>
          </div>
        </div>

        {/* Lista de días estilo agenda */}
        <div className="p-2 space-y-2 max-h-[400px] overflow-y-auto">
          {diasEscolares.map((dia, index) => {
            const estilos = obtenerEstilosDia(dia);
            const textoEstado = dia.asistencia
              ? AsistenciaProcessor.obtenerTextoEstado(dia.asistencia.estado)
              : "-";
            const colores = dia.asistencia
              ? COLORES_ESTADOS[dia.asistencia.estado]
              : {
                  background: "bg-gray-100",
                  text: "text-gray-400",
                };
            const nombreDia = obtenerNombreDia(dia.dia, mesActual);

            return (
              <div
                key={index}
                className={`${estilos.container} rounded-lg p-3 border`}
              >
                {/* Header del día más compacto */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <div className="text-xl font-bold text-gray-800">
                        {dia.dia}
                      </div>
                      <div className="text-xs text-gray-500 uppercase tracking-wide">
                        {mesNombre.split(" ")[0]}
                      </div>
                    </div>
                    <div className="flex flex-col">
                      <div className="text-sm font-medium text-gray-700">
                        {nombreDia}
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className={`w-5 h-5 ${colores.background} ${colores.text} rounded flex items-center justify-center`}
                        >
                          <span className="font-bold text-xs">
                            {textoEstado}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-gray-600">
                          {dia.asistencia
                            ? obtenerTextoEstadoCompleto(dia.asistencia.estado)
                            : "Sin datos"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Detalles de asistencia más compactos */}
                {dia.asistencia && (
                  <div className="space-y-2">
                    {/* Para faltas: mensaje especial más compacto */}
                    {dia.asistencia.estado ===
                    EstadosAsistenciaEscolar.Falta ? (
                      <div className="bg-red-50 p-2 rounded border border-red-200">
                        <div className="text-center">
                          <div className="text-sm font-medium text-red-800 mb-1">
                            El estudiante faltó este día
                          </div>
                          <div className="text-xs text-red-600">
                            No hay registros disponibles
                          </div>
                        </div>
                      </div>
                    ) : (
                      /* Para otros estados con registros */
                      <div className="grid grid-cols-1 gap-2">
                        {/* Entrada */}
                        {dia.asistencia.entrada && (
                          <div className="bg-blue-50 p-2 rounded border border-blue-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                <span className="font-medium text-blue-700 text-sm">
                                  ENTRADA
                                </span>
                              </div>
                              <span className="text-base font-bold text-blue-800">
                                {dia.asistencia.entrada.hora || "No registrada"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Salida (si está habilitada) */}
                        {mostrarSalida && dia.asistencia.salida && (
                          <div className="bg-gray-50 p-2 rounded border border-gray-200">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-2 h-2 bg-gray-500 rounded-full"></div>
                                <span className="font-medium text-gray-700 text-sm">
                                  SALIDA
                                </span>
                              </div>
                              <span className="text-base font-bold text-gray-800">
                                {dia.asistencia.salida.hora || "No registrada"}
                              </span>
                            </div>
                          </div>
                        )}

                        {/* Estados especiales sin horas */}
                        {!dia.asistencia.entrada &&
                          (dia.asistencia.estado ===
                            EstadosAsistenciaEscolar.Evento ||
                            dia.asistencia.estado ===
                              EstadosAsistenciaEscolar.Vacaciones ||
                            dia.asistencia.estado ===
                              EstadosAsistenciaEscolar.Inactivo) && (
                            <div className="bg-amber-50 p-2 rounded border border-amber-200">
                              <div className="text-center">
                                <div className="text-sm font-medium text-amber-800">
                                  {dia.asistencia.estado ===
                                    EstadosAsistenciaEscolar.Evento &&
                                    "Día de evento especial"}
                                  {dia.asistencia.estado ===
                                    EstadosAsistenciaEscolar.Vacaciones &&
                                    "Día de vacaciones"}
                                  {dia.asistencia.estado ===
                                    EstadosAsistenciaEscolar.Inactivo &&
                                    "Estudiante inactivo"}
                                </div>
                              </div>
                            </div>
                          )}
                      </div>
                    )}
                  </div>
                )}

                {/* Sin datos */}
                {!dia.asistencia && (
                  <div className="bg-gray-50 p-2 rounded border border-gray-200 text-center">
                    <span className="text-sm text-gray-500">
                      Sin información disponible
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // Vista Agenda para móvil
  if (vistaMovil === "agenda") {
    return renderizarVistaAgenda();
  }

  return (
    <div className="w-full">
      {/* Mensaje de éxito compacto encima del calendario */}
      {successMessage && (
        <div className="mb-3 min-w-full max-w-full sm:min-w-0 sm:max-w-none mx-auto bg-green-50 border border-green-200 text-green-800 px-3 py-2 rounded-md text-sm">
          {successMessage.message}
        </div>
      )}

      <div className="w-full min-w-full max-w-full sm:min-w-0 sm:max-w-none mx-auto bg-white rounded-lg shadow-md overflow-hidden">
        {/* Header del mes con centrado mejorado */}
        <div className="bg-red-600 text-white p-4">
          <div className="flex justify-between items-center">
            {/* Título centrado en desktop cuando no hay botón */}
            <div className="hidden sm:block w-full text-center">
              <h3 className="text-lg font-bold uppercase sxs-only:text-base xs-only:text-base">
                {mesNombre} - {new Date().getFullYear()}
              </h3>
            </div>

            {/* Layout móvil con botón para cambiar vista */}
            <div className="sm:hidden flex justify-between items-center w-full">
              <h3 className="text-lg font-bold uppercase sxs-only:text-base xs-only:text-base">
                {mesNombre} - {new Date().getFullYear()}
              </h3>
              <button
                onClick={() => onCambiarVista("agenda")}
                className="bg-red-700 hover:bg-red-800 px-3 py-1 rounded text-sm transition-colors"
              >
                Ver Detalles
              </button>
            </div>
          </div>
        </div>

        {/* Grilla del calendario con padding mejorado */}
        <div className="p-3 sm:p-4">
          {/* Headers de días de la semana */}
          <div className="grid grid-cols-5 gap-1 mb-2">
            {["Lun", "Mar", "Mié", "Jue", "Vie"].map((dia) => (
              <div
                key={dia}
                className="text-center font-semibold text-gray-700 py-1 text-xs"
              >
                {dia}
              </div>
            ))}
          </div>

          {/* Días del mes organizados por semanas */}
          <div className="space-y-1">
            {Array.from(
              { length: Math.ceil(diasEscolares.length / 5) },
              (_, semanaIndex) => {
                const diasDeLaSemana = diasEscolares.slice(
                  semanaIndex * 5,
                  (semanaIndex + 1) * 5
                );

                return (
                  <div key={semanaIndex} className="grid grid-cols-5 gap-1">
                    {[0, 1, 2, 3, 4].map((diaIndex) => {
                      const dia = diasDeLaSemana[diaIndex];

                      if (!dia) {
                        return (
                          <div
                            key={diaIndex}
                            className="h-[50px] sm:h-[50px]"
                          ></div>
                        );
                      }

                      return (
                        <div key={diaIndex}>
                          {/* Vista Desktop: Completa */}
                          <div className="hidden sm:block">
                            {renderizarDiaDesktop(dia)}
                          </div>

                          {/* Vista Móvil: Minimalista */}
                          <div className="sm:hidden">
                            {renderizarDiaMovilCalendario(dia)}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              }
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CalendarioAsistenciaEscolarMensual;
