/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Loader2, AlertCircle, CheckCircle, Download } from "lucide-react";
import { ErrorResponseAPIBase } from "@/interfaces/shared/apis/types";
import { ENTORNO } from "@/constants/ENTORNO";
import { Entorno } from "@/interfaces/shared/Entornos";

interface MensajesEstadoAsistenciaProps {
  loading: boolean;
  loadingEventos: boolean;
  exportandoExcel: boolean;
  error: ErrorResponseAPIBase | null;
  successMessage: string;
  considerarDiasNoEscolares?: boolean;
}

const MensajesEstadoAsistencia: React.FC<MensajesEstadoAsistenciaProps> = ({
  loading,
  loadingEventos,
  exportandoExcel,
  error,
  successMessage,
  considerarDiasNoEscolares = false,
}) => {
  return (
    <div className="space-y-3">
      {/* Banner de desarrollo si está activado */}
      {considerarDiasNoEscolares && ENTORNO === Entorno.LOCAL && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg sxs-only:p-2 xs-only:p-2 sm-only:p-3 md-only:p-3 lg-only:p-3 xl-only:p-3">
          <div className="flex items-start space-x-2">
            <AlertCircle className="sxs-only:w-3 sxs-only:h-3 xs-only:w-4 xs-only:h-4 sm-only:w-4 sm-only:h-4 md-only:w-4 md-only:h-4 lg-only:w-4 lg-only:h-4 xl-only:w-4 xl-only:h-4 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 sxs-only:text-xs xs-only:text-xs sm-only:text-sm md-only:text-sm lg-only:text-sm xl-only:text-sm">
                Modo Desarrollo Activado
              </p>
              <p className="text-amber-700 mt-1 sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs">
                Se están mostrando registros de todos los días (incluidos
                sábados y domingos). Para producción, cambiar
                CONSIDERAR_DIAS_NO_ESCOLARES a false.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Indicadores de estado */}
      {(loading || loadingEventos) && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg sxs-only:p-2 xs-only:p-2 sm-only:p-3 md-only:p-3 lg-only:p-3 xl-only:p-3">
          <div className="flex items-center">
            <Loader2 className="animate-spin sxs-only:h-3 sxs-only:w-3 xs-only:h-3 xs-only:w-3 sm-only:h-4 sm-only:w-4 md-only:h-4 md-only:w-4 lg-only:h-4 lg-only:w-4 xl-only:h-4 xl-only:w-4 text-blue-500 mr-2 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-blue-700 font-semibold truncate sxs-only:text-xs xs-only:text-xs sm-only:text-sm md-only:text-sm lg-only:text-sm xl-only:text-sm">
                Consultando registros de asistencia...
              </p>
              <p className="text-blue-600 truncate sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs">
                Esto puede tomar unos segundos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje informativo sobre exportación */}
      {exportandoExcel && ENTORNO !== Entorno.PRODUCCION && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg sxs-only:p-2 xs-only:p-2 sm-only:p-3 md-only:p-3 lg-only:p-3 xl-only:p-3">
          <div className="flex items-center">
            <Download className="animate-bounce sxs-only:h-3 sxs-only:w-3 xs-only:h-3 xs-only:w-3 sm-only:h-4 sm-only:w-4 md-only:h-4 md-only:w-4 lg-only:h-4 lg-only:w-4 xl-only:h-4 xl-only:w-4 text-green-500 mr-2 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-green-700 font-semibold truncate sxs-only:text-xs xs-only:text-xs sm-only:text-sm md-only:text-sm lg-only:text-sm xl-only:text-sm">
                Generando archivo Excel...
              </p>
              <p className="text-green-600 truncate sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-xs">
                Esto puede tomar unos segundos
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mensaje de error */}
      {error && (
        <div className="bg-gradient-to-r from-red-50 to-pink-50 border border-red-200 rounded-lg sxs-only:p-2 xs-only:p-2 sm-only:p-3 md-only:p-3 lg-only:p-3 xl-only:p-3">
          <div className="flex items-center">
            <AlertCircle className="sxs-only:w-3 sxs-only:h-3 xs-only:w-4 xs-only:h-4 sm-only:w-4 sm-only:h-4 md-only:w-4 md-only:h-4 lg-only:w-4 lg-only:h-4 xl-only:w-4 xl-only:h-4 text-red-500 mr-2 flex-shrink-0" />
            <p className="text-red-700 font-medium truncate min-w-0 flex-1 sxs-only:text-xs xs-only:text-xs sm-only:text-sm md-only:text-sm lg-only:text-sm xl-only:text-sm">
              {error.message}
            </p>
          </div>
        </div>
      )}

      {/* Mensaje de éxito */}
      {successMessage && ENTORNO !== Entorno.PRODUCCION && (
        <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg sxs-only:p-2 xs-only:p-2 sm-only:p-3 md-only:p-3 lg-only:p-3 xl-only:p-3 max-w-full">
          <div className="flex items-center">
            <CheckCircle className="sxs-only:w-3 sxs-only:h-3 xs-only:w-4 xs-only:h-4 sm-only:w-4 sm-only:h-4 md-only:w-4 md-only:h-4 lg-only:w-4 lg-only:h-4 xl-only:w-4 xl-only:h-4 text-green-500 mr-2 flex-shrink-0 max-w-full" />
            <p className="text-wrap break-words wrap text-green-700 font-medium truncate min-w-0 flex-1 sxs-only:text-xs xs-only:text-xs sm-only:text-sm md-only:text-sm lg-only:text-sm xl-only:text-sm max-w-full">
              {successMessage}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default MensajesEstadoAsistencia;
