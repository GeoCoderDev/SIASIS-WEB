/* eslint-disable @typescript-eslint/no-explicit-any */
import React from "react";
import { Download } from "lucide-react";
import FotoPerfilClientSide from "@/components/utils/photos/FotoPerfilClientSide";
import { mesesTextos, Meses } from "@/interfaces/shared/Meses";
import { RolesSistema } from "@/interfaces/shared/RolesSistema";
import { GenericUser } from "@/interfaces/shared/GenericUser";

interface InfoUsuarioAsistenciaProps {
  usuario: GenericUser;
  rolSeleccionado: RolesSistema;
  rolesDisponibles: Array<{ value: RolesSistema; label: string }>;
  mes: number;
  totalRegistros: number;
  exportandoExcel: boolean;
  onExportarExcel: () => void;
  puedeExportar: boolean;
  mostrarMensajeDias?: boolean;
  considerarDiasNoEscolares?: boolean;
}

const InfoUsuarioAsistencia: React.FC<InfoUsuarioAsistenciaProps> = ({
  usuario,
  rolSeleccionado,
  rolesDisponibles,
  mes,
  totalRegistros,
  exportandoExcel,
  onExportarExcel,
  puedeExportar,
  mostrarMensajeDias = true,
  considerarDiasNoEscolares = false,
}) => {
  // Obtener rol legible
  const rolLegible =
    rolesDisponibles.find((r) => r.value === rolSeleccionado)?.label ||
    rolSeleccionado;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 sxs-only:p-3 xs-only:p-3 sm-only:p-4 md-only:p-5 lg-only:p-5 xl-only:p-6 mb-4">
      <div className="flex sxs-only:flex-col xs-only:flex-col sm-only:flex-row md-only:flex-row lg-only:flex-row xl-only:flex-row sxs-only:space-y-3 xs-only:space-y-3 sm-only:space-y-0 md-only:space-y-0 lg-only:space-y-0 xl-only:space-y-0 sxs-only:items-center xs-only:items-center sm-only:items-center md-only:items-center lg-only:items-center xl-only:items-center sm-only:space-x-4 md-only:space-x-4 lg-only:space-x-5 xl-only:space-x-6">
        {/* Avatar con iniciales - Responsivo */}
        <div className="flex-shrink-0">
          {usuario.Google_Drive_Foto_ID ? (
            <FotoPerfilClientSide
              Google_Drive_Foto_ID={usuario.Google_Drive_Foto_ID}
              className="sxs-only:w-16 sxs-only:h-16 xs-only:w-16 xs-only:h-16 sm-only:w-18 sm-only:h-18 md-only:w-20 md-only:h-20 lg-only:w-20 lg-only:h-20 xl-only:w-24 xl-only:h-24 border-2 border-white rounded-full shadow-md"
            />
          ) : (
            <div className="sxs-only:w-16 sxs-only:h-16 xs-only:w-16 xs-only:h-16 sm-only:w-18 sm-only:h-18 md-only:w-20 md-only:h-20 lg-only:w-20 lg-only:h-20 xl-only:w-24 xl-only:h-24 bg-gradient-to-br from-green-500 to-green-600 rounded-full flex items-center justify-center text-white font-bold border-2 border-white shadow-md sxs-only:text-lg xs-only:text-lg sm-only:text-xl md-only:text-xl lg-only:text-2xl xl-only:text-2xl">
              <span className="tracking-wide">
                {usuario.Nombres?.charAt(0)}
                {usuario.Apellidos?.charAt(0)}
              </span>
            </div>
          )}
        </div>

        {/* Información del usuario - Responsivo */}
        <div className="flex-1 min-w-0 sxs-only:text-center xs-only:text-center sm-only:text-left md-only:text-left lg-only:text-left xl-only:text-left">
          <div className="flex sxs-only:flex-col sxs-only:items-center xs-only:flex-col xs-only:items-center sm-only:flex-row sm-only:items-center md-only:flex-row md-only:items-center lg-only:flex-row lg-only:items-center xl-only:flex-row xl-only:items-center sxs-only:gap-2 xs-only:gap-2 sm-only:gap-2.5 md-only:gap-2.5 lg-only:gap-2.5 xl-only:gap-3 sxs-only:mb-2 xs-only:mb-2 sm-only:mb-3 md-only:mb-3 lg-only:mb-3 xl-only:mb-3">
            <h3 className="sxs-only:text-base xs-only:text-base sm-only:text-lg md-only:text-lg lg-only:text-xl xl-only:text-xl font-bold text-gray-900 truncate">
              {usuario.Nombres} {usuario.Apellidos}
            </h3>
            <span className="inline-flex items-center sxs-only:px-2 sxs-only:py-0.5 xs-only:px-2 xs-only:py-0.5 sm-only:px-2.5 sm-only:py-0.5 md-only:px-2.5 md-only:py-0.5 lg-only:px-2.5 lg-only:py-0.5 xl-only:px-3 xl-only:py-1 rounded-lg sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-sm font-semibold bg-blue-100 text-blue-800 flex-shrink-0 border border-blue-300">
              {rolLegible}
            </span>
          </div>

          {/* Datos en formato responsivo */}
          <div className="flex sxs-only:flex-col sxs-only:items-center sxs-only:gap-1.5 xs-only:flex-col xs-only:items-center xs-only:gap-1.5 sm-only:flex-wrap sm-only:items-center sm-only:gap-x-4 sm-only:gap-y-1 md-only:flex-wrap md-only:items-center md-only:gap-x-5 md-only:gap-y-2 lg-only:flex-wrap lg-only:items-center lg-only:gap-x-6 lg-only:gap-y-2 xl-only:flex-wrap xl-only:items-center xl-only:gap-x-6 xl-only:gap-y-2 sxs-only:text-xs xs-only:text-xs sm-only:text-xs md-only:text-xs lg-only:text-xs xl-only:text-sm text-gray-600 sxs-only:mb-2 xs-only:mb-2 sm-only:mb-3 md-only:mb-3 lg-only:mb-3 xl-only:mb-3">
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-gray-700 flex-shrink-0">
                DNI:
              </span>
              <span className="font-medium text-gray-900">
                {usuario.DNI_Directivo ?? usuario.ID_O_DNI_Usuario}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-gray-700 flex-shrink-0">
                Mes:
              </span>
              <span className="font-medium text-gray-900">
                {mesesTextos[mes as Meses]}
              </span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-gray-700 flex-shrink-0">
                Registros:
              </span>
              <span className="font-medium text-gray-900">
                {totalRegistros}
              </span>
            </div>

            {/* Mensaje de días laborables */}
            {mostrarMensajeDias && (
              <div className="sxs-only:col-span-full xs-only:col-span-full sm-only:flex-basis-full md-only:flex-basis-full lg-only:flex-basis-full xl-only:flex-basis-full">
                <p className="text-xs text-gray-600 italic">
                  {considerarDiasNoEscolares
                    ? "📅 Incluye todos los días hasta la fecha actual"
                    : "📅 Solo días laborables hasta la fecha actual"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Botón de exportar - Responsivo */}
        <div className="flex-shrink-0 sxs-only:w-full xs-only:w-full sm-only:w-auto md-only:w-auto lg-only:w-auto xl-only:w-auto">
          <button
            onClick={onExportarExcel}
            disabled={exportandoExcel || !puedeExportar}
            title={
              !puedeExportar
                ? "Realiza una búsqueda para exportar datos"
                : "Exportar a Excel"
            }
            className={`sxs-only:w-full sxs-only:px-4 sxs-only:py-2.5 xs-only:w-full xs-only:px-4 xs-only:py-2.5 sm-only:px-4 sm-only:py-2.5 md-only:px-4 md-only:py-3 lg-only:px-5 lg-only:py-3 xl-only:px-5 xl-only:py-3 rounded-lg font-medium sxs-only:text-sm xs-only:text-sm sm-only:text-sm md-only:text-sm lg-only:text-sm xl-only:text-sm transition-all duration-200 flex items-center justify-center space-x-2.5 sxs-only:min-w-full xs-only:min-w-full sm-only:min-w-[120px] md-only:min-w-[130px] lg-only:min-w-[135px] xl-only:min-w-[140px] shadow-sm hover:shadow-md ${
              exportandoExcel || !puedeExportar
                ? "bg-gray-100 text-gray-400 cursor-not-allowed border border-gray-300"
                : "bg-white border border-gray-300 hover:border-green-400 hover:bg-green-50 text-gray-700 hover:text-green-700"
            }`}
          >
            {exportandoExcel ? (
              <>
                <Download className="sxs-only:w-4 xs-only:w-4 sm-only:w-5 md-only:w-6 lg-only:w-6 xl-only:w-6 flex-shrink-0 animate-bounce" />
                <span className="truncate">Generando...</span>
              </>
            ) : (
              <>
                <img
                  className="sxs-only:w-4 xs-only:w-4 sm-only:w-5 md-only:w-6 lg-only:w-6 xl-only:w-6 flex-shrink-0"
                  src="/images/svg/Aplicaciones Relacionadas/ExcelLogo.svg"
                  alt="Logo de Excel"
                />
                <span className="truncate">
                  {!puedeExportar ? "Sin datos" : "Exportar"}
                </span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default InfoUsuarioAsistencia;
