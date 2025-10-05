// components/AsistenciaLeyendaDrawer.tsx
"use client";

import { EstadosAsistenciaEscolar } from "@/interfaces/shared/EstadosAsistenciaEstudiantes";
import { COLORES_ESTADOS_ASISTENCIA_ESCOLAR } from "../../../app/(interfaz)/(responsable)/mis-estudiantes-relacionados/[Id_Estudiante]/asistencias-mensuales/types";
import { AsistenciaProcessor } from "../../../lib/utils/asistencia/AsistenciasEscolaresProcessor";

interface AsistenciaEscolarLeyendaDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  mostrarSalida?: boolean;
}

const AsistenciaEscolarLeyendaDrawer = ({
  isOpen,
  onClose,
  mostrarSalida = false,
}: AsistenciaEscolarLeyendaDrawerProps) => {
  if (!isOpen) return null;

  const estadosInfo = [
    {
      estado: EstadosAsistenciaEscolar.Temprano,
      titulo: "Asistencia Puntual",
      descripcion: "Llegó a tiempo o temprano",
      tipo: "Manual",
    },
    {
      estado: EstadosAsistenciaEscolar.Tarde,
      titulo: "Tardanza",
      descripcion: "Llegó después del horario establecido",
      tipo: "Manual",
    },
    {
      estado: EstadosAsistenciaEscolar.Falta,
      titulo: "Falta",
      descripcion: "No asistió al colegio",
      tipo: "Manual",
    },
    {
      estado: EstadosAsistenciaEscolar.Inactivo,
      titulo: "Matriculado pero inactivo",
      descripcion: "Estudiante matriculado pero no asistió desde el inicio",
      tipo: "Automático",
    },
    {
      estado: EstadosAsistenciaEscolar.Evento,
      titulo: "Evento Especial",
      descripcion: "Feriado, celebración institucional, etc.",
      tipo: "Automático",
    },
    {
      estado: EstadosAsistenciaEscolar.Vacaciones,
      titulo: "Vacaciones",
      descripcion: "Período de vacaciones escolares",
      tipo: "Automático",
    },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-[2000] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="animate__animated animate__bounceInRight duration-500 fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-[2000] transform transition-transform overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-4 sticky top-0">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-bold sxs-only:text-base xs-only:text-base">
              LEYENDA DE ASISTENCIAS
            </h2>
            <button
              onClick={onClose}
              className="text-white hover:text-gray-200 transition-colors p-1"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          {/* Estados de asistencia */}
          <div className="space-y-4 mb-6">
            <h3 className="text-md font-semibold text-gray-800 sxs-only:text-sm">
              Estados de Asistencia
            </h3>

            {estadosInfo.map((info) => {
              const colores = COLORES_ESTADOS_ASISTENCIA_ESCOLAR[info.estado];
              const texto = AsistenciaProcessor.obtenerTextoEstado(info.estado);

              return (
                <div key={info.estado} className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 sxs-only:w-8 sxs-only:h-8 ${colores.background} ${colores.text} rounded-lg flex items-center justify-center font-bold text-sm sxs-only:text-xs flex-shrink-0`}
                  >
                    {texto}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm sxs-only:text-xs text-gray-800">
                      {info.titulo}
                    </p>
                    <p className="text-xs sxs-only:text-[10px] text-gray-600 mt-1">
                      {info.descripcion}
                    </p>
                    <span
                      className={`inline-block mt-1 px-2 py-1 rounded-full text-[10px] sxs-only:text-[8px] font-medium ${
                        info.tipo === "Manual"
                          ? "bg-blue-100 text-blue-800"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {info.tipo}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Información sobre horarios */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <h4 className="font-semibold text-blue-800 mb-2 text-sm sxs-only:text-xs">
              Información Importante
            </h4>
            <ul className="text-xs sxs-only:text-[10px] text-blue-700 space-y-1">
              <li>• La tolerancia para tardanzas es de 5 minutos</li>
              <li>• Solo se muestran días escolares (Lunes a Viernes)</li>
              <li>• Los fines de semana no se registran asistencias</li>
              {mostrarSalida && (
                <li>• Se registra tanto entrada como salida</li>
              )}
              {!mostrarSalida && (
                <li>• Solo se registra la entrada al colegio</li>
              )}
            </ul>
          </div>

          {/* Información adicional */}
          {mostrarSalida && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-semibold text-green-800 mb-2 text-sm sxs-only:text-xs">
                Control de Entrada y Salida
              </h4>
              <p className="text-xs sxs-only:text-[10px] text-green-700">
                El sistema registra tanto la hora de entrada como la hora de
                salida. El estado del día se determina únicamente por la
                puntualidad de entrada.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors text-sm sxs-only:text-xs"
          >
            Cerrar Leyenda
          </button>
        </div>
      </div>
    </>
  );
};

export default AsistenciaEscolarLeyendaDrawer;
