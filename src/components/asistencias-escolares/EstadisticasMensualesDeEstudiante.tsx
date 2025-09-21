"use client";

import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";
import {
  COLORES_ESTADOS,
  EstadisticasMes,
} from "../../app/(interfaz)/(responsable)/mis-estudiantes-relacionados/[Id_Estudiante]/asistencias-mensuales/types";

interface EstadisticasMensualesDeEstudianteProps {
  estadisticas: EstadisticasMes;
  mesNombre: string;
}

const EstadisticasMensualesDeEstudiante = ({
  estadisticas,
  mesNombre,
}: EstadisticasMensualesDeEstudianteProps) => {
  const tarjetas = [
    {
      titulo: "Asistencias",
      valor: estadisticas.asistencias,
      estado: EstadosAsistenciaEscolar.Temprano,
      icono: "✓",
    },
    {
      titulo: "Tardanzas",
      valor: estadisticas.tardanzas,
      estado: EstadosAsistenciaEscolar.Tarde,
      icono: "⏰",
    },
    {
      titulo: "Faltas",
      valor: estadisticas.faltas,
      estado: EstadosAsistenciaEscolar.Falta,
      icono: "✗",
    },
    {
      titulo: "Total Días",
      valor: estadisticas.totalDias,
      estado: null,
      icono: "📅",
    },
  ];

  // Incluir estadísticas adicionales si existen
  if (estadisticas.eventos > 0) {
    tarjetas.push({
      titulo: "Eventos",
      valor: estadisticas.eventos,
      estado: EstadosAsistenciaEscolar.Evento,
      icono: "🎉",
    });
  }

  if (estadisticas.vacaciones > 0) {
    tarjetas.push({
      titulo: "Vacaciones",
      valor: estadisticas.vacaciones,
      estado: EstadosAsistenciaEscolar.Vacaciones,
      icono: "🏖️",
    });
  }

  const obtenerEstiloTarjeta = (estado: EstadosAsistenciaEscolar | null) => {
    if (!estado) {
      return {
        background: "bg-gray-100",
        text: "text-gray-800",
        border: "border-gray-200",
      };
    }

    const colores = COLORES_ESTADOS[estado];
    return {
      background: colores.background.replace("bg-", "bg-") + "/10",
      text: colores.text
        .replace("text-white", "text-gray-800")
        .replace("text-black", "text-gray-800"),
      border: colores.border.replace("border-", "border-") + "/30",
    };
  };

  return (
    <div className="w-full">
      <h2 className="text-base font-semibold text-gray-800 mb-2 sm:mb-3 text-center">
        Estadísticas de {mesNombre}
      </h2>

      {/* Estadísticas principales: 4 columnas en móvil, 2x2 en desktop */}
      <div className="grid grid-cols-4 sm:grid-cols-2 gap-1 sm:gap-1.5 mb-2 sm:mb-3">
        {tarjetas.slice(0, 4).map((tarjeta, index) => {
          const estilos = obtenerEstiloTarjeta(tarjeta.estado);

          return (
            <div
              key={index}
              className={`${estilos.background} ${estilos.border} border rounded p-1 sm:p-2 text-center shadow-sm`}
            >
              <div className="text-sm sm:text-base mb-0.5 sm:mb-1">
                {tarjeta.icono}
              </div>
              <div
                className={`text-sm sm:text-base font-bold ${estilos.text} mb-0.5 sm:mb-1`}
              >
                {tarjeta.valor}
              </div>
              <div className="text-xs sm:text-sm text-gray-600 font-medium leading-tight">
                {tarjeta.titulo}
              </div>
            </div>
          );
        })}
      </div>

      {/* Estadísticas adicionales más compactas si existen */}
      {tarjetas.length > 4 && (
        <div className="mb-2 sm:mb-3">
          <div className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2 text-center">
            Días Especiales
          </div>
          <div className="space-y-1 sm:space-y-1.5">
            {tarjetas.slice(4).map((tarjeta, index) => {
              const estilos = obtenerEstiloTarjeta(tarjeta.estado);

              return (
                <div
                  key={index + 4}
                  className={`${estilos.background} ${estilos.border} border rounded p-1 sm:p-1.5 text-center shadow-sm`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <div className="text-sm sm:text-base">{tarjeta.icono}</div>
                    <div className="flex-1">
                      <div
                        className={`text-sm sm:text-base font-bold ${estilos.text}`}
                      >
                        {tarjeta.valor}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 font-medium">
                        {tarjeta.titulo}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Resumen visual más compacto */}
      <div className="pt-2 sm:pt-3 border-t border-gray-200">
        <h3 className="text-xs sm:text-sm font-medium text-gray-600 mb-1 sm:mb-2 text-center">
          Resumen Visual
        </h3>

        <div className="space-y-1.5 sm:space-y-2">
          {/* Asistencias */}
          <div>
            <div className="flex justify-between items-center mb-0.5 sm:mb-1">
              <span className="text-xs sm:text-sm font-medium text-green-700">
                Asistencias
              </span>
              <span className="text-xs sm:text-sm text-gray-600">
                {estadisticas.totalDias > 0
                  ? `${Math.round(
                      (estadisticas.asistencias / estadisticas.totalDias) * 100
                    )}%`
                  : "0%"}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
              <div
                className="bg-green-500 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                style={{
                  width:
                    estadisticas.totalDias > 0
                      ? `${
                          (estadisticas.asistencias / estadisticas.totalDias) *
                          100
                        }%`
                      : "0%",
                }}
              ></div>
            </div>
          </div>

          {/* Tardanzas */}
          <div>
            <div className="flex justify-between items-center mb-0.5 sm:mb-1">
              <span className="text-xs sm:text-sm font-medium text-orange-700">
                Tardanzas
              </span>
              <span className="text-xs sm:text-sm text-gray-600">
                {estadisticas.totalDias > 0
                  ? `${Math.round(
                      (estadisticas.tardanzas / estadisticas.totalDias) * 100
                    )}%`
                  : "0%"}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
              <div
                className="bg-orange-500 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                style={{
                  width:
                    estadisticas.totalDias > 0
                      ? `${
                          (estadisticas.tardanzas / estadisticas.totalDias) *
                          100
                        }%`
                      : "0%",
                }}
              ></div>
            </div>
          </div>

          {/* Faltas */}
          <div>
            <div className="flex justify-between items-center mb-0.5 sm:mb-1">
              <span className="text-xs sm:text-sm font-medium text-red-700">
                Faltas
              </span>
              <span className="text-xs sm:text-sm text-gray-600">
                {estadisticas.totalDias > 0
                  ? `${Math.round(
                      (estadisticas.faltas / estadisticas.totalDias) * 100
                    )}%`
                  : "0%"}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
              <div
                className="bg-red-500 h-1.5 sm:h-2 rounded-full transition-all duration-300"
                style={{
                  width:
                    estadisticas.totalDias > 0
                      ? `${
                          (estadisticas.faltas / estadisticas.totalDias) * 100
                        }%`
                      : "0%",
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Indicador de rendimiento más compacto */}
      <div className="mt-2 sm:mt-3 pt-1.5 sm:pt-2 border-t border-gray-200">
        <div className="text-center">
          <div className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">
            Rendimiento
          </div>
          <div
            className={`text-sm sm:text-base font-bold ${
              estadisticas.totalDias > 0 &&
              estadisticas.asistencias / estadisticas.totalDias >= 0.9
                ? "text-green-600"
                : estadisticas.totalDias > 0 &&
                  estadisticas.asistencias / estadisticas.totalDias >= 0.7
                ? "text-orange-600"
                : "text-red-600"
            }`}
          >
            {estadisticas.totalDias > 0 &&
            estadisticas.asistencias / estadisticas.totalDias >= 0.9
              ? "Excelente"
              : estadisticas.totalDias > 0 &&
                estadisticas.asistencias / estadisticas.totalDias >= 0.7
              ? "Regular"
              : "Necesita Atención"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default EstadisticasMensualesDeEstudiante;
