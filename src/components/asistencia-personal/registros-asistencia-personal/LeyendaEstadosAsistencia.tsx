/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Info, Clock } from "lucide-react";
import { EstadosAsistenciaPersonalStyles } from "@/Assets/styles/EstadosAsistenciaPersonalStyles";
import { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";
import { ENTORNO } from "@/constants/ENTORNO";
import { Entorno } from "@/interfaces/shared/Entornos";

interface LeyendaEstadosAsistenciaProps {
  registros: any[];
  loading: boolean;
  loadingEventos: boolean;
  mapearEstadoParaUI: (estado: EstadosAsistenciaPersonal) => string;
  considerarDiasNoEscolares?: boolean;
}

const LeyendaEstadosAsistencia: React.FC<LeyendaEstadosAsistenciaProps> = ({
  registros,
  loading,
  loadingEventos,
  mapearEstadoParaUI,
  considerarDiasNoEscolares = false,
}) => {
  if (registros.length === 0 || loading || loadingEventos) {
    return null;
  }

  return (
    <div className="mt-6 bg-white rounded-lg shadow-md sxs-only:p-3 xs-only:p-3 sm-only:p-4 md-only:p-5 lg-only:p-6 xl-only:p-6">
      <div className="flex items-center space-x-2 mb-4">
        <Info className="sxs-only:w-4 sxs-only:h-4 xs-only:w-4 xs-only:h-4 sm-only:w-5 sm-only:h-5 md-only:w-5 md-only:h-5 lg-only:w-5 lg-only:h-5 xl-only:w-5 xl-only:h-5 text-blue-500 flex-shrink-0" />
        <h4 className="sxs-only:text-sm xs-only:text-sm sm-only:text-base md-only:text-base lg-only:text-base xl-only:text-base font-bold text-gray-900 truncate">
          Leyenda de Estados de Asistencia
        </h4>
      </div>

      <div className="grid sxs-only:grid-cols-1 xs-only:grid-cols-1 sm-only:grid-cols-1 md-only:grid-cols-2 lg-only:grid-cols-3 xl-only:grid-cols-3 sxs-only:gap-3 xs-only:gap-3 sm-only:gap-4 md-only:gap-4 lg-only:gap-4 xl-only:gap-4">
        {/* Estados de Entrada */}
        <div className="space-y-2 min-w-0">
          <h5 className="sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-sm font-semibold text-gray-700 bg-gray-100 sxs-only:px-2 sxs-only:py-1 xs-only:px-2 xs-only:py-1 sm-only:px-2 sm-only:py-1 md-only:px-2 md-only:py-1 lg-only:px-2 lg-only:py-1 xl-only:px-2 xl-only:py-1 rounded-md truncate">
            Estados de Entrada
          </h5>
          <div className="space-y-2">
            {[
              {
                estado: EstadosAsistenciaPersonal.En_Tiempo,
                descripcion: "Llegó dentro del horario establecido",
              },
              {
                estado: EstadosAsistenciaPersonal.Temprano,
                descripcion: "Llegó antes del horario programado",
              },
              {
                estado: EstadosAsistenciaPersonal.Tarde,
                descripcion: "Llegó después del horario establecido",
              },
            ].map(({ estado, descripcion }) => (
              <div key={estado} className="flex items-start space-x-2 min-w-0">
                <span
                  className={`inline-flex sxs-only:px-1.5 sxs-only:py-0.5 xs-only:px-1.5 xs-only:py-0.5 sm-only:px-2 sm-only:py-0.5 md-only:px-2 md-only:py-0.5 lg-only:px-2 lg-only:py-0.5 xl-only:px-2 xl-only:py-0.5 rounded-full sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs font-semibold flex-shrink-0 ${EstadosAsistenciaPersonalStyles[estado]}`}
                >
                  {mapearEstadoParaUI(estado)}
                </span>
                <p className="sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs text-gray-600 truncate min-w-0 flex-1">
                  {descripcion}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Estados de Salida */}
        <div className="space-y-2 min-w-0">
          <h5 className="sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-sm font-semibold text-gray-700 bg-gray-100 sxs-only:px-2 sxs-only:py-1 xs-only:px-2 xs-only:py-1 sm-only:px-2 sm-only:py-1 md-only:px-2 md-only:py-1 lg-only:px-2 lg-only:py-1 xl-only:px-2 xl-only:py-1 rounded-md truncate">
            Estados de Salida
          </h5>
          <div className="space-y-2">
            {[
              {
                estado: EstadosAsistenciaPersonal.Cumplido,
                descripcion: "Completó su horario laboral correctamente",
              },
              {
                estado: EstadosAsistenciaPersonal.Salida_Anticipada,
                descripcion: "Se retiró antes del horario establecido",
              },
            ].map(({ estado, descripcion }) => (
              <div key={estado} className="flex items-start space-x-2 min-w-0">
                <span
                  className={`inline-flex sxs-only:px-1.5 sxs-only:py-0.5 xs-only:px-1.5 xs-only:py-0.5 sm-only:px-2 sm-only:py-0.5 md-only:px-2 md-only:py-0.5 lg-only:px-2 lg-only:py-0.5 xl-only:px-2 xl-only:py-0.5 rounded-full sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs font-semibold flex-shrink-0 ${EstadosAsistenciaPersonalStyles[estado]}`}
                >
                  {mapearEstadoParaUI(estado)}
                </span>
                <p className="sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs text-gray-600 truncate min-w-0 flex-1">
                  {descripcion}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Estados Especiales */}
        <div className="space-y-2 min-w-0 sxs-only:col-span-1 xs-only:col-span-1 sm-only:col-span-1 md-only:col-span-2 lg-only:col-span-1 xl-only:col-span-1">
          <h5 className="sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-sm font-semibold text-gray-700 bg-gray-100 sxs-only:px-2 sxs-only:py-1 xs-only:px-2 xs-only:py-1 sm-only:px-2 sm-only:py-1 md-only:px-2 md-only:py-1 lg-only:px-2 lg-only:py-1 xl-only:px-2 xl-only:py-1 rounded-md truncate">
            Estados Especiales
          </h5>
          <div className="space-y-2">
            {[
              {
                estado: EstadosAsistenciaPersonal.Falta,
                descripcion: "No asistió al trabajo ese día",
              },
              {
                estado: EstadosAsistenciaPersonal.No_Registrado,
                descripcion: "No marcó entrada/salida en el sistema",
              },
              {
                estado: EstadosAsistenciaPersonal.Sin_Registro,
                descripcion: "No se tomó asistencia ese día",
              },
              {
                estado: EstadosAsistenciaPersonal.Inactivo,
                descripcion: "Usuario inactivo en el sistema",
              },
              {
                estado: EstadosAsistenciaPersonal.Evento,
                descripcion: "Día feriado o evento especial",
              },
            ].map(({ estado, descripcion }) => (
              <div key={estado} className="flex items-start space-x-2 min-w-0">
                <span
                  className={`inline-flex sxs-only:px-1.5 sxs-only:py-0.5 xs-only:px-1.5 xs-only:py-0.5 sm-only:px-2 sm-only:py-0.5 md-only:px-2 md-only:py-0.5 lg-only:px-2 lg-only:py-0.5 xl-only:px-2 xl-only:py-0.5 rounded-full sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs font-semibold flex-shrink-0 ${EstadosAsistenciaPersonalStyles[estado]}`}
                >
                  {mapearEstadoParaUI(estado)}
                </span>
                <p className="sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs text-gray-600 truncate min-w-0 flex-1">
                  {descripcion}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Información importante */}
      <div className="mt-4 sxs-only:p-2 xs-only:p-2 sm-only:p-3 md-only:p-3 lg-only:p-3 xl-only:p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg">
        <div className="flex items-start space-x-2">
          <Clock className="sxs-only:w-3 sxs-only:h-3 xs-only:w-3 xs-only:h-3 sm-only:w-4 sm-only:h-4 md-only:w-4 md-only:h-4 lg-only:w-4 lg-only:h-4 xl-only:w-4 xl-only:h-4 text-blue-600 sxs-only:mt-0 xs-only:mt-0 sm-only:mt-0.5 md-only:mt-0.5 lg-only:mt-0.5 xl-only:mt-0.5 flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <h5 className="text-blue-800 font-semibold sxs-only:mb-1 xs-only:mb-1 sm-only:mb-2 md-only:mb-2 lg-only:mb-2 xl-only:mb-2 truncate sxs-only:text-xs xs-only:text-xs sm-only:text-sm md-only:text-sm lg-only:text-sm xl-only:text-sm">
              Información del Sistema
            </h5>
            <div className="grid sxs-only:grid-cols-1 xs-only:grid-cols-1 sm-only:grid-cols-1 md-only:grid-cols-2 lg-only:grid-cols-2 xl-only:grid-cols-2 sxs-only:gap-1 xs-only:gap-1 sm-only:gap-2 md-only:gap-2 lg-only:gap-2 xl-only:gap-2 sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs text-blue-700">
              <div className="flex items-start space-x-1 min-w-0">
                <span className="text-blue-600 font-bold flex-shrink-0">
                  📊
                </span>
                <span className="truncate">
                  Los estados se calculan automáticamente según la diferencia
                  entre horarios programados y reales
                </span>
              </div>
              <div className="flex items-start space-x-1 min-w-0">
                <span className="text-green-600 font-bold flex-shrink-0">
                  ⏰
                </span>
                <span className="truncate">
                  Los registros se sincronizan en tiempo real con el servidor
                </span>
              </div>
              <div className="flex items-start space-x-1 min-w-0">
                <span className="text-purple-600 font-bold flex-shrink-0">
                  📅
                </span>
                <span className="truncate">
                  Se muestran solo días laborables hasta la fecha actual
                </span>
              </div>
              <div className="flex items-start space-x-1 min-w-0">
                <span className="text-orange-600 font-bold flex-shrink-0">
                  🎯
                </span>
                <span className="truncate">
                  Los datos incluyen entrada, salida y diferencias horarias
                </span>
              </div>
              {considerarDiasNoEscolares && ENTORNO === Entorno.LOCAL && (
                <div className="sxs-only:col-span-1 xs-only:col-span-1 sm-only:col-span-1 md-only:col-span-2 lg-only:col-span-2 xl-only:col-span-2 flex items-start space-x-1 min-w-0">
                  <span className="text-amber-600 font-bold flex-shrink-0">
                    ⚠️
                  </span>
                  <span className="truncate">
                    <strong>Modo Desarrollo:</strong> Los registros con fondo
                    azul corresponden a fines de semana
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LeyendaEstadosAsistencia;
