import React from "react";
import { T_Estudiantes, T_Aulas } from "@prisma/client";
import FotoPerfilClientSide from "../utils/photos/FotoPerfilClientSide";

interface EstudianteSecundariaParaTomaAsistenciaCardProps {
  estudiante: T_Estudiantes;
  aulaSeleccionada: T_Aulas | null;
  onMarcarAsistencia: (estudiante: T_Estudiantes) => void;
  yaRegistrado?: boolean; // Para mostrar si ya fue registrado
  className?: string;
}

const EstudianteSecundariaParaTomaAsistenciaCard: React.FC<
  EstudianteSecundariaParaTomaAsistenciaCardProps
> = ({
  estudiante,
  aulaSeleccionada,
  onMarcarAsistencia,
  yaRegistrado = false,
  className = "",
}) => {
  return (
    <div
      className={`border rounded-lg p-4 hover:shadow-md transition-all duration-200 ${
        yaRegistrado
          ? "bg-green-50 border-green-200"
          : "bg-white hover:bg-gray-50"
      } ${className}`}
      style={{
        borderLeftWidth: "4px",
        borderLeftColor: aulaSeleccionada?.Color || "#gray",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center flex-1 min-w-0">
          {/* Foto del estudiante */}
          <div className="w-10 h-10 rounded-full bg-gray-300 flex-shrink-0 mr-3 flex items-center justify-center overflow-hidden">
            <FotoPerfilClientSide
              className="w-full h-full object-cover"
              Google_Drive_Foto_ID={estudiante.Google_Drive_Foto_ID}
            />
          </div>

          {/* Información del estudiante */}
          <div className="min-w-0 flex-1">
            <p className="font-medium text-gray-900 truncate text-sm">
              {estudiante.Nombres} {estudiante.Apellidos}
            </p>
            <p className="text-xs text-gray-500 truncate">
              ID: {estudiante.Id_Estudiante}
            </p>
            {aulaSeleccionada && (
              <p className="text-xs text-gray-400 truncate">
                {aulaSeleccionada.Grado}° "{aulaSeleccionada.Seccion}"
              </p>
            )}
          </div>
        </div>

        {/* Botón de acción */}
        <button
          onClick={() => onMarcarAsistencia(estudiante)}
          disabled={yaRegistrado}
          className={`ml-3 px-3 py-1 rounded text-xs font-medium transition-colors flex-shrink-0 ${
            yaRegistrado
              ? "bg-green-100 text-green-700 cursor-not-allowed"
              : "bg-green-500 text-white hover:bg-green-600 active:bg-green-700"
          }`}
          title={yaRegistrado ? "Ya registrado" : "Marcar asistencia"}
        >
          {yaRegistrado ? "✓ Registrado" : "✓ Marcar"}
        </button>
      </div>
    </div>
  );
};

export default EstudianteSecundariaParaTomaAsistenciaCard;
