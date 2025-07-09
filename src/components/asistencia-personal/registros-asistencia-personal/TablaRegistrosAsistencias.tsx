/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { FileText } from "lucide-react";
import { EstadosAsistenciaPersonalStyles } from "@/Assets/styles/EstadosAsistenciaPersonalStyles";
import { EstadosAsistenciaPersonal } from "@/interfaces/shared/EstadosAsistenciaPersonal";

interface RegistroDia {
  fecha: string;
  entradaProgramada: string;
  entradaReal: string;
  diferenciaEntrada: string;
  estadoEntrada: EstadosAsistenciaPersonal;
  salidaProgramada: string;
  salidaReal: string;
  diferenciaSalida: string;
  estadoSalida: EstadosAsistenciaPersonal;
  esEvento: boolean;
  nombreEvento?: string;
  esDiaNoEscolar?: boolean;
}

interface TablaRegistrosAsistenciaProps {
  registros: RegistroDia[];
  loading: boolean;
  loadingEventos: boolean;
  mapearEstadoParaUI: (estado: EstadosAsistenciaPersonal) => string;
}

const TablaRegistrosAsistencia: React.FC<TablaRegistrosAsistenciaProps> = ({
  registros,
  loading,
  loadingEventos,
  mapearEstadoParaUI,
}) => {
  if (registros.length === 0 || loading || loadingEventos) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="sxs-only:p-3 xs-only:p-3 sm-only:p-4 md-only:p-4 lg-only:p-4 xl-only:p-4 border-b border-gray-100">
        <div className="flex items-center space-x-2">
          <FileText className="sxs-only:w-4 sxs-only:h-4 xs-only:w-4 xs-only:h-4 sm-only:w-5 sm-only:h-5 md-only:w-5 md-only:h-5 lg-only:w-5 lg-only:h-5 xl-only:w-5 xl-only:h-5 text-gray-600 flex-shrink-0" />
          <h3 className="sxs-only:text-sm xs-only:text-sm sm-only:text-base md-only:text-base lg-only:text-base xl-only:text-base font-bold text-gray-900 truncate">
            Detalle de Asistencias
          </h3>
        </div>
      </div>

      {/* Tabla responsiva */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gris-oscuro text-white">
            <tr>
              <th className="px-2 lg-only:px-4 py-3 text-center text-xs lg-only:text-sm font-medium">
                Fecha
              </th>
              <th className="px-2 lg-only:px-4 py-3 text-center text-xs lg-only:text-sm font-medium">
                Entrada Programada
              </th>
              <th className="px-2 lg-only:px-4 py-3 text-center text-xs lg-only:text-sm font-medium">
                Entrada Real
              </th>
              <th className="px-2 lg-only:px-4 py-3 text-center text-xs lg-only:text-sm font-medium">
                Diferencia Entrada
              </th>
              <th className="px-2 lg-only:px-4 py-3 text-center text-xs lg-only:text-sm font-medium">
                Estado Entrada
              </th>
              <th className="px-2 lg-only:px-4 py-3 text-center text-xs lg-only:text-sm font-medium">
                Salida Programada
              </th>
              <th className="px-2 lg-only:px-4 py-3 text-center text-xs lg-only:text-sm font-medium">
                Salida Real
              </th>
              <th className="px-2 lg-only:px-4 py-3 text-center text-xs lg-only:text-sm font-medium">
                Diferencia Salida
              </th>
              <th className="px-2 lg-only:px-4 py-3 text-center text-xs lg-only:text-sm font-medium">
                Estado Salida
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gris-claro">
            {registros.map((registro, index) => (
              <tr
                key={registro.fecha}
                className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50"} ${
                  registro.esDiaNoEscolar && !registro.esEvento
                    ? "bg-blue-50"
                    : ""
                }`}
              >
                <td className="sxs-only:px-1 sxs-only:py-2 xs-only:px-1 xs-only:py-2 sm-only:px-2 sm-only:py-3 md-only:px-2 md-only:py-3 lg-only:px-4 lg-only:py-3 xl-only:px-4 xl-only:py-3 sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-sm xl-only:text-sm text-gris-oscuro text-center">
                  <div className="flex flex-col items-center">
                    <span>
                      {new Date(
                        registro.fecha + "T00:00:00"
                      ).toLocaleDateString("es-ES", {
                        weekday: "short",
                        day: "2-digit",
                        month: "2-digit",
                      })}
                    </span>
                    {registro.esEvento && (
                      <div className="sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs text-violeta-principal font-medium mt-1">
                        🎉 {registro.nombreEvento}
                      </div>
                    )}
                    {registro.esDiaNoEscolar && !registro.esEvento && (
                      <div className="sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs text-blue-600 font-medium mt-1">
                        📅 Fin de semana
                      </div>
                    )}
                  </div>
                </td>
                <td className="sxs-only:px-1 sxs-only:py-2 xs-only:px-1 xs-only:py-2 sm-only:px-2 sm-only:py-3 md-only:px-2 md-only:py-3 lg-only:px-4 lg-only:py-3 xl-only:px-4 xl-only:py-3 sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-sm xl-only:text-sm text-gris-oscuro text-center">
                  {registro.entradaProgramada}
                </td>
                <td className="sxs-only:px-1 sxs-only:py-2 xs-only:px-1 xs-only:py-2 sm-only:px-2 sm-only:py-3 md-only:px-2 md-only:py-3 lg-only:px-4 lg-only:py-3 xl-only:px-4 xl-only:py-3 sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-sm xl-only:text-sm text-gris-oscuro text-center">
                  {registro.entradaReal}
                </td>
                <td className="sxs-only:px-1 sxs-only:py-2 xs-only:px-1 xs-only:py-2 sm-only:px-2 sm-only:py-3 md-only:px-2 md-only:py-3 lg-only:px-4 lg-only:py-3 xl-only:px-4 xl-only:py-3 sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-sm xl-only:text-sm text-gris-oscuro text-center">
                  {registro.diferenciaEntrada}
                </td>
                <td className="sxs-only:px-1 sxs-only:py-2 xs-only:px-1 xs-only:py-2 sm-only:px-2 sm-only:py-3 md-only:px-2 md-only:py-3 lg-only:px-4 lg-only:py-3 xl-only:px-4 xl-only:py-3 text-center">
                  <span
                    className={`inline-block sxs-only:px-1 sxs-only:py-0.5 xs-only:px-1 xs-only:py-0.5 sm-only:px-2 sm-only:py-1 md-only:px-2 md-only:py-1 lg-only:px-2 lg-only:py-1 xl-only:px-2 xl-only:py-1 rounded-full sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs font-medium ${
                      EstadosAsistenciaPersonalStyles[registro.estadoEntrada]
                    }`}
                  >
                    {mapearEstadoParaUI(registro.estadoEntrada)}
                  </span>
                </td>
                <td className="sxs-only:px-1 sxs-only:py-2 xs-only:px-1 xs-only:py-2 sm-only:px-2 sm-only:py-3 md-only:px-2 md-only:py-3 lg-only:px-4 lg-only:py-3 xl-only:px-4 xl-only:py-3 sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-sm xl-only:text-sm text-gris-oscuro text-center">
                  {registro.salidaProgramada}
                </td>
                <td className="sxs-only:px-1 sxs-only:py-2 xs-only:px-1 xs-only:py-2 sm-only:px-2 sm-only:py-3 md-only:px-2 md-only:py-3 lg-only:px-4 lg-only:py-3 xl-only:px-4 xl-only:py-3 sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-sm xl-only:text-sm text-gris-oscuro text-center">
                  {registro.salidaReal}
                </td>
                <td className="sxs-only:px-1 sxs-only:py-2 xs-only:px-1 xs-only:py-2 sm-only:px-2 sm-only:py-3 md-only:px-2 md-only:py-3 lg-only:px-4 lg-only:py-3 xl-only:px-4 xl-only:py-3 sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-sm xl-only:text-sm text-gris-oscuro text-center">
                  {registro.diferenciaSalida}
                </td>
                <td className="sxs-only:px-1 sxs-only:py-2 xs-only:px-1 xs-only:py-2 sm-only:px-2 sm-only:py-3 md-only:px-2 md-only:py-3 lg-only:px-4 lg-only:py-3 xl-only:px-4 xl-only:py-3 text-center">
                  <span
                    className={`inline-block sxs-only:px-1 sxs-only:py-0.5 xs-only:px-1 xs-only:py-0.5 sm-only:px-2 sm-only:py-1 md-only:px-2 md-only:py-1 lg-only:px-2 lg-only:py-1 xl-only:px-2 xl-only:py-1 rounded-full sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs font-medium ${
                      EstadosAsistenciaPersonalStyles[registro.estadoSalida]
                    }`}
                  >
                    {mapearEstadoParaUI(registro.estadoSalida)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TablaRegistrosAsistencia;
